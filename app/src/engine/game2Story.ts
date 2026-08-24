// Game 2 — generative story sequencing (F.022 redesign, see
// CLAUDE_CODE_PROMPT_GAME2_REDESIGN.md). Replaces the old fixed
// anchor-template system in routineSequencing.ts: instead of picking one
// of a small set of hand-written routines, a live model call invents a
// short, physically-plausible 2-4 step story from whatever real objects
// were actually detected in the room photo.
//
// This file owns: the contract types shared between the port/adapter
// layer and Game2.tsx, the photo-content-hash cache key, and the
// orchestration that ties "try the real generator, fall back to a
// deterministic template on any failure, cache either result" together.
// It does NOT own the network call itself (that's
// adapters/story/claudeStory.ts) or the interaction UI (Game2.tsx).
//
// Caching contract, load-bearing for "sameness helps" profiles: only the
// STORY STRUCTURE is cached (sentences with slot tokens like {companion}
// still un-filled, plus which detected object each step refers to).
// Rendering — turning `{companion}` into the child's actual companion
// name — happens fresh every time via engine/slots.ts's renderLine, the
// same way routineSequencing.ts's old templates always worked. This means
// a cached story replays byte-identical across sessions (same photo -> same
// structure -> same steps every time) while still reflecting a profile
// edited *after* the story was first generated (a renamed Companion shows
// up immediately, no regeneration needed or wanted).

import type { AttentionSpanAnswer, ChildProfile, CommunicationAnswer, SamenessAnswer } from '../types';
import { renderLine, slotValuesFromProfile } from './slots';
import type {
  DetectedObjectForStory,
  GeneratedStoryTemplate,
  StoryGenPort,
  StoryStepTemplate,
} from '../adapters/ports';

// Re-exported so Game2.tsx (and anything else presentation-layer) can
// import story types from this file alone, without also needing to know
// these particular ones live in adapters/ports.ts -- same shared-contract
// role this file's header describes, the actual definitions just live
// with the rest of the port types per ARCHITECTURE-RULES.md.
export type { DetectedObjectForStory, GeneratedStoryTemplate, StoryStepTemplate };

// ---------------------------------------------------------------------------
// Caching key — SHA-256 of the actual photo bytes, so the same room photo
// (re-uploaded, or re-processed in the same session) always reuses the same
// generated story rather than paying for and risking a different one.
// ---------------------------------------------------------------------------

const STORY_CACHE_PREFIX = 'game2-story-';

/** `dataUrl` is the same base64 JPEG string produced by
 * canvasUtils.canvasToDataUrl -- hash the base64 payload itself (not the
 * data: prefix) so two identical photos always hash identically regardless
 * of how they reached this function. */
