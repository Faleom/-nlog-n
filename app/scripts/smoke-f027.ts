// Real functional check for F.027 — Block-stack match.
// Run with: npm run smoke:f027

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  BlockStackMachine,
  buildRound,
  resolveSwipe,
  resolveTap,
  SWIPE_MEANING,
  SWIPE_MIN_TRAVEL_PX,
  COLUMN_SLOTS,
  MAX_START_OFFSET,
  MIN_START_OFFSET,
} from '../src/games/logic/blockStack';

/** Deterministic stand-in for Math.random over a fixed sequence. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

async function main() {
  section('F.027 — the direction decision is fixed, and both inputs agree');

  await test('up lifts a block OFF, down places one ON', () => {
    assert.equal(SWIPE_MEANING.up, 'lift');
    assert.equal(SWIPE_MEANING.down, 'place');
  });

  await test('a swipe past the threshold resolves; a short drag resolves to nothing', () => {
    assert.equal(resolveSwipe(-(SWIPE_MIN_TRAVEL_PX + 1)), 'lift');
    assert.equal(resolveSwipe(SWIPE_MIN_TRAVEL_PX + 1), 'place');
    assert.equal(resolveSwipe(-(SWIPE_MIN_TRAVEL_PX - 1)), null);
    assert.equal(resolveSwipe(SWIPE_MIN_TRAVEL_PX - 1), null);
    assert.equal(resolveSwipe(0), null);
  });

  await test('a tap above the tower places; a tap on the tower lifts', () => {
    // 7 slots over 700px, tower 3 high -> the top 400px are empty.
    assert.equal(resolveTap(50, 700, 3, 7), 'place');
    assert.equal(resolveTap(399, 700, 3, 7), 'place');
    assert.equal(resolveTap(401, 700, 3, 7), 'lift');
    assert.equal(resolveTap(690, 700, 3, 7), 'lift');
  });

  await test('a full tower has no empty space, so every tap lifts', () => {
    assert.equal(resolveTap(0, 700, 7, 7), 'lift');
    assert.equal(resolveTap(350, 700, 7, 7), 'lift');
  });

  await test('an empty tower has no blocks, so every tap places', () => {
    assert.equal(resolveTap(699, 700, 0, 7), 'place');
  });

  section('F.027 — the round always starts 1-2 blocks off, and is always correctable');

  await test('100 generated rounds all start within the specified offset', () => {
    for (let i = 0; i < 100; i++) {
      const round = buildRound();
      const offset = Math.abs(round.targetHeight - round.startHeight);
      assert.ok(
        offset >= MIN_START_OFFSET && offset <= MAX_START_OFFSET,
        `offset ${offset} outside ${MIN_START_OFFSET}-${MAX_START_OFFSET}`,
      );
    }
  });

  await test('a round never starts already matched', () => {
    for (let i = 0; i < 100; i++) {
      const round = buildRound();
      assert.notEqual(round.startHeight, round.targetHeight);
    }
  });

  await test('target and start both stay inside the column', () => {
    for (let i = 0; i < 100; i++) {
      const round = buildRound();
      assert.ok(round.targetHeight >= 0 && round.targetHeight <= COLUMN_SLOTS);
      assert.ok(round.startHeight >= 0 && round.startHeight <= COLUMN_SLOTS);
    }
  });

  await test('the target leaves headroom to overshoot in both directions', () => {
    // A child who swipes the wrong way must still be able to correct back,
    // so the target is never pinned to the floor or the ceiling.
    for (let i = 0; i < 100; i++) {
      const round = buildRound();
      assert.ok(round.targetHeight > 0, 'target sits on the floor');
      assert.ok(round.targetHeight < COLUMN_SLOTS, 'target sits at the ceiling');
    }
  });

  section('F.027 — the machine, and what it refuses to do');

  await test('placing and lifting move the tower and reach a match', () => {
    const m = new BlockStackMachine({ targetHeight: 5, startHeight: 3 });
    assert.equal(m.matched, false);
    assert.equal(m.place(), true);
    assert.equal(m.height, 4);
    assert.equal(m.matched, false);
    assert.equal(m.place(), true);
    assert.equal(m.height, 5);
    assert.equal(m.matched, true);
  });

  await test('overshooting is not a failure — lifting back down re-matches', () => {
    const m = new BlockStackMachine({ targetHeight: 3, startHeight: 5 });
    m.lift();
    assert.equal(m.matched, false);
    m.lift();
    assert.equal(m.matched, true);
    // and it can leave the match again without anything breaking
    m.place();
    assert.equal(m.matched, false);
  });

  await test('the ceiling and the floor are silent no-ops, not errors', () => {
    const full = new BlockStackMachine({ targetHeight: 3, startHeight: COLUMN_SLOTS });
    assert.equal(full.place(), false);
    assert.equal(full.height, COLUMN_SLOTS);

    const empty = new BlockStackMachine({ targetHeight: 3, startHeight: 0 });
    assert.equal(empty.lift(), false);
    assert.equal(empty.height, 0);
  });

  await test('apply() routes both actions the same way the gestures do', () => {
    const m = new BlockStackMachine({ targetHeight: 4, startHeight: 2 });
    m.apply(SWIPE_MEANING.down);
    assert.equal(m.height, 3);
    m.apply(SWIPE_MEANING.up);
    assert.equal(m.height, 2);
  });

  await test('the machine exposes no score, streak or attempt counter', () => {
    const m = new BlockStackMachine({ targetHeight: 4, startHeight: 2 });
    const keys = [
      ...Object.keys(m),
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(m)),
    ].map((k) => k.toLowerCase());
    for (const banned of ['score', 'stars', 'streak', 'attempts', 'wrong', 'errors', 'points']) {
      assert.ok(!keys.some((k) => k.includes(banned)), `machine exposes "${banned}"`);
    }
  });

  await test('buildRound is deterministic when its random source is', () => {
    const a = buildRound(seq([0.1, 0.9]));
    const b = buildRound(seq([0.1, 0.9]));
    assert.deepEqual(a, b);
  });

  section('F.027 — zero text and zero symbols in the child\'s view');

  const raw = readFileSync(new URL('../src/games/BlockStackMatch.tsx', import.meta.url), 'utf8');

  /** Source with comments removed. The checks below are about what the
   * child can SEE, so a comment that names the thing being banned (this
   * file's own header explains the glyphs it replaced) must not trip them. */
  const ui = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const building = ui.slice(ui.indexOf("phase === 'building'"));

  await test('the plus/minus buttons this round replaced are gone entirely', () => {
    // The whole point of F.027's interaction change: no glyph a
    // pre-literate child would have to decode.
    assert.ok(!/aria-label=["'](more|fewer|plus|minus)["']/i.test(ui), 'a +/- control survives');
    assert.ok(!ui.includes('\u2212'), 'a minus sign survives in the child-facing markup');
    assert.ok(!/>\s*[+\u2212-]\s*</.test(ui), 'a +/- glyph is rendered as content');
    assert.ok(!/pmbtn|pmbar/.test(ui), 'the old button bar markup survives');
  });

  await test('no score, star, counter, timer or progress bar anywhere in the file', () => {
    // Word-boundary matched: "Start a tower" is not a star.
    for (const banned of [/\bscores?\b/i, /\bstars?\b/i, /\bconfetti\b/i, /\bstreaks?\b/i, /\bpoints?\b/i, /progress\s*bar/i, /try again/i, /\btimer\b/i]) {
      assert.ok(!banned.test(ui), `BlockStackMatch.tsx matches ${String(banned)}`);
    }
  });

  await test('the child-facing phase is reported up so the shell can hide its chrome', () => {
    assert.ok(ui.includes("onChildFacingChange?.(phase === 'building')"));
  });

  await test('the child-facing build view renders no visible text node', () => {
    // Caught for real by clicking through the built app: a caregiver-facing
    // "Finish" button was sitting inside this phase, which is a visible word
    // in a zero-text view. The round auto-advances on a match instead.
    const start = building.indexOf('bsm-floor');
    const end = building.indexOf('</div>\n    );');
    assert.ok(start !== -1, 'could not locate the child-facing view');
    const childView = building.slice(start, end === -1 ? building.length : end);
    // Any JSX text node -- >Word< -- between the tags is a rendered word.
    const textNodes = [...childView.matchAll(/>\s*([A-Za-z][A-Za-z ,.'!?-]{1,})\s*</g)]
      .map((m) => m[1].trim())
      .filter((t) => t.length > 1);
    assert.deepEqual(textNodes, [], `visible text in the child's view: ${textNodes.join(', ')}`);
  });

  await test('the round ends itself on a match rather than on a worded control', () => {
    assert.ok(
      /setPhase\('reportingSupport'\)/.test(ui) && /matched/.test(ui),
      'no auto-advance on match',
    );
    assert.ok(!/>Finish</.test(ui), 'a Finish control is rendered');
  });

  await test('the tower honours reduced motion', () => {
    assert.ok(ui.includes('prefers-reduced-motion'));
  });

  section('F.027 — both directions animate, and motion stays capped');

  await test('placing IN and lifting OUT are both animated', () => {
    assert.ok(/@keyframes bsm-drop/.test(ui), 'no place-in animation');
    assert.ok(/@keyframes bsm-lift/.test(ui), 'no lift-out animation');
  });

  await test('the lift-out keeps a ghost alive, since the machine already dropped the block', () => {
    assert.ok(/ghostAt/.test(ui), 'no ghost — a lifted block would just vanish');
    assert.ok(/bsm-ghost/.test(ui));
  });

  await test('the ghost is transient render state, never part of the machine', () => {
    const logic = readFileSync(new URL('../src/games/logic/blockStack.ts', import.meta.url), 'utf8');
    assert.ok(!/ghost|anim|motion|ms\b/i.test(logic.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')),
      'presentation leaked into the pure logic module');
  });

  await test('motion comes from config/motion.ts, not hardcoded durations', () => {
    assert.ok(ui.includes('motionFor(profile'), 'motion tier is not derived from the profile');
    assert.ok(
      !/animation:\s*[a-z-]+\s+\d+m?s/i.test(ui),
      'a hardcoded animation duration bypasses the profile cap',
    );
  });

  await test('the relax animation cannot swallow the ghost\'s lift animation', () => {
    // Found live: the ghost carries .bsm-block--live too, so a bare
    // ".bsm-ghost" rule (0-1-0) loses to ".bsm-col--relaxing
    // .bsm-block--live" (0-2-0) and the block never travels on the way out.
    assert.ok(
      /\.bsm-col--relaxing \.bsm-block--live:not\(\.bsm-ghost\)/.test(ui),
      'the relax rule does not exclude ghosts — it will override the lift-out',
    );
    assert.ok(/\.bsm-slot \.bsm-ghost\s*\{/.test(ui), 'the ghost rule is not specific enough to win');
  });

  await test('the minimal tier removes the ghost rather than shrinking it', () => {
    assert.ok(/\[data-motion="minimal"\][^{]*\.bsm-ghost\s*\{[^}]*display:\s*none/.test(ui));
  });

  summarize();
}

void main();
