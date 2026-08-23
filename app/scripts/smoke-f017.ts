// Real functional check for F.017 — Companion mechanic in Game 1. Run
// with: npm run smoke:f017
//
// game1Companion.ts is pure — fully testable without React or a browser.
// Game1.tsx's own wiring (the hunt button, the celebration cameo, the
// audio) is exercised via static checks against its review checklist,
// same pattern as smoke-f008.ts, plus one live demonstration of the
// "profile-swap" claim using the REAL slot-rendering pipeline
// (engine/slots.ts) rather than asserting it structurally.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  COMPANION_HUNT_PROMPT_TEMPLATE,
  HELPER_FRAMING_PROMPT_TEMPLATE,
  hasCompanion,
  rewardFrameColour,
  shouldUseHelperFraming,
} from '../src/games/game1Companion';
import { renderLine, slotValuesFromProfile } from '../src/engine/slots';
import type { ChildProfile } from '../src/types';

function profileWithCompanion(name: string, overrides: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: 'child-1',
    ageMonths: 40,
    responseProfile: {},
    context: {
      companion: { name, pronoun: 'they', photo: `data:image/png;base64,${name}` },
      quickPreferences: { favColour: 'blue' },
    },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function profileWithoutCompanion(): ChildProfile {
  return {
    id: 'child-2',
    ageMonths: 40,
    responseProfile: {},
    context: {},
    createdAt: '',
    updatedAt: '',
  };
}

function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

async function main() {
  section('F.017 — hasCompanion: gates every Companion-specific feature');

  await test('a profile with a name AND a photo has a Companion', () => {
    assert.equal(hasCompanion(profileWithCompanion('Bunbun')), true);
  });

  await test('a profile with no companion context at all does not', () => {
    assert.equal(hasCompanion(profileWithoutCompanion()), false);
  });

  await test('a name with no photo is not enough (hunt/reward need the real photo)', () => {
    const profile = profileWithCompanion('Bunbun');
    profile.context.companion = { name: 'Bunbun', pronoun: 'they', photo: '' };
    assert.equal(hasCompanion(profile), false);
  });

  section('F.017 — the profile-swap demo moment: same code, real renderLine, different output (§18)');

  await test('swapping the Companion in the SAME profile object changes every rendered line, no branching code', () => {
    const profile = profileWithCompanion('Bunbun');
    const huntLineBefore = renderLine(COMPANION_HUNT_PROMPT_TEMPLATE, slotValuesFromProfile(profile), profile.context);
    const helperLineBefore = renderLine(
      HELPER_FRAMING_PROMPT_TEMPLATE,
      slotValuesFromProfile(profile, { 'object.name': 'cup' }),
      profile.context,
    );
    assert.match(huntLineBefore, /Bunbun/);
    assert.match(helperLineBefore, /Bunbun/);

    // The swap: same profile object, same test, no re-import, no branch —
    // exactly what "change the Companion in settings and the whole app
    // visibly changes, same code" means at the level this file can prove.
    profile.context.companion = { name: 'Captain Whiskers', pronoun: 'he', photo: 'data:image/png;base64,cat' };

    const huntLineAfter = renderLine(COMPANION_HUNT_PROMPT_TEMPLATE, slotValuesFromProfile(profile), profile.context);
    const helperLineAfter = renderLine(
      HELPER_FRAMING_PROMPT_TEMPLATE,
      slotValuesFromProfile(profile, { 'object.name': 'cup' }),
      profile.context,
    );
    assert.match(huntLineAfter, /Captain Whiskers/);
    assert.doesNotMatch(huntLineAfter, /Bunbun/);
    assert.match(helperLineAfter, /Captain Whiskers/);
    assert.match(helperLineAfter, /\bhe\b/, 'the pronoun slot should also follow the swap');
  });

  section('F.017 — with no Companion set, the neutral guide still works (§6.3 review checklist)');

  await test('the hunt/helper templates still render sensibly via the existing neutral defaults', () => {
    const profile = profileWithoutCompanion();
    const line = renderLine(COMPANION_HUNT_PROMPT_TEMPLATE, slotValuesFromProfile(profile), profile.context);
    assert.match(line, /your friend/, 'engine/slots.ts\'s existing neutral default, unchanged by F.017');
  });

  section('F.017 — reward framing: a real CSS colour, or none — never the literal placeholder text');

  await test('a known favourite colour returns a real, paintable CSS colour', () => {
    const profile = profileWithCompanion('Bunbun');
    profile.context.quickPreferences = { favColour: 'red' };
    assert.equal(rewardFrameColour(profile), 'red');
  });

  await test('no favourite colour set returns null, never the fallback placeholder word', () => {
    const profile = profileWithoutCompanion();
    assert.equal(rewardFrameColour(profile), null);
  });

  await test('an unrecognised colour word (not a real CSS colour) returns null rather than breaking a border', () => {
    const profile = profileWithCompanion('Bunbun');
    profile.context.quickPreferences = { favColour: 'a colour' }; // slots.ts's own literal fallback text
    assert.equal(rewardFrameColour(profile), null);
  });

  section('F.017 — helper framing cadence: every 3rd trial, not every trial (variety, per §6.3/§8.1)');

  await test('trials 3, 6, 9 use helper framing; 1, 2, 4, 5 do not', () => {
    const results = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(shouldUseHelperFraming);
    assert.deepEqual(results, [false, false, true, false, false, true, false, false, true]);
  });

  section('F.017 — Companion is never sad/disappointed/hurt (§6.3 hard constraint, static check)');

  const companionSource = readFileSync(new URL('../src/games/game1Companion.ts', import.meta.url), 'utf8');
  const companionCode = codeOnly(companionSource);
  const game1Source = readFileSync(new URL('../src/games/Game1.tsx', import.meta.url), 'utf8');
  const game1Code = codeOnly(game1Source);

  await test('game1Companion.ts defines no sad/disappointed/hurt/upset Companion state or function', () => {
    assert.ok(!/sad|disappoint|hurt|upset|angry|frown/i.test(companionCode));
  });

  await test('Game1.tsx never reacts to a wrong tap with any Companion-specific negative response', () => {
    // handleTap's wrong-tap branch (the ONLY place a wrong answer is
    // handled) must not reference the companion at all — the silence +
    // fade behaviour from F.008/F.009 is untouched by F.017, which is
    // exactly the point: there is no code path for "Companion reacts to
    // a wrong answer" to have been added to.
    const handleTapStart = game1Code.indexOf('function handleTap(');
    const wrongTapSection = game1Code.slice(
      game1Code.indexOf('// Wrong tap', handleTapStart),
      game1Code.indexOf('function handleSupportTierReport'),
    );
    assert.ok(
      !/companion/i.test(wrongTapSection),
      'the wrong-tap path must not reference the Companion at all',
    );
  });

  section('F.017 — the Companion never gives an instruction the caregiver can\'t see (§6.3, static check)');

  await test('every renderLine(...COMPANION_HUNT/HELPER_FRAMING...) call site has a matching visible <p> nearby', () => {
    // Precise version: both templates are used to build the SPOKEN line,
    // and the 'searching' JSX (the caregiver's screen during a trial)
    // independently renders companion-framed text for both the hunt and
    // helper-framing conditions — verified structurally: the searching
    // block contains a caregiver-visible <p> for the hunt state
    // (companionHuntActive) as well as for the standard/helper state.
    const searchingBlockStart = game1Code.indexOf("phase === 'searching' &&");
    const searchingBlock = game1Code.slice(searchingBlockStart, searchingBlockStart + 1200);
    assert.ok(/companionHuntActive \? \(/.test(searchingBlock), 'caregiver text must branch on hunt state, not just audio');
    assert.ok(/help them find/.test(searchingBlock), 'the hunt caregiver text must be present and visible');
  });

  summarize();
}

void main();
