// Pure parsing/validation helpers for the ClaudeStory adapter (F.022
// redesign). Kept separate from claudeStory.ts (which does the actual
// network work) so the part most likely to break in the real world — "did
// the model's text response actually parse into a usable story" — is
// testable in Node with fabricated response text, no network required. See
// scripts/smoke-f022.ts and verify-story-live.ts (the real, paid, manual
// verification script). Same split, same reasoning, as
// adapters/vision/visionParsing.ts.
//
// Unlike visionParsing.ts's parseVisionResponse (which silently DROPS
// individually-bad entries and keeps the rest), parseStoryResponse here
// throws StoryGenerationFailedError on the FIRST validation problem it
// finds, for the whole response. A partially-broken story — say, three good
// steps and one that references an object nobody detected — is worse than
// falling back to the deterministic template generator entirely: it would
// look coherent right up until the child taps the blank that has no correct
// answer among the real crops. See StoryGenPort's doc comment in ../ports.ts
// and engine/game2Story.ts's getOrGenerateStory, which is what actually
// catches this throw and falls back.

import type { DetectedObjectForStory, GeneratedStoryTemplate, StoryStepTemplate } from '../ports';
import { StoryGenerationFailedError } from '../ports';

/**
 * Claude is asked for a JSON object and (per STORY_PROMPT) nothing else,
 * but text models occasionally wrap it in prose or a markdown code fence
 * anyway. This extracts the first plausible JSON object substring and
 * parses it, rather than assuming `response.trim()` is exactly the object.
 * Mirrors visionParsing.ts's extractJsonArray, just for a `{...}` object
 * instead of a `[...]` array.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Fast path: the whole response is already the object.
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to the tolerant path below
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new StoryGenerationFailedError('no JSON object found in story response');
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (err) {
    throw new StoryGenerationFailedError(
      `response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isRawStepShape(v: unknown): v is { sentence: string; objectRef: string } {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return isNonEmptyString(s.sentence) && isNonEmptyString(s.objectRef);
}

/**
 * Parses AND validates a raw Claude response body (the text content of the
 * message) against the exact `{objects}` list this generation request was
 * made for. Every check below throws `StoryGenerationFailedError` with a
 * reason string the instant it fails — see this file's header for why that's
 * strict rather than tolerant, unlike vision's parser.
 */
export function parseStoryResponse(
  text: string,
  objects: DetectedObjectForStory[],
  expectedStepCount?: number,
): GeneratedStoryTemplate {
  const parsed = extractJsonObject(text);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new StoryGenerationFailedError('response JSON is not an object');
  }
  const steps = (parsed as Record<string, unknown>).steps;
  if (!Array.isArray(steps)) {
    throw new StoryGenerationFailedError('response JSON has no "steps" array');
  }
  if (expectedStepCount !== undefined) {
    // A caregiver-chosen exact count -- the prompt asked for exactly this
    // many, so a response with a different count is itself a validation
    // failure (falls back to the template generator, which always
    // respects the count precisely, rather than silently accepting a
    // different one).
    if (steps.length !== expectedStepCount) {
      throw new StoryGenerationFailedError(`expected exactly ${expectedStepCount} steps, got ${steps.length}`);
    }
  } else if (steps.length < 2 || steps.length > 4) {
    throw new StoryGenerationFailedError(`expected 2-4 steps, got ${steps.length}`);
  }

  const knownNames = new Set(objects.map((o) => o.name.trim().toLowerCase()));
  // Every step must point at a DIFFERENT real object. Nothing above catches
  // this -- each objectRef is checked individually against knownNames, so a
  // story where two steps both say "cushion" passes validation cleanly.
  // The break only shows up later, at render time in Game2.tsx: resolving
  // the SECOND "cushion" step finds its real crop already claimed by the
  // first, and falls back to an unrelated generic swatch (a red or blue
  // square with no connection to that step's sentence at all) -- confirmed
  // the actual cause of that bug, not a rendering issue. Rejecting the
  // response here instead means a duplicate-object story never reaches the
  // screen at all; it falls back to the deterministic template generator,
  // which can't produce this by construction (it slices distinct objects).
  const seenRefs = new Set<string>();

  const result: StoryStepTemplate[] = steps.map((raw, i) => {
    if (!isRawStepShape(raw)) {
      throw new StoryGenerationFailedError(
        `step ${i} is missing a non-empty "sentence" or "objectRef"`,
      );
    }
    const normalizedRef = raw.objectRef.trim().toLowerCase();
    if (!knownNames.has(normalizedRef)) {
      throw new StoryGenerationFailedError(
        `step ${i}'s objectRef "${raw.objectRef}" does not match any detected object`,
      );
    }
    if (seenRefs.has(normalizedRef)) {
      throw new StoryGenerationFailedError(
        `step ${i}'s objectRef "${raw.objectRef}" is reused from an earlier step -- every step must reference a different object`,
      );
    }
    seenRefs.add(normalizedRef);
    return { sentence: raw.sentence, objectRef: raw.objectRef };
  });

  return { steps: result, source: 'real' };
}
