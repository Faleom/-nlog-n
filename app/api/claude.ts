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
      // TODO(F.006): real prompt asking for objects present, tagged
      // {name, colour, category, function, bbox}. claude-sonnet-5 — this
      // is the one call that reads a photo (TECH-DECISIONS.md).
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
              { type: 'text', text: 'List the household objects visible in this photo.' },
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

    res.status(400).json({ error: 'unknown request kind' });
  } catch (err) {
    res.status(502).json({ error: 'upstream call failed', detail: String(err) });
  }
}
