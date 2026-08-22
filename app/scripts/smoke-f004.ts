// Real functional check for F.004 — Companion Capture.
// Run with: npm run smoke:f004
//
// Uses fake-indexeddb so this runs in Node, going through the real
// profileStore. The no-people gate is exercised two ways: once against
// whatever FaceDetectPort is CURRENTLY wired in the registry (today, the
// fixture, which always returns zero faces -- proving the "pass" path
// really runs through the real, wired adapter, not a mock), and once
// against an injected fake port that DOES report a face, to prove the
// rejection path actually rejects and actually saves nothing. Both go
// through the same `captureCompanion`/`detectFaceInCompanionPhoto`
// functions the real screen calls -- nothing is bypassed.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { section, summarize, test } from './testHarness';
import type { FaceDetectPort } from '../src/adapters/ports';

function fakeImage(): ImageBitmap {
  // detectFaceInCompanionPhoto never inspects the image itself -- it just
  // hands it to FaceDetectPort.findFaces(). A typed stand-in is enough,
  // and keeps this test out of canvas/DOM territory entirely.
  return {} as unknown as ImageBitmap;
}

function faceDetectThatSees(faces: number): FaceDetectPort {
  return {
    async findFaces() {
      return Array.from({ length: faces }, () => ({ x: 0, y: 0, width: 10, height: 10 }));
    },
  };
}

async function main() {
  const { adapters } = await import('../src/adapters/registry');
  const {
    captureCompanion,
    detectFaceInCompanionPhoto,
    saveCompanion,
    COMPANION_REJECTION_MESSAGE,
  } = await import('../src/engine/companionCapture');
  const { createProfile, getProfile, getActiveProfile } = await import('../src/engine/profileStore');
  const { slotValuesFromProfile } = await import('../src/engine/slots');

  section('F.004 — the no-people gate, against a fake detector that DOES see a face');

  let profileId = '';
  await test('setup: a real profile exists to capture a Companion for', async () => {
    const profile = await createProfile({ ageMonths: 40 });
    profileId = profile.id;
  });

  await test('detectFaceInCompanionPhoto reports true when the port finds a face', async () => {
    const hasFace = await detectFaceInCompanionPhoto(fakeImage(), faceDetectThatSees(1));
    assert.equal(hasFace, true);
  });

  await test('captureCompanion rejects with the exact §6.3 copy, every time a face is found', async () => {
    const result = await captureCompanion(
      profileId,
      fakeImage(),
      'data:image/png;base64,SHOULD_NOT_SAVE',
      'Someone',
      'they',
      faceDetectThatSees(1),
    );
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, COMPANION_REJECTION_MESSAGE);
  });

  await test('a rejected photo saves NOTHING — the profile has no Companion afterward', async () => {
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.companion, undefined, 'a rejected Companion photo must not be saved');
  });

  section('F.004 — the no-people gate, against the REAL currently-wired FaceDetectPort adapter');

  await test('detectFaceInCompanionPhoto works against adapters.faceDetect with no override', async () => {
    // Whichever adapter the registry resolves to today (fixture or real —
    // this test deliberately does not assume which). The fixture always
    // returns zero faces, so this exercises the real "pass" path through
    // the real wired port, not a re-implementation of it.
    const hasFace = await detectFaceInCompanionPhoto(fakeImage());
    assert.equal(typeof hasFace, 'boolean');
  });

  await test('captureCompanion against the real wired adapter saves a real Companion', async () => {
    const result = await captureCompanion(
      profileId,
      fakeImage(),
      'data:image/png;base64,FAKE_BUNBUN',
      'Bunbun',
      'he',
      adapters.faceDetect,
    );
    assert.equal(result.ok, true, 'expected the fixture FaceDetectPort to find no faces and allow the save');
  });

  section('F.004 — the Companion photo really persists (round trip, not a cached reference)');

  await test('reloading the profile independently shows the saved photo, name and pronoun', async () => {
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.companion?.name, 'Bunbun');
    assert.equal(reloaded?.context.companion?.pronoun, 'he');
    assert.equal(reloaded?.context.companion?.photo, 'data:image/png;base64,FAKE_BUNBUN');
  });

  await test('it is also the active profile — simulates surviving a page reload', async () => {
    const active = await getActiveProfile();
    assert.equal(active?.id, profileId);
    assert.equal(active?.context.companion?.name, 'Bunbun');
  });

  section('F.004 — the pronoun is actually used downstream, not hardcoded to "it"');

  await test('saveCompanion with a non-"it" pronoun persists that exact pronoun', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    await saveCompanion(profile.id, 'data:image/png;base64,X', 'Big Ted', 'she');
    const reloaded = await getProfile(profile.id);
    assert.equal(reloaded?.context.companion?.pronoun, 'she', 'pronoun must not be hardcoded to "it"');
  });

  await test('the slot system reflects the real saved pronoun, not a default', async () => {
    // Fetched by id, not "active profile" -- a later test in this file
    // creates further profiles, which would otherwise change which one is
    // active and make this assertion depend on test ordering.
    const profile = await getProfile(profileId);
    const values = slotValuesFromProfile(profile!);
    assert.equal(values.companion_they, 'he');
    assert.equal(values.companion, 'Bunbun');
  });

  section('F.004 — skipping leaves a working neutral guide, not a broken app');

  await test('a profile with no Companion set still resolves neutral slot defaults', async () => {
    const profile = await createProfile({ ageMonths: 33 }); // never captures a Companion
    const values = slotValuesFromProfile(profile);
    assert.equal(values.companion, 'your friend');
    assert.equal(values.companion_they, 'they');
  });

  section('F.004 — updating an unrelated field never clobbers a saved Companion');

  await test('setup + verify Companion survives an unrelated context update', async () => {
    const { updateProfile } = await import('../src/engine/profileStore');
    const profile = await createProfile({ ageMonths: 44 });
    await saveCompanion(profile.id, 'data:image/png;base64,Y', 'Choo-choo', 'it');
    await updateProfile(profile.id, { context: { quickPreferences: { favColour: 'blue' } } });
    const reloaded = await getProfile(profile.id);
    assert.equal(reloaded?.context.companion?.name, 'Choo-choo', 'Companion lost after an unrelated update');
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'blue');
  });

  summarize();
}

void main();
