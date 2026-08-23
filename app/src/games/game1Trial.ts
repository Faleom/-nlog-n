// Pure target-selection logic for Game 1 (F.008 baseline). Kept separate
// from Game1.tsx so it's testable without React or a DOM — see
// scripts/smoke-f008.ts.
//
// F.008 itself needs only "don't immediately repeat the same object twice
// in a row" — the full difficulty-aware selection (weighting distractors,
// grid sizing per level) is F.012's job and extends this file rather than
// duplicating it (see game1Difficulty.ts).

import type { TaggedCrop } from '../types';

/**
 * Picks the next trial's target from the session's crop set, avoiding an
 * immediate repeat of `excludeId` when there's any other option. With only
 * one crop available (a very sparse room), repeating is unavoidable and
 * this correctly falls back to it rather than throwing.
 */
export function pickNextTarget(crops: TaggedCrop[], excludeId: string | null): TaggedCrop {
  if (crops.length === 0) {
    throw new Error('pickNextTarget called with an empty crop set');
  }
  const candidates = excludeId ? crops.filter((c) => c.id !== excludeId) : crops;
  const pool = candidates.length > 0 ? candidates : crops;
  return pool[Math.floor(Math.random() * pool.length)];
}
