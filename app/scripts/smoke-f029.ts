// Real functional check for the shared motion cap (src/config/motion.ts).
// Run with: npm run smoke:f029
//
// This exists because "make it more animated" is a recurring request, and
// the thing that must NOT happen is a game quietly handing a calm-profile
// or motion-averse child more movement than their profile asked for.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { section, summarize, test } from './testHarness';
import { motionFor, motionVars } from '../src/config/motion';
import type { ChildProfile, SoundMovementAnswer } from '../src/types';

function profileWith(
  soundMovement?: SoundMovementAnswer,
  fastAnimation?: boolean,
): ChildProfile {
  return {
    id: 'x',
    ageMonths: 48,
    responseProfile: soundMovement ? { soundMovement } : {},
    context: fastAnimation === undefined ? {} : { avoidList: { fastAnimation } },
    createdAt: '',
    updatedAt: '',
  };
}

async function main() {
  section('motion — the response profile visibly changes the animation');

  await test('calm, lively and unanswered all resolve to different tiers', () => {
    assert.equal(motionFor(profileWith('calm'), false).tier, 'calm');
    assert.equal(motionFor(profileWith('lively'), false).tier, 'full');
    // "If flipping a setting produces no observable change, it isn't
    // implemented" -- UI-STANDARDS.md.
    assert.notEqual(
      motionFor(profileWith('calm'), false).durationMs,
      motionFor(profileWith('lively'), false).durationMs,
    );
    assert.notEqual(
      motionFor(profileWith('calm'), false).travelPx,
      motionFor(profileWith('lively'), false).travelPx,
    );
  });

  await test('only the lively profile gets overshoot', () => {
    assert.equal(motionFor(profileWith('lively'), false).overshoot, true);
    assert.equal(motionFor(profileWith('calm'), false).overshoot, false);
    assert.equal(motionFor(profileWith(), false).overshoot, false);
  });

  await test('a skipped question never opts a child INTO more stimulation', () => {
    // Every response-profile question is skippable (§5.2). An unanswered
    // Q1 must not default to the liveliest setting.
    const skipped = motionFor(profileWith(), false);
    const lively = motionFor(profileWith('lively'), false);
    assert.ok(skipped.durationMs < lively.durationMs);
    assert.ok(skipped.travelPx < lively.travelPx);
  });

  section('motion — the caps, which nothing may override');

  await test('prefers-reduced-motion forces the floor, even for a lively profile', () => {
    const m = motionFor(profileWith('lively'), true);
    assert.equal(m.tier, 'minimal');
    assert.equal(m.durationMs, 0);
    assert.equal(m.travelPx, 0);
  });

  await test('the avoid list "fast animation" forces the floor too', () => {
    const m = motionFor(profileWith('lively', true), false);
    assert.equal(m.tier, 'minimal');
    assert.equal(m.durationMs, 0);
  });

  await test('fastAnimation: false does not itself reduce anything', () => {
    assert.equal(motionFor(profileWith('lively', false), false).tier, 'full');
  });

  await test('a zero duration means SKIP the animation, not run a 0ms one', () => {
    // Consumers branch on durationMs > 0; the vars must still be well-formed.
    const vars = motionVars(motionFor(profileWith('lively'), true));
    assert.equal(vars['--motion-ms'], '0ms');
    assert.equal(vars['--motion-travel'], '0px');
    assert.equal(vars['--motion-overshoot'], '1');
  });

  section('motion — every animating game reads the cap');

  // KNOWN PRE-EXISTING GAP, recorded rather than silently permitted.
  //
  // Game1.tsx (F.008/F.012, P2) and Game3Play.tsx (F.021, P2) both animate
  // without reading this cap, and neither has a prefers-reduced-motion
  // block at all. Two of their three animations are INFINITE
  // (`g1-pulse`/`g3p-pulse` 1.2s infinite, `g1-bounce`/`g3p-bounce` 0.6s
  // infinite) and they are the §7.7 prompt-hierarchy tier-2 and tier-3
  // signals -- i.e. they fire at exactly the moment a child is already
  // struggling. UI-STANDARDS.md requires both the profile tuning and
  // prefers-reduced-motion.
  //
  // Left as-is deliberately: those are P2's feature files, already marked
  // implemented, and quietly editing them is the "make it better on a file
  // that already meets its Done criteria" failure SUBAGENT-STRATEGY.md
  // warns about. Remove an entry here when its file is fixed for real.
  const MOTION_CAP_GAP = new Set(['Game1.tsx', 'Game3Play.tsx']);

  await test('no game hardcodes an animation duration outside the cap', () => {
    const dir = new URL('../src/games/', import.meta.url).pathname;
    const offenders: string[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.tsx')) continue;
      const src = readFileSync(join(dir, f), 'utf8');
      // Only files that actually declare keyframes are in scope here.
      if (!/@keyframes/.test(src)) continue;
      if (!src.includes('motionFor(') && !MOTION_CAP_GAP.has(f)) offenders.push(f);
    }
    assert.deepEqual(
      offenders,
      [],
      `these games animate without reading the motion cap: ${offenders.join(', ')}`,
    );
  });

  await test('the known-gap list is accurate — nothing on it is silently fixed already', () => {
    // Keeps the list honest in the other direction: if someone fixes one of
    // these, this fails until they remove it from the list.
    const dir = new URL('../src/games/', import.meta.url).pathname;
    for (const f of MOTION_CAP_GAP) {
      const src = readFileSync(join(dir, f), 'utf8');
      assert.ok(
        !src.includes('motionFor('),
        `${f} now reads the motion cap — remove it from MOTION_CAP_GAP`,
      );
    }
  });

  summarize();
}

void main();
