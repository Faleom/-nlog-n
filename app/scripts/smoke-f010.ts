// Real functional check for F.010 — Support Ladder & Caregiver Logging.
// Run with: npm run smoke:f010

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { SUPPORT_TIERS, getSupportTierInfo, DEFAULT_STARTING_SUPPORT_TIER } from '../src/config/supportLadder';

async function main() {
  const { createProfile, startSession, getSkillHistory } = await import('../src/engine/profileStore');
  const { logActivityOutcome } = await import('../src/engine/activityLogging');

  section('F.010 — the five tiers, defined once');

  await test('exactly five tiers, numbered 1 through 5', () => {
    assert.equal(SUPPORT_TIERS.length, 5);
    assert.deepEqual(
      SUPPORT_TIERS.map((t) => t.tier),
      [1, 2, 3, 4, 5],
    );
  });

  await test('every tier gives a concrete instruction, not just a name', () => {
    for (const info of SUPPORT_TIERS) {
      assert.ok(info.name.length > 0);
      assert.ok(info.instruction.length > 5, `tier ${info.tier}'s instruction reads like a label, not an action`);
      // A concrete instruction is a sentence a caregiver can act on --
      // heuristic: it should contain a verb-shaped word, not just a noun
      // phrase like "Full physical support".
      assert.ok(
        /walk|point|say|wait|guide|touch|let/i.test(info.instruction),
        `tier ${info.tier}'s instruction has no actionable verb: "${info.instruction}"`,
      );
    }
  });

  await test('getSupportTierInfo(3) returns the Gesture tier with its real copy', () => {
    const info = getSupportTierInfo(3);
    assert.equal(info.name, 'Gesture');
    assert.equal(info.instruction, 'Point to it from where you are.');
  });

  await test('errorless start defaults to the most generous tier (1, full physical)', () => {
    assert.equal(DEFAULT_STARTING_SUPPORT_TIER, 1);
  });

  section('F.010 — the log write: skill, context, tier, prompted, to F.001');

  let childId = '';
  let sessionId = '';
  await test('setup: a profile and a session exist to log against', async () => {
    const profile = await createProfile({ ageMonths: 30 });
    childId = profile.id;
    const session = await startSession(childId);
    sessionId = session.id;
  });

  await test('logActivityOutcome writes a real SkillRecord through to F.001', async () => {
    const session = await logActivityOutcome({
      sessionId,
      skillId: 'find-red-cup',
      context: 'kitchen',
      supportTier: 3,
      onScreenPrompted: true,
    });
    const record = session.skillRecords.at(-1);
    assert.equal(record?.skillId, 'find-red-cup');
    assert.equal(record?.context, 'kitchen');
    assert.equal(record?.supportTier, 3);
    assert.equal(record?.prompted, true);
  });

  await test('it really persisted -- getSkillHistory reads it back independently', async () => {
    const history = await getSkillHistory(childId, 'find-red-cup', 'kitchen');
    assert.equal(history.length, 1);
    assert.equal(history[0]?.supportTier, 3);
  });

  await test('an unprompted on-screen confirmation logs prompted=false, independent of support tier', async () => {
    await logActivityOutcome({
      sessionId,
      skillId: 'find-blue-ball',
      context: 'bedroom',
      supportTier: 1, // caregiver gave lots of physical help...
      onScreenPrompted: false, // ...but the on-screen tap was unprompted
    });
    const history = await getSkillHistory(childId, 'find-blue-ball', 'bedroom');
    assert.equal(history[0]?.supportTier, 1);
    assert.equal(history[0]?.prompted, false, 'the two tier concepts must be independently recorded');
  });

  section('F.010 — nothing here computes anything from history (§10, static check)');

  await test('activityLogging.ts contains no aggregation over past records', () => {
    const source = readFileSync(
      new URL('../src/engine/activityLogging.ts', import.meta.url),
      'utf8',
    );
    // Code only -- the file's own header comment correctly *explains* that
    // history-reading belongs to F.011 (mentioning getSkillHistory by
    // name), which would otherwise trip a naive check on the raw text.
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    assert.ok(!/getSkillHistory|getSessionsForChild/.test(codeOnly));
    assert.ok(!/\.length\s*[><=]|streak|consecutive|threshold/i.test(codeOnly));
  });

  await test('supportLadder.ts is pure static data, no history reads at all', () => {
    const source = readFileSync(new URL('../src/config/supportLadder.ts', import.meta.url), 'utf8');
    assert.ok(!/getSkillHistory|getSessionsForChild|profileStore/.test(source));
  });

  section('F.010 — no score visible to the child (§7.7, static check)');

  await test('nothing in this file emits a numeric score or percentage string', () => {
    const source = readFileSync(new URL('../src/config/supportLadder.ts', import.meta.url), 'utf8');
    assert.ok(!/score|percent|grade/i.test(source));
  });

  summarize();
}

void main();
