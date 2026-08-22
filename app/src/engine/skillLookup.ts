// F.007 — Object → skill → steps lookup table (§7.5).
//
// "The hardest engineering problem in the app... in 48 hours it must be a
// rules-based lookup, not model improvisation." This file IS that lookup.
// No AI call, anywhere, at runtime. It's a plain object literal shipped in
// the bundle — works offline, works on a dead API, works identically every
// demo run.
//
// `detected object -> skill template -> ordered steps`, matching §7.5 and
// TECH-DECISIONS.md "Activity steps & all generated text".
//
// Steps are authored with slot placeholders (F.005's `{slot}` syntax —
// see engine/slots.ts). This file only writes the template STRINGS; filling
// them (fillSlots/renderLine) is the caller's job, same as any other
// child-facing line. Every slot used below is a real key in
// engine/slots.ts's SlotValues, so a template here can never leak a raw
// `{unknown_slot}` to a caregiver.
//
// Fallback chain, per the "Done when" list in F.007.md:
//   1. Exact object name match (case-insensitive)
//   2. Category fallback (§13: never an error for an unrecognised object)
//   3. Fully generic fallback (unrecognised object AND unrecognised category)
// Every branch returns real, ordered, slot-templated steps.

import type { SkillStep, SkillTemplate, TaggedCrop } from '../types';

function step(promptTemplate: string): SkillStep {
  return { promptTemplate };
}

function template(skillId: string, category: string, steps: SkillStep[]): SkillTemplate {
  return { skillId, targetObjectCategories: [category], steps };
}

// ---------------------------------------------------------------------------
// The 15 objects (§7.5's list, verbatim), each with 3-4 skill templates.
// Every template targets ONE real, teachable, preschool-sized action —
// nothing here asks a caregiver to buy, fetch, or prepare anything that
// isn't already in the room (§13).
// ---------------------------------------------------------------------------

