// Real StoryGenPort adapter (F.022 redesign — Game 2 generative story
// sequencing). TECH-DECISIONS.md's "Object recognition" entry documents the
// model split this follows: the vision call that actually reads a photo
// uses claude-sonnet-5; every other, text-only generation call (this one,
// and F.015's Branch 2 card) uses claude-haiku-4-5. See api/claude.ts's
// `kind: 'story'` branch for the actual model call.
//
// Like every other real adapter, this file never imports @anthropic-ai/sdk
// or holds an API key — it calls the one serverless proxy (api/claude.ts)
// over fetch(), same as claudeVision.ts and haikuCard.ts. See
// ARCHITECTURE-RULES.md "Hosting is swappable too".
//
// ⚠ VERIFICATION STATUS: same caveat as claudeVision.ts — the network half
// of this file isn't exercised by `npm run smoke` (no running instance of
// api/claude.ts in this sandbox to call). What IS verified with fabricated
// response text is the parsing/validation it depends on
// (storyParsing.ts's parseStoryResponse) — see scripts/smoke-f022.ts.
// scripts/verify-story-live.ts makes one real, paid call to check the
// prompt below against an actual model response; it's written but
// deliberately NOT run automatically, same as verify-vision-live.ts.

import type { AttentionSpanAnswer, CommunicationAnswer, SamenessAnswer } from '../../types';
import type { DetectedObjectForStory, GeneratedStoryTemplate, StoryGenPort } from '../ports';
import { parseStoryResponse } from './storyParsing';

// Structurally typed rather than relying on the ambient `ImportMetaEnv`
// augmentation from vite/client — mirrors haikuCard.ts's apiBaseUrl(),
// needed for the same reason: this file is transitively importable from
// scripts/*.ts (via adapters/registry), whose tsconfig doesn't load
// vite/client's types.
function apiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_API_BASE_URL ?? '/api';
}

/**
 * The exact instruction the proxy (api/claude.ts) sends to Claude for a
 * `kind: 'story'` request, alongside a data block (built server-side) that
 * lists the detected objects and the child's age/sameness preference.
 * Defined here for the same reason VISION_PROMPT is defined in
 * claudeVision.ts: documentation, and a source of truth for
 * verify-story-live.ts's real, paid, manual verification call.
 *
 * Deliberately NOT sent as part of the client's request body below — the
 * proxy owns and hardcodes its own copy of this exact string server-side
 * (api/claude.ts's `kind === 'story'` branch), rather than trusting
 * arbitrary prompt text from the browser. Keep the two copies byte-for-byte
 * identical if either changes.
 */
export const STORY_PROMPT = `You are a warm, playful children's storyteller inventing a short daily-routine story for a young child, using ONLY the real objects listed above (already detected in a photo of the child's own room).

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

/** Extracts the text Claude actually said from the proxy's `{content}`
 * passthrough of the Anthropic Messages API response shape. Same shape as
 * claudeVision.ts's extractResponseText -- duplicated rather than shared
 * because each real adapter owns its own tiny slice of this glue, same as
 * the rest of adapters/**. */
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

export function createClaudeStory(): StoryGenPort {
  return {
    async generateStory(input: {
      objects: DetectedObjectForStory[];
      childAgeMonths: number;
      sameness?: SamenessAnswer;
      attentionSpan?: AttentionSpanAnswer;
      communication?: CommunicationAnswer;
      stepCount?: number;
      avoidedColour?: string;
      avoidedTerms?: string[];
      perspective?: 'companion' | 'child';
    }): Promise<GeneratedStoryTemplate> {
      const res = await fetch(`${apiBaseUrl()}/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'story',
          objects: input.objects,
          childAgeMonths: input.childAgeMonths,
          sameness: input.sameness,
          attentionSpan: input.attentionSpan,
          communication: input.communication,
          stepCount: input.stepCount,
          avoidedColour: input.avoidedColour,
          avoidedTerms: input.avoidedTerms,
          perspective: input.perspective,
        }),
      });
      if (!res.ok) {
        throw new Error(`Story generation request failed: ${res.status} ${res.statusText}`);
      }
      const body: unknown = await res.json();
      const content = (body as { content?: unknown }).content;
      const text = extractResponseText(content);
      // Same clamp the proxy applies server-side (api/claude.ts) -- kept
      // in sync here too so a mismatched client-side clamp can never
      // cause this validation to reject a response the proxy's prompt
      // correctly asked for.
      const expectedStepCount = input.stepCount
        ? Math.min(Math.max(Math.round(input.stepCount), 2), 4, input.objects.length)
        : undefined;
      return parseStoryResponse(text, input.objects, expectedStepCount);
    },
  };
}
