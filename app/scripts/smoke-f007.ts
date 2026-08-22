// Real functional check for F.007 -- Object -> Skill -> Steps lookup table.
// Run with: npm run smoke:f007
//
// No model call, no network, no IndexedDB -- this is a pure content table,
// so the test is pure too: every object resolves to real steps, slots fill
// to sensible text, and nothing falls through to an error.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  getSkillTemplatesForCrop,
  getSkillTemplatesForObject,
  REQUIRED_OBJECTS,
} from '../src/engine/skillLookup';
import { fillSlots, slotValuesFromContext } from '../src/engine/slots';
import type { SkillTemplate, TaggedCrop } from '../src/types';

// The exact set of slot keys engine/slots.ts's SlotValues supports, plus
// 'object.name' which every caller fills in per-object (see Game1.tsx's own
// usage of {object.name}). A template using anything outside this set would
// render as a raw, un-filled `{token}` to a caregiver.
const KNOWN_SLOT_KEYS = new Set([
  'companion',
  'companion_they',
  'fav_colour',
  'fav_animal',
  'fav_food',
  'fav_place',
  'caregiver',
  'child',
  'movement',
  'object.name',
]);

function slotsUsedIn(text: string): string[] {
  const matches = [...text.matchAll(/\{([a-zA-Z_.]+)\}/g)];
  return matches.map((m) => m[1]);
}

function allSteps(templates: SkillTemplate[]): string[] {
  return templates.flatMap((t) => t.steps.map((s) => s.promptTemplate));
}

