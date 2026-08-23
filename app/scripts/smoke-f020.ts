// Real functional check for F.020 -- Branch handoff & the no-screening
// rule. Run with: npm run smoke:f020
//
// §10 calls this "the most failure-prone part of the design," and F.020.md
// asks for a real repo-wide grep, not a hand-wave. This script does two
// distinct things:
//   1. A real behavioural proof: build two real profiles through the real
//      store (F.001/F.010) -- one with a long run of "couldn't do it"-shaped
//      records, one with none -- and confirm the neutral note prompt is
//      byte-identical for both.
//   2. Real static scans of the ENTIRE app/ tree (src, api, scripts) for
//      any counter/streak/threshold/pattern-detector construct over
//      activity outcomes, with an explicit, narrow, documented allowlist
//      for the two pre-existing, sanctioned, DIFFICULTY-tuning mechanisms
//      (F.009's same-session difficulty step-down, F.011's cross-session
//      support-tier fading) that are NOT what §10 is about -- see
//      engine/activityLogging.ts and engine/fading.ts's own doc comments,
//      which already draw this exact distinction.
//
// Per the harness's own hard-won lesson: every static check below filters
// out comment-only lines before matching, and is run against the real files
// to confirm it doesn't false-positive on a comment correctly describing
// the constraint.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { section, summarize, test } from './testHarness';
import { NEUTRAL_NOTE_PROMPT_TEXT, getNeutralNotePromptState } from '../src/engine/branchHandoff';
import type { SkillRecord } from '../src/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(HERE, '..');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function codeOnlyLines(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  return source.split('\n').filter((line) => {
    const t = line.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  });
}

function relPath(filePath: string): string {
  return path.relative(APP_ROOT, filePath).split(path.sep).join('/');
}

