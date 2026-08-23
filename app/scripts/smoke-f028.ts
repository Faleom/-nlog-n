// Real functional check for F.028 — Sort by rule.
// Run with: npm run smoke:f028

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  SortMachine,
  buildSortRound,
  onScreenTierFromMisses,
  availableDimensions,
  valueOn,
  seedFor,
  SORT_DIMENSIONS,
  SHAPE_VALUES,
  SIZE_VALUES,
  FILL_VALUES,
  COLOUR_VALUES,
  ITEM_COUNTS,
  type SortDimension,
  type SortRound,
} from '../src/games/logic/sortByRule';
import type { AvoidList } from '../src/types';

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const OTHER_DIMENSIONS = (d: SortDimension) => SORT_DIMENSIONS.filter((x) => x !== d);

/** The invariant the whole round depends on. */
function assertOneDimensionVaries(round: SortRound) {
  for (const other of OTHER_DIMENSIONS(round.dimension)) {
    const values = new Set<string>(round.items.map((i) => String(i.attrs[other])));
    // ...and the seeds must match the items on those dimensions too.
    for (const basket of round.baskets) values.add(String(seedFor(round, basket)[other]));
    assert.equal(
      values.size,
      1,
      `round sorts by "${round.dimension}" but "${other}" also varies (${[...values].join(', ')}) — the round has two possible answers`,
    );
  }
  const ruleValues = new Set(round.items.map((i) => valueOn(i, round.dimension)));
  assert.equal(ruleValues.size, 2, 'the rule dimension must take exactly two values');
}

