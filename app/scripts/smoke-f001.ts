// Real functional check for F.001 — Device Store & Profile Model.
// Run with: npm run smoke:f001
//
// Uses fake-indexeddb so this runs in Node without a browser, but every
// call goes through the real IndexedDbStorage adapter and the real
// profileStore module — nothing here is mocked at the profileStore level.
//
// Checks every item in plan/features/F.001.md's Done-when and Review
// checklist sections that can be automated.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';

async function main() {
  // Import after the fake-indexeddb polyfill is installed, and dynamically
  // so this file's own top-level fake-indexeddb import always runs first.
  const {
    createProfile,
    getProfile,
    getActiveProfile,
    updateProfile,
    startSession,
    appendSkillRecord,
    recordMovementBreak,
    endSession,
    getSessionsForChild,
    getSkillHistory,
    saveQuestionCard,
    getQuestionCards,
    deleteQuestionCard,
  } = await import('../src/engine/profileStore');

  section('F.001 — schema guarantees (static check)');

  await test('ChildProfile / ResponseProfile types have no condition field', () => {
    const typesSource = readFileSync(new URL('../src/types/index.ts', import.meta.url), 'utf8');
    // Looks for a `condition` field declaration anywhere in the type file.
    // A loose but honest check: the word "condition" should not appear at
    // all outside of comments explaining why it doesn't exist.
    const codeOnly = typesSource
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    assert.ok(
      !/\bcondition\??\s*:/i.test(codeOnly),
      'found a `condition:` field declaration in types/index.ts — §5.3 forbids this',
    );
  });

  section('F.001 — profile with only age set');

  let profileId = '';
  await test('createProfile with only ageMonths works, everything else empty', async () => {
    const profile = await createProfile({ ageMonths: 24 });
    profileId = profile.id;
    assert.equal(profile.ageMonths, 24);
    assert.equal(profile.nickname, undefined);
    assert.deepEqual(profile.responseProfile, {});
    assert.deepEqual(profile.context, {});
    assert.equal(profile.declaration, undefined);
    assert.ok(!('condition' in profile), 'profile object must not have a condition key');
  });

  await test('getActiveProfile returns the just-created profile', async () => {
    const active = await getActiveProfile();
    assert.equal(active?.id, profileId);
  });

  section('F.001 — round trip through the real store (not a cached reference)');

  await test('updateProfile persists and getProfile reads it back independently', async () => {
    await updateProfile(profileId, {
      responseProfile: { soundMovement: 'calm', sameness: 'sameness-helps' },
    });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.responseProfile.soundMovement, 'calm');
    assert.equal(reloaded?.responseProfile.sameness, 'sameness-helps');
    // A field we did NOT touch should be untouched — proves merge, not overwrite.
    assert.equal(reloaded?.ageMonths, 24);
  });

  await test('the optional declaration is stored separately from responseProfile', async () => {
    await updateProfile(profileId, { declaration: { declared: true, note: 'told us at intake' } });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.declaration?.declared, true);
    // Storing a declaration must not itself write anything into
    // responseProfile — that would be the declaration silently reaching
    // tuning logic, which §5.3 forbids.
    assert.equal(reloaded?.responseProfile.soundMovement, 'calm'); // unchanged by the declaration write
  });

  section('F.001 — the Companion photo persists (the one image that does)');

  await test('Companion name/pronoun/photo round-trip through the real store', async () => {
    await updateProfile(profileId, {
      context: { companion: { photo: 'data:image/png;base64,FAKE', name: 'Bunbun', pronoun: 'he' } },
    });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.companion?.name, 'Bunbun');
    assert.equal(reloaded?.context.companion?.photo, 'data:image/png;base64,FAKE');
  });

  await test('updating quickPreferences does not clobber the Companion', async () => {
    await updateProfile(profileId, { context: { quickPreferences: { favColour: 'blue' } } });
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.context.companion?.name, 'Bunbun', 'Companion lost after an unrelated update');
    assert.equal(reloaded?.context.quickPreferences?.favColour, 'blue');
  });

  section('F.001 — session logs: skill, context, support tier, prompted, duration, breaks');

  let sessionId = '';
  await test('startSession creates a session for the child', async () => {
    const session = await startSession(profileId);
    sessionId = session.id;
    assert.equal(session.childId, profileId);
    assert.equal(session.activitiesRun, 0);
  });

  await test('appendSkillRecord records skill, context, support tier, on-screen tier, prompted', async () => {
    await appendSkillRecord(sessionId, {
      skillId: 'find-red-object',
      context: 'kitchen',
      supportTier: 3,
      onScreenTier: 2,
      prompted: true,
      timestamp: new Date().toISOString(),
    });
    const sessions = await getSessionsForChild(profileId);
    const session = sessions.find((s) => s.id === sessionId);
    assert.equal(session?.activitiesRun, 1);
    assert.equal(session?.skillRecords[0]?.skillId, 'find-red-object');
    assert.equal(session?.skillRecords[0]?.context, 'kitchen');
    assert.equal(session?.skillRecords[0]?.supportTier, 3);
    assert.equal(session?.skillRecords[0]?.onScreenTier, 2);
    assert.equal(session?.skillRecords[0]?.prompted, true);
  });

  await test('recordMovementBreak increments the break count', async () => {
    const session = await recordMovementBreak(sessionId);
    assert.equal(session.movementBreaks, 1);
  });

  await test('endSession sets duration and endedBy', async () => {
    const session = await endSession(sessionId, 'cap');
    assert.equal(session.endedBy, 'cap');
    assert.ok(session.endedAt);
    assert.ok(session.durationSeconds >= 0);
  });

  await test('getSkillHistory returns records scoped to skill and context', async () => {
    const history = await getSkillHistory(profileId, 'find-red-object', 'kitchen');
    assert.equal(history.length, 1);
    const wrongContext = await getSkillHistory(profileId, 'find-red-object', 'bedroom');
    assert.equal(wrongContext.length, 0);
  });

  section('F.001 — Branch 2 question cards');

  await test('saveQuestionCard / getQuestionCards / deleteQuestionCard round-trip', async () => {
    await saveQuestionCard({
      id: 'card-1',
      childAgeMonths: 24,
      observationText: 'To ask your health worker: ...',
      createdAt: new Date().toISOString(),
      guardrailPassed: true,
    });
    const cards = await getQuestionCards();
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.id, 'card-1');

    await deleteQuestionCard('card-1');
    const afterDelete = await getQuestionCards();
    assert.equal(afterDelete.length, 0);
  });

  section('F.001 — nothing here can hold a room photo (structural, type-level)');

  await test('ChildContextProfile has no room-photo-shaped field', () => {
    const typesSource = readFileSync(new URL('../src/types/index.ts', import.meta.url), 'utf8');
    const contextBlock = typesSource.slice(
      typesSource.indexOf('export interface ChildContextProfile'),
      typesSource.indexOf('}', typesSource.indexOf('export interface ChildContextProfile')),
    );
    assert.ok(
      !/roomPhoto|photo:/i.test(contextBlock),
      'ChildContextProfile appears to have a photo field outside Companion — check it is not a room photo',
    );
  });

  summarize();
}

void main();
