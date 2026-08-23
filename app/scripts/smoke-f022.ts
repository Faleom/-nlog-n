// Real functional check for F.022 — Game 2: Toy Story Sequencing, redesigned
// (see CLAUDE_CODE_PROMPT_GAME2_REDESIGN.md) to generate its story from a
// live model call over the detected room objects, rather than a small
// hand-written anchor-template library. Run with: npm run smoke:f022
//
// Covers what's left in routineSequencing.ts after the anchor system was
// removed (SequencingMachine's tap-to-place behaviour, modelPlaybackCount,
// actItOutLine, the adapted formatVisualSchedule), plus new static-check
// tests for the generation/validation/fallback/caching pieces this redesign
// added: storyParsing.ts's tolerant-but-strict parser, templateStory.ts's
// never-throws fallback, and game2Story.ts's getOrGenerateStory caching —
// all exercised with fabricated data, no real network call (see
// verify-story-live.ts for the one real, paid, manual check of that).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  SequencingMachine,
  actItOutLine,
  formatVisualSchedule,
  modelPlaybackCount,
  type SequenceStep,
} from '../src/engine/routineSequencing';
import { getOrGenerateStory, type GetOrGenerateStoryDeps } from '../src/engine/game2Story';
import { extractJsonObject, parseStoryResponse } from '../src/adapters/story/storyParsing';
import { createTemplateStory } from '../src/adapters/story/templateStory';
import { StoryGenerationFailedError, type DetectedObjectForStory, type GeneratedStoryTemplate, type StoryGenPort } from '../src/adapters/ports';
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
  return {
    id,
    name,
    colour: 'red',
    category: 'toy',
    function: 'plays with it',
    bbox: { x: 0, y: 0, width: 1, height: 1 },
    image: '',
  };
}

function fakeSteps(names: string[]): SequenceStep[] {
  return names.map((name, i) => ({
    crop: fakeCrop(`c${i}`, name),
    position: i,
    label: `does something with the ${name}`,
  }));
}

function fakeObjects(names: string[]): DetectedObjectForStory[] {
  return names.map((name) => ({ name, colour: 'red', category: 'toy', function: 'play with' }));
}

