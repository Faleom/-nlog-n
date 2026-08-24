// Real functional check for F.016 — Context Profile: Quick Preferences.
// Run with: npm run smoke:f016

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { section, summarize, test } from './testHarness';

async function main() {
  const { saveQuickPreferences, shouldAskIsCompanionStillFavourite } = await import(
    '../src/engine/quickPreferences'
  );
  const { createProfile, getProfile, updateProfile } = await import('../src/engine/profileStore');
  const { slotValuesFromProfile, renderLine } = await import('../src/engine/slots');

  section('F.016 — real round trip through the store (tap-only, skippable, colour-only now)');

  let profileId = '';
  await test('setup: a real profile exists', async () => {
    const profile = await createProfile({ ageMonths: 42 });
    profileId = profile.id;
  });

  await test('saving favColour persists it', async () => {
    await saveQuickPreferences(profileId, { favColour: 'blue' });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'blue');
  });

  await test('a later save overwrites the earlier favColour — real round trip through the store', async () => {
    await saveQuickPreferences(profileId, { favColour: 'green' });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'green');
  });

  section('F.016 — changing a favourite visibly changes what the app says (real slot integration)');

  await test('changing favColour changes a real rendered line, end to end', async () => {
    const before = await getProfile(profileId);
    const lineBefore = renderLine(
      'Find something {fav_colour}!',
      slotValuesFromProfile(before!)
    );
    assert.ok(lineBefore.includes('green'));

    await saveQuickPreferences(profileId, { favColour: 'purple' });
    const after = await getProfile(profileId);
    const lineAfter = renderLine(
      'Find something {fav_colour}!',
      slotValuesFromProfile(after!)
    );
    assert.ok(lineAfter.includes('purple'), 'line did not pick up the new favourite colour');
    assert.ok(!lineAfter.includes('green'), 'line still shows the old favourite colour');
  });

  section('F.016 — an all-skipped (empty) profile still renders a coherent neutral theme');

  await test('a profile that never touches quickPreferences at all still fills every slot', async () => {
    const emptyProfile = await createProfile({ ageMonths: 30 });
    const values = slotValuesFromProfile(emptyProfile);
    for (const [key, value] of Object.entries(values)) {
      assert.equal(typeof value, 'string', `slot ${key} did not default to a string on an empty profile`);
    }
    const line = renderLine('Find something {fav_colour}!', values);
    assert.ok(!/\{[a-zA-Z_.]+\}/.test(line), `raw slot leaked with an empty profile: "${line}"`);
  });

  section('F.016 — editable from settings any time, no re-onboarding (structural)');

  await test('saveQuickPreferences works identically on a profile created long ago (no special first-time path)', async () => {
    const oldProfile = await createProfile({ ageMonths: 50 });
    await updateProfile(oldProfile.id, { nickname: 'Already onboarded' });
    await saveQuickPreferences(oldProfile.id, { favColour: 'yellow' });
    const reloaded = await getProfile(oldProfile.id);
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'yellow');
    assert.equal(reloaded?.nickname, 'Already onboarded');
  });

  section('F.016 — §6.5 companion check-in timing: pure function of session count');

  await test('never asks before 10 completed sessions', () => {
    assert.equal(shouldAskIsCompanionStillFavourite(0), false);
    assert.equal(shouldAskIsCompanionStillFavourite(1), false);
    assert.equal(shouldAskIsCompanionStillFavourite(9), false);
  });

  await test('asks at 10, and again every 10th session after that', () => {
    assert.equal(shouldAskIsCompanionStillFavourite(10), true);
    assert.equal(shouldAskIsCompanionStillFavourite(15), false);
    assert.equal(shouldAskIsCompanionStillFavourite(20), true);
    assert.equal(shouldAskIsCompanionStillFavourite(30), true);
  });

  summarize();
}

void main();
