// Orchestration + persistence for Game 3's roadmap (F.021, redesigned).
// Bridges the pure generator/advancement modules to the real app: a set of
// crops (Game 3's bundled stock assets — see stockAssets.ts) becomes a
// target pool, StoragePort persists progress across sessions
// (§ persistence: "{chapterId, lessonId, roundsCompleted} survives
// reload"). This module itself doesn't care where crops come from — it
// took real captured photos in an earlier version of this file and could
// again later; only the caller (screens/Game3Roadmap.tsx) knows they're
// currently bundled stock icons.
//
// Only RoadmapProgress is persisted — never the derived Lesson[] list.
// The generator is pure and deterministic, so lessons are re-walked from
// (targetPool, contexts) on every read. One source of truth, no drift
// between "the lessons" and "the saved progress".

import { adapters } from '../../adapters/registry';
import type { TaggedCrop } from '../../types';
import { walkContext } from './generator';
import { isChapterComplete, lessonOutcome } from './advancement';
import type { Chapter, Lesson, LessonOutcome, RoadmapProgress, RoundResult } from './types';
import { ROUNDS_PER_LESSON } from './types';

const CHAPTER_ID = 'ch1';
const CHAPTER_TITLE = 'Match the picture';
const CHAPTER_SKILL = 'identical-match';
const FIELD_SIZES = [2, 3, 4];
const MAX_TARGETS = 6;

function storageKey(childId: string): string {
  return `game3-roadmap:${childId}`;
}

/** Unique, lowercase object names from a set of crops — Game 3's bundled
 * stock assets (stockAssets.ts) in practice, but this function itself is
 * agnostic to where the crops came from. Capped so an unusually large set
 * doesn't produce an unplayably long chapter (§4: chapter length already
 * varies with pool size on purpose; this just keeps that variation inside
 * a sane range). */
export function poolFromCrops(crops: TaggedCrop[]): string[] {
  const seen = new Set<string>();
  for (const crop of crops) {
    const name = crop.name.trim().toLowerCase();
    if (name) seen.add(name);
    if (seen.size >= MAX_TARGETS) break;
  }
  return [...seen];
}

export async function getRoadmapProgress(childId: string): Promise<RoadmapProgress | undefined> {
  return adapters.storage.get<RoadmapProgress>(storageKey(childId));
}

async function saveProgress(childId: string, progress: RoadmapProgress): Promise<void> {
  await adapters.storage.set(storageKey(childId), progress);
}

/** Re-walks the generator for every context in `progress`, in order,
 * threading field index and new-element count across contexts exactly
 * as §4 requires. Cheap and pure — safe to call on every render. */
export function deriveLessons(progress: RoadmapProgress): Lesson[] {
  const lessons: Lesson[] = [];
  let introduced: string[] = [];
  let fieldIndex = 0;
  let newElementLessonCount = 0;
  let nextLessonIndex = 1;

  progress.contexts.forEach((context, i) => {
    const startFieldIndex = i === 0 ? 0 : Math.max(0, fieldIndex - 1);
    const result = walkContext({
      chapterId: progress.chapterId,
      context,
      targetPool: progress.targetPool,
      alreadyIntroduced: introduced,
      fieldSizes: FIELD_SIZES,
      startFieldIndex,
      newElementLessonCountSoFar: newElementLessonCount,
      startLessonIndex: nextLessonIndex,
    });
    lessons.push(...result.lessons);
    introduced = [...new Set([...introduced, ...progress.targetPool])];
    fieldIndex = result.endFieldIndex;
    newElementLessonCount = result.newElementLessonCount;
    nextLessonIndex += result.lessons.length;
  });

  return lessons;
}

export function deriveChapter(progress: RoadmapProgress): Chapter {
  return {
    id: progress.chapterId,
    title: CHAPTER_TITLE,
    skill: CHAPTER_SKILL,
    targetPool: progress.targetPool,
    fieldSizes: FIELD_SIZES,
    contexts: progress.contexts,
  };
}

/** First-time setup: a captured room becomes Chapter 1's target pool and
 * first context. No-op (returns existing progress) if this child already
 * has a chapter started — call `addContext` for a second room instead. */
export async function ensureChapterStarted(
  childId: string,
  crops: TaggedCrop[],
  contextLabel: string,
): Promise<RoadmapProgress> {
  const existing = await getRoadmapProgress(childId);
  if (existing) return existing;

  const progress: RoadmapProgress = {
    chapterId: CHAPTER_ID,
    targetPool: poolFromCrops(crops),
    contexts: [contextLabel],
    contextCrops: { [contextLabel]: crops },
    lessonResults: {},
    lessonOutcomes: {},
    inProgress: null,
  };
  await saveProgress(childId, progress);
  return progress;
}

