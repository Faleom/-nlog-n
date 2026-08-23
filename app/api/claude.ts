// The one server-side function in this app. Holds the Anthropic API key.
// See plan/engineering/ARCHITECTURE-RULES.md "Hosting is swappable too" and
// plan/engineering/TECH-DECISIONS.md "Hosting & secrets".
//
// Vercel-style handler signature (req, res). If the team lands on a
// different host, only this file's export shape changes — nothing in
// src/adapters/** needs to know or care.
//
// DO NOT let this grow scope. It proxies exactly three things:
//   - vision: object recognition on a redacted room/Companion photo (F.006)
//   - card: Branch 2 question-card generation (F.015)
//   - story: Game 2 generative story sequencing (F.022 redesign)
// Model choice and request shape for vision/card are decided in
// plan/engineering/TECH-DECISIONS.md — don't relitigate them here. `story`
// follows that same established split (see the comment above its branch
// below): claude-haiku-4-5, matching `card` — Sonnet stays reserved for the
// one call that actually reads a photo.

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
type StoryObjectInput = { name: string; colour: string; category: string; function: string };
type StoryRequest = {
  kind: 'story';
  objects: StoryObjectInput[];
  childAgeMonths: number;
  sameness?: 'sameness-helps' | 'somewhat' | 'variety';
  /** Caregiver-chosen exact step count, if they picked one on Game 2's
   * idle screen. Clamped server-side to [2, 4] and to objects.length --
   * never trust a client-sent number blindly into the prompt. */
  stepCount?: number;
  /** §6.2/§6.4 hard exclusion -- the child's avoid list, if set. The
   * caller has already excluded any matching OBJECT from `objects`; this
   * is the second layer, telling the model not to use these words in its
   * own incidental descriptive language either. */
  avoidedColour?: string;
  avoidedTerms?: string[];
  /** Who the story is about -- see StoryGenPort's doc comment in
   * src/adapters/ports.ts. 'companion' (or omitted) is the default. */
  perspective?: 'companion' | 'child';
};

