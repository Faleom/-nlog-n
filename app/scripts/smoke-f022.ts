// Real functional check for F.022 — Game 2: Toy Story Sequencing.
// Run with: npm run smoke:f022

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  ROUTINE_ANCHOR_OPTIONS,
  getRoutineAnchors,
  buildSequence,
  modelPlaybackCount,
  SequencingMachine,
  actItOutLine,
  formatVisualSchedule,
} from '../src/engine/routineSequencing';
import type { ChildProfile, TaggedCrop } from '../src/types';

function fakeProfile(overrides: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: 'x',
    ageMonths: 40,
    nickname: 'Maya',
    responseProfile: {},
    context: { companion: { photo: '', name: 'Bunbun', pronoun: 'he' } },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function fakeCrop(id: string, name: string): TaggedCrop {
  return { id, name, colour: 'red', category: 'toy', function: 'plays with it', bbox: { x: 0, y: 0, width: 1, height: 1 }, image: '' };
}

async function main() {
  section('F.022 — routine anchors: uses the child\'s REAL routine, falls back sensibly');

  await test('a profile with no saved anchors gets a sensible default pair', () => {
    const profile = fakeProfile();
    const anchors = getRoutineAnchors(profile);
    assert.equal(anchors.length, 2);
    for (const a of anchors) assert.ok((ROUTINE_ANCHOR_OPTIONS as readonly string[]).includes(a));
  });

  await test('a profile with real saved anchors uses those, not the default', () => {
    const profile = fakeProfile({
      context: { peopleAndRoutine: { routineAnchors: ['snack', 'going out'] } },
    });
    const anchors = getRoutineAnchors(profile);
    assert.deepEqual(anchors, ['snack', 'going out']);
  });

  section('F.022 — sequence building: never invents an object that is not really there');

  await test('buildSequence only uses crops that actually exist this session', () => {
    const crops = [fakeCrop('c1', 'rubber duck'), fakeCrop('c2', 'towel')];
    const steps = buildSequence('bath time', crops);
    assert.equal(steps.length, 2, 'only 2 real crops were available, so only 2 steps');
    assert.equal(steps[0]?.crop.id, 'c1');
    assert.equal(steps[1]?.crop.id, 'c2');
  });

  await test('a full crop set produces the full 3-step template for that anchor', () => {
    const crops = [fakeCrop('c1', 'a'), fakeCrop('c2', 'b'), fakeCrop('c3', 'c')];
    const steps = buildSequence('bedtime', crops);
    assert.equal(steps.length, 3);
  });

  section('F.022 — sameness-helps profiles see the sequence modelled twice');

  await test('sameness-helps -> 2 playbacks; everything else -> 1', () => {
    assert.equal(modelPlaybackCount('sameness-helps'), 2);
    assert.equal(modelPlaybackCount('somewhat'), 1);
    assert.equal(modelPlaybackCount('variety'), 1);
    assert.equal(modelPlaybackCount(undefined), 1);
  });

  section('F.022 — tap-to-place: wrong tap is silent, second wrong locks to correct-only');

  await test('correct taps in order complete the sequence', () => {
    const crops = [fakeCrop('c1', 'a'), fakeCrop('c2', 'b'), fakeCrop('c3', 'c')];
    const steps = buildSequence('snack', crops);
    const m = new SequencingMachine(steps);
    const r1 = m.submitTap('c1');
    assert.equal(r1.correct, true);
    if (r1.correct) assert.equal(r1.complete, false);
    m.submitTap('c2');
    const r3 = m.submitTap('c3');
    assert.equal(r3.correct, true);
    if (r3.correct) assert.equal(r3.complete, true);
    assert.equal(m.isComplete, true);
  });

  await test('a wrong tap does not advance the slot and is not yet locked', () => {
    const crops = [fakeCrop('c1', 'a'), fakeCrop('c2', 'b')];
    const steps = buildSequence('snack', crops);
    const m = new SequencingMachine(steps);
    const wrong = m.submitTap('c2'); // c1 is expected first
    assert.equal(wrong.correct, false);
    if (!wrong.correct) assert.equal(wrong.onlyCorrectRemainsTappable, false, 'first wrong tap should not lock yet');
    assert.equal(m.currentSlotIndex, 0, 'the slot must not advance on a wrong tap');
  });

  await test('a second wrong tap on the same slot locks the UI to correct-only', () => {
    const crops = [fakeCrop('c1', 'a'), fakeCrop('c2', 'b')];
    const steps = buildSequence('snack', crops);
    const m = new SequencingMachine(steps);
    m.submitTap('c2'); // wrong #1
    const secondWrong = m.submitTap('c2'); // wrong #2, same slot
    assert.equal(secondWrong.correct, false);
    if (!secondWrong.correct) assert.equal(secondWrong.onlyCorrectRemainsTappable, true);
  });

  await test('the wrong-attempt counter resets once the slot is correctly placed', () => {
    const crops = [fakeCrop('c1', 'a'), fakeCrop('c2', 'b'), fakeCrop('c3', 'c')];
    const steps = buildSequence('snack', crops);
    const m = new SequencingMachine(steps);
    m.submitTap('c2'); // wrong on slot 0
    m.submitTap('c1'); // correct, advances to slot 1
    const freshWrong = m.submitTap('c3'); // wrong on slot 1 -- should be attempt #1, not #2
    if (!freshWrong.correct) {
      assert.equal(freshWrong.onlyCorrectRemainsTappable, false, 'a new slot should not inherit the previous slot\'s wrong count');
    }
  });

  section('F.022 — off-screen act-it-out and the printable visual schedule');

  await test('actItOutLine names the real Companion, not a generic phrase', () => {
    const line = actItOutLine(fakeProfile());
    assert.ok(line.includes('Bunbun'), `expected the Companion's name: "${line}"`);
    assert.ok(line.toLowerCase().includes('real'));
  });

  await test('formatVisualSchedule produces one line per step plus a title, using real steps', () => {
    const crops = [fakeCrop('c1', 'a'), fakeCrop('c2', 'b'), fakeCrop('c3', 'c')];
    const steps = buildSequence('bath time', crops);
    const lines = formatVisualSchedule('bath time', steps, fakeProfile());
    assert.equal(lines.length, steps.length + 1, 'title line plus one line per step');
    assert.ok(lines[0]?.includes('Maya'));
    assert.ok(lines[1]?.startsWith('First'));
    assert.ok(lines[2]?.startsWith('Then'));
    assert.ok(lines[3]?.startsWith('Last'));
  });

  section('F.022 — thin layer: no engine logic duplicated (static check)');

  await test('routineSequencing.ts does not reimplement F.009s prompt-tier escalation', () => {
    const source = readFileSync(new URL('../src/engine/routineSequencing.ts', import.meta.url), 'utf8');
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    // It should have its OWN small state machine (a different interaction
    // shape from find-it's grid), not a reimplementation of F.009's
    // wait/repeat/highlight/animate hierarchy or its config constants.
    assert.ok(!/FIRST_PROMPT_DELAY|TIER_2_DELAY|TIER_3_DELAY|RAPID_TAP/i.test(codeOnly));
  });

  await test('no model/network import anywhere in this file (§8.2 -- templates and slots only)', () => {
    const source = readFileSync(new URL('../src/engine/routineSequencing.ts', import.meta.url), 'utf8');
    assert.ok(!/@anthropic-ai|fetch\(/i.test(source));
  });

  summarize();
}

void main();