async function main() {
  section('F.007 -- all 15 required objects resolve to real templates');

  for (const object of REQUIRED_OBJECTS) {
    await test(`"${object}" resolves to 3-4 skill templates with ordered steps`, () => {
      // Category is deliberately wrong/irrelevant here -- an exact name
      // match must win regardless of what category the vision port sent.
      const templates = getSkillTemplatesForObject(object, 'nonsense-category');
      assert.ok(templates.length >= 3, `expected 3-4 templates, got ${templates.length}`);
      assert.ok(templates.length <= 4, `expected 3-4 templates, got ${templates.length}`);
      for (const t of templates) {
        assert.ok(t.skillId.length > 0, 'skillId must not be empty');
        assert.ok(t.steps.length >= 1, `${t.skillId} has no steps`);
        for (const s of t.steps) {
          assert.ok(s.promptTemplate.trim().length > 0, `${t.skillId} has a blank step`);
        }
      }
    });
  }

  await test('REQUIRED_OBJECTS matches the exact §7.5 list, no more no less', () => {
    assert.equal(REQUIRED_OBJECTS.length, 15);
    for (const name of [
      'cup',
      'ball',
      'shoe',
      'spoon',
      'door',
      'chair',
      'book',
      'toy animal',
      'plate',
      'towel',
      'brush',
      'box',
      'blanket',
      'bottle',
      'sock',
    ]) {
      assert.ok(REQUIRED_OBJECTS.includes(name), `missing required object: ${name}`);
    }
  });

  section('F.007 -- every step uses only real, known slots (never a raw leak)');

  for (const object of REQUIRED_OBJECTS) {
    const templates = getSkillTemplatesForObject(object, 'unused');
    for (const stepText of allSteps(templates)) {
      const used = slotsUsedIn(stepText);
      for (const key of used) {
        assert.ok(
          KNOWN_SLOT_KEYS.has(key),
          `"${object}" step "${stepText}" uses unknown slot {${key}}`,
        );
      }
    }
  }

  section('F.007 -- slots fill to real, non-empty, readable text (real integration with F.005)');

  await test('a real step for "cup" fills to sensible text with a real profile context', () => {
    const templates = getSkillTemplatesForObject('cup', 'drinkware');
    const values = slotValuesFromContext(
      { quickPreferences: { favColour: 'red' }, peopleAndRoutine: { caregiverTerm: 'Mum' } },
      { 'object.name': 'cup' },
    );
    const filled = templates[0].steps.map((s) => fillSlots(s.promptTemplate, values));
    for (const line of filled) {
      assert.ok(line.length > 0);
      assert.ok(!line.includes('{'), `unfilled slot leaked into: "${line}"`);
      assert.ok(!line.includes('}'), `unfilled slot leaked into: "${line}"`);
    }
    assert.ok(filled.some((l) => l.includes('cup')), 'expected the real object name to appear');
  });

  section('F.007 -- steps are genuinely small (one thing, not "and then")');

  for (const object of REQUIRED_OBJECTS) {
    const templates = getSkillTemplatesForObject(object, 'unused');
    for (const stepText of allSteps(templates)) {
      await test(`"${object}" step is one action: "${stepText}"`, () => {
        assert.ok(!/\band then\b/i.test(stepText), 'step chains two actions with "and then"');
        assert.ok(!/\bthen\b/i.test(stepText), 'step chains actions with "then"');
        const wordCount = stepText.trim().split(/\s+/).length;
        assert.ok(wordCount <= 12, `step has ${wordCount} words, too long to read in one breath: "${stepText}"`);
      });
    }
  }

  section('F.007 -- no output suggests buying, fetching-from-elsewhere, or preparing food (§13)');

  for (const object of REQUIRED_OBJECTS) {
    const templates = getSkillTemplatesForObject(object, 'unused');
    for (const stepText of allSteps(templates)) {
      await test(`"${object}" step "${stepText}" never suggests buying/shopping/cooking`, () => {
        assert.ok(!/\b(buy|purchase|shop|shopping|store|cook|bake|recipe|order online)\b/i.test(stepText));
      });
    }
  }

  section('F.007 -- unknown object degrades to its category, never an error');

  await test('an unrecognised object name with a KNOWN category falls to the category generic set', () => {
    // "mug" is not in the object table, but shares cup's category.
    const templates = getSkillTemplatesForObject('mug', 'drinkware');
    assert.ok(templates.length >= 2, 'expected real category-fallback templates');
    assert.ok(
      allSteps(templates).some((s) => s.includes('{object.name}')),
      'category fallback should still name the real object somewhere',
    );
  });

  await test('a fully unrecognised object AND category falls to the generic fallback, never throws', () => {
    const templates = getSkillTemplatesForObject('mystery-thing', 'mystery-category');
    assert.ok(templates.length >= 3);
    for (const t of templates) {
      assert.ok(t.steps.length >= 1);
    }
  });

  await test('empty-string object name never throws -- degrades to generic', () => {
    assert.doesNotThrow(() => getSkillTemplatesForObject('', ''));
    const templates = getSkillTemplatesForObject('', '');
    assert.ok(templates.length >= 1);
  });

  section('F.007 -- getSkillTemplatesForCrop wraps a real TaggedCrop correctly');

  await test('a TaggedCrop for "ball" resolves the same as calling by name+category directly', () => {
    const crop: TaggedCrop = {
      id: 'x',
      name: 'ball',
      colour: 'blue',
      category: 'toy',
      function: 'you play with it',
      bbox: { x: 0, y: 0, width: 10, height: 10 },
      image: '',
    };
    const viaCrop = getSkillTemplatesForCrop(crop);
    const viaDirect = getSkillTemplatesForObject('ball', 'toy');
    assert.deepEqual(
      viaCrop.map((t) => t.skillId),
      viaDirect.map((t) => t.skillId),
    );
  });

  section('F.007 -- no model call at runtime (static check)');

  await test('skillLookup.ts never imports a vendor SDK or calls a network/model API', () => {
    const source = readFileSync(new URL('../src/engine/skillLookup.ts', import.meta.url), 'utf8');
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    assert.ok(!/@anthropic-ai|fetch\(|XMLHttpRequest|import\(.*http/i.test(codeOnly));
  });

  summarize();
}

void main();