type ProxyRequest = VisionRequest | CardRequest | StoryRequest;

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
      const VISION_PROMPT = `List the distinct physical household objects visible in this photo.

Return ONLY a JSON array (no prose, no markdown fences) where each entry has exactly this shape:
{"name": string, "colour": string, "category": string, "function": string, "bbox": {"x": number, "y": number, "width": number, "height": number}}

- "name": a short, concrete noun a young child would use for it (e.g. "cup", "ball", "shoe").
- "colour": its single most obvious colour, as one plain word.
- "category": a broad kind (e.g. "drinkware", "toy", "clothing", "furniture").
- "function": a short phrase completing "you ___ it" (e.g. "drink from", "play with", "wear").
- "bbox": a tight pixel bounding box in THIS image's own coordinates (top-left origin, x/y/width/height in pixels of this exact image, not normalised 0-1).

Only include objects a preschooler could recognise and go find in a room. Never include a person, a body part, or anything that looks like a person, even blurred or partial. If you see nothing usable, return [].`;

      const message = await client.messages.create({
        model: 'claude-sonnet-5',
        // A busy real room can easily have 10-15+ objects, each entry
        // costing ~30-50 tokens (name/colour/category/a full "function"
        // phrase/bbox). 1024 was cutting real responses off mid-array --
        // no closing ']', which is exactly "No JSON array found in vision
        // response" downstream in visionParsing.ts. 4096 gives real rooms
        // headroom without meaningfully changing cost (output tokens are
        // billed for what's actually used, not the ceiling).
        max_tokens: 4096,
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
      res.status(200).json({ content: message.content });
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

    if (body.kind === 'story') {
      // F.022 redesign — Game 2's generative story sequencing. Text-only
      // generation, so this follows TECH-DECISIONS.md's "Object
      // recognition" split the same way `card` above already does:
      // claude-sonnet-5 is reserved for the one call that reads a photo;
      // every other generation call (this one, `card`) is
      // claude-haiku-4-5.
      //
      // This text is intentionally hardcoded server-side, not taken from
      // the request body — same reasoning as VISION_PROMPT above: see
      // src/adapters/story/claudeStory.ts's STORY_PROMPT constant, which
      // documents the full "why" and must stay byte-for-byte identical to
      // the literal below. api/ lives outside src/ (a separate deploy
      // target — see ARCHITECTURE-RULES.md "Hosting is swappable too"), so
      // this is a deliberate, necessary duplicate rather than an import.
      const STORY_PROMPT = `You are a warm, playful children's storyteller inventing a short daily-routine story for a young child, using ONLY the real objects listed above (already detected in a photo of the child's own room).

Return ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{"steps": [{"sentence": string, "objectRef": string}, ...]}

- "steps" must have between 2 and 4 entries.
- "objectRef" must be exactly one of the object names listed above, spelled exactly as given there.
- "sentence" is one short routine step, e.g. "{companion} climbs into the warm, bubbly bath." Always use the literal placeholder text "{companion}" (including the curly braces) as the subject of every sentence -- never substitute a real name, a pronoun, or any other word in its place. This placeholder is filled in later by the app, not by you.
- Never start a sentence with an ordinal word or numbering of any kind -- no "First —", "Then —", "Next —", "Last —", no "1.", nothing. The app numbers and orders the steps itself; your sentence should read as a plain, self-contained moment on its own (start directly with the subject, e.g. "{companion} climbs into...").
- Give it a little warmth and personality -- a small, cozy moment your {companion} character is having, not a flat instruction list. One vivid, concrete, sensory word or small detail per sentence is enough (a texture, a sound, a feeling) -- still simple, short, and easy for a young child to follow. Never add drama, tension, or anything that isn't calm and reassuring.
- Steps must be in a real, physically sensible order: the order the step would actually happen in real life (for example, shoes go on BEFORE going out the door, not after; getting in the bath happens BEFORE getting dried off, not after) -- reflected in the ARRAY ORDER you return them in, never stated in the text itself.
- Only invent a routine that plausibly fits the objects given. If the objects don't obviously suggest one clear routine, still produce your single best plausible 2-4 step guess using some of them -- never refuse and never return an empty list.

Example 1 -- objects include "bath", "duck", "towel":
{"steps": [
  {"sentence": "{companion} climbs into the warm, bubbly bath.", "objectRef": "bath"},
  {"sentence": "{companion} splashes and plays with the squeaky duck.", "objectRef": "duck"},
  {"sentence": "{companion} gets wrapped up snug in the soft towel.", "objectRef": "towel"}
]}

Example 2 -- objects include "shoes", "backpack", "door":
{"steps": [
  {"sentence": "{companion} pulls on both comfy shoes.", "objectRef": "shoes"},
  {"sentence": "{companion} swings the backpack on, ready for adventure.", "objectRef": "backpack"},
  {"sentence": "{companion} heads out through the door.", "objectRef": "door"}
]}`;

      // Never trust a client-sent number into the prompt unclamped -- a
      // caregiver-picked step count is still bounded to the same [2, 4]
      // range STORY_PROMPT's own instructions describe, and can never
      // exceed how many real objects actually exist.
      const clampedStepCount = body.stepCount
        ? Math.min(Math.max(Math.round(body.stepCount), 2), 4, body.objects.length)
        : undefined;

      // §6.2/§6.4 hard exclusion. The caller has already removed any
      // matching OBJECT from the list above -- this second instruction
      // covers the model's own incidental descriptive language (a vivid
      // sentence can use a word that isn't any object's name).
      const avoidTerms = [
        ...(body.avoidedColour ? [body.avoidedColour] : []),
        ...(body.avoidedTerms ?? []),
      ].filter((t) => t.trim().length > 0);

      // Default is the {companion} character every other slot-filled line
      // in this app uses. 'child' overrides that entirely -- some children
      // don't relate to a third-person friend/companion framing, so the
      // caregiver can pick a mode where the story addresses the child
      // directly instead.
      const perspectiveOverride =
        body.perspective === 'child'
          ? `\n\nIMPORTANT OVERRIDE, replacing the "{companion}" instruction above: do NOT use the "{companion}" placeholder or reference any friend/companion character at all in this story. Instead, write every sentence in the second person, addressing the child directly as "You" (e.g. "You climb into the warm, bubbly bath."). Every sentence must start with "You" as its subject.`
          : '';

      const objectsText = `Detected objects (JSON array, each with name/colour/category/function -- use these exact "name" values for "objectRef"):
${JSON.stringify(body.objects)}

Child's age: ${body.childAgeMonths} months.${body.sameness ? ` This child's routine-preference profile is "${body.sameness}" -- if "sameness-helps", favour an especially familiar, ordinary routine.` : ''}${clampedStepCount ? `\n\nThe story must have EXACTLY ${clampedStepCount} steps -- not more, not fewer, overriding the "2 to 4" range in the instructions below.` : ''}${avoidTerms.length > 0 ? `\n\nHARD RULE, no exceptions: never use any of these words anywhere in the story, not even as incidental description or colour: ${avoidTerms.map((t) => `"${t}"`).join(', ')}. Write around them entirely.` : ''}${perspectiveOverride}`;

      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: objectsText },
              { type: 'text', text: STORY_PROMPT },
            ],
          },
        ],
      });
      res.status(200).json({ content: message.content });
      return;
    }

    res.status(400).json({ error: 'unknown request kind' });
  } catch (err) {
    res.status(502).json({ error: 'upstream call failed', detail: String(err) });
  }
}