const OBJECT_TABLE: Record<string, { category: string; templates: SkillTemplate[] }> = {
  cup: {
    category: 'drinkware',
    templates: [
      template('find-cup', 'drinkware', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('carry-cup-carefully', 'drinkware', [
        step('Pick up the {object.name} with two hands.'),
        step('Walk slowly to the table.'),
        step('Set it down gently.'),
      ]),
      template('put-away-cup', 'drinkware', [
        step('Pick up the {object.name}.'),
        step('Carry it to the shelf.'),
        step('Put it next to the other cups.'),
      ]),
      template('match-cup-colour', 'drinkware', [
        step('Find the {fav_colour} {object.name}.'),
        step('Show it to {companion}.'),
      ]),
    ],
  },
  ball: {
    category: 'toy',
    templates: [
      template('find-ball', 'toy', [step('Find your {object.name}.'), step('Bring it to {caregiver}.')]),
      template('roll-ball', 'toy', [
        step('Pick up the {object.name}.'),
        step('Roll it to {caregiver}.'),
        step('Wait for it to roll back to you.'),
      ]),
      template('throw-catch-ball', 'toy', [
        step('Hold the {object.name} with two hands.'),
        step('Throw it to {caregiver}.'),
        step('Try to catch it when it comes back.'),
      ]),
      template('bounce-ball', 'toy', [
        step('Pick up the {object.name}.'),
        step('Bounce it on the floor once.'),
      ]),
    ],
  },
  shoe: {
    category: 'clothing',
    templates: [
      template('find-shoe', 'clothing', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('put-on-shoe', 'clothing', [
        step('Pick up the {object.name}.'),
        step('Sit down.'),
        step('Put it on your foot.'),
      ]),
      template('put-away-shoe', 'clothing', [
        step('Pick up the {object.name}.'),
        step('Carry it to the door.'),
        step('Line it up next to the other shoes.'),
      ]),
      template('match-shoe-pair', 'clothing', [
        step('Find the other {object.name}.'),
        step('Put the two shoes side by side.'),
      ]),
    ],
  },
  spoon: {
    category: 'utensil',
    templates: [
      template('find-spoon', 'utensil', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('carry-spoon-to-table', 'utensil', [
        step('Pick up the {object.name}.'),
        step('Walk to the table.'),
        step('Set it down next to the plate.'),
      ]),
      template('put-away-spoon', 'utensil', [
        step('Pick up the {object.name}.'),
        step('Carry it to the drawer.'),
        step('Put it inside.'),
      ]),
      template('tap-spoon-rhythm', 'utensil', [
        step('Hold the {object.name}.'),
        step('Tap it gently on the table, like {companion}!'),
      ]),
    ],
  },
  door: {
    category: 'fixture',
    templates: [
      template('find-door', 'fixture', [step('Walk to the {object.name}.'), step('Touch it.')]),
      template('open-close-door', 'fixture', [
        step('Walk to the {object.name}.'),
        step('Push it open.'),
        step('Close it gently.'),
      ]),
      template('knock-on-door', 'fixture', [
        step('Walk to the {object.name}.'),
        step('Knock on it two times.'),
        step('Wait for {caregiver} to answer.'),
      ]),
      template('point-to-door', 'fixture', [step('Point to the {object.name}.')]),
    ],
  },
  chair: {
    category: 'furniture',
    templates: [
      template('find-chair', 'furniture', [step('Find the {object.name}.'), step('Stand next to it.')]),
      template('sit-in-chair', 'furniture', [
        step('Walk to the {object.name}.'),
        step('Turn around.'),
        step('Sit down.'),
      ]),
      template('push-in-chair', 'furniture', [
        step('Stand behind the {object.name}.'),
        step('Push it in to the table.'),
      ]),
      template('climb-up-chair', 'furniture', [
        step('Walk to the {object.name}.'),
        step('Climb up with {caregiver}’s help.'),
        step('Sit down.'),
      ]),
    ],
  },
  book: {
    category: 'book',
    templates: [
      template('find-book', 'book', [step('Find your {object.name}.'), step('Bring it to {caregiver}.')]),
      template('carry-book-to-caregiver', 'book', [
        step('Pick up the {object.name}.'),
        step('Carry it to {caregiver}.'),
        step('Sit down together.'),
      ]),
      template('turn-pages', 'book', [
        step('Open the {object.name}.'),
        step('Turn one page.'),
        step('Point to a picture.'),
      ]),
      template('put-away-book', 'book', [
        step('Pick up the {object.name}.'),
        step('Carry it to the shelf.'),
        step('Slide it in next to the others.'),
      ]),
    ],
  },
  'toy animal': {
    category: 'toy',
    templates: [
      template('find-toy-animal', 'toy', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('pretend-feed-toy-animal', 'toy', [
        step('Hold the {object.name}.'),
        step('Pretend to give it some {fav_food}.'),
        step('Say goodnight to it.'),
      ]),
      template('hide-and-seek-toy-animal', 'toy', [
        step('Hide the {object.name} somewhere close by.'),
        step('Help {caregiver} find it.'),
      ]),
      template('move-like-toy-animal', 'toy', [
        step('Hold the {object.name}.'),
        step('Make it {movement} across the floor.'),
      ]),
    ],
  },
  plate: {
    category: 'tableware',
    templates: [
      template('find-plate', 'tableware', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('carry-plate-to-table', 'tableware', [
        step('Pick up the {object.name} with two hands.'),
        step('Walk slowly to the table.'),
        step('Set it down.'),
      ]),
      template('stack-plates', 'tableware', [
        step('Find another {object.name}.'),
        step('Stack it on top, carefully.'),
      ]),
      template('put-away-plate', 'tableware', [
        step('Pick up the {object.name}.'),
        step('Carry it to the shelf.'),
        step('Put it down flat.'),
      ]),
    ],
  },
  towel: {
    category: 'textile',
    templates: [
      template('find-towel', 'textile', [step('Find your {object.name}.'), step('Bring it to {caregiver}.')]),
      template('fold-towel', 'textile', [
        step('Pick up the {object.name}.'),
        step('Fold it in half.'),
        step('Put it on the shelf.'),
      ]),
      template('dry-hands-towel', 'textile', [
        step('Pick up the {object.name}.'),
        step('Wipe your hands with it.'),
      ]),
      template('hang-towel', 'textile', [
        step('Pick up the {object.name}.'),
        step('Hang it on the hook.'),
      ]),
    ],
  },
  brush: {
    category: 'grooming',
    templates: [
      template('find-brush', 'grooming', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('brush-hair', 'grooming', [
        step('Pick up the {object.name}.'),
        step('Brush your hair.'),
        step('Give it to {caregiver}.'),
      ]),
      template('put-away-brush', 'grooming', [
        step('Pick up the {object.name}.'),
        step('Carry it to the drawer.'),
        step('Put it inside.'),
      ]),
      template('brush-toy-hair', 'grooming', [
        step('Pick up the {object.name}.'),
        step('Brush {companion}’s hair with it.'),
      ]),
    ],
  },
  box: {
    category: 'container',
    templates: [
      template('find-box', 'container', [step('Find the {object.name}.'), step('Bring it to {caregiver}.')]),
      template('put-things-in-box', 'container', [
        step('Pick up the {object.name}.'),
        step('Put a toy inside.'),
        step('Close the lid.'),
      ]),
      template('carry-box', 'container', [
        step('Pick up the {object.name} with two hands.'),
        step('Carry it to {caregiver}.'),
      ]),
      template('hide-in-box', 'container', [
        step('Open the {object.name}.'),
        step('Hide something small {companion_they} likes inside.'),
        step('Close it and find it again.'),
      ]),
    ],
  },
  blanket: {
    category: 'textile',
    templates: [
      template('find-blanket', 'textile', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('fold-blanket', 'textile', [
        step('Pick up the {object.name}.'),
        step('Fold it in half.'),
        step('Put it on the bed.'),
      ]),
      template('wrap-up-blanket', 'textile', [
        step('Pick up the {object.name}.'),
        step('Wrap it around {companion}.'),
        step('Tuck it in.'),
      ]),
      template('carry-blanket-to-bed', 'textile', [
        step('Pick up the {object.name}.'),
        step('Carry it to your bed.'),
      ]),
    ],
  },
  bottle: {
    category: 'drinkware',
    templates: [
      template('find-bottle', 'drinkware', [
        step('Find your {object.name}.'),
        step('Bring it to {caregiver}.'),
      ]),
      template('carry-bottle', 'drinkware', [
        step('Pick up the {object.name}.'),
        step('Carry it to {caregiver}.'),
      ]),
      template('open-close-bottle-cap', 'drinkware', [
        step('Pick up the {object.name}.'),
        step('Twist the cap open.'),
        step('Twist it closed again.'),
      ]),
      template('put-away-bottle', 'drinkware', [
        step('Pick up the {object.name}.'),
        step('Carry it to the shelf.'),
        step('Put it down.'),
      ]),
    ],
  },
  sock: {
    category: 'clothing',
    templates: [
      template('find-sock', 'clothing', [step('Find your {object.name}.'), step('Bring it to {caregiver}.')]),
      template('put-on-sock', 'clothing', [
        step('Pick up the {object.name}.'),
        step('Sit down.'),
        step('Put it on your foot.'),
      ]),
      template('match-sock-pair', 'clothing', [
        step('Find the other {object.name}.'),
        step('Put the two socks together.'),
      ]),
      template('put-away-sock', 'clothing', [
        step('Pick up the {object.name}.'),
        step('Carry it to the basket.'),
        step('Drop it in.'),
      ]),
    ],
  },
};

// ---------------------------------------------------------------------------
// Category fallback (§7.5 "unrecognised object -> generic template for its
// category, never an error"). Used when the exact object name isn't in
// OBJECT_TABLE but the vision port's category tag matches one we know.
// ---------------------------------------------------------------------------

const CATEGORY_FALLBACK: Record<string, SkillTemplate[]> = {
  drinkware: [
    template('find-generic-drinkware', 'drinkware', [
      step('Find the {object.name}.'),
      step('Bring it to {caregiver}.'),
    ]),
    template('carry-generic-drinkware', 'drinkware', [
      step('Pick up the {object.name} with two hands.'),
      step('Carry it to the table.'),
    ]),
    template('put-away-generic-drinkware', 'drinkware', [
      step('Pick up the {object.name}.'),
      step('Put it on the shelf.'),
    ]),
  ],
  toy: [
    template('find-generic-toy', 'toy', [step('Find the {object.name}.'), step('Bring it to {caregiver}.')]),
    template('carry-generic-toy', 'toy', [
      step('Pick up the {object.name}.'),
      step('Carry it to {companion}.'),
    ]),
    template('put-away-generic-toy', 'toy', [
      step('Pick up the {object.name}.'),
      step('Put it in the toy box.'),
    ]),
  ],
  clothing: [
    template('find-generic-clothing', 'clothing', [
      step('Find the {object.name}.'),
      step('Bring it to {caregiver}.'),
    ]),
    template('carry-generic-clothing', 'clothing', [
      step('Pick up the {object.name}.'),
      step('Carry it to {caregiver}.'),
    ]),
    template('put-away-generic-clothing', 'clothing', [
      step('Pick up the {object.name}.'),
      step('Put it in the basket.'),
    ]),
  ],
  utensil: [
    template('find-generic-utensil', 'utensil', [
      step('Find the {object.name}.'),
      step('Bring it to {caregiver}.'),
    ]),
    template('carry-generic-utensil', 'utensil', [
      step('Pick up the {object.name}.'),
      step('Carry it to the table.'),
    ]),
    template('put-away-generic-utensil', 'utensil', [
      step('Pick up the {object.name}.'),
      step('Put it in the drawer.'),
    ]),
  ],
  furniture: [
    template('find-generic-furniture', 'furniture', [
      step('Find the {object.name}.'),
      step('Stand next to it.'),
    ]),
    template('touch-generic-furniture', 'furniture', [
      step('Walk to the {object.name}.'),
      step('Touch it with one hand.'),
    ]),
    template('point-generic-furniture', 'furniture', [step('Point to the {object.name}.')]),
  ],
  fixture: [
    template('find-generic-fixture', 'fixture', [step('Walk to the {object.name}.'), step('Touch it.')]),
    template('point-generic-fixture', 'fixture', [step('Point to the {object.name}.')]),
  ],
  book: [
    template('find-generic-book', 'book', [step('Find the {object.name}.'), step('Bring it to {caregiver}.')]),
    template('carry-generic-book', 'book', [
      step('Pick up the {object.name}.'),
      step('Carry it to {caregiver}.'),
    ]),
    template('put-away-generic-book', 'book', [
      step('Pick up the {object.name}.'),
      step('Put it on the shelf.'),
    ]),
  ],
  tableware: [
    template('find-generic-tableware', 'tableware', [
      step('Find the {object.name}.'),
      step('Bring it to {caregiver}.'),
    ]),
    template('carry-generic-tableware', 'tableware', [
      step('Pick up the {object.name}.'),
      step('Carry it to the table.'),
    ]),
    template('put-away-generic-tableware', 'tableware', [
      step('Pick up the {object.name}.'),
      step('Put it on the shelf.'),
    ]),
  ],
  textile: [
    template('find-generic-textile', 'textile', [
      step('Find the {object.name}.'),
      step('Bring it to {caregiver}.'),
    ]),
    template('fold-generic-textile', 'textile', [
      step('Pick up the {object.name}.'),
      step('Fold it in half.'),
    ]),
    template('put-away-generic-textile', 'textile', [
      step('Pick up the {object.name}.'),
      step('Put it on the shelf.'),
    ]),
  ],
  grooming: [
    template('find-generic-grooming', 'grooming', [
      step('Find the {object.name}.'),
      step('Bring it to {caregiver}.'),
    ]),
    template('carry-generic-grooming', 'grooming', [
      step('Pick up the {object.name}.'),
      step('Carry it to {caregiver}.'),
    ]),
    template('put-away-generic-grooming', 'grooming', [
      step('Pick up the {object.name}.'),
      step('Put it away.'),
    ]),
  ],
  container: [
    template('find-generic-container', 'container', [
      step('Find the {object.name}.'),
      step('Bring it to {caregiver}.'),
    ]),
    template('carry-generic-container', 'container', [
      step('Pick up the {object.name}.'),
      step('Carry it to {caregiver}.'),
    ]),
    template('put-things-in-generic-container', 'container', [
      step('Open the {object.name}.'),
      step('Put something inside.'),
    ]),
  ],
};

// ---------------------------------------------------------------------------
// The ultimate fallback: object name unknown AND category unknown/unhandled.
// Still real, ordered, slot-templated steps -- never an error, never a
// crash, never an empty array (§7.5 Done when: "never an error").
// ---------------------------------------------------------------------------

const GENERIC_FALLBACK: SkillTemplate[] = [
  template('find-generic-object', 'generic', [
    step('Find the {object.name}.'),
    step('Bring it to {caregiver}.'),
  ]),
  template('carry-generic-object', 'generic', [
    step('Pick up the {object.name}.'),
    step('Carry it to {caregiver}.'),
  ]),
  template('put-away-generic-object', 'generic', [
    step('Pick up the {object.name}.'),
    step('Put it back where it belongs.'),
  ]),
];

/**
 * The one function callers should use. Resolves an object name + category
 * to 3-4 real skill templates, degrading gracefully at every step:
 *   exact name -> known category -> fully generic. Never throws, never
 * returns an empty array.
 */
export function getSkillTemplatesForObject(objectName: string, category: string): SkillTemplate[] {
  const nameKey = objectName.trim().toLowerCase();
  const exact = OBJECT_TABLE[nameKey];
  if (exact) return exact.templates;

  const categoryKey = category.trim().toLowerCase();
  const byCategory = CATEGORY_FALLBACK[categoryKey];
  if (byCategory) return byCategory;

  return GENERIC_FALLBACK;
}

/** Convenience wrapper for callers that already have a TaggedCrop (F.006/F.008). */
export function getSkillTemplatesForCrop(crop: TaggedCrop): SkillTemplate[] {
  return getSkillTemplatesForObject(crop.name, crop.category);
}

/** The 15 objects named explicitly in §7.5 -- exported so the smoke test
 * (and any future content audit) can assert every one of them is covered,
 * without hand-copying the list a second time. */
export const REQUIRED_OBJECTS: readonly string[] = [
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
];
