// Real functional check for F.011 — Fading Logic.
// Run with: npm run smoke:f011
//
// Scripted fake log entries, exactly as plan/features/F.011.md's Done-when
// section asks: "feed a run, confirm the suggestion appears at the stated
// threshold and not before."

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { INTERACTION_CONFIG } from '../src/config/interaction';
import type { OnScreenPromptTier, SupportTier } from '../src/types';

async function main() {
  const { createProfile, startSession, appendSkillRecord } = await import(
    '../src/engine/profileStore'
  );
  const { getFadingSuggestion } = await import('../src/engine/fading');

  async function feedRecords(
    childId: string,
    sessionId: string,
    skillId: string,
    onScreenTiers: OnScreenPromptTier[],
    supportTier: SupportTier = 3,
  ) {
    for (const t of onScreenTiers) {
      await appendSkillRecord(sessionId, {
        skillId,
        context: 'kitchen',
        supportTier,
        onScreenTier: t,
        prompted: t > 0,
        timestamp: new Date().toISOString(),
      });
    }
    return childId;
  }

  section('F.011 — step up: exactly the stated threshold, not before');

  await test('one good record does not trigger a step-up suggestion', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);
    await feedRecords(profile.id, session.id, 'skill-a', [0]); // just 1, need 3
    const suggestion = await getFadingSuggestion(profile.id, 'skill-a', 3);
    assert.equal(suggestion, null, 'a single unprompted success must not trigger a drop in support');
  });

  await test(
    `exactly ${INTERACTION_CONFIG.STEP_UP_UNPROMPTED_STREAK} consecutive unprompted successes triggers step-up`,
    async () => {
      const profile = await createProfile({ ageMonths: 36 });
      const session = await startSession(profile.id);
      const n = INTERACTION_CONFIG.STEP_UP_UNPROMPTED_STREAK;
      await feedRecords(
        profile.id,
        session.id,
        'skill-b',
        Array(n).fill(0) as OnScreenPromptTier[],
      );
      const suggestion = await getFadingSuggestion(profile.id, 'skill-b', 3);
      assert.ok(suggestion, `expected a suggestion after ${n} consecutive unprompted successes`);
      assert.equal(suggestion?.direction, 'step-up');
      assert.equal(suggestion?.fromTier, 3);
      assert.equal(suggestion?.toTier, 4, 'must move exactly one tier at a time');
    },
  );

  await test(`${INTERACTION_CONFIG.STEP_UP_UNPROMPTED_STREAK - 1} unprompted successes is not enough`, async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);
    const n = INTERACTION_CONFIG.STEP_UP_UNPROMPTED_STREAK - 1;
    await feedRecords(profile.id, session.id, 'skill-c', Array(n).fill(0) as OnScreenPromptTier[]);
    const suggestion = await getFadingSuggestion(profile.id, 'skill-c', 3);
    assert.equal(suggestion, null);
  });

  section('F.011 — step down: exactly the stated threshold, not before');

  await test(
    `${INTERACTION_CONFIG.STEP_DOWN_TIER3_STREAK} consecutive tier-3 (max on-screen prompt) records triggers step-down`,
    async () => {
      const profile = await createProfile({ ageMonths: 36 });
      const session = await startSession(profile.id);
      const n = INTERACTION_CONFIG.STEP_DOWN_TIER3_STREAK;
      await feedRecords(profile.id, session.id, 'skill-d', Array(n).fill(3) as OnScreenPromptTier[]);
      const suggestion = await getFadingSuggestion(profile.id, 'skill-d', 3);
      assert.ok(suggestion, `expected a suggestion after ${n} consecutive tier-3 records`);
      assert.equal(suggestion?.direction, 'step-down');
      assert.equal(suggestion?.fromTier, 3);
      assert.equal(suggestion?.toTier, 2, 'must move exactly one tier at a time');
    },
  );

  await test('a single tier-3 record is not enough to step down', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);
    await feedRecords(profile.id, session.id, 'skill-e', [3]);
    const suggestion = await getFadingSuggestion(profile.id, 'skill-e', 3);
    assert.equal(suggestion, null);
  });

  section('F.011 — it is a suggestion, not a ratchet: both directions work, one tier at a time');

  await test('support can move up then back down for the same skill as history changes', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);

    // Three unprompted successes -> step up from 3.
    await feedRecords(profile.id, session.id, 'skill-f', [0, 0, 0]);
    const up = await getFadingSuggestion(profile.id, 'skill-f', 3);
    assert.equal(up?.direction, 'step-up');
    assert.equal(up?.toTier, 4);

    // Now two tier-3 struggles in a row (most recent 2 of the growing
    // history) -- should suggest stepping back down from wherever the
    // caregiver currently has it set, e.g. 4.
    await feedRecords(profile.id, session.id, 'skill-f', [3, 3]);
    const down = await getFadingSuggestion(profile.id, 'skill-f', 4);
    assert.equal(down?.direction, 'step-down');
    assert.equal(down?.toTier, 3);
  });

  section('F.011 — tier bounds: never suggests below 1 or above 5');

  await test('already at tier 5 (independent) — no step-up suggestion possible', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);
    await feedRecords(profile.id, session.id, 'skill-g', [0, 0, 0]);
    const suggestion = await getFadingSuggestion(profile.id, 'skill-g', 5);
    assert.equal(suggestion, null, 'cannot step up past tier 5');
  });

  await test('already at tier 1 (full physical) — no step-down suggestion possible', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);
    await feedRecords(profile.id, session.id, 'skill-h', [3, 3]);
    const suggestion = await getFadingSuggestion(profile.id, 'skill-h', 1);
    assert.equal(suggestion, null, 'cannot step down past tier 1');
  });

  section('F.011 — per-skill, never blended into one global ability (§13)');

  await test('a strong streak on one skill does not leak into a suggestion for a different skill', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);
    await feedRecords(profile.id, session.id, 'skill-strong', [0, 0, 0]);
    // A brand new skill with NO history at all for this child.
    const suggestion = await getFadingSuggestion(profile.id, 'skill-untouched', 3);
    assert.equal(suggestion, null, 'a different skill must not inherit another skill\'s streak');
  });

  section('F.011 — the caregiver-facing message names a real tier, not a number alone');

  await test('the suggestion message is phrased, not just a bare tier number', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    const session = await startSession(profile.id);
    await feedRecords(profile.id, session.id, 'skill-i', [0, 0, 0]);
    const suggestion = await getFadingSuggestion(profile.id, 'skill-i', 3, 'Maya');
    assert.ok(suggestion);
    assert.ok(suggestion!.message.includes('Maya'));
    assert.ok(suggestion!.message.length > 20, 'message reads like a real sentence, not a code');
  });

  section('F.011 — never a score, percentage, or progress bar (§13, static check)');

  await test('fading.ts never produces a percentage or numeric score string', () => {
    const source = readFileSync(new URL('../src/engine/fading.ts', import.meta.url), 'utf8');
    // Code only -- the file's own header comment correctly *states* this
    // constraint in prose ("never a score, percentage..."), which would
    // otherwise trip a naive check on the raw text.
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    assert.ok(!/%|percent|score\s*[:=]/i.test(codeOnly));
  });

  summarize();
}

void main();
