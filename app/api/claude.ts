// The one server-side function in this app. Holds the Anthropic API key.
// See plan/engineering/ARCHITECTURE-RULES.md "Hosting is swappable too" and
// plan/engineering/TECH-DECISIONS.md "Hosting & secrets".
//
// Vercel-style handler signature (req, res). If the team lands on a
// different host, only this file's export shape changes — nothing in
// src/adapters/** needs to know or care.
//
// DO NOT let this grow scope. It proxies exactly two things:
//   - vision: object recognition on a redacted room/Companion photo (F.006)
//   - card: Branch 2 question-card generation (F.015)
// Both the model choice and the request shape are decided in
// plan/engineering/TECH-DECISIONS.md — don't relitigate them here.

import Anthropic from '@anthropic-ai/sdk';
import { buildObservationSystemPrompt, buildObservationUserPrompt } from '../src/engine/branch2Card';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type VisionRequest = { kind: 'vision'; imageBase64: string; mediaType: string };
type CardRequest = {
  kind: 'card';
  whatNoticed: string;
  whenNoticed: string;
  whatItLooksLike: string;
  childAgeMonths: number;
};

type ProxyRequest = VisionRequest | CardRequest;

// Minimal req/res typing so this compiles without pulling in a host-specific
// SDK (that would itself violate the "no hosting SDK in src/" rule — this
// file lives in api/, outside src/, precisely so the proxy boundary is clear).
interface ProxyReq {
  method?: string;
  body: ProxyRequest;
}
interface ProxyRes {
  status(code: number): ProxyRes;
  json(body: unknown): void;
}

export default async function handler(req: ProxyReq, res: ProxyRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const body = req.body;

  try {
    if (body.kind === 'vision') {
      // F.006 — real prompt asking for objects present, tagged
      // {name, colour, category, function, bbox}. claude-sonnet-5 — this
      // is the one call that reads a photo (TECH-DECISIONS.md).
      //
      // This text is intentionally hardcoded server-side, not taken from
      // the request body — see src/adapters/vision/claudeVision.ts's
      // VISION_PROMPT constant for the full "why", and keep the two
      // byte-for-byte identical if either changes. api/ cannot import from
      // src/ (separate deploy target — see ARCHITECTURE-RULES.md "Hosting
      // is swappable too"), so this is a deliberate, necessary duplicate.
      const VISION_PROMPT = `List the physical objects in this photo that a 3-5 year old child could safely go and fetch on their own.

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

      const message = await client.messages.create({
        model: 'claude-sonnet-5',
        // NOT 1024. A busy child's bedroom really does return 15+ objects,
        // and at ~45 JSON tokens each that overran the old cap, truncating
        // the array mid-object. The client's parse then threw, the pipeline
        // mapped it to no-objects-found, and the caregiver was told nothing
        // in their photo was safe to fetch — for a photo full of toys.
        // max_tokens is a ceiling, not a reservation: unused headroom costs
        // nothing, so this is priced the same and simply cannot truncate.
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: body.mediaType as
                    | 'image/jpeg'
                    | 'image/png'
                    | 'image/gif'
                    | 'image/webp',
                  data: body.imageBase64,
                },
              },
              { type: 'text', text: VISION_PROMPT },
            ],
          },
        ],
      });
      // stop_reason travels with the response so the client can tell a
      // TRUNCATED list ("max_tokens") apart from a genuinely empty one —
      // they are indistinguishable from the parsed JSON alone, and they
      // mean opposite things to the caregiver.
      res.status(200).json({ content: message.content, stop_reason: message.stop_reason });
      return;
    }

    if (body.kind === 'card') {
      // F.015: claude-haiku-4-5 (TECH-DECISIONS.md), constrained to
      // generating ONLY the observation paragraph -- the fixed header and
      // the three fixed questions are never model output (see
      // src/engine/branch2Card.ts). The §9.4 guardrail itself runs
      // CLIENT-SIDE, in src/adapters/textgen/haikuCard.ts, per the
      // TextGenPort doc comment in src/adapters/ports.ts -- this endpoint's
      // only job is the model call.
      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        system: buildObservationSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildObservationUserPrompt({
              whatNoticed: body.whatNoticed,
              whenNoticed: body.whenNoticed,
              whatItLooksLike: body.whatItLooksLike,
              childAgeMonths: body.childAgeMonths,
            }),
          },
        ],
      });
      const observation = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
      res.status(200).json({ observation });
      return;
    }

    res.status(400).json({ error: 'unknown request kind' });
  } catch (err) {
    res.status(502).json({ error: 'upstream call failed', detail: String(err) });
  }
}
