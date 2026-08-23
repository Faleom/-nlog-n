// F.021 — Game 3 Mode A: Shadow Match. Pure logic (sample-kind per level,
// option-grid building, target selection). No React, no canvas — fully
// testable without a browser. See scripts/smoke-f021.ts.
//
// §8.3's level table:
//   Level 1: sample = identical photo
//   Level 2: sample = same object, different angle/lighting
//   Level 3: sample = black silhouette
//   Level 4: sample = silhouette, answer NOT on screen — child fetches it
//            ("hands directly into Game 1's loop" — intentional, same
//            skill at a different distance).
//
// This is a THIN LAYER on top of F.008/F.012's already-built engine —
// InteractionMachine (wrong-tap escalation), sessionLifecycle (cap/idle/
// caregiver end), activityLogging, and even game1Trial.ts's
// pickNextTarget are reused as-is by Game3ShadowMatch.tsx, not
// reimplemented here. Any engine logic creeping into this file would be
// exactly the "contract violation" F.021's review checklist calls out.

import type { ChildProfile, TaggedCrop } from '../types';
import type { Game3Level } from './game3Level';

export type SampleKind = 'identical' | 'altered' | 'silhouette' | 'silhouette-fetch';

export function sampleKindForLevel(level: Game3Level): SampleKind {
  switch (level) {
    case 1:
      return 'identical';
    case 2:
      return 'altered';
    case 3:
      return 'silhouette';
    case 4:
      return 'silhouette-fetch';
  }
}

/**
 * What the caregiver is choosing between, in one line.
 *
 * The level buttons used to be bare numbers, which told a caregiver nothing
 * — including that the silhouette game lives at 3. Describing the SAMPLE
 * (rather than the whole round) keeps each line true whichever source is in
 * play, since only Level 4's fetch step differs between a room photo and a
 * library picture.
 */
export function levelDescription(level: Game3Level): string {
  switch (sampleKindForLevel(level)) {
    case 'identical':
      return 'Shows the picture as it is — find its twin.';
    case 'altered':
      return 'Shows the same thing, lit and angled differently.';
    case 'silhouette':
      return 'Shows the shape only, in black.';
    case 'silhouette-fetch':
      return 'Shape only — with a room photo, they go and fetch the real thing.';
  }
}

/** Level 4 hands directly into Game 1's loop (§8.3) — same skill, a
 * different distance. Game3ShadowMatch.tsx checks this to switch from
 * "pick the matching photo from a small options grid" to "leave the
 * screen, fetch the real object, come back" — Game 1's own interaction
 * shape, not a new one invented here. */
export function requiresFetchingTheRealObject(level: Game3Level): boolean {
  return sampleKindForLevel(level) === 'silhouette-fetch';
}

const OPTIONS_GRID_SIZE = 3;

/**
 * Builds the options grid for levels 1-3 (level 4 has no options grid at
 * all — see requiresFetchingTheRealObject). Always includes the target
 * exactly once, clamped to the available pool, same clamping discipline
 * as game1Difficulty.ts's buildConfirmationGrid.
 */
export function buildShadowMatchOptions(pool: TaggedCrop[], target: TaggedCrop): TaggedCrop[] {
  const size = Math.min(OPTIONS_GRID_SIZE, pool.length);
  const others = pool.filter((c) => c.id !== target.id);
  return [target, ...others.slice(0, Math.max(0, size - 1))];
}

/** A synthetic TaggedCrop-shaped wrapper for the Companion, so
 * Game3ShadowMatch.tsx can put it through the exact same options-grid and
 * silhouette machinery as a room crop — see buildLevel1Pool. `bbox` is a
 * meaningless placeholder (unused for a Companion cameo, which is
 * rendered from its own photo directly, not cropped from a room photo). */
export function companionAsCrop(profile: ChildProfile): TaggedCrop | null {
  const companion = profile.context.companion;
  if (!companion?.name || !companion.photo) return null;
  return {
    id: 'companion',
    name: companion.name,
    colour: '',
    category: 'companion',
    function: '',
    bbox: { x: 0, y: 0, width: 1, height: 1 },
    image: companion.photo,
  };
}

/**
 * §8.3/F.021: "The Companion's silhouette is the Level 1 sample every
 * session." Builds the Level-1-specific pool: the Companion (as the
 * target) plus a few real room crops as decoys. Falls back to a normal
 * room-crop pool (Companion absent from the options entirely) with no
 * Companion set — §6.3's "neutral guide still works" applies here too.
 */
export function buildLevel1Pool(profile: ChildProfile, roomCrops: TaggedCrop[]): { pool: TaggedCrop[]; target: TaggedCrop } | null {
  const companion = companionAsCrop(profile);
  if (!companion) return null;
  return { pool: [companion, ...roomCrops], target: companion };
}

/**
 * Level 2's sample is "the same object, different angle or lighting"
 * (§8.3) — but the whole app only ever captures ONE photo per session
 * (§8.1: "one photo per session, not per trial"), so there is no second
 * angle of the same object to show. Faking a second photo would mean
 * either a second vision/API round trip (an explicit non-goal — §8.3's
 * "no extra API cost, no latency") or fabricating imagery, which is worse.
 *
 * Instead this simulates a visibly different angle/lighting with a cheap,
 * deterministic CSS transform + filter over the SAME crop image: mirrored
 * (a different "angle"), rotated slightly, darkened and higher-contrast (a
 * different "lighting"). Honest tradeoff, stated plainly rather than
 * pretended away — see silhouette.ts's header for the same style of
 * disclosure. Plain CSS strings, not React.CSSProperties, so this file
 * stays framework-free per its header; Game3ShadowMatch.tsx applies them
 * as inline style values only when sampleKindForLevel(level) === 'altered'.
 */
export const ALTERED_SAMPLE_FILTER = 'brightness(0.78) contrast(1.2) saturate(0.8)';
export const ALTERED_SAMPLE_TRANSFORM = 'scaleX(-1) rotate(-7deg)';
