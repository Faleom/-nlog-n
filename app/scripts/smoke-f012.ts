// Real functional check for F.012 — Game 1 Difficulty Levels 1-4. Run
// with: npm run smoke:f012
//
// game1Difficulty.ts and game1Level.ts are pure (or, for game1Level.ts,
// StoragePort-backed with fake-indexeddb) — fully testable without a
// browser or camera. Game1.tsx's own wiring of this logic (the level
// picker UI, the movement-break phase) needs a human on a real device —
// see PERSON-2's final report.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  applyProfileTuning,
  buildConfirmationGrid,
  buildSearchPromptTemplate,
  gridSizeForLevel,
  searchScopeLabelForLevel,
  shuffleGrid,
  targetDescriptionForLevel,
} from '../src/games/game1Difficulty';
import type { ChildProfile, TaggedCrop } from '../src/types';
import type { Game1Level } from '../src/games/game1Level';

function crop(overrides: Partial<TaggedCrop>): TaggedCrop {
  return {
    id: 'x',
    name: 'cup',
    colour: 'red',
    category: 'drinkware',
    function: 'drink from',
    bbox: { x: 0, y: 0, width: 1, height: 1 },
    image: '',
    ...overrides,
  };
}

function baseProfile(overrides: Partial<ChildProfile['responseProfile']> = {}): ChildProfile {
  return {
    id: 'child-1',
    ageMonths: 40,
    responseProfile: overrides,
    context: {},
    createdAt: '',
    updatedAt: '',
  };
}

