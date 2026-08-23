// Real functional check for F.021 — Game 3's roadmap engine (redesigned:
// Chapter -> Lesson -> Round, replacing the earlier single-session Shadow
// Match design). Run with: npm run smoke:f021
//
// generator.ts, advancement.ts, roundBuilder.ts, roadmap.ts and
// stockAssets.ts are pure (or StoragePort-backed) — fully testable
// without a browser, same pattern as smoke-f001.ts. Game3Roadmap.tsx /
// Game3Play.tsx's actual rendering needs a human on a real device.
//
// silhouette.ts's own pure image-processing tests are kept here even
// though no game currently wires it in — it's the reusable threshold+fill
// utility future chapters (silhouette matching) build on, per
// TASK-game3-roadmap.md §12, and this file already owned its tests.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { computeSilhouette, silhouetteCoverage } from '../src/games/silhouette';
import type { PixelBuffer } from '../src/adapters/imaging/pixelBuffer';
import { estimatedLessonCount, walkContext } from '../src/games/game3/generator';
import {
  allLessonsPassed,
  contextIsIndependent,
  isChapterComplete,
  lessonOutcome,
} from '../src/games/game3/advancement';
import { buildRoundOptions, pickRoundTarget } from '../src/games/game3/roundBuilder';
import { ROUNDS_PER_LESSON } from '../src/games/game3/types';
import type { Chapter, Lesson, RoundResult } from '../src/games/game3/types';
import { BEDROOM_STOCK_CROPS, KITCHEN_STOCK_CROPS, STOCK_CONTEXTS } from '../src/games/game3/stockAssets';
import type { TaggedCrop } from '../src/types';