export async function hashPhotoDataUrl(dataUrl: string): Promise<string> {
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function storyCacheKey(photoHash: string): string {
  return `${STORY_CACHE_PREFIX}${photoHash}`;
}

// ---------------------------------------------------------------------------
// Rendering — turns a cached/generated template step back into an on-screen
// sentence with the CURRENT profile's slot values filled in. Same
// renderLine/slotValuesFromProfile pair routineSequencing.ts always used.
// ---------------------------------------------------------------------------

export function renderStorySentence(step: StoryStepTemplate, profile: ChildProfile): string {
  const rendered = renderLine(step.sentence, slotValuesFromProfile(profile));
  // The model writes {companion} assuming it becomes a proper name (which
  // is already capitalized) -- but the slot's own fallback, when no
  // Companion is set, is a lowercase generic phrase ("your friend"), which
  // leaves the rendered sentence starting lowercase. Capitalize the final
  // string's first character regardless of what filled the slot, rather
  // than special-casing the fallback value itself (this also covers the
  // "child" perspective mode's "you"/"your" sentences the same way, with
  // no separate logic needed).
  return rendered.length > 0 ? rendered[0].toUpperCase() + rendered.slice(1) : rendered;
}

/** Maps a step's objectRef back to the real detected object (and from
 * there, Game2.tsx pulls the matching TaggedCrop for its actual cropped
 * photo). Case-insensitive because model output casing isn't guaranteed
 * even after validation already checked the ref exists. Returns undefined
 * only if the caller passes a story that wasn't validated against this
 * exact object list -- should not happen in practice. */
export function resolveStoryStepObject<T extends { name: string }>(
  step: StoryStepTemplate,
  objects: T[],
): T | undefined {
  const target = step.objectRef.trim().toLowerCase();
  return objects.find((o) => o.name.trim().toLowerCase() === target);
}

// ---------------------------------------------------------------------------
// Orchestration -- the one function Game2.tsx actually calls. Contract is
// final; the body below is what adapters/story/*.ts + this function's
// caching wrapper get implemented against in parallel with the Game2.tsx
// rewrite that calls it.
//
// Behavior: check the cache for this exact photo first (never regenerate a
// story for a photo already seen -- the load-bearing "sameness helps"
// guarantee from this file's header). On a miss, try the real generator;
// on ANY failure (network, malformed JSON, failed validation --
// StoryGenerationFailedError or anything else thrown), fall back to the
// deterministic template generator, which cannot itself fail. Cache
// whichever result was produced (real or fallback) under the same key, so
// a fallback-on-first-try still replays identically on a second view of
// the same photo, keeping the sameness guarantee even through a transient
// failure.
// ---------------------------------------------------------------------------

export interface GetOrGenerateStoryDeps {
  real: StoryGenPort;
  fallback: StoryGenPort;
  cache: {
    get(key: string): Promise<GeneratedStoryTemplate | undefined>;
    set(key: string, value: GeneratedStoryTemplate): Promise<void>;
  };
}

export async function getOrGenerateStory(
  photoDataUrl: string,
  objects: DetectedObjectForStory[],
  childAgeMonths: number,
  sameness: SamenessAnswer | undefined,
  deps: GetOrGenerateStoryDeps,
  stepCount?: number,
  avoid?: { colour?: string; terms?: string[] },
  perspective?: 'companion' | 'child',
  // Not folded into the cache key below, same reasoning as `sameness`
  // above: these are fixed per-child profile dimensions, not a per-call
  // choice like stepCount/perspective, so they can never make two calls
  // for the same photo "genuinely different requests".
  attentionSpan?: AttentionSpanAnswer,
  communication?: CommunicationAnswer,
): Promise<GeneratedStoryTemplate> {
  // stepCount AND perspective folded into the key -- picking a different
  // count, or a different "who's this about" mode, for the same photo
  // must never replay a story generated under different terms; it's a
  // genuinely different request, not a cache hit.
  const key = `${storyCacheKey(await hashPhotoDataUrl(photoDataUrl))}-steps-${stepCount ?? 'auto'}-pov-${perspective ?? 'companion'}`;
  const cached = await deps.cache.get(key);
  // A cached FALLBACK is never treated as a durable hit -- only a cached
  // REAL generation is. Without this, one transient failure (a network
  // blip, a dev-environment gap that's since been fixed) would entomb a
  // generic fallback story for that exact photo forever, with no way for
  // the app to ever try again -- indistinguishable, from the screen
  // alone, from an actual ongoing generation bug. See GeneratedStoryTemplate's
  // `source` field in adapters/ports.ts for the full reasoning.
  //
  // Diagnostic-only logging (never shown to a caregiver or child) -- this
  // is genuinely useful for telling "stale cache" apart from "real
  // generation bug" without guessing, so it stays rather than getting
  // pulled once this is confirmed working.
  if (cached?.source === 'real') {
    console.warn(`[game2Story] cache HIT (real) for key ${key}`);
    return cached;
  }
  console.warn(
    cached
      ? `[game2Story] cache has a stale FALLBACK for key ${key} -- retrying the real generator`
      : `[game2Story] cache MISS for key ${key}, generating fresh`,
  );

  let story: GeneratedStoryTemplate;
  try {
    story = await deps.real.generateStory({
      objects,
      childAgeMonths,
      sameness,
      attentionSpan,
      communication,
      stepCount,
      avoidedColour: avoid?.colour,
      avoidedTerms: avoid?.terms,
      perspective,
    });
    console.warn('[game2Story] real generator succeeded');
  } catch (err) {
    // Any failure -- network, malformed JSON, failed validation -- is a
    // quiet degrade to the template generator, never a caregiver-facing
    // error (per the redesign spec's "the user should never see a
    // failure state"). The template generator cannot itself throw. Still
    // cached below (so a burst of retries within one session doesn't
    // hammer the API), just never as a durable hit -- see above.
    console.warn('[game2Story] real generator failed, falling back to template:', err);
    story = await deps.fallback.generateStory({
      objects,
      childAgeMonths,
      sameness,
      attentionSpan,
      communication,
      stepCount,
      avoidedColour: avoid?.colour,
      avoidedTerms: avoid?.terms,
      perspective,
    });
  }

  await deps.cache.set(key, story);
  return story;
}

/** The one function Game2.tsx actually imports and calls. Wires
 * `getOrGenerateStory` to the real registry adapter, the deterministic
 * fallback (imported directly, never through the registry -- same
 * convention as adapters/textgen/rawTextCard.ts, which Branch2Card.tsx
 * also calls directly rather than registering, since a fallback isn't
 * something a deployment should ever swap out), and the real StoragePort
 * for caching. Kept as a thin wire-up here specifically so Game2.tsx never
 * needs to import `adapters` itself for this call, matching how the rest
 * of this file stays presentation-agnostic. */
export async function generateGame2Story(
  photoDataUrl: string,
  objects: DetectedObjectForStory[],
  childAgeMonths: number,
  sameness: SamenessAnswer | undefined,
  stepCount?: number,
  avoid?: { colour?: string; terms?: string[] },
  perspective?: 'companion' | 'child',
  attentionSpan?: AttentionSpanAnswer,
  communication?: CommunicationAnswer,
): Promise<GeneratedStoryTemplate> {
  const { adapters } = await import('../adapters/registry');
  const { createTemplateStory } = await import('../adapters/story/templateStory');
  return getOrGenerateStory(
    photoDataUrl,
    objects,
    childAgeMonths,
    sameness,
    {
      real: adapters.story,
      fallback: createTemplateStory(),
      cache: {
        get: (key) => adapters.storage.get<GeneratedStoryTemplate>(key),
        set: (key, value) => adapters.storage.set(key, value),
      },
    },
    stepCount,
    avoid,
    perspective,
    attentionSpan,
    communication,
  );
}