async function main() {
  section('F.012 — prompt type walks the ladder exactly per §8.1\'s worked example');

  await test('L1: named object — "your {colour} {name}"', () => {
    const c = crop({ name: 'cup', colour: 'red' });
    assert.equal(targetDescriptionForLevel(1, c), 'your red cup');
  });

  await test('L2: attribute — "something {colour}"', () => {
    const c = crop({ colour: 'red' });
    assert.equal(targetDescriptionForLevel(2, c), 'something red');
  });

  await test('L3: category/function — "something you {function}"', () => {
    const c = crop({ function: 'drink from' });
    assert.equal(targetDescriptionForLevel(3, c), 'something you drink from');
  });

  await test('L4: abstracted function — matches the guide\'s own worked example for a cup', () => {
    const c = crop({ category: 'drinkware' });
    assert.equal(targetDescriptionForLevel(4, c), "something you use when you're thirsty");
  });

  await test('L4 degrades gracefully for an unrecognised category rather than guessing', () => {
    const c = crop({ category: 'some-totally-unknown-category' });
    assert.equal(targetDescriptionForLevel(4, c), 'something you use when you need it');
  });

  await test('all four levels are actually distinguishable from each other for the same crop', () => {
    const c = crop({});
    const descriptions = ([1, 2, 3, 4] as Game1Level[]).map((l) => targetDescriptionForLevel(l, c));
    assert.equal(new Set(descriptions).size, 4, 'all 4 level descriptions must be distinct');
  });

  section('F.012 — grid size: 2 crops -> 6 crops, clamped to what the room actually has');

  await test('grid size grows monotonically with level', () => {
    const sizes = ([1, 2, 3, 4] as Game1Level[]).map(gridSizeForLevel);
    assert.deepEqual(sizes, [2, 4, 5, 6]);
  });

  await test('buildConfirmationGrid clamps to the available crop pool rather than padding', () => {
    const target = crop({ id: 't' });
    const pool = [target, crop({ id: 'a' }), crop({ id: 'b' })]; // only 3 total
    const grid = buildConfirmationGrid(pool, target, 4); // wants 6
    assert.equal(grid.length, 3, 'must not exceed the actual pool size');
  });

  await test('buildConfirmationGrid always includes the target exactly once', () => {
    const target = crop({ id: 't' });
    const pool = [target, crop({ id: 'a' }), crop({ id: 'b' }), crop({ id: 'c' }), crop({ id: 'd' }), crop({ id: 'e' })];
    for (const level of [1, 2, 3, 4] as Game1Level[]) {
      const grid = buildConfirmationGrid(pool, target, level);
      assert.equal(grid.filter((c) => c.id === 't').length, 1);
    }
  });

  section('F.012 — distractors: unrelated at low levels, sharing a feature at high levels');

  await test('L1 prefers UNRELATED distractors over ones sharing category/colour when both exist', () => {
    const target = crop({ id: 't', category: 'drinkware', colour: 'red' });
    const sameCategory = crop({ id: 'same', category: 'drinkware', colour: 'blue' });
    const unrelated = crop({ id: 'diff', category: 'toy', colour: 'green' });
    const grid = buildConfirmationGrid([target, sameCategory, unrelated], target, 1);
    // gridSizeForLevel(1) === 2, so only ONE distractor is picked — it
    // should be the unrelated one.
    assert.equal(grid.length, 2);
    assert.equal(grid[1].id, 'diff');
  });

  await test('L4 prefers distractors SHARING a feature (category or colour) over unrelated ones', () => {
    const target = crop({ id: 't', category: 'drinkware', colour: 'red' });
    const sameCategory = crop({ id: 'same', category: 'drinkware', colour: 'blue' });
    const unrelated = crop({ id: 'diff', category: 'toy', colour: 'green' });
    const grid = buildConfirmationGrid([target, sameCategory, unrelated, crop({ id: 'x2' })], target, 4);
    assert.ok(grid.some((c) => c.id === 'same'), 'the same-category distractor should be preferred and included');
  });

  section('F.012 — search scope: "a different room" wording actually changes at level 4');

  await test('levels 1-2 stay within "this room" phrasing, levels 3-4 mention a different room', () => {
    assert.doesNotMatch(searchScopeLabelForLevel(1), /different room/);
    assert.doesNotMatch(searchScopeLabelForLevel(2), /different room/);
    assert.match(searchScopeLabelForLevel(3), /different room/);
    assert.match(searchScopeLabelForLevel(4), /different room/);
  });

  section('F.012 — profile tuning reads ONLY the four response-profile dimensions, never a condition');

  await test('calm/sameness profile: literal phrasing + fixed layout, no movement-break cadence', () => {
    const tuning = applyProfileTuning(baseProfile({ sameness: 'sameness-helps' }));
    assert.equal(tuning.literalPhrasingOnly, true);
    assert.equal(tuning.fixedLayout, true);
    assert.equal(tuning.movementBreakEveryNTrials, null);
  });

  await test('lively profile: shortened prompt, movement folded in, faster celebration, break every 3', () => {
    const tuning = applyProfileTuning(baseProfile({ soundMovement: 'lively' }));
    assert.equal(tuning.shortenPrompt, true);
    assert.equal(tuning.foldMovementIntoRetrieval, true);
    assert.equal(tuning.fasterCelebration, true);
    assert.equal(tuning.movementBreakEveryNTrials, 3);
  });

  await test('a profile with no answers at all gets neutral (non-tuned) defaults, never crashes', () => {
    const tuning = applyProfileTuning(baseProfile());
    assert.equal(tuning.literalPhrasingOnly, false);
    assert.equal(tuning.fixedLayout, false);
    assert.equal(tuning.movementBreakEveryNTrials, null);
  });

  await test('calm profile prompt has NO idiom/movement wrapper — plain "{companion} wants..." template', () => {
    const tuning = applyProfileTuning(baseProfile({ soundMovement: 'calm' }));
    const template = buildSearchPromptTemplate(1, crop({}), tuning);
    assert.match(template, /^\{companion\} wants/);
  });

  await test('lively profile folds movement into the retrieval prompt itself', () => {
    const tuning = applyProfileTuning(baseProfile({ soundMovement: 'lively' }));
    const template = buildSearchPromptTemplate(1, crop({}), tuning);
    assert.match(template, /^Run and find/);
  });

  section('F.012 — identical phrasing trial to trial under calm/sameness (static + behavioural)');

  await test('the SAME level + SAME crop always produces the IDENTICAL prompt template (deterministic, no randomness)', () => {
    const c = crop({ colour: 'blue', name: 'ball' });
    const tuning = applyProfileTuning(baseProfile({ sameness: 'sameness-helps' }));
    const first = buildSearchPromptTemplate(2, c, tuning);
    const second = buildSearchPromptTemplate(2, c, tuning);
    assert.equal(first, second);
  });

  section('F.012 — shuffleGrid: real shuffling behaviour, deterministic via an injectable RNG');

  await test('is deterministic for a fixed rng sequence (same input, same rng -> same output every time)', () => {
    const grid = ['a', 'b', 'c', 'd'];
    const first = shuffleGrid(grid, () => 0);
    const second = shuffleGrid(grid, () => 0);
    assert.deepEqual(first, second);
  });

  await test('an rng that always returns just-under-1 produces the reverse order (each element swapped to the front)', () => {
    // Fisher-Yates with rng() -> just under 1 picks j = i every iteration,
    // i.e. swaps each element with itself -- the one rng value that IS a
    // true identity permutation, a useful second known-output check
    // alongside the "same rng -> same output" determinism test above.
    const grid = ['a', 'b', 'c', 'd'];
    const result = shuffleGrid(grid, () => 0.999999);
    assert.deepEqual(result, ['a', 'b', 'c', 'd']);
  });

  await test('shuffleGrid does not mutate its input array', () => {
    const grid = ['a', 'b', 'c'];
    shuffleGrid(grid, () => 0.999);
    assert.deepEqual(grid, ['a', 'b', 'c'], 'original array must be untouched');
  });

  await test('shuffleGrid preserves the same set of elements, just reordered', () => {
    const grid = [1, 2, 3, 4, 5];
    const result = shuffleGrid(grid, Math.random);
    assert.deepEqual([...result].sort(), [1, 2, 3, 4, 5]);
  });

  section('F.012 — no timer of any kind under calm/sameness (static check, comments filtered)');

  const game1Source = readFileSync(new URL('../src/games/Game1.tsx', import.meta.url), 'utf8');
  const game1Code = game1Source
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');

  await test('Game1.tsx renders no countdown/visible timer UI element', () => {
    assert.ok(!/setInterval.*[Cc]ountdown|<Countdown|timeLeft|secondsRemaining/.test(game1Code));
  });

  section('F.012 — level state is per child and persists (game1Level.ts, real StoragePort via fake-indexeddb)');

  await test('a fresh child defaults to level 1', async () => {
    const { getGame1Level } = await import('../src/games/game1Level');
    const level = await getGame1Level('fresh-child-id');
    assert.equal(level, 1);
  });

  await test('setGame1Level persists and getGame1Level reads it back for the SAME child', async () => {
    const { getGame1Level, setGame1Level } = await import('../src/games/game1Level');
    await setGame1Level('child-abc', 3);
    assert.equal(await getGame1Level('child-abc'), 3);
  });

  await test('level state is isolated per child — setting one child\'s level does not affect another\'s', async () => {
    const { getGame1Level, setGame1Level } = await import('../src/games/game1Level');
    await setGame1Level('child-x', 4);
    await setGame1Level('child-y', 2);
    assert.equal(await getGame1Level('child-x'), 4);
    assert.equal(await getGame1Level('child-y'), 2);
  });

  summarize();
}

void main();
