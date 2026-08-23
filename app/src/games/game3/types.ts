// Game 3's roadmap data model — Chapter 1 ("Match the picture") only.
// Adapted from TASK-game3-roadmap.md §3 into this app's real domain types
// rather than redefining them: `supportTier`/`promptsUsed` are exactly
// F.010's five-tier caregiver ladder and F.009's four-tier on-screen
// hierarchy (../../types), already the shapes this task needs. Kept local
// to games/game3/, not src/types/index.ts, per the task's own §11 — this
// is Game 3's own contract, consumed by nothing outside this folder.
//
// This replaces the earlier single-session Shadow Match design (F.021):
// a Duolingo-style Chapter -> Lesson -> Round progression, caregiver-
// facing roadmap, persisted across sessions. See F.000-INDEX.md.

import type { OnScreenPromptTier, SupportTier, TaggedCrop } from '../../types';

export const ROUNDS_PER_LESSON = 4;

export interface Chapter {
  id: string;
  title: string;
  skill: string;
  /** Object names available for this chapter — deduped, lowercase. Drawn
   * from Game 3's bundled stock assets (stockAssets.ts), a deliberate
   * exception to the rest of the app's "always the child's own captured
   * room, never stock" rule — see that file's header. */
  targetPool: string[];
  fieldSizes: number[];
  /** Physical contexts (rooms) captured so far, in capture order. A
   * chapter starts with one; a second unlocks the generalization gate
   * (§6) once the first is fully passed — see roadmap.ts. */
  contexts: string[];
}

export interface Lesson {
  id: string;
  chapterId: string;
  index: number;
  rounds: typeof ROUNDS_PER_LESSON;
  fieldSize: number;
  /** Subset of the chapter's targetPool available by this point in the walk. */
  pool: string[];
  context: string;
  /** The single new target this lesson introduces, or null on a
   * consolidation lesson (introduces nothing — where mastery forms). */
  newElement: string | null;
}

export interface RoundResult {
  lessonId: string;
  /** The target's object NAME (matches TaggedCrop.name), not a crop id —
   * crop identity is per-photo and doesn't survive a new capture; name is
   * what recurs across contexts and sessions. */
  targetId: string;
  supportTier: SupportTier;
  promptsUsed: OnScreenPromptTier;
  completedAt: number;
}

export type LessonOutcome = 'pass' | 'repeat';

/** Everything persisted for one child's Chapter 1 progress (StoragePort). */
export interface RoadmapProgress {
  chapterId: string;
  targetPool: string[];
  contexts: string[];
  /** The real captured crops for each context, keyed by context label —
   * what Game3Play actually renders. Lesson.pool only carries object
   * NAMES (the generator is pure and doesn't know about photos); this is
   * where those names resolve back to a real image. */
  contextCrops: Record<string, TaggedCrop[]>;
  /** Only the most recent attempt's results per lesson — a repeat replaces
   * rather than appends, per §6: outcome is about the LATEST attempt. */
  lessonResults: Record<string, RoundResult[]>;
  lessonOutcomes: Record<string, LessonOutcome>;
  /** Resume point for a lesson left mid-way — survives reload (§ persistence). */
  inProgress: { lessonId: string; roundIndex: number; results: RoundResult[] } | null;
}
