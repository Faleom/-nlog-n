// Real functional check for F.008 — Game 1 End-to-End, One Level (the
// Tier 0 gate). Run with: npm run smoke:f008
//
// Game1.tsx itself is a React component and isn't rendered here (no DOM/
// React Testing Library in this repo) — see PERSON-2's final report for
// what a human must verify on a real device (§4.4: "devtools emulation is
// not sufficient"; the F.008 review checklist's "cover all text and try"
// check especially needs eyes on a real screen).
//
// What THIS file verifies automatically:
//   - game1Trial.ts's pickNextTarget(): the one piece of Game 1's own
//     trial logic that's pure enough to unit test.
//   - STATIC checks straight from the F.008 review checklist that a grep
//     can actually answer correctly: does the button say "They brought
//     it" and never a verdict word; is there no score/star/confetti/timer
//     anywhere in the file; does the child-facing JSX avoid rendering
//     crop.name (or any other raw string) as visible text. Every static
//     check filters out comment lines first — a naive regex over the raw
//     source would trip on this file's own header comments explaining
//     these exact constraints (see PERSON-2's brief for why that's a
//     known failure mode to avoid).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { pickNextTarget } from '../src/games/game1Trial';
import { GENERIC_FALLBACK_CROPS } from '../src/games/genericFallbackCrops';
import type { TaggedCrop } from '../src/types';

function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');
}

async function main() {
  section('F.008 — pickNextTarget (game1Trial.ts)');

  await test('never immediately repeats the same target when another exists', () => {
    const crops = GENERIC_FALLBACK_CROPS;
    let lastId: string | null = crops[0].id;
    for (let i = 0; i < 50; i++) {
      const next = pickNextTarget(crops, lastId);
      assert.notEqual(next.id, lastId, `iteration ${i}: repeated the same target back to back`);
      lastId = next.id;
    }
  });

  await test('with a single crop, correctly falls back to repeating it rather than throwing', () => {
    const solo: TaggedCrop[] = [GENERIC_FALLBACK_CROPS[0]];
    const next = pickNextTarget(solo, solo[0].id);
    assert.equal(next.id, solo[0].id);
  });

  await test('with no excludeId (first trial of a session), any crop is a valid pick', () => {
    const next = pickNextTarget(GENERIC_FALLBACK_CROPS, null);
    assert.ok(GENERIC_FALLBACK_CROPS.some((c) => c.id === next.id));
  });

  await test('throws on an empty crop set rather than returning undefined', () => {
    assert.throws(() => pickNextTarget([], null));
  });

  section('F.008 — the button reads "They brought it", never a verdict (static check)');

  const game1Source = readFileSync(new URL('../src/games/Game1.tsx', import.meta.url), 'utf8');
  const game1Code = codeOnly(game1Source);

  await test('the capture-confirmation button literally says "They brought it"', () => {
    assert.ok(/They brought it/.test(game1Code));
  });

  await test('no verdict phrasing ("they got it right/wrong", "correct!", "well done") appears anywhere', () => {
    assert.ok(!/got it (right|wrong)|correct!|well done|good job/i.test(game1Code));
  });

  section('F.008 — no score, star, confetti or counter anywhere (§7.7, static check)');

  await test('Game1.tsx never renders a score, star, confetti, or counter', () => {
    // Deliberately excludes the word "count" alone (e.g. successCount is a
    // legitimate engine concept read from elsewhere) and matches on the
    // specific forbidden UI vocabulary from §7.7 instead.
    assert.ok(!/\bscore\b|\bstar\b|confetti|\bpoints?\b/i.test(game1Code));
  });

  await test('no countdown/timer text is ever shown to the child', () => {
    assert.ok(!/countdown|time left|seconds remaining/i.test(game1Code));
  });

  section('F.008 — the child-facing confirmation view renders photos, not names, as the tap target (static check)');

  await test('the confirming-phase crop grid does not render crop.name as visible JSX text', () => {
    // The CropButton component intentionally has NO text children — only
    // aria-label (accessibility metadata, not visible text) and a
    // background-image/background-colour style. This check confirms that
    // shape hasn't regressed back to rendering {crop.name} as a label,
    // which the ORIGINAL walking skeleton did (see git history).
    const cropButtonSection = game1Code.slice(
      game1Code.indexOf('function CropButton'),
      game1Code.indexOf('const GAME1_STYLES'),
    );
    assert.ok(!/>\s*\{crop\.name\}\s*</.test(cropButtonSection), 'crop.name must not be rendered as visible text');
    assert.ok(/aria-label=\{crop\.name\}/.test(cropButtonSection), 'crop.name should still be present as an aria-label for accessibility');
  });

  await test('the pipeline is reached only through captureRoomAndRecognize, never adapters.capture/vision directly', () => {
    assert.ok(/captureRoomAndRecognize/.test(game1Code));
    assert.ok(!/adapters\.capture\.capturePhoto|adapters\.vision\.recognizeObjects/.test(game1Code));
  });

  section('F.008 — one capture per session, not per trial (static check)');

  await test('captureRoomAndRecognize is called from exactly one place (the idle "take a photo" handler)', () => {
    const occurrences = game1Code.split('captureRoomAndRecognize(').length - 1;
    // Once in the import, once in the call site.
    assert.equal(occurrences, 1, `expected exactly 1 call site, found ${occurrences}`);
  });

  await test('the between-trials path (handleSupportTierReport) reuses `crops` state, it does not recapture', () => {
    const handlerStart = game1Code.indexOf('async function handleSupportTierReport');
    const handlerSection = game1Code.slice(handlerStart, game1Code.indexOf('if (phase ===', handlerStart));
    assert.ok(/startTrialWith\(crops\)/.test(handlerSection), 'the next trial must reuse the existing session crop set');
    assert.ok(!/captureRoomAndRecognize/.test(handlerSection), 'must not recapture between trials');
  });

  summarize();
}

void main();
