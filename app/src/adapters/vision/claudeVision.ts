// The real VisionPort (F.006). TECH-DECISIONS.md § Object recognition:
// "Claude vision, claude-sonnet-5, via the serverless proxy. One call per
// session. Returns objects tagged {name, colour, category, function,
// bbox}; the app cuts crops from the bboxes."
//
// This adapter NEVER imports @anthropic-ai/sdk or holds an API key — the
// key can't ship in the browser bundle (TECH-DECISIONS.md § Hosting &
// secrets: "anything in it is view-source public"). It calls the one
// serverless function (api/claude.ts) over fetch(), same as any other
// client of that proxy. See ARCHITECTURE-RULES.md "Hosting is swappable
// too".
//
// ⚠ VERIFICATION STATUS: the network+canvas glue in THIS file (the
// fetch() call itself, and cutting real crop images out of a real canvas)
// is not exercised by the automated smoke suite — there's no running
// instance of api/claude.ts in this sandbox to call (see PERSON-2's final
// report). What IS verified with a real, paid Anthropic API call is the
// prompt this file sends and the parsing it depends on
// (visionParsing.ts's parseVisionResponse) — see
// scripts/verify-vision-live.ts, run manually, not part of `npm run smoke`
// because it costs real money on every run.

import type { TaggedCrop } from '../../types';
import type { VisionPort, VisionResult } from '../ports';
import { DETECTION_MAX_LONG_EDGE, computeDownscaleFactor, scaledSize } from '../face/faceGeometry';
import { canvasToDataUrl, cropCanvas, dataUrlToBase64, drawScaled } from '../imaging/canvasUtils';
import { regionFromRawBbox, parseVisionResponse } from './visionParsing';

// Read via an untyped cast rather than `import.meta.env.VITE_API_BASE_URL`
// directly — the latter type-checks fine under `tsc -p tsconfig.app.json`
// (vite/client's ImportMeta augmentation, pulled in by src/vite-env.d.ts)
// but fails under this repo's composite `tsc -b` build with "Property
// 'env' does not exist on type 'ImportMeta'", an apparent cross-project
// ambient-global quirk unrelated to this file's own correctness — the
// same three files (importMeta.d.ts, client.d.ts, vite-env.d.ts) are
// confirmed present in `-b`'s own file list either way. `npm run build`
// runs `tsc -b`, so this file works around it rather than fighting it.
const API_BASE = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
  ?.VITE_API_BASE_URL ?? '/api') as string;

/**
 * The exact instruction the proxy (api/claude.ts) sends to Claude for a
 * `kind: 'vision'` request. Defined here, not inline in the fetch call,
 * because it needs to be reachable from THREE places that must never
 * drift apart: this adapter's own documentation, api/claude.ts's actual
 * server-side call (api/ can't import from src/, so that copy is
 * necessarily a literal duplicate — kept byte-for-byte identical on
 * purpose, see the comment there), and verify-vision-live.ts's real,
 * paid, manual verification call.
 *
 * Deliberately NOT sent as part of the client's request body — the proxy
 * owns and hardcodes its own prompt server-side rather than trusting
 * arbitrary prompt text from the browser, which would otherwise let any
 * caller of the public endpoint redirect the model to do something else
 * entirely on our API budget.
 *
 * Asks for STRICT JSON only, matching RawVisionObject's shape exactly, and
 * is explicit that bbox is pixel coordinates in THIS image (the one
 * actually sent, already downscaled) — see visionParsing.ts for how the
 * response is parsed and padded once it comes back.
 */
