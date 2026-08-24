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

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// F.015's two prompt-builders, duplicated from src/engine/branch2Card.ts
// rather than imported from it. api/ is a separate deploy target from
// src/ (see VISION_PROMPT's and STORY_PROMPT's comments below for the
// same rule already followed for the other two prompts) -- importing
// across that boundary isn't just a style rule, it actively breaks on
// Vercel: the function bundler doesn't trace a relative import that
// reaches outside api/, so the deployed function 500s on every request
// with ERR_MODULE_NOT_FOUND at cold start, before the handler even runs.
// Keep byte-for-byte identical to branch2Card.ts's originals.
function buildObservationSystemPrompt(): string {
  return [
    "You rewrite a parent's own words about their child's development into one",
    'short, clear, neutral paragraph, for a health worker.',
    '',
    'STRICT RULES:',
    '- Only rephrase what the parent literally said. Never add, infer, extend,',
    '  or "complete" anything they did not say.',
    '- Never name or imply any medical, developmental, or psychological condition.',
    '- Never use these words: delayed, disorder, risk, concerning, abnormal,',
    '  symptom, likely, probably, suggests.',
    '- Never state a severity, probability, or percentage of any kind.',
    '- Never recommend anything. Do not tell the parent what to do next --',
    '  that is handled elsewhere.',
    '- Output ONLY the rewritten paragraph. No greeting, no heading, no',
    '  questions, no bullet points, no extra commentary, no quotation marks.',
  ].join('\n');
}

function buildObservationUserPrompt(answers: {
  whatNoticed: string;
  whenNoticed: string;
  whatItLooksLike: string;
  childAgeMonths: number;
}): string {
  return [
    "Parent's own words:",
    `- What they noticed: "${answers.whatNoticed}"`,
    `- When they first noticed it: "${answers.whenNoticed}"`,
    `- What it looks like when it happens: "${answers.whatItLooksLike}"`,
    '',
    `Child's age: ${answers.childAgeMonths} months.`,
    '',
    'Rewrite this into one short, clear, neutral paragraph, following the strict rules exactly.',
  ].join('\n');
}

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
  /** §5.2's rule -- a response DIMENSION, never a condition label. Both
   * folded into the prompt as a plain, positive behavioural note (short
   * sentences, a shorter or longer story) -- see PLAIN_LANGUAGE_BY_* below,
   * never the raw enum value or any clinical-sounding term. */
  attentionSpan?: 'brief' | 'moderate' | 'sustained';
  communication?: 'not-with-words-yet' | 'single-words' | 'short-phrases' | 'full-sentences';
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
        // (Independently found and fixed by two people the same night --
        // this repo's own git log has both attempts; this is the merged,
        // more generous of the two.)
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
- "objectRef" must be exactly one of the object names listed above, spelled exactly as given there. EVERY STEP MUST USE A DIFFERENT OBJECT -- never reference the same object in two different steps, even if the story would naturally revisit it (e.g. never have one step about "the cushion" and a later step also about "the cushion", even worded differently). Each real object gets used at most once across the whole story.
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

      // §5.2: "tuning keys off response dimensions, not a condition
      // label" -- same rule as `sameness` above. Both maps write out a
      // plain, positive behavioural instruction; the model is never told
      // the raw answer value, a field name, or anything that reads as a
      // diagnosis. Only the values that actually call for different
      // phrasing than the model's own defaults get an entry -- 'moderate'
      // and 'full-sentences' are the ordinary case and add nothing.
      const ATTENTION_SPAN_NOTE: Record<string, string> = {
        brief: ' This child tends to engage best with shorter stories -- favour the shorter end of the 2-4 step range.',
        sustained: ' This child can happily follow a longer story -- the fuller end of the 2-4 step range works well here.',
      };
      const COMMUNICATION_NOTE: Record<string, string> = {
        'not-with-words-yet': ' This child is not yet using words to communicate -- keep every sentence very short and simple, using only concrete, everyday words a very young child would recognise.',
        'single-words': ' This child communicates mainly in single words -- keep sentences short and simple, favouring concrete, familiar words.',
        'short-phrases': ' This child communicates in short phrases -- keep sentences simple and not too long.',
      };

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

Child's age: ${body.childAgeMonths} months.${body.sameness ? ` This child's routine-preference profile is "${body.sameness}" -- if "sameness-helps", favour an especially familiar, ordinary routine.` : ''}${body.attentionSpan ? (ATTENTION_SPAN_NOTE[body.attentionSpan] ?? '') : ''}${body.communication ? (COMMUNICATION_NOTE[body.communication] ?? '') : ''}${clampedStepCount ? `\n\nThe story must have EXACTLY ${clampedStepCount} steps -- not more, not fewer, overriding the "2 to 4" range in the instructions below.` : ''}${avoidTerms.length > 0 ? `\n\nHARD RULE, no exceptions: never use any of these words anywhere in the story, not even as incidental description or colour: ${avoidTerms.map((t) => `"${t}"`).join(', ')}. Write around them entirely.` : ''}${perspectiveOverride}`;

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
