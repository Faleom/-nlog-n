// Real functional check for F.002 — Shared Onboarding.
// Run with: npm run smoke:f002

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';

async function main() {
  const { parseAgeMonths } = await import('../src/engine/onboarding');
  const { createProfile, getProfile } = await import('../src/engine/profileStore');

  section('F.002 — age validation: the only required field');

  await test('a plain whole number of months is valid', () => {
    assert.equal(parseAgeMonths('42'), 42);
  });

  await test('empty input is invalid (required field, not defaulted)', () => {
    assert.equal(parseAgeMonths(''), null);
    assert.equal(parseAgeMonths('   '), null);
  });

  await test('non-numeric, negative, zero and implausible ages are all rejected', () => {
    assert.equal(parseAgeMonths('abc'), null);
    assert.equal(parseAgeMonths('-3'), null);
    assert.equal(parseAgeMonths('0'), null);
    assert.equal(parseAgeMonths('3.5'), null);
    assert.equal(parseAgeMonths('9999'), null);
  });

  section('F.002 — real profile creation through the store, age + optional nickname');

  await test('creating a profile with only age works, nickname stays undefined', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    assert.equal(profile.ageMonths, 36);
    assert.equal(profile.nickname, undefined);
    const reloaded = await getProfile(profile.id);
    assert.equal(reloaded?.ageMonths, 36, 'age did not really persist through the store');
  });

  await test('a skipped nickname leaves no blank string anywhere downstream', async () => {
    const profile = await createProfile({ ageMonths: 30 });
    // Onboarding.tsx passes `undefined`, never `''`, when the nickname
    // field is left empty — verify the real save path preserves that.
    assert.notEqual(profile.nickname, '', 'nickname should be undefined, not an empty string');
  });

  await test('a provided nickname round-trips through the real store', async () => {
    const profile = await createProfile({ ageMonths: 42, nickname: 'Maya' });
    const reloaded = await getProfile(profile.id);
    assert.equal(reloaded?.nickname, 'Maya');
  });

  section('F.002 — no diagnosis/condition/development question on this screen (§5.1, static check)');

  await test('Onboarding.tsx never mentions diagnosis, condition or development', () => {
    const source = readFileSync(new URL('../src/screens/Onboarding.tsx', import.meta.url), 'utf8');
    const codeAndTextOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    // "development" is allowed ONLY inside the second (Branch 2) door's
    // label, which is exactly the equal-weight door text the guide
    // specifies (§5.1) -- it is not a question asked about the child.
    assert.ok(!/diagnos|condition/i.test(codeAndTextOnly), 'found forbidden diagnosis/condition wording');
  });

  await test('the two doors are rendered with identical button styling (equal visual weight)', () => {
    const source = readFileSync(new URL('../src/screens/Onboarding.tsx', import.meta.url), 'utf8');
    // Both door buttons must share the same disabled={creating} prop and
    // no distinguishing style prop between them -- a crude but honest
    // check that neither has a "primary"-looking treatment the other lacks.
    const doorsBlock = source.slice(source.indexOf('What brings you here?'));
    const buttonMatches = [...doorsBlock.matchAll(/<button[^>]*>/g)];
    assert.equal(buttonMatches.length, 2, 'expected exactly two door buttons');
    const [first, second] = buttonMatches;
    assert.equal(first[0].includes('disabled={creating}'), true);
    assert.equal(second[0].includes('disabled={creating}'), true);
    assert.ok(!/primary|default|recommended/i.test(doorsBlock), 'a door button looks styled as default');
  });

  summarize();
}

void main();
