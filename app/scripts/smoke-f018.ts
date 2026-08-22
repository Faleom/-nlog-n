// Real functional check for F.018 — Avoid List.
// Run with: npm run smoke:f018
//
// The core claim to prove for real, not just by reading the code: the
// filter runs LAST, on the FINAL slot-filled string, not on the raw
// template. See the "ordering" section below — it uses a template whose
// STATIC TEXT never contains the avoided word at all; only the SUBSTITUTED
// value does. If the filter ran before substitution (or wasn't wired at
// all), that test would fail.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { section, summarize, test } from './testHarness';

async function main() {
  const {
    avoidListFilter,
    containsAvoidedContent,
    installAvoidFilter,
    isColourAvoided,
    NEUTRAL_FALLBACK_LINE,
    shouldAnnounceChangesInAdvance,
    shouldReduceAnimation,
    shouldUseVisualPulseInsteadOfChime,
  } = await import('../src/engine/avoidFilter');
  const { fillSlots, renderLine, resetAvoidFilter, slotValuesFromContext } = await import(
    '../src/engine/slots'
  );
  const { createProfile, updateProfile, getProfile } = await import('../src/engine/profileStore');

  section('F.018 — containsAvoidedContent: whole-word, case-insensitive, colour + free text');

  await test('an avoided colour is detected in text, case-insensitively', () => {
    assert.equal(containsAvoidedContent('Find something RED!', { avoidedColour: 'red' }), true);
  });

  await test('whole-word matching does not false-positive on a substring', () => {
    // "red" must not match inside "bored" or "credit".
    assert.equal(containsAvoidedContent('Are you bored?', { avoidedColour: 'red' }), false);
    assert.equal(containsAvoidedContent('Use your credit', { avoidedColour: 'red' }), false);
  });

  await test('a free-text avoided term is detected', () => {
    assert.equal(containsAvoidedContent('Time for the vacuum!', { avoidedTerms: ['vacuum'] }), true);
  });

  await test('an empty/undefined avoid list matches nothing, at no cost', () => {
    assert.equal(containsAvoidedContent('Find something red!', undefined), false);
    assert.equal(containsAvoidedContent('Find something red!', {}), false);
  });

  section('F.018 — this is a hard exclusion, not a weighting: full-line swap, not word-editing');

  await test('matching text is replaced by the ONE fixed neutral line, not edited in place', () => {
    const context = { avoidList: { avoidedColour: 'red' } };
    const result = avoidListFilter('Find something red!', context);
    assert.equal(result, NEUTRAL_FALLBACK_LINE);
  });

  await test('non-matching text passes through completely unchanged', () => {
    const context = { avoidList: { avoidedColour: 'red' } };
    const result = avoidListFilter('Find something blue!', context);
    assert.equal(result, 'Find something blue!');
  });

  section('F.018 — THE FILTER RUNS LAST: proven against the fully-substituted string, not the template');

  await test('a template whose static text never contains the avoided word still gets caught, via renderLine', () => {
    // The literal template text is `{fav_colour} time!` -- the substring
    // "red" appears ONLY after slot substitution fills fav_colour. If the
    // filter ran on the raw template (or before substitution in any way),
    // it could never see "red" here, because the template never contains
    // that word at all.
    const context = { avoidList: { avoidedColour: 'red' } };
    const values = slotValuesFromContext(context, { fav_colour: 'red' });
    // Sanity: the raw template truly does not contain "red".
    assert.ok(!/red/i.test('{fav_colour} time!'));

    installAvoidFilter();
    const line = renderLine('{fav_colour} time!', values, context);
    resetAvoidFilter();
    assert.equal(line, NEUTRAL_FALLBACK_LINE, 'the avoid filter did not catch a word introduced by slot substitution');
  });

  await test('the same avoided word, if it only appeared in the STATIC template text, is also caught', () => {
    const context = { avoidList: { avoidedColour: 'red' } };
    installAvoidFilter();
    const line = renderLine('The red ball is over there!', slotValuesFromContext(context), context);
    resetAvoidFilter();
    assert.equal(line, NEUTRAL_FALLBACK_LINE);
  });

  await test('with the real filter installed, a genuinely clean line still renders normally', () => {
    const context = { avoidList: { avoidedColour: 'red' } };
    installAvoidFilter();
    const line = renderLine('Find something {fav_colour}!', slotValuesFromContext(context, { fav_colour: 'blue' }), context);
    resetAvoidFilter();
    assert.equal(line, 'Find something blue!');
  });

  section('F.018 — "loud sounds" actually changes something (documented: audio -> visual pulse flag)');

  await test('shouldUseVisualPulseInsteadOfChime is true only when loudSounds is set', () => {
    assert.equal(shouldUseVisualPulseInsteadOfChime({ loudSounds: true }), true);
    assert.equal(shouldUseVisualPulseInsteadOfChime({ loudSounds: false }), false);
    assert.equal(shouldUseVisualPulseInsteadOfChime(undefined), false);
    assert.equal(shouldUseVisualPulseInsteadOfChime({}), false);
  });

  section('F.018 — non-text properties: colour and animation flags for other consumers (e.g. Game 1 targeting)');

  await test('isColourAvoided matches case- and whitespace-insensitively', () => {
    assert.equal(isColourAvoided('Red', { avoidedColour: 'red' }), true);
    assert.equal(isColourAvoided(' red ', { avoidedColour: 'RED' }), true);
    assert.equal(isColourAvoided('blue', { avoidedColour: 'red' }), false);
    assert.equal(isColourAvoided('red', undefined), false);
  });

  await test('shouldReduceAnimation and shouldAnnounceChangesInAdvance read their own flags only', () => {
    assert.equal(shouldReduceAnimation({ fastAnimation: true }), true);
    assert.equal(shouldReduceAnimation({ fastAnimation: false }), false);
    assert.equal(shouldAnnounceChangesInAdvance({ surprises: true }), true);
    assert.equal(shouldAnnounceChangesInAdvance({}), false);
  });

  section('F.018 — real round trip: an avoid list saved through the store actually filters real output');

  await test('setup: a real profile with an avoid list, saved and reloaded through the real store', async () => {
    const profile = await createProfile({ ageMonths: 40 });
    await updateProfile(profile.id, {
      context: { avoidList: { avoidedColour: 'red', avoidedTerms: ['vacuum'] } },
    });
    const reloaded = await getProfile(profile.id);
    assert.equal(reloaded?.context.avoidList?.avoidedColour, 'red');

    installAvoidFilter();
    const filteredLine = renderLine(
      'Find something {fav_colour}!',
      slotValuesFromContext(reloaded!.context, { fav_colour: 'red' }),
      reloaded!.context,
    );
    resetAvoidFilter();
    assert.equal(filteredLine, NEUTRAL_FALLBACK_LINE, 'a saved avoid-list colour did not filter a real rendered line');
  });

  section('F.018 — empty avoid list: no behaviour change, no cost (regression guard)');

  await test('a profile that never sets an avoid list renders every line completely untouched', async () => {
    const profile = await createProfile({ ageMonths: 36 });
    installAvoidFilter();
    const line = renderLine('Find something {fav_colour}!', slotValuesFromContext(profile.context, { fav_colour: 'yellow' }), profile.context);
    resetAvoidFilter();
    assert.equal(line, 'Find something yellow!');
  });

  section('F.018 — fillSlots alone (no filter) is a different function -- renderLine is the one consumers must use');

  await test('fillSlots by itself never applies the avoid filter -- proves renderLine is the load-bearing entry point', () => {
    const context = { avoidList: { avoidedColour: 'red' } };
    const raw = fillSlots('Find something {fav_colour}!', slotValuesFromContext(context, { fav_colour: 'red' }));
    assert.equal(raw, 'Find something red!', 'fillSlots should NOT filter -- only renderLine does');
  });

  summarize();
}

void main();
