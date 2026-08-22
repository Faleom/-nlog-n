// Real functional check for F.015 -- Branch 2: card, guardrail, save &
// handoff back. Run with: npm run smoke:f015
//
// This is the OFFLINE, deterministic half of F.015's verification: the
// guardrail function itself, the template assembly, and the raw-text
// fallback -- no network, no API key, runs in CI. The REAL adversarial
// test against the live Haiku model (the actual point of this file, per
// the task brief) is scripts/verify-f015-live.ts -- not part of `npm run
// smoke` because it costs real money and needs network + a key. Its
// results are summarized in the final report, not re-derived here.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { checkCardGuardrail } from '../src/engine/branch2Guardrail';
import {
  FIXED_QUESTIONS,
  assembleCard,
  buildObservationSystemPrompt,
  buildObservationUserPrompt,
  buildRawTextCard,
} from '../src/engine/branch2Card';

function codeOnly(path: string): string {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  return source
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

async function main() {
  section('F.015 -- guardrail catches every §9.4 banned word (word-boundary, not substring)');

  const bannedWords = [
    'delayed',
    'disorder',
    'risk',
    'concerning',
    'abnormal',
    'symptom',
    'likely',
    'probably',
    'suggests',
  ];

  for (const word of bannedWords) {
    await test(`"${word}" alone fails the guardrail`, () => {
      const result = checkCardGuardrail(`This is a sentence that is ${word} in nature.`);
      assert.equal(result.passed, false);
      assert.ok(result.reasons.some((r) => r.includes(word)));
    });
  }

  await test('word-boundary matching -- "risk" does not false-positive inside "brisk"', () => {
    const result = checkCardGuardrail('They walked at a brisk pace across the room.');
    assert.equal(result.passed, true, `expected clean text to pass, got: ${result.reasons.join('; ')}`);
  });

  await test('word-boundary matching -- "add" does not false-positive inside "address" or "addition"', () => {
    const result = checkCardGuardrail(
      'They gave their address without trouble and enjoyed an addition to the game.',
    );
    assert.equal(result.passed, true, `expected clean text to pass, got: ${result.reasons.join('; ')}`);
  });

  section('F.015 -- guardrail catches condition names outright');

  for (const phrase of [
    'This may indicate autism.',
    'consistent with ADHD',
    'signs of Asperger syndrome',
    'a possible developmental delay',
    'features of a sensory processing issue',
  ]) {
    await test(`condition-adjacent phrase fails: "${phrase}"`, () => {
      const result = checkCardGuardrail(phrase);
      assert.equal(result.passed, false, `expected this to fail: "${phrase}"`);
    });
  }

  section('F.015 -- guardrail catches severity, probability, percentage');

  for (const phrase of [
    'there is a 40% chance of this',
    'a moderate presentation',
    'a severe case',
    'a high probability of this continuing',
  ]) {
    await test(`severity/probability phrase fails: "${phrase}"`, () => {
      const result = checkCardGuardrail(phrase);
      assert.equal(result.passed, false, `expected this to fail: "${phrase}"`);
    });
  }

  section('F.015 -- guardrail catches recommendations beyond "ask a health worker"');

  for (const phrase of [
    'We recommend starting therapy immediately.',
    'You should see a specialist urgently.',
    'This needs treatment as soon as possible.',
  ]) {
    await test(`recommendation phrase fails: "${phrase}"`, () => {
      const result = checkCardGuardrail(phrase);
      assert.equal(result.passed, false, `expected this to fail: "${phrase}"`);
    });
  }

  section('F.015 -- guardrail passes genuinely clean, parent-observation-shaped text');

  await test('a clean rephrasing passes with no reasons', () => {
    const result = checkCardGuardrail(
      'They have not yet said a word directed at another person, though they frequently ' +
        'vocalise on their own. I first noticed this at around 18 months.',
    );
    assert.equal(result.passed, true, `expected clean text to pass, got: ${result.reasons.join('; ')}`);
    assert.deepEqual(result.reasons, []);
  });

  section('F.015 -- §9.5 worked example: exact output shape, nothing added');

  await test('assembleCard(20, <the §9.5 observation>) matches the guide\'s example verbatim', () => {
    const observation =
      'They have not yet said a word directed at another person, though they frequently ' +
      'vocalise on their own. I first noticed this at around 18 months.';
    const card = assembleCard(20, observation);
    const expected = [
      'To ask your health worker: My child is 20 months old. They have not yet said a word ' +
        'directed at another person, though they frequently vocalise on their own. I first ' +
        'noticed this at around 18 months.',
      '',
      '1. Is this within a typical range for this age?',
      '2. What should I watch for over the next few months?',
      '3. Would a developmental check be worth scheduling?',
    ].join('\n');
    assert.equal(card, expected);
  });

  await test('the §9.5 example observation passes the guardrail cleanly', () => {
    const observation =
      'They have not yet said a word directed at another person, though they frequently ' +
      'vocalise on their own. I first noticed this at around 18 months.';
    const result = checkCardGuardrail(observation);
    assert.equal(result.passed, true, `should pass: ${result.reasons.join('; ')}`);
  });

  section('F.015 -- FIXED_QUESTIONS are the exact §9.4 three, never model-generated');

  await test('FIXED_QUESTIONS matches §9.4 verbatim, in order', () => {
    assert.deepEqual(FIXED_QUESTIONS, [
      'Is this within a typical range for this age?',
      'What should I watch for over the next few months?',
      'Would a developmental check be worth scheduling?',
    ]);
  });

  section('F.015 -- raw-text fallback is always safe: literal words, never a guardrail concern');

  await test('buildRawTextCard never fails its own guardrail, even with adversarial input', () => {
    // The raw fallback's entire point is that it's the parent's own words,
    // untouched -- including a case where the parent explicitly names a
    // condition. Real §9.4 behaviour: the guardrail governs GENERATED
    // text, never the parent's own reported words shown back to them.
    const raw = buildRawTextCard({
      whatNoticed: 'I think she might be autistic, honestly',
      whenNoticed: '2 years old',
      whatItLooksLike: 'she lines up her toys',
      childAgeMonths: 30,
    });
    assert.ok(raw.includes('I think she might be autistic, honestly'));
    assert.ok(raw.includes('30 months old'));
    assert.ok(raw.includes(FIXED_QUESTIONS[0]));
  });

  section('F.015 -- prompt builders are real, and are the SAME text the live proxy sends');

  await test('system prompt states every §9.4 banned word explicitly', () => {
    const system = buildObservationSystemPrompt();
    for (const word of bannedWords) {
      assert.ok(system.includes(word), `system prompt should name "${word}"`);
    }
  });

  await test('user prompt includes the parent\'s literal answers and the age', () => {
    const user = buildObservationUserPrompt({
      whatNoticed: 'hasn\'t said mama',
      whenNoticed: 'around 18 months',
      whatItLooksLike: 'babbles but not at me',
      childAgeMonths: 20,
    });
    assert.ok(user.includes("hasn't said mama"));
    assert.ok(user.includes('around 18 months'));
    assert.ok(user.includes('babbles but not at me'));
    assert.ok(user.includes('20 months'));
  });

  section('F.015 -- the guardrail is a real post-generation check, not just prompt wording (static)');

  await test('haikuCard.ts actually calls checkCardGuardrail and throws GuardrailFailedError', () => {
    const source = codeOnly('../src/adapters/textgen/haikuCard.ts');
    assert.ok(/checkCardGuardrail\(/.test(source), 'haikuCard.ts must call the real guardrail function');
    assert.ok(/throw new GuardrailFailedError/.test(source), 'must throw on guardrail failure');
  });

  await test('rawTextCard.ts never imports the guardrail -- it cannot fail what it never generates', () => {
    const source = codeOnly('../src/adapters/textgen/rawTextCard.ts');
    assert.ok(!/checkCardGuardrail/.test(source));
    assert.ok(!/@anthropic-ai\/sdk/.test(source));
  });

  await test('engine/branch2Card.ts and branch2Guardrail.ts never import a vendor SDK', () => {
    const card = codeOnly('../src/engine/branch2Card.ts');
    const guardrail = codeOnly('../src/engine/branch2Guardrail.ts');
    assert.ok(!/@anthropic-ai\/sdk/.test(card + guardrail));
  });

  summarize();
}

void main();