function solidBuffer(width: number, height: number, rgba: [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4) as Uint8ClampedArray<ArrayBuffer>;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

function crop(overrides: Partial<TaggedCrop>): TaggedCrop {
  return {
    id: 'x',
    name: 'cup',
    colour: 'red',
    category: 'drinkware',
    function: 'drink from',
    bbox: { x: 0, y: 0, width: 1, height: 1 },
    image: 'data:image/png;base64,x',
    ...overrides,
  };
}

function round(overrides: Partial<RoundResult>): RoundResult {
  return {
    lessonId: 'l1',
    targetId: 'cup',
    supportTier: 3,
    promptsUsed: 0,
    completedAt: Date.now(),
    ...overrides,
  };
}

/** See F.021's own prior version of this helper — strips comments before a
 * static keyword-match check so a comment EXPLAINING a constraint isn't
 * flagged as code VIOLATING it. */
function codeOnly(source: string): string {
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

async function main() {
  section('F.021 — silhouette generation: pure threshold + fill (silhouette.ts, kept for later chapters)');

  await test('a solid dark image becomes fully opaque silhouette (below threshold)', () => {
    const buffer = solidBuffer(10, 10, [10, 10, 10, 255]);
    assert.equal(silhouetteCoverage(computeSilhouette(buffer)), 1);
  });

  await test('a solid bright image becomes fully transparent (above threshold)', () => {
    const buffer = solidBuffer(10, 10, [240, 240, 240, 255]);
    assert.equal(silhouetteCoverage(computeSilhouette(buffer)), 0);
  });

  await test('does not mutate the source buffer', () => {
    const buffer = solidBuffer(5, 5, [10, 10, 10, 255]);
    const snapshot = Uint8ClampedArray.from(buffer.data);
    computeSilhouette(buffer);
    assert.deepEqual(buffer.data, snapshot);
  });

  section('F.021 — generator: alternates add_target and grow_field, never emits an absent target');

  await test('the first lesson introduces the first pool target at the smallest field size', () => {
    const result = walkContext({
      chapterId: 'ch1',
      context: 'kitchen',
      targetPool: ['cup', 'ball', 'teddy', 'shoe', 'book'],
      alreadyIntroduced: [],
      fieldSizes: [2, 3, 4],
      startFieldIndex: 0,
      newElementLessonCountSoFar: 0,
      startLessonIndex: 1,
    });
    assert.equal(result.lessons[0].newElement, 'cup');
    assert.equal(result.lessons[0].fieldSize, 2);
  });

  await test('every lesson.newElement and every lesson.pool entry is drawn from targetPool', () => {
    const pool = ['cup', 'ball', 'teddy', 'shoe', 'book'];
    const result = walkContext({
      chapterId: 'ch1',
      context: 'kitchen',
      targetPool: pool,
      alreadyIntroduced: [],
      fieldSizes: [2, 3, 4],
      startFieldIndex: 0,
      newElementLessonCountSoFar: 0,
      startLessonIndex: 1,
    });
    for (const lesson of result.lessons) {
      if (lesson.newElement !== null) assert.ok(pool.includes(lesson.newElement));
      for (const p of lesson.pool) assert.ok(pool.includes(p));
    }
  });

  await test('inserts a consolidation lesson after every 2nd new-target lesson', () => {
    const result = walkContext({
      chapterId: 'ch1',
      context: 'kitchen',
      targetPool: ['cup', 'ball', 'teddy', 'shoe'],
      alreadyIntroduced: [],
      fieldSizes: [2, 3, 4],
      startFieldIndex: 0,
      newElementLessonCountSoFar: 0,
      startLessonIndex: 1,
    });
    const newTargetLessonIndices = result.lessons
      .map((l, i) => (l.newElement !== null ? i : -1))
      .filter((i) => i >= 0);
    // The 2nd new-target lesson must be immediately followed by a
    // consolidation lesson (newElement === null).
    const secondNewTargetIndex = newTargetLessonIndices[1];
    assert.ok(secondNewTargetIndex !== undefined, 'expected at least 2 new-target lessons');
    const following = result.lessons[secondNewTargetIndex + 1];
    assert.ok(following, 'expected a lesson to follow the 2nd new-target lesson');
    assert.equal(following.newElement, null);
  });

  await test('field size drops one step when a second context starts (never below 0)', () => {
    const first = walkContext({
      chapterId: 'ch1',
      context: 'kitchen',
      targetPool: ['cup', 'ball', 'teddy'],
      alreadyIntroduced: [],
      fieldSizes: [2, 3, 4],
      startFieldIndex: 0,
      newElementLessonCountSoFar: 0,
      startLessonIndex: 1,
    });
    assert.equal(first.endFieldIndex, 2, 'first context should reach the top field size (index 2 -> value 4)');

    const secondStartIndex = Math.max(0, first.endFieldIndex - 1);
    const second = walkContext({
      chapterId: 'ch1',
      context: 'bedroom',
      targetPool: ['cup', 'ball', 'teddy'],
      alreadyIntroduced: ['cup', 'ball', 'teddy'], // already introduced in context 1 — no new targets here
      fieldSizes: [2, 3, 4],
      startFieldIndex: secondStartIndex,
      newElementLessonCountSoFar: first.newElementLessonCount,
      startLessonIndex: first.lessons.length + 1,
    });
    assert.equal(second.lessons[0].fieldSize, 3, 'bedroom should start one field-size step below kitchen\'s ending size (4 -> 3)');
    assert.ok(
      second.lessons.every((l) => l.newElement === null),
      'a second context re-tests the SAME objects — it introduces no new targets',
    );
  });

  await test('a 3-object pool produces a shorter chapter than a 5-object pool', () => {
    const short = estimatedLessonCount(3, [2, 3, 4]);
    const long = estimatedLessonCount(5, [2, 3, 4]);
    assert.ok(short < long, `expected a 3-object pool (${short} lessons) to be shorter than a 5-object pool (${long} lessons)`);
  });

  section('F.021 — advancement: pass/repeat, and the two-part chapter gate (§6)');

  await test('lessonOutcome is "pass" only when every round completed at tier >=3', () => {
    const allLight = [round({ supportTier: 3 }), round({ supportTier: 4 }), round({ supportTier: 5 }), round({ supportTier: 3 })];
    assert.equal(lessonOutcome(allLight), 'pass');
  });

  await test('lessonOutcome is "repeat" when any round needed tier 1-2', () => {
    const oneHeavy = [round({ supportTier: 3 }), round({ supportTier: 2 }), round({ supportTier: 4 }), round({ supportTier: 5 })];
    assert.equal(lessonOutcome(oneHeavy), 'repeat');
  });

  await test('lessonOutcome throws if fewer than ROUNDS_PER_LESSON results are given', () => {
    assert.throws(() => lessonOutcome([round({})]));
  });

  function lesson(overrides: Partial<Lesson>): Lesson {
    return {
      id: 'l1',
      chapterId: 'ch1',
      index: 1,
      rounds: ROUNDS_PER_LESSON,
      fieldSize: 2,
      pool: ['cup'],
      context: 'kitchen',
      newElement: 'cup',
      ...overrides,
    };
  }

  await test('allLessonsPassed is false unless every lesson has a pass outcome', () => {
    const lessons = [lesson({ id: 'a' }), lesson({ id: 'b' })];
    assert.equal(allLessonsPassed(lessons, { a: 'pass', b: 'repeat' }), false);
    assert.equal(allLessonsPassed(lessons, { a: 'pass', b: 'pass' }), true);
  });

  await test('contextIsIndependent is true only once a round in that context resolves at tier 5', () => {
    const lessons = [lesson({ id: 'a', context: 'kitchen' })];
    assert.equal(
      contextIsIndependent('kitchen', lessons, { a: [round({ lessonId: 'a', supportTier: 3 })] }),
      false,
    );
    assert.equal(
      contextIsIndependent('kitchen', lessons, { a: [round({ lessonId: 'a', supportTier: 5 })] }),
      true,
    );
  });

  await test('a chapter with only 1 context can never be complete, even fully passed', () => {
    const chapter: Chapter = { id: 'ch1', title: 't', skill: 's', targetPool: ['cup'], fieldSizes: [2, 3, 4], contexts: ['kitchen'] };
    const lessons = [lesson({ id: 'a', context: 'kitchen' })];
    const outcomes = { a: 'pass' as const };
    const results = { a: [round({ lessonId: 'a', supportTier: 5 })] };
    assert.equal(isChapterComplete(chapter, lessons, outcomes, results), false);
  });

  await test('a chapter completes once all lessons pass AND 2 contexts show independence', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 't',
      skill: 's',
      targetPool: ['cup'],
      fieldSizes: [2, 3, 4],
      contexts: ['kitchen', 'bedroom'],
    };
    const lessons = [lesson({ id: 'a', context: 'kitchen' }), lesson({ id: 'b', context: 'bedroom' })];
    const outcomes = { a: 'pass' as const, b: 'pass' as const };
    const results = {
      a: [round({ lessonId: 'a', supportTier: 5 })],
      b: [round({ lessonId: 'b', supportTier: 5 })],
    };
    assert.equal(isChapterComplete(chapter, lessons, outcomes, results), true);
  });

  section('F.021 — round content: target always included once, clamped to what\'s available');

  await test('buildRoundOptions always includes the target exactly once', () => {
    const target = crop({ id: 't' });
    const lessonCrops = [target, crop({ id: 'a' })];
    const options = buildRoundOptions(target, lessonCrops, [], 4);
    assert.equal(options.filter((c) => c.id === 't').length, 1);
  });

  await test('buildRoundOptions clamps to the available pool rather than padding', () => {
    const target = crop({ id: 't' });
    const options = buildRoundOptions(target, [target], [], 4); // only 1 crop exists anywhere
    assert.equal(options.length, 1);
  });

  await test('buildRoundOptions fills remaining slots from context crops once the lesson pool runs out', () => {
    const target = crop({ id: 't' });
    const options = buildRoundOptions(target, [target], [crop({ id: 'x' }), crop({ id: 'y' })], 3);
    assert.equal(options.length, 3);
  });

  await test('pickRoundTarget avoids repeating the immediately previous target when another option exists', () => {
    const pool = [crop({ id: 'a' }), crop({ id: 'b' })];
    const picked = pickRoundTarget(pool, 'a');
    assert.equal(picked.id, 'b');
  });

  section('F.021 — stock assets: two named sets, each internally distinct, each a real image');

  await test('KITCHEN_STOCK_CROPS and BEDROOM_STOCK_CROPS each have unique, non-empty names and ids', () => {
    for (const set of [KITCHEN_STOCK_CROPS, BEDROOM_STOCK_CROPS]) {
      const names = set.map((c) => c.name.trim().toLowerCase());
      const ids = set.map((c) => c.id);
      assert.equal(new Set(names).size, names.length, 'names must be unique within a set — the generator dedupes by name');
      assert.equal(new Set(ids).size, ids.length, 'ids must be unique within a set');
      assert.ok(names.every((n) => n.length > 0));
    }
  });

  await test('every stock crop has a real inline SVG image, never an empty string', () => {
    for (const set of [KITCHEN_STOCK_CROPS, BEDROOM_STOCK_CROPS]) {
      for (const c of set) {
        assert.ok(c.image.startsWith('data:image/svg+xml'), `${c.id} should carry a real inline SVG, not a placeholder`);
      }
    }
  });

  await test('STOCK_CONTEXTS is exactly [Kitchen, Bedroom], in that order, matching the two crop sets above', () => {
    assert.deepEqual(
      STOCK_CONTEXTS.map((c) => c.label),
      ['Kitchen', 'Bedroom'],
    );
    assert.equal(STOCK_CONTEXTS[0].crops, KITCHEN_STOCK_CROPS);
    assert.equal(STOCK_CONTEXTS[1].crops, BEDROOM_STOCK_CROPS);
  });

  await test('the two stock sets don\'t silently share a name — a real second-context test needs the SAME pool, not overlapping names by accident', () => {
    const kitchenNames = new Set(KITCHEN_STOCK_CROPS.map((c) => c.name.trim().toLowerCase()));
    const bedroomNames = BEDROOM_STOCK_CROPS.map((c) => c.name.trim().toLowerCase());
    const overlap = bedroomNames.filter((n) => kitchenNames.has(n));
    assert.deepEqual(overlap, [], `unexpected name overlap between stock sets: ${overlap.join(', ')}`);
  });

  section('F.021 — Game3Roadmap.tsx no longer depends on the capture pipeline (static check)');

  const roadmapScreenSource = readFileSync(new URL('../src/screens/Game3Roadmap.tsx', import.meta.url), 'utf8');
  const roadmapScreenCode = codeOnly(roadmapScreenSource);

  await test('Game3Roadmap.tsx never imports the capture pipeline or generic fallback crops', () => {
    assert.ok(!/captureRoomAndRecognize/.test(roadmapScreenCode));
    assert.ok(!/GENERIC_FALLBACK_CROPS/.test(roadmapScreenCode));
  });

  await test('Game3Roadmap.tsx sources its content from stockAssets.ts', () => {
    assert.ok(/from '\.\.\/games\/game3\/stockAssets'/.test(roadmapScreenCode));
  });

  section('F.021 — roadmap persistence (real StoragePort, fake-indexeddb)');

  await test('a fresh child has no roadmap progress', async () => {
    const { getRoadmapProgress } = await import('../src/games/game3/roadmap');
    assert.equal(await getRoadmapProgress('fresh-g3-child'), undefined);
  });

  await test('ensureChapterStarted derives a target pool from real crop names and is idempotent', async () => {
    const { ensureChapterStarted } = await import('../src/games/game3/roadmap');
    const crops = [crop({ id: '1', name: 'Cup' }), crop({ id: '2', name: 'cup' }), crop({ id: '3', name: 'Ball' })];
    const first = await ensureChapterStarted('roadmap-child-1', crops, 'Room 1');
    assert.deepEqual(first.targetPool, ['cup', 'ball'], 'names dedupe case-insensitively');
    const again = await ensureChapterStarted('roadmap-child-1', [crop({ id: '9', name: 'shoe' })], 'Room 2');
    assert.deepEqual(again, first, 'a second call is a no-op once a chapter exists');
  });

  await test('recordRound then completeLesson computes and persists the real outcome', async () => {
    const { ensureChapterStarted, deriveLessons, recordRound, completeLesson, getRoadmapProgress } = await import(
      '../src/games/game3/roadmap'
    );
    const crops = [crop({ id: '1', name: 'cup' }), crop({ id: '2', name: 'ball' })];
    const progress = await ensureChapterStarted('roadmap-child-2', crops, 'Room 1');
    const firstLesson = deriveLessons(progress)[0];

    for (let i = 0; i < ROUNDS_PER_LESSON; i++) {
      await recordRound('roadmap-child-2', firstLesson.id, i, round({ lessonId: firstLesson.id, supportTier: 4 }));
    }
    const { outcome } = await completeLesson('roadmap-child-2', firstLesson.id);
    assert.equal(outcome, 'pass');

    const saved = await getRoadmapProgress('roadmap-child-2');
    assert.equal(saved?.lessonOutcomes[firstLesson.id], 'pass');
    assert.equal(saved?.lessonResults[firstLesson.id]?.length, ROUNDS_PER_LESSON);
    assert.equal(saved?.inProgress, null, 'in-progress resume point clears once a lesson completes');
  });

  await test('an in-progress attempt survives a reload (resume point)', async () => {
    const { ensureChapterStarted, deriveLessons, recordRound, getRoadmapProgress } = await import(
      '../src/games/game3/roadmap'
    );
    const crops = [crop({ id: '1', name: 'cup' }), crop({ id: '2', name: 'ball' })];
    const progress = await ensureChapterStarted('roadmap-child-3', crops, 'Room 1');
    const firstLesson = deriveLessons(progress)[0];

    await recordRound('roadmap-child-3', firstLesson.id, 0, round({ lessonId: firstLesson.id }));
    await recordRound('roadmap-child-3', firstLesson.id, 1, round({ lessonId: firstLesson.id }));

    const reloaded = await getRoadmapProgress('roadmap-child-3');
    assert.equal(reloaded?.inProgress?.lessonId, firstLesson.id);
    assert.equal(reloaded?.inProgress?.roundIndex, 2, 'resume point is the NEXT round to play, not the last one played');
    assert.equal(reloaded?.inProgress?.results.length, 2);
  });

  await test('lessonState sequences lessons: passed, then exactly one available, the rest locked', async () => {
    const { ensureChapterStarted, deriveLessons, lessonState, recordRound, completeLesson, getRoadmapProgress } =
      await import('../src/games/game3/roadmap');
    const crops = [crop({ id: '1', name: 'cup' }), crop({ id: '2', name: 'ball' }), crop({ id: '3', name: 'teddy' })];
    let progress = await ensureChapterStarted('roadmap-child-4', crops, 'Room 1');
    const lessons = deriveLessons(progress);
    assert.ok(lessons.length > 1, 'test needs at least 2 lessons to be meaningful');

    // Every lesson should start locked except the very first, which is available.
    assert.equal(lessonState(lessons[0], progress), 'available');
    assert.equal(lessonState(lessons[1], progress), 'locked');

    for (let i = 0; i < ROUNDS_PER_LESSON; i++) {
      await recordRound('roadmap-child-4', lessons[0].id, i, round({ lessonId: lessons[0].id, supportTier: 5 }));
    }
    await completeLesson('roadmap-child-4', lessons[0].id);
    progress = (await getRoadmapProgress('roadmap-child-4'))!;

    assert.equal(lessonState(lessons[0], progress), 'passed');
    assert.equal(lessonState(lessons[1], progress), 'available');
    if (lessons[2]) assert.equal(lessonState(lessons[2], progress), 'locked');
  });

  await test('addContext keeps the same target pool — generalization tests the same objects, not new ones', async () => {
    const { ensureChapterStarted, addContext } = await import('../src/games/game3/roadmap');
    const crops = [crop({ id: '1', name: 'cup' })];
    const progress = await ensureChapterStarted('roadmap-child-5', crops, 'Room 1');
    const withSecond = await addContext('roadmap-child-5', 'Room 2', [crop({ id: '9', name: 'completely-different' })]);
    assert.deepEqual(withSecond.targetPool, progress.targetPool);
    assert.deepEqual(withSecond.contexts, ['Room 1', 'Room 2']);
  });

  section('F.021 — no counter/streak/threshold/tally construct in the new game3 files (repo convention, see smoke-f020.ts)');

  await test('generator.ts, advancement.ts, roadmap.ts, roundBuilder.ts, types.ts contain none of those words', () => {
    const files = [
      '../src/games/game3/generator.ts',
      '../src/games/game3/advancement.ts',
      '../src/games/game3/roadmap.ts',
      '../src/games/game3/roundBuilder.ts',
      '../src/games/game3/types.ts',
      '../src/games/Game3Play.tsx',
      '../src/screens/Game3Roadmap.tsx',
    ];
    const offenders: string[] = [];
    for (const rel of files) {
      const code = codeOnly(readFileSync(new URL(rel, import.meta.url), 'utf8'));
      if (/\b(streak|tally|threshold|counter)\b/i.test(code)) offenders.push(rel);
    }
    assert.deepEqual(offenders, []);
  });

  section('F.021 — Game3Play.tsx: wrong tap is silent, no score/star/confetti anywhere (§7.7, §13)');

  const playSource = readFileSync(new URL('../src/games/Game3Play.tsx', import.meta.url), 'utf8');
  const playCode = codeOnly(playSource);

  await test('Game3Play.tsx never renders a score, star, confetti, or points', () => {
    assert.ok(!/\bscore\b|\bstar\b|confetti|\bpoints?\b/i.test(playCode));
  });

  await test('a wrong tap triggers no spoken line — silence plus fade only', () => {
    const start = playCode.indexOf('function handleOptionTap');
    const end = playCode.indexOf('const handleSupportTierReport');
    const section_ = playCode.slice(start, end);
    const wrongBranch = section_.slice(section_.indexOf('setDeadIds'));
    assert.ok(!/say\(/.test(wrongBranch), 'the wrong-tap branch must not call speechOut.say');
  });

  await test('Game3Play.tsx reuses InteractionMachine rather than reimplementing prompt escalation', () => {
    assert.ok(/from '\.\.\/engine\/interactionMachine'/.test(playCode));
  });

  summarize();
}

void main();
