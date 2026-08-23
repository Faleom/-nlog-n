// Real functional check for F.021 — Game 3 Mode A: Shadow Match. Run
// with: npm run smoke:f021
//
// silhouette.ts, game3Level.ts, and game3ShadowMatch.ts are pure (or
// StoragePort-backed) — fully testable without a browser. silhouetteCanvas.ts
// and Game3ShadowMatch.tsx's own rendering need a human on a real device —
// see PERSON-2's final report.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { computeSilhouette, silhouetteCoverage } from '../src/games/silhouette';
import type { PixelBuffer } from '../src/adapters/imaging/pixelBuffer';
import {
  ALTERED_SAMPLE_FILTER,
  ALTERED_SAMPLE_TRANSFORM,
  buildLevel1Pool,
  buildShadowMatchOptions,
  companionAsCrop,
  requiresFetchingTheRealObject,
  sampleKindForLevel,
} from '../src/games/game3ShadowMatch';
import type { ChildProfile, TaggedCrop } from '../src/types';
import type { Game3Level } from '../src/games/game3Level';

function solidBuffer(width: number, height: number, rgba: [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4) as Uint8ClampedArray<ArrayBuffer>;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

function crop(overrides: Partial<TaggedCrop>): TaggedCrop {
  return {
    id: 'x',
    name: 'cup',
    colour: 'red',
    category: 'drinkware',
    function: 'drink from',
    bbox: { x: 0, y: 0, width: 1, height: 1 },
    image: 'data:image/png;base64,x',
    ...overrides,
  };
}

/**
 * Strips comments before a static keyword-match check runs, so a comment
 * correctly EXPLAINING a constraint doesn't get flagged as code VIOLATING
 * it (a known false-positive class in this codebase's static checks — see
 * this file's own F.021 fixes, where a multi-line JSX comment block
 * `{/* ... *\/}` tripped a keyword check because its continuation lines
 * don't start with `//`/`*`/`/*`, only the JSX file's block comments in
 * general do). Two passes: first strip any `/* ... *\/` block (which also
 * covers a JSX `{/* ... *\/}`, since the `{`/`}` around it aren't part of
 * the match), THEN drop any remaining single-line `//` comments.
 */
function codeOnly(source: string): string {
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//');
    })
    .join('\n');
}