export const VISION_PROMPT = `List the physical objects in this photo that a 3-5 year old child could safely go and fetch on their own.

Return ONLY a JSON array (no prose, no markdown fences) where each entry has exactly this shape:
{"name": string, "colour": string, "category": string, "function": string, "bbox": {"x": number, "y": number, "width": number, "height": number}}

- "name": a short, concrete noun a young child would use for it (e.g. "cup", "ball", "shoe").
- "colour": its single most obvious colour, as one plain word.
- "category": a broad kind (e.g. "drinkware", "toy", "clothing", "textile").
- "function": a short phrase completing "you ___ it" (e.g. "drink from", "play with", "wear").
- "bbox": a tight pixel bounding box in THIS image's own coordinates (top-left origin, x/y/width/height in pixels of this exact image, not normalised 0-1).

Every object you return MUST pass ALL FIVE tests below. If it fails even one, leave it out entirely:

1. PORTABLE — a small child can pick it up and carry it in two hands. Exclude furniture (beds, sofas, tables, wardrobes, chairs), appliances, doors, windows, rugs and curtains.
2. REACHABLE — it rests on the floor or on low furniture, within reach of a child standing on their own two feet. Exclude anything mounted, fixed or up high: ceiling and wall lights, fans, air conditioners, power points, switches, wall art, curtain rails, and anything on a high shelf or on top of a wardrobe.
3. BIG ENOUGH TO SPOT — clearly visible from across the room. Exclude small items: coins, buttons, batteries, keys, jewellery, marbles, and anything small enough to fit in a toddler's mouth.
4. SAFE TO HANDLE — exclude anything sharp (knives, scissors, tools), hot or burning (kettles, irons, candles, heaters), electrical (cords, chargers, power banks, appliances), fragile enough to shatter (drinking glasses, mirrors, vases, ornaments, picture frames), or harmful if swallowed (medicine, cleaning products, batteries, small detachable parts).
5. NOT A PERSON — never include a person, a body part, or anything that looks like a person, even blurred or partial. A doll or a soft toy is fine.

Everyday tableware IS allowed and wanted: a child's cup, mug, plate, bowl or spoon all pass test 4. Exclude tableware only when it is clearly a glass drinking glass or a decorative ornament.

Look hard for the things a young child already knows by name: soft toys, balls, dolls, toy cars, building blocks, books, cups, bottles, bowls, shoes, socks, hats, bags, blankets, pillows, cushions and towels.

Return AT MOST 10 objects — pick the biggest, clearest and most distinct ones, and never list the same kind of thing twice (one ball, not four). Two or three genuine objects beat stretching to fill a quota.

If nothing in the photo passes all five tests, return [].`;

async function imageToTransmitPayload(image: ImageBitmap): Promise<{
  base64: string;
  mediaType: 'image/jpeg';
  sentCanvas: HTMLCanvasElement;
}> {
  const factor = computeDownscaleFactor(
    { width: image.width, height: image.height },
    DETECTION_MAX_LONG_EDGE,
  );
  const targetSize = scaledSize({ width: image.width, height: image.height }, factor);
  const sentCanvas = drawScaled(image, targetSize);
  const dataUrl = canvasToDataUrl(sentCanvas, 'image/jpeg', 0.85);
  return { base64: dataUrlToBase64(dataUrl), mediaType: 'image/jpeg', sentCanvas };
}

/** Extracts the text Claude actually said from the proxy's `{content}`
 * passthrough of the Anthropic Messages API response shape. */
function extractResponseText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((block): block is { type: string; text: string } => {
      return (
        typeof block === 'object' &&
        block !== null &&
        (block as Record<string, unknown>).type === 'text' &&
        typeof (block as Record<string, unknown>).text === 'string'
      );
    })
    .map((block) => block.text)
    .join('\n');
}

export function createClaudeVision(): VisionPort {
  return {
    async recognizeObjects(image: ImageBitmap): Promise<VisionResult> {
      const { base64, mediaType, sentCanvas } = await imageToTransmitPayload(image);

      const res = await fetch(`${API_BASE}/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'vision', imageBase64: base64, mediaType }),
      });
      if (!res.ok) {
        throw new Error(`Vision request failed: ${res.status} ${res.statusText}`);
      }
      const body: unknown = await res.json();
      const content = (body as { content?: unknown }).content;
      const text = extractResponseText(content);

      // A truncated list parses as garbage or as a short partial array —
      // either way it is a FAILURE, not "the room had nothing in it", and
      // the caregiver must not be told those are the same thing.
      if ((body as { stop_reason?: string }).stop_reason === 'max_tokens') {
        throw new Error(
          'Vision response was cut off by max_tokens — the object list is incomplete.',
        );
      }

      const rawObjects = parseVisionResponse(text);
      const imageSize = { width: sentCanvas.width, height: sentCanvas.height };

      const crops = rawObjects.map((obj, index) => {
        const region = regionFromRawBbox(obj.bbox, imageSize);
        const cropped = cropCanvas(sentCanvas, region);
        return {
          id: `vision-${index}-${obj.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: obj.name,
          colour: obj.colour,
          category: obj.category,
          function: obj.function,
          bbox: region,
          image: canvasToDataUrl(cropped),
        } satisfies TaggedCrop;
      });

      // The scene is `sentCanvas` itself — already redacted (the pipeline
      // guarantees that upstream) and already downscaled — because every
      // bbox above is in exactly this canvas's pixel space. Handing back a
      // differently-sized copy would misplace every marker drawn on it.
      return {
        crops,
        scene: {
          dataUrl: canvasToDataUrl(sentCanvas, 'image/jpeg', 0.8),
          width: sentCanvas.width,
          height: sentCanvas.height,
        },
      };
    },
  };
}