/** Adds a second (or later) context, per §6's generalization gate — a
 * fresh setting to re-test the same objects in (currently: a second
 * stock set standing in for a second room, see stockAssets.ts). Does not
 * re-derive the target pool from the new crops: the pool being tested
 * must stay the SAME objects, in a new setting, or "generalization"
 * would just mean "more objects", which isn't the skill (§8.3). */
export async function addContext(
  childId: string,
  contextLabel: string,
  crops: TaggedCrop[],
): Promise<RoadmapProgress> {
  const existing = await getRoadmapProgress(childId);
  if (!existing) {
    throw new Error('addContext called before ensureChapterStarted — no chapter to extend.');
  }
  if (existing.contexts.includes(contextLabel)) return existing;
  const progress: RoadmapProgress = {
    ...existing,
    contexts: [...existing.contexts, contextLabel],
    contextCrops: { ...existing.contextCrops, [contextLabel]: crops },
  };
  await saveProgress(childId, progress);
  return progress;
}

/** Resolves a lesson's `pool` (object names) back to real crops from the
 * lesson's own context — always THIS lesson's context, never mixed with
 * another room's photos even if a name recurs. Silently drops a name with
 * no matching crop (can't happen in practice since the pool is derived
 * from these same crops, but stays honest under a future edit). */
export function cropsForLesson(lesson: Lesson, progress: RoadmapProgress): TaggedCrop[] {
  const available = progress.contextCrops[lesson.context] ?? [];
  return lesson.pool
    .map((name) => available.find((c) => c.name.trim().toLowerCase() === name))
    .filter((c): c is TaggedCrop => c !== undefined);
}

export type LessonState = 'locked' | 'available' | 'passed';

/** Sequential unlock: the first not-yet-passed lesson (by generation
 * order) is 'available'; everything before it is 'passed' (an invariant
 * of always playing in order); everything after is 'locked'. Locked
 * content is never rendered to the child — this only ever drives the
 * CAREGIVER-facing roadmap view. */
export function lessonState(lesson: Lesson, progress: RoadmapProgress): LessonState {
  if (progress.lessonOutcomes[lesson.id] === 'pass') return 'passed';
  const lessons = deriveLessons(progress);
  const firstUnpassed = lessons.find((l) => progress.lessonOutcomes[l.id] !== 'pass');
  return firstUnpassed?.id === lesson.id ? 'available' : 'locked';
}

export function chapterProgress(progress: RoadmapProgress): {
  chapter: Chapter;
  lessons: Lesson[];
  complete: boolean;
} {
  const chapter = deriveChapter(progress);
  const lessons = deriveLessons(progress);
  return {
    chapter,
    lessons,
    complete: isChapterComplete(chapter, lessons, progress.lessonOutcomes, progress.lessonResults),
  };
}

/** Persists one round's result into the in-progress lesson attempt.
 * Returns the updated in-progress state so the caller (Game3Play) can
 * keep rendering without a second read. */
export async function recordRound(
  childId: string,
  lessonId: string,
  roundIndex: number,
  result: RoundResult,
): Promise<RoadmapProgress> {
  const existing = await getRoadmapProgress(childId);
  if (!existing) throw new Error('recordRound called with no roadmap progress for this child.');
  const priorResults = existing.inProgress?.lessonId === lessonId ? existing.inProgress.results : [];
  const results = [...priorResults, result];
  const progress: RoadmapProgress = {
    ...existing,
    inProgress: { lessonId, roundIndex: roundIndex + 1, results },
  };
  await saveProgress(childId, progress);
  return progress;
}

/**
 * Closes out a lesson attempt once all ROUNDS_PER_LESSON rounds are in:
 * computes pass/repeat (§6), replaces (never appends to) this lesson's
 * stored results and outcome, and clears the resume point.
 */
export async function completeLesson(
  childId: string,
  lessonId: string,
): Promise<{ outcome: LessonOutcome; progress: RoadmapProgress }> {
  const existing = await getRoadmapProgress(childId);
  if (!existing || existing.inProgress?.lessonId !== lessonId) {
    throw new Error('completeLesson called with no matching in-progress attempt.');
  }
  const results = existing.inProgress.results;
  if (results.length < ROUNDS_PER_LESSON) {
    throw new Error(
      `completeLesson called with only ${results.length}/${ROUNDS_PER_LESSON} rounds recorded.`,
    );
  }
  const outcome = lessonOutcome(results);
  const progress: RoadmapProgress = {
    ...existing,
    lessonResults: { ...existing.lessonResults, [lessonId]: results },
    lessonOutcomes: { ...existing.lessonOutcomes, [lessonId]: outcome },
    inProgress: null,
  };
  await saveProgress(childId, progress);
  return { outcome, progress };
}
