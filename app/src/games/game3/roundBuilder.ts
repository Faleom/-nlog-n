// Round content — turning a Lesson + real crops into one round's target
// and options grid. Pure, no React. Target selection reuses
// game1Trial.ts's pickNextTarget directly rather than reimplementing it
// (same "no immediate repeat" rule applies here).

import type { TaggedCrop } from '../../types';
import { pickNextTarget } from '../game1Trial';

export function pickRoundTarget(lessonCrops: TaggedCrop[], excludeId: string | null): TaggedCrop {
  return pickNextTarget(lessonCrops, excludeId);
}

/**
 * Builds the options grid for one round: the target once, plus distractors
 * up to `fieldSize`. Distractors are drawn first from the lesson's own
 * pool (the objects this lesson is actually teaching), then — only if
 * still short — from the rest of the room's captured crops. A field of 4
 * doesn't require 4 DISTINCT taught objects to exist yet; the remaining
 * slots can be any other real photo from the same room, since their job
 * is purely visual noise for "which one is identical", not content the
 * child is meant to learn (§4's generator only tracks TAUGHT targets,
 * this is a separate, looser pool). Clamped to whatever's actually
 * available rather than padded — same discipline as F.021's
 * buildShadowMatchOptions.
 */
export function buildRoundOptions(
  target: TaggedCrop,
  lessonCrops: TaggedCrop[],
  allContextCrops: TaggedCrop[],
  fieldSize: number,
): TaggedCrop[] {
  const used = new Set([target.id]);
  const options: TaggedCrop[] = [target];

  function fillFrom(source: TaggedCrop[]): void {
    for (const crop of source) {
      if (options.length >= fieldSize) return;
      if (used.has(crop.id)) continue;
      used.add(crop.id);
      options.push(crop);
    }
  }

  fillFrom(lessonCrops);
  fillFrom(allContextCrops);
  return options;
}
