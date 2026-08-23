// Real functional check for the bundled object artwork (games/objectIcons.tsx).
// Run with: npm run smoke:icons
//
// What this verifies, with no browser and no network:
//   - every synonym and every category fallback points at artwork that
//     actually exists (a typo'd target would otherwise render `generic`
//     silently, and nobody would notice until demo day)
//   - the resolution ladder itself: exact name, plural, multi-word head
//     noun, casing/punctuation, category fallback, and the final generic
//   - the four GENERIC_FALLBACK_CROPS (§11's quiet degradation set) all
//     resolve to real artwork rather than the generic star
//   - every category the vision prompt asks for, and every category the
//     F.007 lookup table already uses, resolves to something specific
//
// This file is deliberately assertion-heavy about the SYNONYM table: it is
// the one part of the icon system where a silent miss looks exactly like
// working software.

import assert from 'node:assert/strict';
import { section, summarize, test } from './testHarness';
// Imports the PURE half (objectIconLogic.ts), not objectIcons.tsx — JSX
// can't be evaluated by tsx/Node here, and doesn't need to be: the artwork
// map is typed Record<IconKey, ReactElement>, so `tsc` already guarantees
// every key in ICON_KEYS has a drawing. This file covers the half tsc
// can't: whether the synonym/category tables point at the RIGHT keys.
import {
  ICON_KEYS,
  SYNONYMS as SYNONYM_TABLE,
  CATEGORY_ICONS as CATEGORY_TABLE,
  iconKeyFor,
} from '../src/games/objectIconLogic';
import { GENERIC_FALLBACK_CROPS } from '../src/games/genericFallbackCrops';

