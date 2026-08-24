// Real functional check for F.019 — Caregiver Dashboard (Minimal).
// Run with: npm run smoke:f019
//
// Populates REAL logged session data through the real profileStore +
// sessionLifecycle/activityLogging paths (not fixtures), then calls the
// exact functions CaregiverDashboard.tsx renders against. That's as close
// to "render the dashboard against real data" as this repo's test setup
// gets without a DOM/jsdom harness -- no UI-rendering test exists
// anywhere else in this codebase either (Game1.tsx has none); every
// screen so far is verified by exercising its real logic functions plus
// a dev-server pass. See this smoke script's final section and the F.019
// report for that scope note.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';

function codeOnlyLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
}

async function main() {
  const {
    createProfile,
    startSession,
    appendSkillRecord,
    recordMovementBreak,
    endSession,
    getSessionsForChild,
  } = await import('../src/engine/profileStore');
  const { distinctSkillsThisSession } = await import('../src/engine/sessionLifecycle');
  const { NON_DIAGNOSTIC_BANNER, getGeneralizedSkills, mostRecentSession } = await import(
    '../src/engine/caregiverDashboard'
  );

  section('F.019 — populate REAL sessions through the real store, not fixtures');

  const profile = await createProfile({ ageMonths: 44, nickname: 'Maya' });

  // Session 1: one skill logged at tier 3 (gesture -- not yet independent),
  // one movement break, ended by cap.
  const session1 = await startSession(profile.id);
  await appendSkillRecord(session1.id, {
    skillId: 'find-red-cup',
    context: 'kitchen',
    supportTier: 3,
    onScreenTier: 1,
    prompted: true,
    timestamp: new Date().toISOString(),
  });
  await recordMovementBreak(session1.id);
  await endSession(session1.id, 'cap');

  // Session 2 (later): the SAME skill now logged at tier 5 (independent,
  // in a different context too) -- this is the generalization case --
  // plus a second, still-supported skill. Shorter session than #1, ended
  // by the caregiver deliberately, not idle/cap. This is the "shortening
  // session" case the dashboard must show as plain fact, not decline.
  await new Promise((resolve) => setTimeout(resolve, 5)); // ensure startedAt orders after session1
  const session2 = await startSession(profile.id);
  await appendSkillRecord(session2.id, {
    skillId: 'find-red-cup',
    context: 'kitchen',
    supportTier: 5,
    onScreenTier: 0,
    prompted: false,
    timestamp: new Date().toISOString(),
  });
  await appendSkillRecord(session2.id, {
    skillId: 'find-red-cup',
    context: 'living-room',
    supportTier: 5,
    onScreenTier: 0,
    prompted: false,
    timestamp: new Date().toISOString(),
  });
  await appendSkillRecord(session2.id, {
    skillId: 'stack-blocks',
    context: 'living-room',
    supportTier: 2,
    onScreenTier: 1,
    prompted: true,
    timestamp: new Date().toISOString(),
  });
  await endSession(session2.id, 'caregiver');

  const sessions = await getSessionsForChild(profile.id);

  await test('both real sessions are actually retrievable from the store', () => {
    assert.equal(sessions.length, 2);
  });

  section('F.019 — mostRecentSession and distinct skills on the REAL most recent session');

  await test('mostRecentSession picks session 2 (later startedAt), not just array order', () => {
    const latest = mostRecentSession(sessions);
    assert.equal(latest?.id, session2.id);
  });

  await test('distinctSkillsThisSession reflects the real skill records, deduplicated', () => {
    const latest = mostRecentSession(sessions)!;
    const skills = distinctSkillsThisSession(latest);
    assert.deepEqual([...skills].sort(), ['find-red-cup', 'stack-blocks']);
  });

  section('F.019 — Generalization list: only tier-5 (independent) records, grouped by real context');

  await test('find-red-cup shows as generalized, independent in BOTH real contexts it reached tier 5 in', () => {
    const generalized = getGeneralizedSkills(sessions);
    const redCup = generalized.find((g) => g.skillId === 'find-red-cup');
    assert.ok(redCup, 'expected find-red-cup to appear as generalized');
    assert.deepEqual(redCup!.contexts, ['kitchen', 'living-room']);
  });

  await test('stack-blocks (tier 2, still supported) does NOT appear -- not yet independent anywhere', () => {
    const generalized = getGeneralizedSkills(sessions);
    assert.equal(
      generalized.some((g) => g.skillId === 'stack-blocks'),
      false,
    );
  });

  section('F.019 — the permanent banner: exact copy, always rendered, never dismissible (§7.9)');

  await test('the banner text matches §7.9 exactly', () => {
    assert.equal(NON_DIAGNOSTIC_BANNER, 'This is an activity log, not a clinical assessment.');
  });

  await test('CaregiverDashboard.tsx renders the banner in EVERY return path, including the loading state', () => {
    const source = readFileSync(new URL('../src/screens/CaregiverDashboard.tsx', import.meta.url), 'utf8');
    const bannerUsages = (source.match(/<Banner \/>/g) ?? []).length;
    assert.ok(bannerUsages >= 2, `expected the banner in at least 2 return paths (loading + loaded), found ${bannerUsages}`);
  });

  await test('nothing in the dashboard CODE makes the banner dismissible or first-run-only', () => {
    // Code only -- this file's own header comment correctly explains that
    // the banner is "not first-run only", which would trip a naive check
    // on the raw text (the exact false-positive the F.001/F.010 checks
    // above already guard against).
    const source = readFileSync(new URL('../src/screens/CaregiverDashboard.tsx', import.meta.url), 'utf8');
    const code = codeOnlyLines(source);
    assert.ok(!/dismiss|firstRun|first-run|hasSeen|seenBanner|localStorage/i.test(code));
  });

  section('F.019 — no score, index, percentile, streak, or rating anywhere (§13, static check)');

  await test('caregiverDashboard.ts and CaregiverDashboard.tsx contain none of the forbidden words in code', () => {
    for (const file of ['../src/engine/caregiverDashboard.ts', '../src/screens/CaregiverDashboard.tsx']) {
      const code = codeOnlyLines(readFileSync(new URL(file, import.meta.url), 'utf8'));
      assert.ok(!/\bscore\b|\bpercentile\b|\bstreak\b|\brating\b|\bgrade\b|composite/i.test(code), file);
    }
  });

  section('F.019 — no trend interpretation or judgement (§10, §13, static check)');

  await test('no "better", "worse", "improve", "decline", "concern" or similar judgement language in code', () => {
    for (const file of ['../src/engine/caregiverDashboard.ts', '../src/screens/CaregiverDashboard.tsx']) {
      const code = codeOnlyLines(readFileSync(new URL(file, import.meta.url), 'utf8'));
      assert.ok(
        !/\bbetter\b|\bworse\b|\bimprov|\bdeclin|\bconcern|\balert\b|you might want to look into/i.test(code),
        file,
      );
    }
  });

  summarize();
}

void main();
