// Real functional check for the concept library (games/concepts/).
// Run with: npm run smoke:concepts
//
// The assertion that matters here is "the distractor is at least as close
// to the sample as the correct answer is". That is not a style preference —
// it IS the teaching mechanism. If a trial's correct answer also happens to
// be the one that most resembles the sample, the child can pass it by
// matching colours and never engage with the concept at all, and nobody
// would notice from the outside because the taps still land on the right
// tile.
//
// Imports the DATA half only. conceptArt.tsx is JSX and cannot be evaluated
// by tsx/Node — its completeness is instead guaranteed at compile time by
// Record<VariantId, ReactElement>, plus the art-coverage check below which
// reads the file as text.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { section, summarize, test } from './testHarness';
import {
  ALL_VARIANTS,
  CONCEPTS,
  buildShapeTrial,
  buildTrial,
  surfaceDistance,
  trialOptions,
  type ConceptKey,
  type Variant,
} from '../src/games/concepts/conceptLibrary';

async function main() {
  // -------------------------------------------------------------------------
  section('Concept library — shape of the data');
  // -------------------------------------------------------------------------

  await test('every concept carries a real spread, not one picture', () => {
    // One picture per concept is exactly the failure this library exists to
    // avoid. Three is the floor: two variants can only ever pose the same
    // single comparison, so the child can memorise the pair rather than the
    // concept. (tomato sits at two on purpose — it exists mainly as a near
    // miss for the fruit cluster, not as a concept to be taught.)
    const thin = Object.values(CONCEPTS)
      .filter((c) => c.variants.length < 3 && c.key !== 'tomato')
      .map((c) => `${c.key}(${c.variants.length})`);
    assert.deepEqual(thin, [], `concepts too thin to teach: ${thin.join(', ')}`);
  });

  await test("apple's variants really do differ — not one drawing relabelled", () => {
    const apples = CONCEPTS.apple.variants;
    assert.ok(new Set(apples.map((v) => v.hue)).size >= 3, 'at least 3 different hues');
    assert.ok(new Set(apples.map((v) => v.shape)).size >= 3, 'at least 3 different shapes');
    assert.ok(new Set(apples.map((v) => v.size)).size >= 2, 'at least 2 different sizes');
  });

  await test('every variant id is unique', () => {
    const ids = ALL_VARIANTS.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  await test('every near miss names a concept that exists and has artwork to draw from', () => {
    for (const concept of Object.values(CONCEPTS)) {
      for (const key of concept.nearMisses) {
        assert.ok(CONCEPTS[key], `${concept.key} names a missing near miss: ${key}`);
        assert.ok(CONCEPTS[key].variants.length > 0, `near miss ${key} has no variants`);
      }
    }
  });

  await test('a near miss is a DIFFERENT concept — never the concept itself', () => {
    for (const concept of Object.values(CONCEPTS)) {
      assert.ok(!concept.nearMisses.includes(concept.key), `${concept.key} lists itself`);
    }
  });

  // -------------------------------------------------------------------------
  section('Concept library — every variant has a drawing');
  // -------------------------------------------------------------------------

  await test('conceptArt.tsx draws every variant the library declares', () => {
    const artSource = readFileSync(
      fileURLToPath(new URL('../src/games/concepts/conceptArt.tsx', import.meta.url)),
      'utf8',
    );
    const missing = ALL_VARIANTS.filter((v) => !artSource.includes(`'${v.id}'`)).map((v) => v.id);
    assert.deepEqual(missing, [], `variants with no artwork: ${missing.join(', ')}`);
  });

  // -------------------------------------------------------------------------
  section('Concept library — trial construction');
  // -------------------------------------------------------------------------

  await test('a trial is built, and its correct answer is the SAME concept as the sample', () => {
    const trial = buildTrial('apple');
    assert.ok(trial);
    assert.equal(trial.correct.concept, 'apple');
    assert.equal(trial.sample.concept, 'apple');
  });

  await test('the correct answer is never the sample shown back again', () => {
    for (let i = 0; i < CONCEPTS.apple.variants.length; i++) {
      const trial = buildTrial('apple', { sampleIndex: i });
      assert.ok(trial);
      assert.notEqual(trial.correct.id, trial.sample.id, `sampleIndex ${i} echoed the sample back`);
    }
  });

  await test('every distractor is a DIFFERENT concept from the sample', () => {
    for (let i = 0; i < CONCEPTS.apple.variants.length; i++) {
      const trial = buildTrial('apple', { sampleIndex: i });
      assert.ok(trial);
      assert.ok(trial.distractors.length > 0, 'a trial with no distractor is not a choice');
      for (const d of trial.distractors) {
        assert.notEqual(d.concept, 'apple', `distractor ${d.id} is itself an apple`);
      }
    }
  });

  await test('THE POINT: the wrong answer looks at least as much like the sample as the right one', () => {
    // If this ever flips, the trial silently becomes a colour-matching task
    // that any child passes without understanding the concept at all.
    // Checked across the WHOLE library, not just apple — a new concept whose
    // near misses are too weak would otherwise ship as a fake hard trial.
    const failures: string[] = [];
    for (const key of Object.keys(CONCEPTS) as ConceptKey[]) {
      for (let i = 0; i < CONCEPTS[key].variants.length; i++) {
        const trial = buildTrial(key, { sampleIndex: i });
        if (!trial) continue;
        const toCorrect = surfaceDistance(trial.sample, trial.correct);
        const nearest = Math.min(...trial.distractors.map((d) => surfaceDistance(trial.sample, d)));
        if (nearest > toCorrect) {
          failures.push(`${trial.sample.id}: nearest distractor ${nearest} > correct ${toCorrect}`);
        }
      }
    }
    assert.deepEqual(failures, [], failures.join(' | '));
  });

  await test('every concept, at every sample, produces a usable trial', () => {
    const broken: string[] = [];
    for (const key of Object.keys(CONCEPTS) as ConceptKey[]) {
      for (let i = 0; i < CONCEPTS[key].variants.length; i++) {
        const trial = buildTrial(key, { sampleIndex: i });
        if (!trial) { broken.push(`${key}[${i}]: null`); continue; }
        if (trial.correct.id === trial.sample.id) broken.push(`${key}[${i}]: echoed sample`);
        if (trial.correct.concept !== key) broken.push(`${key}[${i}]: wrong concept`);
        if (trial.distractors.length === 0) broken.push(`${key}[${i}]: no distractor`);
        for (const d of trial.distractors) {
          if (d.concept === key) broken.push(`${key}[${i}]: distractor ${d.id} is the same concept`);
        }
      }
    }
    assert.deepEqual(broken, [], broken.join(' | '));
  });

  await test('the worked example reads the way it was designed to', () => {
    // Sample a dark red apple: the right answer should be a visibly
    // different apple, and a red ball or tomato should be sitting there
    // looking far more like the sample than the right answer does.
    const trial = buildTrial('apple', { sampleIndex: 0 });
    assert.ok(trial);
    assert.equal(trial.sample.id, 'apple-deep-red');
    assert.notEqual(trial.correct.hue, 'red', 'the right answer should not be another red apple');
    assert.ok(
      trial.distractors.some((d) => d.hue === 'red'),
      'a red non-apple should be on screen as the tempting wrong answer',
    );
  });

  await test('distractors are never two of the same thing', () => {
    // "apple / tomato / tomato" happened for real: both tomato variants
    // scored well, so the board offered the same wrong answer twice. A
    // second, DIFFERENT non-apple is worth more, and a doubled distractor
    // makes the board look like it is about tomatoes.
    const dupes: string[] = [];
    for (const key of Object.keys(CONCEPTS) as ConceptKey[]) {
      for (let i = 0; i < CONCEPTS[key].variants.length; i++) {
        const trial = buildTrial(key, { sampleIndex: i });
        if (!trial) continue;
        const concepts = trial.distractors.map((d) => d.concept);
        if (new Set(concepts).size !== concepts.length) {
          dupes.push(`${key}[${i}]: ${concepts.join(' + ')}`);
        }
      }
    }
    assert.deepEqual(dupes, [], dupes.join(' | '));
  });

  // -------------------------------------------------------------------------
  section('Concept library — SHAPE rounds obey the opposite rule');
  // -------------------------------------------------------------------------

  await test('a shape round answers with the SAME variant, not a different one', () => {
    // A silhouette is one particular drawing's outline. A tall light-red
    // apple's outline is not a small green apple's, so answering a shape
    // question with a different variant makes the level unwinnable — and
    // unwinnable in a way that reads as the child failing, not the board.
    const wrong: string[] = [];
    for (const key of Object.keys(CONCEPTS) as ConceptKey[]) {
      for (let i = 0; i < CONCEPTS[key].variants.length; i++) {
        const trial = buildShapeTrial(key, { sampleIndex: i });
        if (!trial) { wrong.push(`${key}[${i}]: null`); continue; }
        if (trial.correct.id !== trial.sample.id) {
          wrong.push(`${key}[${i}]: answer ${trial.correct.id} != sample ${trial.sample.id}`);
        }
      }
    }
    assert.deepEqual(wrong, [], wrong.join(' | '));
  });

  await test('a shape round never puts two of the same object on the board', () => {
    // With one silhouette and two apples on screen, "which has this shape"
    // has no single defensible answer.
    const dupes: string[] = [];
    for (const key of Object.keys(CONCEPTS) as ConceptKey[]) {
      for (let i = 0; i < CONCEPTS[key].variants.length; i++) {
        const trial = buildShapeTrial(key, { sampleIndex: i });
        if (!trial) continue;
        const concepts = trialOptions(trial).map((o) => o.concept);
        if (new Set(concepts).size !== concepts.length) {
          dupes.push(`${key}[${i}]: ${concepts.join(' + ')}`);
        }
      }
    }
    assert.deepEqual(dupes, [], dupes.join(' | '));
  });

  await test('a shape round still offers a real choice', () => {
    for (const key of Object.keys(CONCEPTS) as ConceptKey[]) {
      const trial = buildShapeTrial(key);
      assert.ok(trial, `${key} produced no shape trial`);
      assert.ok(trial.distractors.length > 0, `${key}: a board with no wrong answer is not a choice`);
    }
  });

  await test('shape rounds are playable for MORE concepts than generalization rounds', () => {
    // Matching an outline to its own drawing needs one variant; finding
    // "another apple" needs two. Thin concepts should still be usable here.
    const shape = (Object.keys(CONCEPTS) as ConceptKey[]).filter((k) => buildShapeTrial(k) !== null);
    const general = (Object.keys(CONCEPTS) as ConceptKey[]).filter((k) => buildTrial(k) !== null);
    assert.ok(shape.length >= general.length, 'shape rounds should never be the narrower set');
    assert.ok(shape.includes('tomato'), 'tomato has one usable outline and should be shape-playable');
  });

  await test('options always contain the correct answer exactly once', () => {
    for (let i = 0; i < CONCEPTS.apple.variants.length; i++) {
      const trial = buildTrial('apple', { sampleIndex: i });
      assert.ok(trial);
      const options = trialOptions(trial);
      const hits = options.filter((o: Variant) => o.id === trial.correct.id);
      assert.equal(hits.length, 1, `sampleIndex ${i}: correct answer appears ${hits.length} times`);
    }
  });

  await test('trials are deterministic — the same sample lays out the same way every time', () => {
    // §5.2's `sameness` dimension: a child who needs predictability must not
    // get a reshuffled board for the same question.
    const a = buildTrial('apple', { sampleIndex: 2 });
    const b = buildTrial('apple', { sampleIndex: 2 });
    assert.deepEqual(a, b);
  });

  await test('EVERY concept in the library can actually form a trial', () => {
    // The real invariant now that the library has grown: a concept with one
    // variant has no "different apple" to offer as the correct answer, so it
    // silently can never be played. Shipping one would look fine in the
    // library and simply never appear in the game.
    const unplayable = Object.keys(CONCEPTS).filter((k) => buildTrial(k as ConceptKey) === null);
    assert.deepEqual(unplayable, [], `concepts that can never be played: ${unplayable.join(', ')}`);
  });

  await test('an unknown concept key refuses rather than throwing', () => {
    assert.equal(buildTrial('not-a-real-concept' as ConceptKey), null);
  });

  await test('sampleIndex wraps instead of running off the end', () => {
    const count = CONCEPTS.apple.variants.length;
    assert.deepEqual(buildTrial('apple', { sampleIndex: count }), buildTrial('apple', { sampleIndex: 0 }));
  });

  summarize();
}

void main();
