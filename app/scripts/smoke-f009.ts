// Real functional check for F.009 — Interaction State Machine.
// Run with: npm run smoke:f009
//
// This is the highest-value review in the whole build per
// plan/engineering/SUBAGENT-STRATEGY.md: "tap wrong three times — does the
// child end in success, silently?" Every assertion here uses explicit fake
// timestamps, not real timers, so it's fast and deterministic.

import assert from 'node:assert/strict';
import { section, summarize, test } from './testHarness';
import { InteractionMachine } from '../src/engine/interactionMachine';
import { INTERACTION_CONFIG } from '../src/config/interaction';

async function main() {
  section('F.009 — the core promise: a trial never ends in failure');

  await test('tap wrong three times in a row — child ends in success, tier escalates 1,2,3', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);

    const a1 = m.recordAttempt(false, 100);
    assert.equal(a1.resolved, false);
    assert.equal(a1.tier, 1, 'first wrong tap should escalate to tier 1');

    const a2 = m.recordAttempt(false, 200);
    assert.equal(a2.resolved, false);
    assert.equal(a2.tier, 2, 'second wrong tap should escalate to tier 2');

    const a3 = m.recordAttempt(false, 300);
    assert.equal(a3.resolved, false);
    assert.equal(a3.tier, 3, 'third wrong tap should escalate to tier 3, never past it');

    // At tier 3 "only the correct target remains tappable" — the next tap
    // the child makes is therefore correct.
    const resolution = m.recordAttempt(true, 400);
    assert.equal(resolution.resolved, true);
    if (resolution.resolved) {
      assert.equal(resolution.tier, 3);
      assert.equal(resolution.prompted, true, 'a tier>0 resolution must log prompted=true');
    }
  });

  await test('tier never skips and never resets mid-trial', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    const a1 = m.recordAttempt(false, 100);
    assert.equal(a1.tier, 1);
    const a2 = m.recordAttempt(false, 200);
    assert.equal(a2.tier, 2, 'must not skip from 1 straight to 3');
    // A correct answer at tier 2 resolves — it must not silently "reset"
    // to 0 first.
    const resolved = m.recordAttempt(true, 300);
    assert.equal(resolved.resolved, true);
    if (resolved.resolved) assert.equal(resolved.tier, 2);
  });

  await test('an unprompted (tier 0) success logs prompted=false', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    const resolution = m.recordAttempt(true, 50);
    assert.equal(resolution.resolved, true);
    if (resolution.resolved) assert.equal(resolution.prompted, false);
  });

  section('F.009 — the resolution log entry is a shape, not a word: no "failed" exists');

  await test('AttemptOutcome has no failure state to represent at all', () => {
    // Structural: recordAttempt's return type only ever has resolved=true
    // (success) or resolved=false (still going). There is no third case.
    // This test exercises every branch and confirms none produces
    // anything resembling a failure.
    const m = new InteractionMachine(0);
    m.startTrial(0);
    for (let i = 0; i < 3; i++) {
      const outcome = m.recordAttempt(false, 100 * (i + 1));
      assert.ok('tier' in outcome && outcome.resolved === false);
    }
    const final = m.recordAttempt(true, 500);
    assert.equal(final.resolved, true);
  });

  section('F.009 — time-based escalation: an idle child escalates exactly like a wrong-tapping one');

  await test('no taps at all, just elapsed time, still escalates through the hierarchy', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);

    const beforeTier1 = m.tick(INTERACTION_CONFIG.FIRST_PROMPT_DELAY_MS - 1);
    assert.equal(beforeTier1.tier, 0);

    const atTier1 = m.tick(INTERACTION_CONFIG.FIRST_PROMPT_DELAY_MS);
    assert.equal(atTier1.tier, 1);
    assert.equal(atTier1.tierChanged, true);

    const atTier2 = m.tick(INTERACTION_CONFIG.TIER_2_DELAY_MS);
    assert.equal(atTier2.tier, 2);

    const atTier3 = m.tick(INTERACTION_CONFIG.TIER_3_DELAY_MS);
    assert.equal(atTier3.tier, 3);
  });

  await test('time-based tier never un-escalates a tier a wrong tap already reached', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    m.recordAttempt(false, 100); // tier -> 1 almost immediately
    // Ticking at a time BEFORE the 8s time-based threshold should not
    // drop tier back to 0 — max(wrongTapTier, timeTier), never min.
    const result = m.tick(500);
    assert.equal(result.tier, 1);
  });

  section('F.009 — disengagement: co-play handoff and session end');

  await test('45s idle triggers co-play handoff', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    const before = m.tick(INTERACTION_CONFIG.COPLAY_HANDOFF_DELAY_MS - 1);
    assert.equal(before.coplayHandoff, false);
    const at = m.tick(INTERACTION_CONFIG.COPLAY_HANDOFF_DELAY_MS);
    assert.equal(at.coplayHandoff, true);
  });

  await test('90s total idle triggers graceful session end', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    const before = m.tick(INTERACTION_CONFIG.SESSION_END_IDLE_MS - 1);
    assert.equal(before.endSession, false);
    const at = m.tick(INTERACTION_CONFIG.SESSION_END_IDLE_MS);
    assert.equal(at.endSession, true);
  });

  await test('a fresh input resets the idle clock', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    m.tick(40_000); // approaching co-play handoff, not there yet
    m.recordAttempt(false, 40_000); // fresh input
    const result = m.tick(40_000 + INTERACTION_CONFIG.COPLAY_HANDOFF_DELAY_MS - 1);
    assert.equal(result.coplayHandoff, false, 'idle clock should have reset on the wrong tap');
  });

  section('F.009 — rapid/random tapping is a distinct signal from careful-but-wrong');

  await test('4 wrong taps within the rapid-tap window are flagged', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    m.recordAttempt(false, 0);
    m.recordAttempt(false, 200);
    const third = m.recordAttempt(false, 400);
    assert.equal(third.resolved, false);
    if (!third.resolved) assert.equal(third.rapidTapping, false, 'only 3 taps so far');
    const fourth = m.recordAttempt(false, 600);
    if (!fourth.resolved) assert.equal(fourth.rapidTapping, true, '4 wrong taps within 2s');
  });

  await test('4 wrong taps spread outside the window are NOT flagged as rapid', () => {
    const m = new InteractionMachine(0);
    m.startTrial(0);
    // Tier caps at 3 after 3 wrong taps regardless, but rapid-tapping is
    // about timing, not count alone.
    m.recordAttempt(false, 0);
    m.recordAttempt(false, 3000); // outside the 2s window from the first
    const third = m.recordAttempt(false, 6000);
    if (!third.resolved) {
      assert.equal(
        third.rapidTapping,
        false,
        'taps spread well beyond the rapid-tap window should not trigger it',
      );
    }
  });

  section('F.009 — co-play prompt on success fires every Nth success, not every time');

  await test('co-play prompt fires on the 3rd success, not the 1st or 2nd', () => {
    const m = new InteractionMachine(0);
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      m.startTrial(i * 1000);
      const r = m.recordAttempt(true, i * 1000 + 1);
      if (r.resolved) results.push(r.showCoplayPrompt);
    }
    assert.deepEqual(results, [false, false, true, false]);
  });

  section('F.009 — same-session difficulty signal (distinct from F.011s cross-session fading)');

  await test('3 consecutive tier-3 resolutions signal stepDifficultyDown', () => {
    const m = new InteractionMachine(0);
    for (let i = 0; i < 3; i++) {
      const base = i * 1000;
      m.startTrial(base);
      m.recordAttempt(false, base + 100);
      m.recordAttempt(false, base + 200);
      m.recordAttempt(false, base + 300);
      const resolved = m.recordAttempt(true, base + 400);
      assert.equal(resolved.resolved, true);
      if (resolved.resolved) assert.equal(resolved.tier, 3);
    }
    assert.equal(m.checkDifficultySignal().stepDifficultyDown, true);
  });

  await test('a non-tier-3 resolution in between resets the consecutive-tier-3 streak', () => {
    const m = new InteractionMachine(0);
    // Two tier-3 resolutions...
    for (let i = 0; i < 2; i++) {
      const base = i * 1000;
      m.startTrial(base);
      m.recordAttempt(false, base + 100);
      m.recordAttempt(false, base + 200);
      m.recordAttempt(false, base + 300);
      m.recordAttempt(true, base + 400);
    }
    // ...then an unprompted success, which should break the streak.
    m.startTrial(3000);
    m.recordAttempt(true, 3001);
    assert.equal(
      m.checkDifficultySignal().stepDifficultyDown,
      false,
      'an intervening non-tier-3 success should reset the streak',
    );
  });

  section('F.009 — movement breaks cap at 3 per session (§7.7)');

  await test('the 4th movement-break request is refused, not granted', () => {
    const m = new InteractionMachine(0);
    assert.equal(m.takeMovementBreak(), true);
    assert.equal(m.takeMovementBreak(), true);
    assert.equal(m.takeMovementBreak(), true);
    assert.equal(m.takeMovementBreak(), false, 'a 4th break should be refused, per the §7.7 cap');
    assert.equal(m.movementBreakCount, 3, 'the refused attempt must not have incremented the count');
  });

  section('F.009 — no forbidden signals anywhere in this file (static check)');

  await test('no return type or emitted value represents a failure state', () => {
    // Precise version of the check above: not "does the word 'wrong' ever
    // appear" (it legitimately does — a wrong tap is a real input event,
    // and `wrongTapTimestampsThisTrial` is an accurate variable name for
    // it), but "does anything this machine ever RETURNS encode failure".
    // Exhaustive behavioural coverage already exists above; this adds one
    // structural guarantee: every outcome's `resolved` field is boolean,
    // and there is no status/outcome string field anywhere that could
    // hold a value like 'failed' or 'incorrect'.
    const m = new InteractionMachine(0);
    m.startTrial(0);
    const outcomes = [
      m.recordAttempt(false, 100),
      m.recordAttempt(false, 200),
      m.recordAttempt(false, 300),
      m.recordAttempt(true, 400),
    ];
    for (const outcome of outcomes) {
      assert.equal(typeof outcome.resolved, 'boolean');
      // No key on any outcome should be a string status field at all —
      // resolved is the only status-shaped field, and it is a boolean.
      const stringStatusKeys = Object.entries(outcome).filter(
        ([, v]) => typeof v === 'string',
      );
      assert.deepEqual(
        stringStatusKeys,
        [],
        `found a string-valued field on an outcome — a status field is exactly how a "failed" state would sneak in: ${JSON.stringify(outcome)}`,
      );
    }
  });

  await test('the machine never imports a camera, vision, or face-related port (§7.7, §13)', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../src/engine/interactionMachine.ts', import.meta.url), 'utf8');
    const importLines = source
      .split('\n')
      .filter((line) => line.trim().startsWith('import'))
      .join('\n');
    // The disengagement signals must come from touch timing alone. This
    // checks actual imports, not prose — the file's own header comment
    // correctly *explains* this constraint, which would otherwise trip a
    // naive word-ban on "face"/"camera"/"emotion".
    assert.ok(!/adapters\/(vision|face|capture)|FaceDetectPort|VisionPort|CapturePort/i.test(importLines));
  });

  summarize();
}

void main();
