// The lesson generator (TASK-game3-roadmap.md §4). Pure — no storage, no
// React, fully unit-testable, same spirit as game1Trial.ts.
//
// Walks one context at a time rather than building a whole chapter
// up front: this app's real target pool for context 2+ doesn't exist
// until the caregiver captures a second room (see roadmap.ts), so lessons
// for a later context can only be generated once that capture happens.
// `walkContext` is called once per context, threading its return state
// (field index reached, cumulative new-element count) into the next call.
//
// The §4 illustrative table is exactly that — illustrative, not a byte-
// for-byte spec. Its four bullet rules ARE the spec:
//   - alternate [add_target, grow_field]
//   - insert consolidation after every 2nd new element
//   - add_context only when targetPool is exhausted
//   - field size drops one step when context changes
// This implements those rules directly. What's tested (generator.smoke)
// is the rules themselves — consolidation cadence, the field-size drop,
// chapter length scaling with pool size, never emitting an absent target —
// not an exact reproduction of one worked example, which would require
// guessing tie-break behaviour the doc never specifies (e.g. how many
// targets a context's very first lesson seeds).

import { ROUNDS_PER_LESSON, type Lesson } from './types';

export interface ContextWalkResult {
  lessons: Lesson[];
  /** Index into fieldSizes this context ended on — the next context starts
   * one step below this (§4's "field size drops on context change"). */
  endFieldIndex: number;
  /** Cumulative count of lessons that introduced a new target, carried
   * across contexts so the every-2nd-new-element cadence doesn't reset. */
  newElementLessonCount: number;
}

/**
 * Walks ONE context: introduces every not-yet-introduced target from
 * `targetPool` (only on the FIRST context a target pool has anything left
 * to introduce — a later context re-tests the same objects, it never
 * introduces new ones, per §4's "add_context only when targetPool is
 * exhausted"), alternating with field-size growth, consolidating every
 * 2nd new-target lesson, and always closing the context's arc with one
 * consolidation lesson so generalization testing lands on a mastery
 * check rather than mid-introduction.
 */
export function walkContext(params: {
  chapterId: string;
  context: string;
  targetPool: string[];
  /** Targets already introduced in an earlier context — never re-introduced. */
  alreadyIntroduced: string[];
  fieldSizes: number[];
  /** Field index to start this context at (0 for the first context). */
  startFieldIndex: number;
  newElementLessonCountSoFar: number;
  /** 1-based index to continue lesson numbering from, across contexts. */
  startLessonIndex: number;
}): ContextWalkResult {
  const {
    chapterId,
    context,
    targetPool,
    alreadyIntroduced,
    fieldSizes,
    startFieldIndex,
    newElementLessonCountSoFar,
    startLessonIndex,
  } = params;

  const introduced = [...alreadyIntroduced];
  const remaining = targetPool.filter((t) => !introduced.includes(t));
  const isFirstContext = alreadyIntroduced.length === 0;

  let fieldIndex = startFieldIndex;
  let newElementLessonCount = newElementLessonCountSoFar;
  let lessonIndex = startLessonIndex;
  let addTargetTurn = true;
  const lessons: Lesson[] = [];

  function push(newElement: string | null): void {
    lessons.push({
      id: `${chapterId}-l${lessonIndex}`,
      chapterId,
      index: lessonIndex,
      rounds: ROUNDS_PER_LESSON,
      fieldSize: fieldSizes[fieldIndex],
      pool: [...introduced],
      context,
      newElement,
    });
    lessonIndex += 1;
  }

  function addNextTarget(): void {
    const next = remaining.shift();
    if (!next) return;
    introduced.push(next);
    push(next);
    newElementLessonCount += 1;
    if (newElementLessonCount % 2 === 0) push(null); // consolidation
  }

  function growField(): void {
    fieldIndex += 1;
    push(null);
  }

  const hasTargetsLeft = () => isFirstContext && remaining.length > 0;
  const hasFieldRoom = () => fieldIndex < fieldSizes.length - 1;

  // A later context (no targets left to introduce) must actually be
  // PLAYED at its dropped starting field size before anything grows —
  // growField() increments fieldIndex before it pushes, so without this,
  // a context with nothing new to add would skip straight past the drop
  // that's the entire point of dropping it. A first context never hits
  // this (it always has a target to add on its very first turn).
  if (!hasTargetsLeft()) {
    push(null);
  }

  while (hasTargetsLeft() || hasFieldRoom()) {
    if (addTargetTurn && hasTargetsLeft()) {
      addNextTarget();
    } else if (hasFieldRoom()) {
      growField();
    } else if (hasTargetsLeft()) {
      addNextTarget();
    } else {
      break;
    }
    addTargetTurn = !addTargetTurn;
  }

  // Every context's arc closes on a consolidation lesson, so the
  // generalization gate (§6) always lands on a mastery check, not
  // mid-introduction — matters most for later contexts, which may
  // otherwise end on a bare field-grow lesson with nothing to consolidate.
  push(null);

  return { lessons, endFieldIndex: fieldIndex, newElementLessonCount };
}

/** §4: "Chapter length varies with pool size ... that is correct
 * behaviour, not a bug." A 3-object pool simply runs out of add_target
 * turns sooner than a 5-object one — nothing else to compute here, this
 * helper exists so callers don't need to re-derive it themselves. */
export function estimatedLessonCount(targetPoolSize: number, fieldSizes: number[]): number {
  const first = walkContext({
    chapterId: 'estimate',
    context: 'estimate',
    targetPool: Array.from({ length: targetPoolSize }, (_, i) => `t${i}`),
    alreadyIntroduced: [],
    fieldSizes,
    startFieldIndex: 0,
    newElementLessonCountSoFar: 0,
    startLessonIndex: 1,
  });
  return first.lessons.length;
}
