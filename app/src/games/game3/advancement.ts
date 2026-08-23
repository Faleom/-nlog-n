// Advancement rules (TASK-game3-roadmap.md §6). Pure — reads only the
// arguments it's given, no storage. §6's own warning: "the two-part
// chapter gate matters. Finishing every lesson is not enough — the
// generalization requirement is separate. Without it this is a
// completion tracker, not a mastery model."

import type { Chapter, Lesson, LessonOutcome, RoundResult } from './types';
import { ROUNDS_PER_LESSON } from './types';

/** "Gesture or lighter" (§6) — tier 3 (gesture), 4 (verbal) or 5
 * (independent) on the SUPPORT_TIERS ladder (../../config/supportLadder). */
const LESSON_PASS_MIN_SUPPORT_TIER = 3;

/**
 * A lesson passes only when every round completed at tier >=3. Any round
 * that needed tier 1-2 (full or partial physical support) sends the whole
 * lesson back to repeat — not just that one round, because a lesson is
 * the unit mastery is measured at (§6).
 */
export function lessonOutcome(results: RoundResult[]): LessonOutcome {
  if (results.length < ROUNDS_PER_LESSON) {
    throw new Error(
      `lessonOutcome called with ${results.length} results, expected ${ROUNDS_PER_LESSON} — a lesson's outcome is only defined once all its rounds have completed.`,
    );
  }
  const allLight = results.every((r) => r.supportTier >= LESSON_PASS_MIN_SUPPORT_TIER);
  return allLight ? 'pass' : 'repeat';
}

/** Every lesson generated so far for this chapter has a 'pass' outcome. */
export function allLessonsPassed(
  lessons: Lesson[],
  lessonOutcomes: Record<string, LessonOutcome>,
): boolean {
  return lessons.length > 0 && lessons.every((l) => lessonOutcomes[l.id] === 'pass');
}

/** A context counts as demonstrating independence once any round within
 * it resolved at the ladder's top tier (5 — "wait, let them go"), with no
 * caregiver support at all. */
export function contextIsIndependent(
  context: string,
  lessons: Lesson[],
  lessonResults: Record<string, RoundResult[]>,
): boolean {
  const contextLessonIds = new Set(lessons.filter((l) => l.context === context).map((l) => l.id));
  return Object.entries(lessonResults).some(
    ([lessonId, results]) =>
      contextLessonIds.has(lessonId) && results.some((r) => r.supportTier === 5),
  );
}

/**
 * §6's two-part gate: every generated lesson passed, AND independence was
 * demonstrated in at least 2 distinct contexts. A single-context chapter
 * (the caregiver hasn't captured a second room yet) can never satisfy
 * this — by design, not an oversight, since generalization across a real
 * second context is the whole point of the requirement.
 */
export function isChapterComplete(
  chapter: Chapter,
  lessons: Lesson[],
  lessonOutcomes: Record<string, LessonOutcome>,
  lessonResults: Record<string, RoundResult[]>,
): boolean {
  if (!allLessonsPassed(lessons, lessonOutcomes)) return false;
  const independentContexts = chapter.contexts.filter((c) =>
    contextIsIndependent(c, lessons, lessonResults),
  );
  return independentContexts.length >= 2;
}