async function main() {
  const { createProfile, startSession, appendSkillRecord } = await import('../src/engine/profileStore');
  const { getSkillHistory } = await import('../src/engine/profileStore');

  section('F.020 — the neutral note prompt is identical regardless of activity history (real proof)');

  await test('a profile with a LONG run of low-support ("couldn\'t do it") records', async () => {
    const heavy = await createProfile({ ageMonths: 40, nickname: 'HeavyHistory' });
    const session = await startSession(heavy.id);
    for (let i = 0; i < 25; i++) {
      await appendSkillRecord(session.id, {
        skillId: 'find-cup',
        context: 'kitchen',
        supportTier: 1, // full physical -- the child needed maximum help every time
        onScreenTier: 3, // maxed out the on-screen prompt hierarchy every time
        prompted: true,
        timestamp: new Date().toISOString(),
      });
    }
    const history = await getSkillHistory(heavy.id, 'find-cup');
    assert.equal(history.length, 25, 'setup sanity check');

    const light = await createProfile({ ageMonths: 40, nickname: 'NoHistory' });
    const emptyHistory = await getSkillHistory(light.id, 'find-cup');
    assert.equal(emptyHistory.length, 0, 'setup sanity check');

    const heavyState = getNeutralNotePromptState(history);
    const lightState = getNeutralNotePromptState(emptyHistory);

    assert.deepEqual(
      heavyState,
      lightState,
      'a long run of "couldn\'t do it" must produce an IDENTICAL prompt to no history at all',
    );
    assert.equal(heavyState.text, NEUTRAL_NOTE_PROMPT_TEXT);
    assert.equal(lightState.text, NEUTRAL_NOTE_PROMPT_TEXT);
  });

  await test('NEUTRAL_NOTE_PROMPT_TEXT matches §10 verbatim', () => {
    assert.equal(NEUTRAL_NOTE_PROMPT_TEXT, 'Want to save a note about this to ask about later?');
  });

  section('F.020 — card -> activity offer works with NO Branch 1 profile at all');

  await test('a brand-new child with zero sessions still gets the same neutral state', async () => {
    const fresh = await createProfile({ ageMonths: 36 });
    const history = await getSkillHistory(fresh.id, 'anything-at-all');
    assert.equal(history.length, 0);
    const state = getNeutralNotePromptState(history);
    assert.equal(state.text, NEUTRAL_NOTE_PROMPT_TEXT);
  });

  await test('Branch2CardProps requires no Branch 1 profile/session/history at all (structural)', () => {
    const source = readFileSync(path.join(APP_ROOT, 'src/screens/Branch2Card.tsx'), 'utf8');
    const propsBlock = /interface Branch2CardProps \{([\s\S]*?)\}/.exec(source)?.[1] ?? '';
    assert.ok(propsBlock.length > 0, 'could not locate Branch2CardProps -- test itself needs updating');
    assert.ok(
      !/profile|session|skillHistory|SkillRecord/i.test(propsBlock),
      `Branch2CardProps should never require Branch 1 profile/session data, found: ${propsBlock}`,
    );
  });

  section('F.020 — repo-wide: every getSkillHistory/getSessionsForChild call site is on the allowlist');

  // The ONLY files allowed to read activity history at all. Each entry is
  // there for a specific, already-reviewed, non-screening reason:
  //   - profileStore.ts: defines the functions themselves
  //   - fading.ts: F.011 cross-session support-tier fading (§7.6) -- a
  //     task-difficulty suggestion, never surfaced as a concern
  //   - sessionLifecycle.ts: F.013 session numbering (how many PAST
  //     sessions exist, to set the next one's time cap) -- counts sessions,
  //     never outcomes
  //   - branchHandoff.ts / smoke-f020.ts: this file's own structural proof
  //     that history is accepted and then ignored
  //   - CaregiverDashboard.tsx / caregiverDashboard.ts: F.019's own
  //     spec-required feature (§7.9) -- DISPLAYING real session history to
  //     the caregiver who already owns it. The §10 rule this file exists
  //     to enforce is specifically about COMPUTING A CONCERN from history,
  //     not reading it at all -- a recap and a generalization tracker are
  //     not a concern signal, they're the dashboard doing its job.
  const HISTORY_READER_ALLOWLIST = new Set([
    'src/engine/profileStore.ts',
    'src/engine/fading.ts',
    'src/engine/sessionLifecycle.ts',
    'src/engine/branchHandoff.ts',
    'src/engine/caregiverDashboard.ts',
    'src/screens/CaregiverDashboard.tsx',
    'scripts/smoke-f020.ts',
    'scripts/smoke-f001.ts', // F.001's own test, verifying the store functions themselves work
    'scripts/smoke-f010.ts', // F.010's own test, same reason (and asserts activityLogging.ts does NOT read history)
    'scripts/smoke-f011.ts', // F.011's own test, reads history to set up fixtures
    'scripts/smoke-f013.ts', // F.013's own test, same reason
    'scripts/smoke-f019.ts', // F.019's own test, reads history to set up real fixtures for the dashboard
  ]);

  await test('no file outside the allowlist reads activity history', () => {
    const allFiles = [
      ...listFiles(path.join(APP_ROOT, 'src')),
      ...listFiles(path.join(APP_ROOT, 'scripts')),
    ];
    const offenders: string[] = [];
    for (const file of allFiles) {
      const rel = relPath(file);
      const code = codeOnlyLines(file).join('\n');
      const readsHistory = /\bgetSkillHistory\(|\bgetSessionsForChild\(/.test(code);
      if (readsHistory && !HISTORY_READER_ALLOWLIST.has(rel)) {
        offenders.push(rel);
      }
    }
    assert.deepEqual(offenders, [], `unexpected history reader(s): ${offenders.join(', ')}`);
  });

  section('F.020 — repo-wide: every streak/tally/threshold/counter construct is on the allowlist');

  // The ONLY files allowed to define a streak/tally/threshold/counter over
  // activity outcomes -- both pre-existing, both about task DIFFICULTY
  // (never a concern signal): F.009's same-session difficulty step-down
  // (interactionMachine.ts, consecutiveTier3Trials) and F.011's
  // cross-session support-tier fading (fading.ts, upStreak/downStreak).
  // config/interaction.ts just holds their shared numeric constants.
  const COUNTER_ALLOWLIST = new Set([
    'src/config/interaction.ts',
    'src/engine/fading.ts',
    'src/engine/interactionMachine.ts',
    'src/engine/activityLogging.ts', // only mentions these words to explicitly DISCLAIM having them
    'src/engine/sessionLifecycle.ts', // only mentions "streak" to explicitly disclaim it (see its own static check in smoke-f013.ts)
    'scripts/smoke-f009.ts',
    'scripts/smoke-f010.ts',
    'scripts/smoke-f011.ts',
    'scripts/smoke-f013.ts',
    'scripts/smoke-f014.ts', // asserts the ABSENCE of "tally" in F.014's files -- the word appears only inside that assertion
    'scripts/smoke-f020.ts', // this file's own allowlist text
    'src/engine/routineSequencing.ts', // Game 2's own same-slot wrong-attempt
    // counter -- the tap-to-place equivalent of F.009's same-trial tier
    // escalation, a different interaction shape but the identical category
    // of "within one attempt at one skill", never a cross-session concern
    'scripts/smoke-f022.ts', // F.022's own test, names that counter in prose
    'scripts/smoke-f019.ts', // F.019's own test, asserts the ABSENCE of "streak" etc. in the dashboard
    'scripts/smoke-f008.ts', // F.008's own test, asserts the ABSENCE of "counter" etc. in Game1.tsx
    'src/games/silhouette.ts', // an image-processing luminance THRESHOLD for
    // generating a silhouette from a crop -- a pixel-brightness cutoff, unrelated
    // to activity history in any way. Confirmed: this file never imports
    // profileStore or reads a SkillRecord.
    'scripts/smoke-f021.ts', // F.021's own test (Game 3 roadmap engine), asserts the ABSENCE of "counter" etc. in its own files, plus the silhouette image-threshold tests it inherited
    'scripts/smoke-f027.ts', // F.027's own test (block-stack), asserts the ABSENCE of "streak"/"counter" in BlockStackMatch.tsx -- the words appear only inside those assertions
    'scripts/smoke-f028.ts', // F.028's own test (sort by rule), same: names the banned words only to assert they are absent from SortByRule.tsx
  ]);

  await test('no counter/streak/threshold/tally construct exists outside the allowlist', () => {
    const allFiles = [
      ...listFiles(path.join(APP_ROOT, 'src')),
      ...listFiles(path.join(APP_ROOT, 'api')),
      ...listFiles(path.join(APP_ROOT, 'scripts')),
    ];
    const offenders: string[] = [];
    for (const file of allFiles) {
      const rel = relPath(file);
      const code = codeOnlyLines(file).join('\n');
      if (/\b(streak|tally|threshold|counter)\b/i.test(code) && !COUNTER_ALLOWLIST.has(rel)) {
        offenders.push(rel);
      }
    }
    assert.deepEqual(offenders, [], `unexpected counter/streak/threshold construct(s): ${offenders.join(', ')}`);
  });

  section('F.020 — Branch 2 and handoff files specifically contain none of this, ever');

  await test('branch2*.ts, branchHandoff.ts and the Branch2*/NeutralNotePrompt screens are clean', () => {
    const files = [
      'src/engine/branch2.ts',
      'src/engine/branch2Card.ts',
      'src/engine/branch2Guardrail.ts',
      'src/engine/branchHandoff.ts',
      'src/screens/Branch2Milestones.tsx',
      'src/screens/Branch2Card.tsx',
      'src/components/NeutralNotePrompt.tsx',
    ].map((p) => path.join(APP_ROOT, p));
    for (const file of files) {
      const code = codeOnlyLines(file).join('\n');
      assert.ok(
        !/\b(streak|tally|threshold|counter|concernScore|riskScore|warningLevel|screeningResult)\b/i.test(
          code,
        ),
        `${relPath(file)} contains a forbidden pattern-detection construct`,
      );
    }
  });

  section('F.020 — branch switching asks nothing, warns nothing (no confirm dialogs)');

  await test('no Branch 1/2/handoff file ever shows a confirm() dialog or "are you sure" text', () => {
    const files = [
      'src/engine/branch2.ts',
      'src/engine/branch2Card.ts',
      'src/engine/branchHandoff.ts',
      'src/screens/Branch2Milestones.tsx',
      'src/screens/Branch2Card.tsx',
      'src/components/NeutralNotePrompt.tsx',
    ].map((p) => path.join(APP_ROOT, p));
    for (const file of files) {
      const code = codeOnlyLines(file).join('\n');
      assert.ok(!/\bconfirm\(/.test(code), `${relPath(file)} calls confirm()`);
      assert.ok(!/are you sure/i.test(code), `${relPath(file)} shows an "are you sure" prompt`);
    }
  });

  section('F.020 — a fresh SkillRecord[] type-checks through the real ignore path (no crash on real shape)');

  await test('getNeutralNotePromptState accepts a real SkillRecord[] shape without incident', () => {
    const records: SkillRecord[] = [
      {
        skillId: 'find-ball',
        context: 'bedroom',
        supportTier: 1,
        onScreenTier: 3,
        prompted: true,
        timestamp: new Date().toISOString(),
      },
    ];
    assert.equal(getNeutralNotePromptState(records).text, NEUTRAL_NOTE_PROMPT_TEXT);
  });

  summarize();
}

void main();
