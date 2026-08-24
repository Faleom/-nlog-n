// Real functional check for F.013 — Session Cap, Fade & Off-Screen Handoff.
// Run with: npm run smoke:f013

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { INTERACTION_CONFIG, sessionCapMinutes } from '../src/config/interaction';
import type { ChildProfile } from '../src/types';

async function main() {
  const { createProfile, startSession, endSession, appendSkillRecord } = await import(
    '../src/engine/profileStore'
  );
  const {
    getSessionNumber,
    sessionCapSeconds,
    hasCapBeenReached,
    endSessionNow,
    childFacingHandoffLine,
    distinctSkillsThisSession,
  } = await import('../src/engine/sessionLifecycle');

  section('F.013 — session cap: 12 min session 1, -1/session, floor 6');

  await test('sessionCapMinutes matches the stated schedule exactly', () => {
    assert.equal(sessionCapMinutes(1), 12);
    assert.equal(sessionCapMinutes(2), 11);
    assert.equal(sessionCapMinutes(3), 10);
    assert.equal(sessionCapMinutes(9), 6, 'raw formula gives 4, must floor to 6');
    assert.equal(sessionCapMinutes(20), 6, 'must never drop below the 6-minute floor');
  });

  await test('getSessionNumber counts a child\'s real session history', async () => {
    const profile = await createProfile({ ageMonths: 40 });
    const first = await getSessionNumber(profile.id);
    assert.equal(first, 1, 'a brand new child starts at session 1');

    const s1 = await startSession(profile.id);
    await endSession(s1.id, 'cap');
    const second = await getSessionNumber(profile.id);
    assert.equal(second, 2);

    const s2 = await startSession(profile.id);
    await endSession(s2.id, 'idle');
    const third = await getSessionNumber(profile.id);
    assert.equal(third, 3, 'session number reflects real completed sessions, not a guess');
  });

  await test('hasCapBeenReached is exact at the boundary, not off-by-one', () => {
    const capSeconds = sessionCapSeconds(1); // 720s
    assert.equal(hasCapBeenReached(1, capSeconds - 1), false);
    assert.equal(hasCapBeenReached(1, capSeconds), true);
  });

  section('F.013 — three exit conditions converge on one ending');

  let childId = '';
  await test('setup: a profile with a real session', async () => {
    const profile = await createProfile({ ageMonths: 40, nickname: 'Maya' });
    childId = profile.id;
  });

  for (const reason of ['cap', 'idle', 'caregiver'] as const) {
    await test(`endSessionNow('${reason}') persists the same shape as the other two`, async () => {
      const session = await startSession(childId);
      await appendSkillRecord(session.id, {
        skillId: 'find-red-cup',
        context: 'kitchen',
        supportTier: 3,
        onScreenTier: 1,
        prompted: true,
        timestamp: new Date().toISOString(),
      });
      const result = await endSessionNow(session.id, reason, 'red cup');
      assert.equal(result.reason, reason);
      assert.equal(result.session.endedBy, reason);
      assert.ok(result.session.endedAt);
      assert.equal(result.handoffObjectName, 'red cup');
    });
  }

  section('F.013 — the handoff names a REAL object from this session');

  await test('childFacingHandoffLine names the actual object, not a generic one', () => {
    const profile: ChildProfile = {
      id: 'x',
      ageMonths: 40,
      responseProfile: {},
      context: { companion: { photo: '', name: 'Bunbun', pronoun: 'he' } },
      createdAt: '',
      updatedAt: '',
    };
    const line = childFacingHandoffLine(profile, 'blue ball');
    assert.ok(line.includes('blue ball'), `expected the real object in the line: "${line}"`);
    assert.ok(line.includes('Bunbun'), `expected the Companion's name in the line: "${line}"`);
  });

  await test('with no object interacted with, falls back to a neutral phrase, never a crash', async () => {
    const session = await startSession(childId);
    const result = await endSessionNow(session.id, 'idle', null);
    assert.equal(result.handoffObjectName, 'favourite thing');
  });

  section('F.013 — distinct skills this session');

  await test('distinctSkillsThisSession dedupes repeats of the same skill', async () => {
    const session = await startSession(childId);
    for (let i = 0; i < 3; i++) {
      await appendSkillRecord(session.id, {
        skillId: 'find-red-cup',
        context: 'kitchen',
        supportTier: 3,
        onScreenTier: 0,
        prompted: false,
        timestamp: new Date().toISOString(),
      });
    }
    await appendSkillRecord(session.id, {
      skillId: 'find-blue-ball',
      context: 'kitchen',
      supportTier: 3,
      onScreenTier: 0,
      prompted: false,
      timestamp: new Date().toISOString(),
    });
    const finalSessions = (await import('../src/engine/profileStore')).getSessionsForChild;
    const sessions = await finalSessions(childId);
    const thisOne = sessions.find((s) => s.id === session.id)!;
    const distinct = distinctSkillsThisSession(thisOne);
    assert.deepEqual([...distinct].sort(), ['find-blue-ball', 'find-red-cup']);
  });

  section('F.013 — no streaks, no total-time rewards (static check)');

  await test('sessionLifecycle.ts never frames shortening as decline or rewards a streak', () => {
    const source = readFileSync(new URL('../src/engine/sessionLifecycle.ts', import.meta.url), 'utf8');
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    assert.ok(!/streak|days in a row|total.?time|badge|reward/i.test(codeOnly));
  });

  section('F.013 — config sanity: cap floor matches INTERACTION_CONFIG');

  await test('sessionCapSeconds never goes below the floor, at any session number', () => {
    for (const n of [1, 5, 10, 50, 1000]) {
      const seconds = sessionCapSeconds(n);
      assert.ok(seconds >= INTERACTION_CONFIG.SESSION_CAP_FLOOR_MINUTES * 60);
    }
  });

  summarize();
}

void main();