async function main() {
  // -------------------------------------------------------------------------
  section('Object icons — every table entry points at real artwork');
  // -------------------------------------------------------------------------

  await test('every SYNONYM target is a real icon key', () => {
    const broken = Object.entries(SYNONYM_TABLE)
      .filter(([, target]) => !(ICON_KEYS as readonly string[]).includes(target))
      .map(([word, target]) => `${word} -> ${target}`);
    assert.deepEqual(broken, [], `synonyms pointing at missing artwork: ${broken.join(', ')}`);
  });

  await test('every CATEGORY fallback target is a real icon key', () => {
    const broken = Object.entries(CATEGORY_TABLE)
      .filter(([, target]) => !(ICON_KEYS as readonly string[]).includes(target))
      .map(([cat, target]) => `${cat} -> ${target}`);
    assert.deepEqual(broken, [], `categories pointing at missing artwork: ${broken.join(', ')}`);
  });

  await test('the generic fallback artwork itself exists', () => {
    assert.ok((ICON_KEYS as readonly string[]).includes('generic'));
    assert.equal(iconKeyFor('something nobody has ever drawn'), 'generic');
  });

  // -------------------------------------------------------------------------
  section('Object icons — the resolution ladder');
  // -------------------------------------------------------------------------

  await test('an exact name resolves to its own artwork', () => {
    assert.equal(iconKeyFor('ball'), 'ball');
    assert.equal(iconKeyFor('book'), 'book');
    assert.equal(iconKeyFor('shoe'), 'shoe');
  });

  await test('plurals resolve the same as singulars', () => {
    assert.equal(iconKeyFor('balls'), 'ball');
    assert.equal(iconKeyFor('books'), 'book');
    assert.equal(iconKeyFor('blocks'), 'blocks'); // already plural in the table
  });

  await test('casing, spaces and hyphens do not matter', () => {
    assert.equal(iconKeyFor('Teddy Bear'), 'teddy');
    assert.equal(iconKeyFor('teddy-bear'), 'teddy');
    assert.equal(iconKeyFor('  TEDDYBEAR  '), 'teddy');
  });

  await test('a multi-word name resolves on its head noun (English puts it last)', () => {
    assert.equal(iconKeyFor('big red ball'), 'ball');
    assert.equal(iconKeyFor('toy car'), 'car');
    assert.equal(iconKeyFor('water bottle'), 'bottle');
    assert.equal(iconKeyFor('picture book'), 'book');
  });

  await test('a name that only matches on its FIRST word still resolves', () => {
    // Last word is a miss ("water" has no artwork), first word is the object.
    assert.equal(iconKeyFor('cup of water'), 'cup');
    assert.equal(iconKeyFor('ball pit'), 'ball');
  });

  await test('last word wins over first when BOTH are known objects', () => {
    // Deliberate, not a bug: English puts the head noun last, so "toy car"
    // is a car and "book shelf" is a shelf. The cost of that rule is that a
    // prepositional phrase ("book about trains") resolves on the trailing
    // noun -- an acceptable trade, since a vision model asked for "a short,
    // concrete noun" returns "book", not a sentence.
    assert.equal(iconKeyFor('toy car'), 'car');
    assert.equal(iconKeyFor('book about trains'), 'train');
  });

  await test('an unknown name falls back to its category, not to generic', () => {
    assert.equal(iconKeyFor('sippy tumbler thing', 'drinkware'), 'cup');
    assert.equal(iconKeyFor('romper', 'clothing'), 'shirt');
  });

  await test('an unrecognised TOY never borrows the ball artwork', () => {
    // Regression: category `toy` used to map to `ball`, so a real bedroom
    // photo came back as five identical balls. In a game whose instruction
    // is "go and fetch the ball", drawing a ball for something that is not
    // one is worse than drawing something deliberately generic.
    assert.equal(iconKeyFor('wooden shape sorter', 'toy'), 'toy');
    assert.equal(iconKeyFor('spinning top', 'toy'), 'toy');
    assert.notEqual(iconKeyFor('something toylike', 'toy'), 'ball');
    // ...but a thing that really IS a ball still gets the ball.
    assert.equal(iconKeyFor('ball', 'toy'), 'ball');
    assert.equal(iconKeyFor('beach ball', 'toy'), 'ball');
  });

  await test('the kids-bedroom vocabulary that came back blank now resolves', () => {
    const expected: Array<[string, string]> = [
      ['play tent', 'tent'],
      ['teepee', 'tent'],
      ['rug', 'rug'],
      ['play mat', 'rug'],
      ['hula hoop', 'hoop'],
      ['puzzle', 'puzzle'],
      ['bean bag', 'cushion'],
      ['storage bin', 'basket'],
      ['laundry basket', 'basket'],
      ['toy box', 'box'],
      ['stacking rings', 'toy'],
    ];
    const wrong = expected
      .filter(([name, want]) => iconKeyFor(name) !== want)
      .map(([name, want]) => `${name}: wanted ${want}, got ${iconKeyFor(name)}`);
    assert.deepEqual(wrong, [], wrong.join(' | '));
  });

  await test('a known NAME wins over a mismatched category', () => {
    // The name is the more specific signal -- a "book" tagged as a toy is
    // still drawn as a book.
    assert.equal(iconKeyFor('book', 'toy'), 'book');
  });

  await test('an unknown name AND unknown category lands on generic', () => {
    assert.equal(iconKeyFor('zorblat', 'nonsense'), 'generic');
  });

  // -------------------------------------------------------------------------
  section('Object icons — coverage of the vocabularies the app actually produces');
  // -------------------------------------------------------------------------

  await test('every §11 generic fallback crop resolves to specific artwork', () => {
    for (const crop of GENERIC_FALLBACK_CROPS) {
      const key = iconKeyFor(crop.name, crop.category);
      assert.notEqual(
        key,
        'generic',
        `the fallback set's "${crop.name}" fell through to generic artwork`,
      );
    }
  });

  await test('every category named in the vision prompt resolves specifically', () => {
    // The four the prompt gives as examples, which is what the model will
    // most often echo back.
    for (const cat of ['drinkware', 'toy', 'clothing', 'textile']) {
      assert.notEqual(iconKeyFor('unknown thing', cat), 'generic', `category ${cat} has no artwork`);
    }
  });

  await test('the common child-object vocabulary is covered end to end', () => {
    const expected: Array<[string, string]> = [
      ['cup', 'cup'],
      ['mug', 'cup'],
      ['glass', 'cup'], // regression: naive plural-stripping turned this into "glas"
      ['bottle', 'bottle'],
      ['bowl', 'bowl'],
      ['plate', 'plate'],
      ['spoon', 'spoon'],
      ['teddy', 'teddy'],
      ['stuffed animal', 'teddy'],
      ['soft toy', 'teddy'],
      ['doll', 'doll'],
      ['ball', 'ball'],
      ['building blocks', 'blocks'],
      ['toy car', 'car'],
      ['rubber duck', 'duck'],
      ['balloon', 'balloon'],
      ['book', 'book'],
      ['shoe', 'shoe'],
      ['trainers', 'shoe'],
      ['sock', 'sock'],
      ['hat', 'hat'],
      ['t-shirt', 'shirt'],
      ['backpack', 'bag'],
      ['pillow', 'pillow'],
      ['cushion', 'cushion'],
      ['blanket', 'blanket'],
      ['towel', 'towel'],
      ['toothbrush', 'toothbrush'],
      ['hairbrush', 'brush'],
      ['box', 'box'],
      ['basket', 'basket'],
      ['bucket', 'bucket'],
      ['banana', 'banana'],
      ['apple', 'apple'],
      ['crayon', 'crayon'],
      ['pencil', 'pencil'],
      ['clock', 'clock'],
      ['umbrella', 'umbrella'],
      ['drum', 'drum'],
      ['train', 'train'],
    ];
    const wrong = expected
      .filter(([name, want]) => iconKeyFor(name) !== want)
      .map(([name, want]) => `${name}: wanted ${want}, got ${iconKeyFor(name)}`);
    assert.deepEqual(wrong, [], wrong.join(' | '));
  });

  summarize();
}

void main();
