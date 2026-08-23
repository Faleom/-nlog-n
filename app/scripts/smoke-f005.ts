// Real functional check for F.005 — Slot System.
// Run with: npm run smoke:f005

import assert from 'node:assert/strict';
import { section, summarize, test } from './testHarness';
import {
  fillSlots,
  renderLine,
  resetAvoidFilter,
  setAvoidFilter,
  slotValuesFromContext,
} from '../src/engine/slots';
import type { ChildContextProfile } from '../src/types';

async function main() {
  section('F.005 — all ten named slots resolve');

  await test('every slot from the guide fills correctly', () => {
    const template =
      '{companion} {companion_they} {fav_colour} {fav_animal} {fav_food} ' +
      '{fav_place} {caregiver} {child} {movement} {object.name}';
    const filled = fillSlots(template, {
      companion: 'Bunbun',
      companion_they: 'he',
      fav_colour: 'red',
      fav_animal: 'rabbit',
      fav_food: 'banana',
      fav_place: 'the kitchen',
      caregiver: 'Dada',
      child: 'Maya',
      movement: 'hop',
      'object.name': 'red cup',
    });
    assert.equal(filled, 'Bunbun he red rabbit banana the kitchen Dada Maya hop red cup');
  });

  section('F.005 — empty profile reads naturally, never a visible {placeholder}');

  await test('slotValuesFromContext on a fully empty context has no undefined-shaped gaps', () => {
    const empty: ChildContextProfile = {};
    const values = slotValuesFromContext(empty);
    // Every value must be a real string default, not undefined.
    for (const [key, value] of Object.entries(values)) {
      assert.equal(typeof value, 'string', `slot ${key} did not default to a string`);
    }
  });

  await test('a template with an empty context never leaks a raw {slot}', () => {
    const empty: ChildContextProfile = {};
    const line = fillSlots('{companion} wants something {fav_colour}!', slotValuesFromContext(empty));
    assert.ok(!/\{[a-zA-Z_.]+\}/.test(line), `raw slot leaked into output: "${line}"`);
  });

  await test('a genuinely unknown slot name degrades to nothing, not the raw bracket', () => {
    const line = fillSlots('Find the {totally_unknown_slot} today', {});
    assert.ok(!/\{[a-zA-Z_.]+\}/.test(line), `raw slot leaked into output: "${line}"`);
    assert.equal(line, 'Find the today');
  });

  section('F.005 — the avoid-list filter hook runs last');

  await test('renderLine calls the registered filter with the fully-filled text', () => {
    let filterSawText = '';
    setAvoidFilter((text) => {
      filterSawText = text;
      return text;
    });
    const context: ChildContextProfile = { quickPreferences: { favColour: 'red' } };
    renderLine('Find something {fav_colour}!', slotValuesFromContext(context), context);
    resetAvoidFilter();
    assert.equal(
      filterSawText,
      'Find something red!',
      'filter should see fully-substituted text (slots already filled), not the raw template',
    );
  });

  await test('renderLine actually applies the registered filter\'s output', () => {
    setAvoidFilter((text) => text.replace('loud', 'gentle'));
    const context: ChildContextProfile = {};
    const line = renderLine('Make a loud sound!', slotValuesFromContext(context), context);
    resetAvoidFilter();
    assert.equal(line, 'Make a gentle sound!');
  });

  await test('with no filter registered (noop default), renderLine still fills slots', () => {
    const context: ChildContextProfile = { quickPreferences: { favColour: 'blue' } };
    const line = renderLine('Find something {fav_colour}!', slotValuesFromContext(context), context);
    assert.equal(line, 'Find something blue!');
  });

  section('F.005 — no runtime model call in this path (static check)');

  await test('slots.ts does not import a model/network SDK', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../src/engine/slots.ts', import.meta.url), 'utf8');
    assert.ok(!/@anthropic-ai|fetch\(|XMLHttpRequest/i.test(source));
  });

  summarize();
}

void main();
