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
        max_tokens: 1024,
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
      // TODO(F.015): real prompt + the §9.4 post-generation guardrail check.
      // claude-haiku-4-5 for the text-only call (TECH-DECISIONS.md).
      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Parent noticed: ${body.whatNoticed}. First noticed at: ${body.whenNoticed}. Looks like: ${body.whatItLooksLike}. Child age in months: ${body.childAgeMonths}.`,
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