async function main() {
  section('F.022 — tap-to-place: wrong tap is silent, second wrong locks to correct-only');

  await test('correct taps in order complete the sequence', () => {
    const steps = fakeSteps(['a', 'b', 'c']);
    const m = new SequencingMachine(steps);
    const r1 = m.submitTap('c0');
    assert.equal(r1.correct, true);
    if (r1.correct) assert.equal(r1.complete, false);
    m.submitTap('c1');
    const r3 = m.submitTap('c2');
    assert.equal(r3.correct, true);
    if (r3.correct) assert.equal(r3.complete, true);
    assert.equal(m.isComplete, true);
  });

  await test('a wrong tap does not advance the slot and is not yet locked', () => {
    const steps = fakeSteps(['a', 'b']);
    const m = new SequencingMachine(steps);
    const wrong = m.submitTap('c1'); // c0 is expected first
    assert.equal(wrong.correct, false);
    if (!wrong.correct) assert.equal(wrong.onlyCorrectRemainsTappable, false, 'first wrong tap should not lock yet');
    assert.equal(m.currentSlotIndex, 0, 'the slot must not advance on a wrong tap');
  });

  await test('a second wrong tap on the same slot locks the UI to correct-only', () => {
    const steps = fakeSteps(['a', 'b']);
    const m = new SequencingMachine(steps);
    m.submitTap('c1'); // wrong #1
    const secondWrong = m.submitTap('c1'); // wrong #2, same slot
    assert.equal(secondWrong.correct, false);
    if (!secondWrong.correct) assert.equal(secondWrong.onlyCorrectRemainsTappable, true);
  });

  await test('the wrong-attempt counter resets once the slot is correctly placed', () => {
    const steps = fakeSteps(['a', 'b', 'c']);
    const m = new SequencingMachine(steps);
    m.submitTap('c1'); // wrong on slot 0
    m.submitTap('c0'); // correct, advances to slot 1
    const freshWrong = m.submitTap('c2'); // wrong on slot 1 -- should be attempt #1, not #2
    if (!freshWrong.correct) {
      assert.equal(freshWrong.onlyCorrectRemainsTappable, false, "a new slot should not inherit the previous slot's wrong count");
    }
  });

  section('F.022 — sameness-helps profiles see the sequence modelled twice');

  await test('sameness-helps -> 2 playbacks; everything else -> 1', () => {
    assert.equal(modelPlaybackCount('sameness-helps'), 2);
    assert.equal(modelPlaybackCount('somewhat'), 1);
    assert.equal(modelPlaybackCount('variety'), 1);
    assert.equal(modelPlaybackCount(undefined), 1);
  });

  section('F.022 — off-screen act-it-out and the printable visual schedule');

  await test('actItOutLine names the real Companion, not a generic phrase', () => {
    const line = actItOutLine(fakeProfile());
    assert.ok(line.includes('Bunbun'), `expected the Companion's name: "${line}"`);
    assert.ok(line.toLowerCase().includes('real'));
  });

  await test('formatVisualSchedule renders the title and prepends it to already-rendered lines', () => {
    const rendered = ['First — Bunbun picks up the duck.', 'Last — Bunbun puts away the duck.'];
    const lines = formatVisualSchedule(fakeProfile(), "{child}'s bedtime schedule", rendered);
    assert.equal(lines.length, rendered.length + 1, 'title line plus one line per already-rendered step');
    assert.ok(lines[0]?.includes('Maya'), 'title should be rendered with the real profile slot values');
    assert.equal(lines[1], rendered[0], 'step lines pass through unchanged, already rendered');
    assert.equal(lines[2], rendered[1]);
  });

  section('F.022 — thin layer: no engine logic duplicated (static check)');

  await test('routineSequencing.ts does not reimplement F.009s prompt-tier escalation', () => {
    const source = readFileSync(new URL('../src/engine/routineSequencing.ts', import.meta.url), 'utf8');
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    assert.ok(!/FIRST_PROMPT_DELAY|TIER_2_DELAY|TIER_3_DELAY|RAPID_TAP/i.test(codeOnly));
  });

  await test('no model/network import anywhere in routineSequencing.ts (unchanged from before the redesign)', () => {
    const source = readFileSync(new URL('../src/engine/routineSequencing.ts', import.meta.url), 'utf8');
    assert.ok(!/@anthropic-ai|fetch\(/i.test(source));
  });

  // ---------------------------------------------------------------------
  // Story generation: parsing + validation (storyParsing.ts), fabricated
  // response text only, no network.
  // ---------------------------------------------------------------------

  section('F.022 — story parsing: valid JSON parses correctly');

  const objects = fakeObjects(['bath', 'duck', 'towel']);

  await test('a clean, exact JSON object response parses into a matching story', () => {
    const raw = {
      steps: [
        { sentence: 'First — {companion} gets in the bath.', objectRef: 'bath' },
        { sentence: 'Then — {companion} washes with the duck.', objectRef: 'duck' },
        { sentence: 'Last — {companion} gets dried off with the towel.', objectRef: 'towel' },
      ],
    };
    const story = parseStoryResponse(JSON.stringify(raw), objects);
    assert.equal(story.steps.length, 3);
    assert.deepEqual(story.steps, raw.steps);
  });

  section('F.022 — story parsing: tolerant of prose/markdown fences around the JSON');

  await test('a response wrapped in a markdown code fence still parses', () => {
    const raw = { steps: [{ sentence: 'First — {companion} picks up the duck.', objectRef: 'duck' }, { sentence: 'Last — {companion} puts away the duck.', objectRef: 'duck' }] };
    const text = '```json\n' + JSON.stringify(raw) + '\n```';
    const story = parseStoryResponse(text, objects);
    assert.equal(story.steps.length, 2);
  });

  await test('a response wrapped in leading/trailing prose still parses', () => {
    const raw = { steps: [{ sentence: 'First — {companion} gets in the bath.', objectRef: 'bath' }, { sentence: 'Last — {companion} gets dried off with the towel.', objectRef: 'towel' }] };
    const text = `Sure, here's the story:\n${JSON.stringify(raw)}\nHope that helps!`;
    const story = parseStoryResponse(text, objects);
    assert.equal(story.steps.length, 2);
    assert.equal(story.steps[0]?.objectRef, 'bath');
  });

  await test('extractJsonObject finds the object even with extraneous prose', () => {
    const parsed = extractJsonObject('blah blah {"steps": []} blah') as { steps: unknown[] };
    assert.deepEqual(parsed.steps, []);
  });

  section('F.022 — story parsing: rejects malformed structure');

  await test('a response that is not JSON at all throws StoryGenerationFailedError', () => {
    assert.throws(() => parseStoryResponse('not json at all, no braces here', objects), StoryGenerationFailedError);
  });

  await test('missing "steps" field throws', () => {
    assert.throws(() => parseStoryResponse(JSON.stringify({ notSteps: [] }), objects), StoryGenerationFailedError);
  });

  await test('too few steps (1) throws', () => {
    const raw = { steps: [{ sentence: 'First — {companion} gets in the bath.', objectRef: 'bath' }] };
    assert.throws(() => parseStoryResponse(JSON.stringify(raw), objects), StoryGenerationFailedError);
  });

  await test('too many steps (5) throws', () => {
    const step = { sentence: 'Then — {companion} does something.', objectRef: 'bath' };
    const raw = { steps: [step, step, step, step, step] };
    assert.throws(() => parseStoryResponse(JSON.stringify(raw), objects), StoryGenerationFailedError);
  });

  await test('a step with an empty sentence throws', () => {
    const raw = { steps: [{ sentence: '', objectRef: 'bath' }, { sentence: 'Last — {companion} gets dried off.', objectRef: 'towel' }] };
    assert.throws(() => parseStoryResponse(JSON.stringify(raw), objects), StoryGenerationFailedError);
  });

  await test('an objectRef that matches no detected object throws', () => {
    const raw = {
      steps: [
        { sentence: 'First — {companion} gets in the bath.', objectRef: 'bath' },
        { sentence: 'Last — {companion} plays with the rocket ship.', objectRef: 'rocket ship' },
      ],
    };
    assert.throws(() => parseStoryResponse(JSON.stringify(raw), objects), StoryGenerationFailedError);
  });

  await test('objectRef matching is case-insensitive', () => {
    const raw = {
      steps: [
        { sentence: 'First — {companion} gets in the BATH.', objectRef: 'BATH' },
        { sentence: 'Last — {companion} gets dried off.', objectRef: 'Towel' },
      ],
    };
    const story = parseStoryResponse(JSON.stringify(raw), objects);
    assert.equal(story.steps.length, 2);
  });

  // ---------------------------------------------------------------------
  // Template fallback: must never throw, must always produce 2-4 steps
  // for any realistic object count.
  // ---------------------------------------------------------------------

  section('F.022 — template fallback: never throws, always 2-4 steps');

  const templateStory = createTemplateStory();

  for (const count of [2, 3, 4, 6]) {
    await test(`createTemplateStory() with ${count} objects produces a 2-4 step story referencing real objects`, async () => {
      const objs = fakeObjects(Array.from({ length: count }, (_, i) => `object-${i}`));
      const result = await templateStory.generateStory({ objects: objs, childAgeMonths: 36 });
      assert.ok(result.steps.length >= 2 && result.steps.length <= 4, `expected 2-4 steps, got ${result.steps.length}`);
      for (const step of result.steps) {
        assert.ok(objs.some((o) => o.name === step.objectRef), `objectRef "${step.objectRef}" should be a real object name`);
        assert.ok(step.sentence.includes('{companion}'), 'sentence should carry the unfilled {companion} slot token');
      }
    });
  }

  // ---------------------------------------------------------------------
  // Caching + fallback orchestration: getOrGenerateStory with fake deps
  // (no real registry, no real network, no real storage).
  // ---------------------------------------------------------------------

  section('F.022 — caching: the same photo replays the identical story without regenerating');

  function fakeCache() {
    const store = new Map<string, GeneratedStoryTemplate>();
    return {
      get: async (key: string) => store.get(key),
      set: async (key: string, value: GeneratedStoryTemplate) => {
        store.set(key, value);
      },
    };
  }

  function countingPort(result: GeneratedStoryTemplate, shouldFail = false): { port: StoryGenPort; calls: () => number } {
    let calls = 0;
    return {
      port: {
        async generateStory() {
          calls++;
          if (shouldFail) throw new StoryGenerationFailedError('forced failure for test');
          return result;
        },
      },
      calls: () => calls,
    };
  }

  const samplePhoto = 'data:image/jpeg;base64,' + Buffer.from('fake-photo-bytes-for-f022-smoke').toString('base64');
  const sampleObjects = fakeObjects(['bath', 'duck']);

  await test('a second call for the same photo reuses the cached REAL story and never calls the real generator again', async () => {
    const realResult: GeneratedStoryTemplate = { steps: [{ sentence: 'First — {companion} gets in the bath.', objectRef: 'bath' }, { sentence: 'Last — {companion} washes with the duck.', objectRef: 'duck' }], source: 'real' };
    const real = countingPort(realResult);
    const fallback = countingPort({ steps: [{ sentence: 'fallback', objectRef: 'bath' }, { sentence: 'fallback', objectRef: 'duck' }], source: 'fallback' });
    const deps: GetOrGenerateStoryDeps = { real: real.port, fallback: fallback.port, cache: fakeCache() };

    const first = await getOrGenerateStory(samplePhoto, sampleObjects, 36, undefined, deps);
    const second = await getOrGenerateStory(samplePhoto, sampleObjects, 36, undefined, deps);

    assert.deepEqual(first, realResult);
    assert.deepEqual(second, realResult);
    assert.equal(real.calls(), 1, 'the real generator should only be called once for the same photo');
    assert.equal(fallback.calls(), 0, 'the fallback should never be invoked when the real generator succeeds');
  });

  await test('a failed real generation falls back quietly, but a cached FALLBACK is never a durable hit -- the next attempt for the same photo gets a real chance again', async () => {
    // This is the exact bug a real session hit: the dev proxy was broken,
    // every attempt fell back to generic content, and the first fallback
    // got cached. Once the proxy was fixed, every SUBSEQUENT attempt for
    // that same photo kept replaying the stale cached fallback forever --
    // indistinguishable, from the screen, from the bug still being
    // unfixed. This test is that exact scenario end to end.
    const fallbackResult: GeneratedStoryTemplate = { steps: [{ sentence: 'First — {companion} picks up the bath.', objectRef: 'bath' }, { sentence: 'Last — {companion} puts away the duck.', objectRef: 'duck' }], source: 'fallback' };
    const realResult: GeneratedStoryTemplate = { steps: [{ sentence: 'First — {companion} gets in the bath.', objectRef: 'bath' }, { sentence: 'Last — {companion} washes with the duck.', objectRef: 'duck' }], source: 'real' };
    const sharedCache = fakeCache();
    const fallback = countingPort(fallbackResult);

    const brokenReal = countingPort({ steps: [], source: 'real' }, true);
    const first = await getOrGenerateStory(samplePhoto, sampleObjects, 36, undefined, {
      real: brokenReal.port,
      fallback: fallback.port,
      cache: sharedCache,
    });
    assert.deepEqual(first, fallbackResult, 'a failed real generation should quietly degrade to the fallback');
    assert.equal(brokenReal.calls(), 1);

    // Whatever caused the failure is now fixed -- same photo, same shared
    // cache, but this time the real generator would succeed if given the
    // chance.
    const nowWorkingReal = countingPort(realResult);
    const second = await getOrGenerateStory(samplePhoto, sampleObjects, 36, undefined, {
      real: nowWorkingReal.port,
      fallback: fallback.port,
      cache: sharedCache,
    });
    assert.deepEqual(second, realResult, 'a cached fallback must not block a later real success for the same photo');
    assert.equal(nowWorkingReal.calls(), 1, 'the real generator must be retried, not skipped, when the cache only holds a fallback');
  });

  await test('two different photos each get their own independent generation', async () => {
    const resultA: GeneratedStoryTemplate = { steps: [{ sentence: 'a', objectRef: 'bath' }, { sentence: 'a2', objectRef: 'duck' }], source: 'real' };
    const real = countingPort(resultA);
    const fallback = countingPort({ steps: [{ sentence: 'f', objectRef: 'bath' }, { sentence: 'f2', objectRef: 'duck' }], source: 'fallback' });
    const deps: GetOrGenerateStoryDeps = { real: real.port, fallback: fallback.port, cache: fakeCache() };

    const photoB = 'data:image/jpeg;base64,' + Buffer.from('a-different-photo-entirely').toString('base64');
    await getOrGenerateStory(samplePhoto, sampleObjects, 36, undefined, deps);
    await getOrGenerateStory(photoB, sampleObjects, 36, undefined, deps);

    assert.equal(real.calls(), 2, 'a genuinely different photo should trigger its own generation call');
  });

  summarize();
}

void main();