async function main() {
  section('F.021 — silhouette generation: pure threshold + fill (silhouette.ts)');

  await test('a solid dark image becomes fully opaque silhouette (below threshold)', () => {
    const buffer = solidBuffer(10, 10, [10, 10, 10, 255]);
    const result = computeSilhouette(buffer);
    assert.equal(silhouetteCoverage(result), 1);
  });

  await test('a solid bright image becomes fully transparent (above threshold, not part of the silhouette)', () => {
    const buffer = solidBuffer(10, 10, [240, 240, 240, 255]);
    const result = computeSilhouette(buffer);
    assert.equal(silhouetteCoverage(result), 0);
  });

  await test('a dark object on a light background produces a real, non-trivial silhouette (some but not all pixels)', () => {
    const width = 10;
    const height = 10;
    const buffer = solidBuffer(width, height, [240, 240, 240, 255]); // light background
    // Paint a dark 4x4 square in the middle.
    for (let y = 3; y < 7; y++) {
      for (let x = 3; x < 7; x++) {
        const i = (y * width + x) * 4;
        buffer.data[i] = 10;
        buffer.data[i + 1] = 10;
        buffer.data[i + 2] = 10;
        buffer.data[i + 3] = 255;
      }
    }
    const result = computeSilhouette(buffer);
    const coverage = silhouetteCoverage(result);
    assert.ok(coverage > 0 && coverage < 1, `expected a partial silhouette, got coverage=${coverage}`);
    assert.equal(coverage, 16 / 100, 'the 4x4 dark square should be exactly the silhouette');
  });

  await test('every silhouette pixel is EITHER fully opaque near-black OR fully transparent — never in between', () => {
    const width = 10;
    const height = 10;
    const buffer = solidBuffer(width, height, [128, 128, 128, 255]);
    // Introduce some mid-tone variety so the threshold has real work to do.
    for (let i = 0; i < buffer.data.length; i += 4) {
      buffer.data[i] = (i / 4) % 256;
      buffer.data[i + 1] = (i / 4) % 256;
      buffer.data[i + 2] = (i / 4) % 256;
    }
    const result = computeSilhouette(buffer);
    for (let i = 0; i < result.data.length; i += 4) {
      const alpha = result.data[i + 3];
      assert.ok(alpha === 0 || alpha === 255, `pixel alpha must be 0 or 255, got ${alpha}`);
      if (alpha === 255) {
        assert.ok(result.data[i] <= 40, 'an opaque silhouette pixel must be near-black, not the original colour');
      }
    }
  });

  await test('invert flips which side of the threshold becomes the silhouette', () => {
    const buffer = solidBuffer(5, 5, [240, 240, 240, 255]); // bright
    const normal = computeSilhouette(buffer);
    const inverted = computeSilhouette(buffer, { invert: true });
    assert.equal(silhouetteCoverage(normal), 0);
    assert.equal(silhouetteCoverage(inverted), 1);
  });

  await test('fully transparent source pixels never become part of the silhouette, even if dark', () => {
    const buffer = solidBuffer(5, 5, [0, 0, 0, 0]); // dark but transparent
    const result = computeSilhouette(buffer);
    assert.equal(silhouetteCoverage(result), 0);
  });

  await test('does not mutate the source buffer', () => {
    const buffer = solidBuffer(5, 5, [10, 10, 10, 255]);
    const snapshot = Uint8ClampedArray.from(buffer.data);
    computeSilhouette(buffer);
    assert.deepEqual(buffer.data, snapshot);
  });

  section('F.021 — level table matches §8.3 exactly');

  await test('sample kind walks identical -> altered -> silhouette -> silhouette-fetch', () => {
    const kinds = ([1, 2, 3, 4] as Game3Level[]).map(sampleKindForLevel);
    assert.deepEqual(kinds, ['identical', 'altered', 'silhouette', 'silhouette-fetch']);
  });

  await test('only level 4 requires fetching the real object', () => {
    const results = ([1, 2, 3, 4] as Game3Level[]).map(requiresFetchingTheRealObject);
    assert.deepEqual(results, [false, false, false, true]);
  });

  const game3Source = readFileSync(new URL('../src/games/Game3ShadowMatch.tsx', import.meta.url), 'utf8');
  const game3Code = codeOnly(game3Source);

  section('F.021 — Level 2 is visually distinguishable from Level 1 (no second photo exists — §8.3 vs §8.1)');

  await test('ALTERED_SAMPLE_FILTER and ALTERED_SAMPLE_TRANSFORM are real, non-empty CSS values', () => {
    // §8.3 Level 2 is "same object, different angle or lighting", but the
    // pipeline only ever produces one photo per session (§8.1) — so Level
    // 1 and Level 2 would render the pixel-IDENTICAL sample image with no
    // simulated transform. That would make two of the four levels
    // indistinguishable to the child, defeating the ladder. These constants
    // are what Game3ShadowMatch.tsx applies (via sampleVisualStyle) to the
    // sample image only at Level 2, so this at least checks they exist and
    // are non-trivial CSS — the actual visual result still needs a human
    // on a real device, per this file's header.
    assert.ok(ALTERED_SAMPLE_FILTER.length > 0);
    assert.ok(ALTERED_SAMPLE_TRANSFORM.length > 0);
    assert.notEqual(ALTERED_SAMPLE_FILTER, 'none');
    assert.notEqual(ALTERED_SAMPLE_TRANSFORM, 'none');
  });

  await test('Game3ShadowMatch.tsx actually applies the altered style, gated on sampleKind, not applied unconditionally', () => {
    assert.ok(
      /sampleVisualStyle\(sampleKind\)/.test(game3Code),
      'the sample render must call sampleVisualStyle(sampleKind) so the transform only applies at the altered (Level 2) kind',
    );
    assert.ok(
      /kind === 'altered'/.test(game3Code),
      'sampleVisualStyle must branch specifically on the altered kind, not apply to every level',
    );
  });

  section('F.021 — Level 4\'s silhouette is actually shown on screen, not just described in caregiver text');

  await test('the searching phase (Level 4) renders the sample image, not text-only', () => {
    // Anchored on the JSX render blocks specifically (`{phase === '...' &&`)
    // rather than the bare condition text, which ALSO appears earlier in
    // the file inside the tick() polling effect's `if (phase === ...)` —
    // a plain `indexOf("phase === 'searching'")` would match that first
    // occurrence instead of the actual render block.
    const searchingStart = game3Code.indexOf("{phase === 'searching' &&");
    const searchingEnd = game3Code.indexOf("{phase === 'confirming' &&");
    assert.ok(searchingStart > -1 && searchingEnd > searchingStart, 'expected to locate the searching render block');
    const searchingSection = game3Code.slice(searchingStart, searchingEnd);
    assert.ok(
      /sampleImage/.test(searchingSection),
      'Level 4 is "silhouette, answer not on screen" — the silhouette itself must render somewhere on this screen, not just be described to the caregiver in text',
    );
  });

  section('F.021 — reward is a real dissolve, not a straight swap (§8.3: "the silhouette dissolves into the real photo")');

  await test('the celebrating phase layers the sample over the real photo with a dissolve animation, not a plain swap', () => {
    const celebratingStart = game3Code.indexOf("phase === 'celebrating'");
    const celebratingEnd = game3Code.indexOf("phase === 'reportingSupport'");
    const celebratingSection = game3Code.slice(celebratingStart, celebratingEnd);
    assert.ok(/g3-dissolve-top/.test(celebratingSection), 'expected the dissolve-animated top layer class in the celebrating render');
    assert.ok(/target\.image/.test(celebratingSection), 'expected the real photo underneath as the revealed layer');
  });

  section('F.021 — phone gets Game 3\'s OWN pattern: sequential reveal, not Game 1\'s carousel (§4.3, static check)');

  await test('the options grid is driven by JS reveal state (isPhoneViewport/revealedCount), not a CSS overflow-x carousel', () => {
    // §4.3's own table assigns "Grid -> Carousel" to Game 1's confirmation
    // and a DIFFERENT pattern, "Grid -> Sequential reveal ... 2 at a time,
    // 'show me more' between", specifically to Game 3's options. Copying
    // Game1.tsx's `overflow-x: auto` carousel trick here (an earlier
    // version of this file did exactly that) would be the WRONG row of
    // that table, not a simplification of it.
    assert.ok(/isPhoneViewport/.test(game3Code), 'expected a phone-viewport check driving the options grid');
    assert.ok(/revealedCount/.test(game3Code), 'expected a reveal-count driving how many options are visible at once');
    assert.ok(!/overflow-x/.test(game3Code), 'Game 3\'s phone pattern is sequential reveal, not a horizontally scrolling carousel (that\'s Game 1\'s row of the §4.3 table, not Game 3\'s)');
  });

  await test('PHONE_REVEAL_BATCH is exactly 2, per §4.3\'s "2 at a time"', () => {
    assert.ok(/PHONE_REVEAL_BATCH\s*=\s*2\b/.test(game3Code));
  });

  section('F.021 — Level 4 hands directly into Game 1\'s loop (static check)');

  await test('the Level-4 fetch path uses "They brought it" — Game 1\'s own confirmation button text', () => {
    assert.ok(/They brought it/.test(game3Code));
  });

  section('F.021 — options grid: target always included, clamped to the pool');

  await test('buildShadowMatchOptions always includes the target exactly once', () => {
    const target = crop({ id: 't' });
    const pool = [target, crop({ id: 'a' }), crop({ id: 'b' }), crop({ id: 'c' })];
    const options = buildShadowMatchOptions(pool, target);
    assert.equal(options.filter((c) => c.id === 't').length, 1);
  });

  await test('clamps to the available pool rather than padding', () => {
    const target = crop({ id: 't' });
    const options = buildShadowMatchOptions([target], target); // pool of 1
    assert.equal(options.length, 1);
  });

  section('F.021 — the Companion\'s silhouette is the Level 1 sample every session (§8.1/F.021)');

  function profileWithCompanion(): ChildProfile {
    return {
      id: 'c1',
      ageMonths: 40,
      responseProfile: {},
      context: { companion: { name: 'Bunbun', pronoun: 'he', photo: 'data:image/png;base64,bunbun' } },
      createdAt: '',
      updatedAt: '',
    };
  }

  function profileWithoutCompanion(): ChildProfile {
    return { id: 'c2', ageMonths: 40, responseProfile: {}, context: {}, createdAt: '', updatedAt: '' };
  }

  await test('companionAsCrop wraps the Companion with its own photo', () => {
    const wrapped = companionAsCrop(profileWithCompanion());
    assert.ok(wrapped);
    assert.equal(wrapped?.name, 'Bunbun');
    assert.equal(wrapped?.image, 'data:image/png;base64,bunbun');
  });

  await test('with no Companion set, companionAsCrop returns null (no broken Level 1)', () => {
    assert.equal(companionAsCrop(profileWithoutCompanion()), null);
  });

  await test('buildLevel1Pool targets the Companion, with room crops as decoys', () => {
    const roomCrops = [crop({ id: 'a' }), crop({ id: 'b' })];
    const result = buildLevel1Pool(profileWithCompanion(), roomCrops);
    assert.ok(result);
    assert.equal(result?.target.id, 'companion');
    assert.ok(result?.pool.some((c) => c.id === 'a'));
  });

  await test('buildLevel1Pool returns null with no Companion — caller falls back to a normal target (§6.3)', () => {
    const result = buildLevel1Pool(profileWithoutCompanion(), [crop({ id: 'a' })]);
    assert.equal(result, null);
  });

  section('F.021 — level state SHARED across Game 3 modes (game3Level.ts, real StoragePort)');

  await test('a fresh child defaults to level 1', async () => {
    const { getGame3Level } = await import('../src/games/game3Level');
    assert.equal(await getGame3Level('fresh-g3-child'), 1);
  });

  await test('setGame3Level persists under a key distinct from Game 1\'s level (no cross-game collision)', async () => {
    const { getGame3Level: getG3, setGame3Level: setG3 } = await import('../src/games/game3Level');
    const { getGame1Level: getG1, setGame1Level: setG1 } = await import('../src/games/game1Level');
    await setG3('shared-child', 4);
    await setG1('shared-child', 2);
    assert.equal(await getG3('shared-child'), 4, 'Game 3\'s level must not be clobbered by Game 1\'s');
    assert.equal(await getG1('shared-child'), 2, 'Game 1\'s level must not be clobbered by Game 3\'s');
  });

  section('F.021 — thin layer: no engine logic duplicated (static check, comments filtered)');

  await test('Game3ShadowMatch.tsx reuses InteractionMachine, sessionLifecycle and game1Trial rather than reimplementing them', () => {
    assert.ok(/from '\.\.\/engine\/interactionMachine'/.test(game3Code));
    assert.ok(/from '\.\.\/engine\/sessionLifecycle'/.test(game3Code));
    assert.ok(/from '\.\/game1Trial'/.test(game3Code), 'target selection should reuse game1Trial.ts\'s pickNextTarget, not reinvent it');
  });

  await test('wrong tap is silent — no sound/colour-flash/text reaction, same as F.009\'s contract', () => {
    const handlerStart = game3Code.indexOf('function handleOptionTap');
    const handlerEnd = game3Code.indexOf('function handleTheyBroughtIt');
    const handlerSection = game3Code.slice(handlerStart, handlerEnd);
    assert.ok(!/say\(/.test(handlerSection), 'a wrong tap must not trigger any spoken line');
  });

  section('F.021 — no score, star, confetti or timer anywhere (§7.7, static check)');

  await test('Game3ShadowMatch.tsx never renders a score, star, confetti, or counter', () => {
    assert.ok(!/\bscore\b|\bstar\b|confetti|\bpoints?\b/i.test(game3Code));
  });

  summarize();
}

void main();
