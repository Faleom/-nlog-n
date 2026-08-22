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

  section('F.016 — real round trip through the store, one field at a time (tap-only, all skippable)');

  let profileId = '';
  await test('setup: a real profile exists', async () => {
    const profile = await createProfile({ ageMonths: 42 });
    profileId = profile.id;
  });

  await test('saving only favColour persists it and leaves everything else empty', async () => {
    await saveQuickPreferences(profileId, { favColour: 'blue' });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'blue');
    assert.equal(reloaded?.context.quickPreferences?.favAnimal, undefined);
  });

  await test('a second save (favAnimal) does not clobber the first (favColour) — real deep merge', async () => {
    await saveQuickPreferences(profileId, { favAnimal: 'rabbit' });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'blue', 'favColour was clobbered');
    assert.equal(reloaded?.context.quickPreferences?.favAnimal, 'rabbit');
  });

  await test('all six fields save and load together', async () => {
    await saveQuickPreferences(profileId, {
      favColour: 'green',
      favAnimal: 'duck',
      favFood: 'banana',
      favPlace: 'the kitchen',
      favSound: 'chime',
      movement: 'spin',
    });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'green');
    assert.equal(reloaded?.context.quickPreferences?.favAnimal, 'duck');
    assert.equal(reloaded?.context.quickPreferences?.favFood, 'banana');
    assert.equal(reloaded?.context.quickPreferences?.favPlace, 'the kitchen');
    assert.equal(reloaded?.context.quickPreferences?.favSound, 'chime');
    assert.equal(reloaded?.context.quickPreferences?.movement, 'spin');
  });

  section('F.016 — changing a favourite visibly changes what the app says (real slot integration)');

  await test('changing favColour changes a real rendered line, end to end', async () => {
    const before = await getProfile(profileId);
    const lineBefore = renderLine(
      'Find something {fav_colour}!',
      slotValuesFromProfile(before!),
      before!.context,
    );
    assert.ok(lineBefore.includes('green'));

    await saveQuickPreferences(profileId, { favColour: 'purple' });
    const after = await getProfile(profileId);
    const lineAfter = renderLine(
      'Find something {fav_colour}!',
      slotValuesFromProfile(after!),
      after!.context,
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
    const line = renderLine('Find something {fav_colour}!', values, emptyProfile.context);
    assert.ok(!/\{[a-zA-Z_.]+\}/.test(line), `raw slot leaked with an empty profile: "${line}"`);
  });

  section('F.016 — editable from settings any time, no re-onboarding (structural)');

  await test('saveQuickPreferences works identically on a profile created long ago (no special first-time path)', async () => {
    const oldProfile = await createProfile({ ageMonths: 50 });
    await updateProfile(oldProfile.id, { nickname: 'Already onboarded' });
    await saveQuickPreferences(oldProfile.id, { favFood: 'apple' });
    const reloaded = await getProfile(oldProfile.id);
    assert.equal(reloaded?.context.quickPreferences?.favFood, 'apple');
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