async function main() {
  section('F.028 — exactly one dimension varies, always');

  await test('300 random rounds all vary exactly one dimension', () => {
    for (let i = 0; i < 300; i++) assertOneDimensionVaries(buildSortRound());
  });

  await test('every dimension can be the rule, and holds the invariant', () => {
    for (const dimension of SORT_DIMENSIONS) {
      for (let i = 0; i < 40; i++) {
        const round = buildSortRound({ dimension });
        assert.equal(round.dimension, dimension);
        assertOneDimensionVaries(round);
      }
    }
  });

  await test('random rounds actually reach all four dimensions (real variety)', () => {
    const seen = new Set<SortDimension>();
    for (let i = 0; i < 400; i++) seen.add(buildSortRound().dimension);
    assert.deepEqual([...seen].sort(), [...SORT_DIMENSIONS].sort());
  });

  await test('the held-constant dimensions vary BETWEEN rounds, not within one', () => {
    // Two shape rounds in a row should not be visually identical.
    const constants = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = buildSortRound({ dimension: 'shape' });
      constants.add(`${r.items[0].attrs.size}/${r.items[0].attrs.fill}/${r.items[0].attrs.colour}`);
    }
    assert.ok(constants.size > 1, 'every shape round looks identical — no between-round variety');
  });

  await test('the seeded example matches the items on every non-rule dimension', () => {
    for (let i = 0; i < 100; i++) {
      const round = buildSortRound();
      for (const basket of round.baskets) {
        const seed = seedFor(round, basket);
        assert.equal(seed[round.dimension], basket, 'the seed does not show its own basket rule');
        for (const other of OTHER_DIMENSIONS(round.dimension)) {
          assert.equal(seed[other], round.items[0].attrs[other]);
        }
      }
    }
  });

  await test('the two baskets are always distinct values', () => {
    for (let i = 0; i < 200; i++) {
      const r = buildSortRound();
      assert.notEqual(r.baskets[0], r.baskets[1]);
    }
  });

  await test('every value on every dimension is reachable', () => {
    const seen: Record<string, Set<string>> = {
      shape: new Set(), size: new Set(), fill: new Set(), colour: new Set(),
    };
    for (let i = 0; i < 600; i++) {
      const r = buildSortRound();
      for (const it of r.items) {
        for (const d of SORT_DIMENSIONS) seen[d].add(String(it.attrs[d]));
      }
    }
    assert.deepEqual([...seen.shape].sort(), [...SHAPE_VALUES].sort());
    assert.deepEqual([...seen.size].sort(), [...SIZE_VALUES].sort());
    assert.deepEqual([...seen.fill].sort(), [...FILL_VALUES].sort());
    assert.deepEqual([...seen.colour].sort(), [...COLOUR_VALUES].sort());
  });

  section('F.028 — the item split, and the tray');

  await test('items split evenly between the two baskets', () => {
    for (let i = 0; i < 200; i++) {
      const r = buildSortRound();
      const a = r.items.filter((it) => valueOn(it, r.dimension) === r.baskets[0]).length;
      assert.equal(a * 2, r.items.length, 'one basket takes more than half — it becomes a guess');
    }
  });

  await test('item count varies across the allowed counts', () => {
    const counts = new Set<number>();
    for (let i = 0; i < 200; i++) counts.add(buildSortRound().items.length);
    for (const c of counts) assert.ok(ITEM_COUNTS.includes(c), `unexpected item count ${c}`);
    assert.ok(counts.size > 1, 'item count never varies');
  });

  await test('an odd requested count is rounded up, never left uneven', () => {
    const r = buildSortRound({ itemCount: 5 });
    assert.equal(r.items.length % 2, 0);
  });

  await test('the tray order is shuffled, not a giveaway alternation', () => {
    const round = buildSortRound({ random: seq([0]), dimension: 'shape', itemCount: 4 });
    const vals = round.items.map((i) => valueOn(i, 'shape')).join(',');
    const alternating = [round.baskets[0], round.baskets[1], round.baskets[0], round.baskets[1]].join(',');
    assert.notEqual(vals, alternating);
  });

  await test('buildSortRound is deterministic when its random source is', () => {
    const a = buildSortRound({ random: seq([0.1, 0.7, 0.3, 0.9]) });
    const b = buildSortRound({ random: seq([0.1, 0.7, 0.3, 0.9]) });
    assert.deepEqual(a, b);
  });

  section('F.028 — the avoid list is honoured at OFFER time, not render time');

  const avoidsBlue: AvoidList = { avoidedColour: 'blue' };

  await test('an avoided colour never appears in any round, on any dimension', () => {
    for (let i = 0; i < 400; i++) {
      const r = buildSortRound({ avoidList: avoidsBlue });
      for (const it of r.items) {
        assert.notEqual(it.attrs.colour, 'blue', 'an avoided colour was offered');
      }
      for (const basket of r.baskets) {
        assert.notEqual(seedFor(r, basket).colour, 'blue', 'an avoided colour was seeded');
      }
    }
  });

  await test('a colour round still works with one colour excluded', () => {
    const r = buildSortRound({ avoidList: avoidsBlue, dimension: 'colour' });
    assert.equal(r.dimension, 'colour');
    assertOneDimensionVaries(r);
  });

  await test('availableDimensions gates colour on having two colours left', () => {
    assert.deepEqual(availableDimensions(undefined), SORT_DIMENSIONS);
    assert.ok(availableDimensions(avoidsBlue).includes('colour'), '3 colours left should still allow it');
  });

  await test('a round never uses a dimension the avoid list excluded', () => {
    for (let i = 0; i < 200; i++) {
      const r = buildSortRound({ avoidList: avoidsBlue });
      assert.ok(availableDimensions(avoidsBlue).includes(r.dimension));
    }
  });

  section('F.028 — a wrong basket costs nothing');

  await test('a matching basket accepts and keeps the item', () => {
    const round = buildSortRound();
    const m = new SortMachine(round);
    const item = round.items[0];
    const right = valueOn(item, round.dimension);
    assert.equal(m.deposit(item.id, right), 'accepted');
    assert.ok(m.contents(right).some((i) => i.id === item.id));
    assert.ok(!m.remaining.some((i) => i.id === item.id));
  });

  await test('a mismatching basket returns it, and it stays available', () => {
    const round = buildSortRound();
    const m = new SortMachine(round);
    const item = round.items[0];
    const wrong = round.baskets.find((b) => b !== valueOn(item, round.dimension))!;
    assert.equal(m.deposit(item.id, wrong), 'returned');
    assert.ok(m.remaining.some((i) => i.id === item.id), 'the item left the tray');
    assert.equal(m.contents(wrong).length, 0, 'the item entered the wrong basket');
  });

  await test('a wrong drop can be repeated forever without locking anything out', () => {
    const round = buildSortRound();
    const m = new SortMachine(round);
    const item = round.items[0];
    const right = valueOn(item, round.dimension);
    const wrong = round.baskets.find((b) => b !== right)!;
    for (let i = 0; i < 20; i++) assert.equal(m.deposit(item.id, wrong), 'returned');
    assert.equal(m.deposit(item.id, right), 'accepted');
  });

  await test('an already-sorted item cannot be double-counted', () => {
    const round = buildSortRound();
    const m = new SortMachine(round);
    const item = round.items[0];
    const right = valueOn(item, round.dimension);
    m.deposit(item.id, right);
    assert.equal(m.deposit(item.id, right), 'returned');
    assert.equal(m.contents(right).filter((i) => i.id === item.id).length, 1);
  });

  await test('an unknown item id is refused without throwing', () => {
    const round = buildSortRound();
    const m = new SortMachine(round);
    assert.equal(m.deposit('nope', round.baskets[0]), 'returned');
  });

  await test('sorting every item completes the round', () => {
    const round = buildSortRound();
    const m = new SortMachine(round);
    assert.equal(m.complete, false);
    for (const item of round.items) m.deposit(item.id, valueOn(item, round.dimension));
    assert.equal(m.complete, true);
    assert.equal(m.remaining.length, 0);
  });

  section('F.028 — misses feed the shared log, and are never a score');

  await test('misses map onto F.009\'s 0-3 prompt tier, and cap', () => {
    assert.equal(onScreenTierFromMisses(0), 0);
    assert.equal(onScreenTierFromMisses(1), 1);
    assert.equal(onScreenTierFromMisses(2), 2);
    assert.equal(onScreenTierFromMisses(3), 3);
    assert.equal(onScreenTierFromMisses(99), 3, 'the tier must cap, not keep climbing');
  });

  await test('a clean round logs as unprompted', () => {
    const round = buildSortRound();
    const m = new SortMachine(round);
    for (const item of round.items) m.deposit(item.id, valueOn(item, round.dimension));
    assert.equal(onScreenTierFromMisses(m.misses), 0);
  });

  section('F.028 — tap leads, drag follows, and the child sees no text');

  const raw = readFileSync(new URL('../src/games/SortByRule.tsx', import.meta.url), 'utf8');
  /** Comments stripped — these checks are about what the child can see. */
  const ui = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  await test('both inputs exist, and both go through the same offer() path', () => {
    assert.ok(ui.includes("offer(selectedId, basket, 'tap')"), 'tap-then-tap path missing');
    assert.ok(ui.includes("offer(item.id, basket, 'drag')"), 'drag path missing');
  });

  await test('tap is not gated behind a drag capability check', () => {
    assert.ok(
      !/drag(Enabled|Only|Required)/i.test(ui),
      'drag looks like it can become the required path — it must never be',
    );
  });

  await test('the avoid list is passed into round CONSTRUCTION', () => {
    assert.ok(
      /buildSortRound\(\{\s*avoidList: profile\.context\.avoidList\s*\}\)/.test(ui),
      'the round is built without the avoid list — a disliked colour could be offered',
    );
  });

  await test('the armed-basket state changes no fill, only its border', () => {
    // A background tint on the hovered basket would be a second varying
    // visual property during a colour round.
    const rule = ui.match(/\.sbr-basket--armed\s*\{[^}]*\}/)?.[0] ?? '';
    assert.ok(rule.length > 0, 'the armed rule is gone');
    assert.ok(!/background/.test(rule), `armed basket changes its background: ${rule}`);
  });

  await test('colour is resolved in exactly one place', () => {
    const hexes = ui.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    const inMap = (ui.match(/COLOUR_HEX[\s\S]*?\};/)?.[0].match(/#[0-9A-Fa-f]{6}/g) ?? []).length;
    assert.equal(hexes.length, inMap, 'a colour literal exists outside COLOUR_HEX');
  });

  await test('no score, star, counter, timer or progress bar anywhere in the file', () => {
    // `points="..."` is the SVG polygon attribute that draws the triangle,
    // not a score. Dropped before the scan rather than weakening the word.
    const scanned = ui.replace(/points="[^"]*"/g, '');
    for (const banned of [/\bscores?\b/i, /\bstars?\b/i, /\bconfetti\b/i, /\bstreaks?\b/i, /\bpoints?\b/i, /progress\s*bar/i, /try again/i, /\btimer\b/i]) {
      assert.ok(!banned.test(scanned), `SortByRule.tsx matches ${String(banned)}`);
    }
  });

  await test('a returned item triggers no feedback branch in the UI', () => {
    const offerBody = ui.slice(ui.indexOf('function offer('), ui.indexOf('function basketAtPoint('));
    assert.ok(!/returned/.test(offerBody), 'offer() branches on a returned result');
  });

  await test('the child-facing phase is reported up so the shell can hide its chrome', () => {
    assert.ok(ui.includes("onChildFacingChange?.(phase === 'sorting')"));
  });

  await test('the sorting view renders no visible text node', () => {
    const start = ui.indexOf("if (phase === 'sorting' && machine)");
    const end = ui.indexOf('<p>How much support');
    assert.ok(start !== -1 && end !== -1 && end > start, 'could not locate the child-facing view');
    const childView = ui.slice(start, end);
    const textNodes = [...childView.matchAll(/>\s*([A-Za-z][A-Za-z ,.'!?-]{1,})\s*</g)]
      .map((m) => m[1].trim())
      .filter((t) => t.length > 1);
    assert.deepEqual(textNodes, [], `visible text in the child's view: ${textNodes.join(', ')}`);
  });

  await test('the round ends itself when the tray empties, not on a worded control', () => {
    assert.ok(/machine\?\.complete/.test(ui), 'no auto-advance on completion');
    assert.ok(!/>Finish</.test(ui), 'a Finish control is rendered');
  });

  section('F.028 — motion is capped, not chosen here');

  await test('motion comes from config/motion.ts, not hardcoded durations', () => {
    assert.ok(ui.includes('motionFor(profile'), 'motion tier is not derived from the profile');
    assert.ok(
      !/animation:\s*[a-z-]+\s+\d+m?s/i.test(ui),
      'a hardcoded animation duration bypasses the profile cap',
    );
  });

  await test('reduced motion is honoured', () => {
    assert.ok(ui.includes('prefers-reduced-motion'));
  });

  section('F.028 — 88pt touch targets');

  await test('tray items are at least 88x88', () => {
    const rule = ui.match(/\.sbr-item\s*\{[^}]*\}/)?.[0] ?? '';
    assert.ok(/width:\s*88px/.test(rule) && /height:\s*88px/.test(rule), rule);
  });

  summarize();
}

void main();
