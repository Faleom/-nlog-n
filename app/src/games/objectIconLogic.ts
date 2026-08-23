// Which artwork represents which recognised object. Pure logic only — no
// React, no JSX — so the whole resolution ladder is testable in Node with
// no browser, exactly like game1Companion.ts. The drawings themselves live
// in objectIcons.tsx; this file only decides WHICH one to use.
//
// The split also buys a compile-time guarantee: ICON_KEYS below is the
// canonical set, and objectIcons.tsx types its artwork map as
// Record<IconKey, ReactElement> — so a key listed here with no drawing is a
// tsc error, not a silent fallback to the generic star at runtime.

/** Every piece of artwork that exists. Adding a key here without adding the
 * matching drawing in objectIcons.tsx will fail the build. */
export const ICON_KEYS = [
  'ball', 'teddy', 'doll', 'book', 'cup', 'bottle', 'plate', 'bowl', 'spoon',
  'apple', 'banana', 'blocks', 'car', 'train', 'duck', 'balloon', 'drum',
  'shoe', 'sock', 'hat', 'shirt', 'bag', 'pillow', 'cushion', 'blanket',
  'towel', 'toothbrush', 'brush', 'box', 'basket', 'bucket', 'clock',
  'umbrella', 'crayon', 'pencil',
  // Added after a real kids'-room photo came back with five identical balls
  // and two blank stars — see CATEGORY_ICONS below for the `toy` fix.
  'toy', 'tent', 'rug', 'hoop', 'puzzle',
  'generic',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

/**
 * The many words a vision model might return, mapped onto the artwork we
 * have. Typed to IconKey so a target that doesn't exist is a compile error
 * — this table is the one place where a silent miss would look exactly like
 * working software (the object would just quietly render as a star).
 */
export const SYNONYMS: Record<string, IconKey> = {
  // toys
  ball: 'ball', football: 'ball', soccerball: 'ball', basketball: 'ball',
  beachball: 'ball', tennisball: 'ball',
  teddy: 'teddy', teddybear: 'teddy', bear: 'teddy', stuffedanimal: 'teddy',
  stuffedtoy: 'teddy', softtoy: 'teddy', plush: 'teddy', plushie: 'teddy',
  cuddlytoy: 'teddy', stuffedbear: 'teddy',
  doll: 'doll', figure: 'doll', actionfigure: 'doll', dolly: 'doll',
  blocks: 'blocks', block: 'blocks', buildingblocks: 'blocks', lego: 'blocks',
  bricks: 'blocks', brick: 'blocks',
  car: 'car', toycar: 'car', truck: 'car', vehicle: 'car', racecar: 'car',
  train: 'train', toytrain: 'train',
  duck: 'duck', rubberduck: 'duck', duckie: 'duck',
  balloon: 'balloon',
  drum: 'drum',
  // books
  book: 'book', storybook: 'book', picturebook: 'book', notebook: 'book',
  // drink & food
  cup: 'cup', mug: 'cup', glass: 'cup', tumbler: 'cup', teacup: 'cup',
  bottle: 'bottle', waterbottle: 'bottle', sippycup: 'bottle',
  babybottle: 'bottle', flask: 'bottle',
  plate: 'plate', dish: 'plate', saucer: 'plate',
  bowl: 'bowl',
  spoon: 'spoon', fork: 'spoon', cutlery: 'spoon', utensil: 'spoon',
  apple: 'apple', orange: 'apple', fruit: 'apple',
  banana: 'banana',
  // clothing
  shoe: 'shoe', shoes: 'shoe', trainer: 'shoe', trainers: 'shoe',
  sneaker: 'shoe', sneakers: 'shoe', boot: 'shoe', sandal: 'shoe',
  slipper: 'shoe',
  sock: 'sock', socks: 'sock',
  hat: 'hat', cap: 'hat', beanie: 'hat',
  // No `top: 'shirt'` — "top" is a garment AND a spinning top, and it lost
  // that fight badly: "spinning top" resolved on its last word and came out
  // as a t-shirt. A model asked for "a short, concrete noun" says "shirt" or
  // "t-shirt" for the garment anyway, and category `clothing` catches the
  // rest, so the synonym earned nothing and cost a real miss.
  shirt: 'shirt', tshirt: 'shirt', jumper: 'shirt',
  sweater: 'shirt', jacket: 'shirt', clothes: 'shirt', clothing: 'shirt',
  // soft furnishings
  pillow: 'pillow',
  cushion: 'cushion',
  blanket: 'blanket', duvet: 'blanket', quilt: 'blanket', throw: 'blanket',
  towel: 'towel',
  // containers
  bag: 'bag', backpack: 'bag', rucksack: 'bag', satchel: 'bag',
  handbag: 'bag',
  box: 'box', crate: 'box', carton: 'box',
  basket: 'basket', bin: 'basket', hamper: 'basket',
  bucket: 'bucket', pail: 'bucket',
  // grooming
  toothbrush: 'toothbrush',
  brush: 'brush', hairbrush: 'brush', comb: 'brush',
  // other
  clock: 'clock',
  umbrella: 'umbrella',
  crayon: 'crayon', marker: 'crayon', chalk: 'crayon',
  pencil: 'pencil', pen: 'pencil',
  // Added from a real kids'-bedroom photo, where these were the things that
  // came back as blank stars or got swept into the `toy` -> ball fallback.
  toy: 'toy', plaything: 'toy', stackingrings: 'toy', stacker: 'toy',
  rattle: 'toy', xylophone: 'toy', shapesorter: 'toy',
  tent: 'tent', playtent: 'tent', teepee: 'tent', tipi: 'tent',
  playhouse: 'tent', canopy: 'tent', wigwam: 'tent',
  rug: 'rug', mat: 'rug', playmat: 'rug', carpet: 'rug',
  hoop: 'hoop', hulahoop: 'hoop', ring: 'hoop',
  puzzle: 'puzzle', jigsaw: 'puzzle',
  beanbag: 'cushion', pouffe: 'cushion',
  storagebin: 'basket', laundrybasket: 'basket', laundryhamper: 'basket',
  toybox: 'box', storagebox: 'box',
  tub: 'bucket',
};

/** Category → artwork, used when the object's own NAME didn't resolve. These
 * are the categories the vision prompt asks for plus the ones
 * engine/skillLookup.ts's OBJECT_TABLE already uses, so there is no second
 * vocabulary to keep in sync. */
export const CATEGORY_ICONS: Record<string, IconKey> = {
  // NOT 'ball'. Most things in a child's room are category "toy", so mapping
  // the category to a ball turned a real bedroom photo into five identical
  // ball markers — and in a game whose whole instruction is "go and fetch
  // the ball", drawing a ball for something that is not a ball is worse
  // than drawing nothing. 'toy' is a deliberately generic plaything.
  toy: 'toy',
  drinkware: 'cup',
  tableware: 'plate',
  utensil: 'spoon',
  clothing: 'shirt',
  footwear: 'shoe',
  book: 'book',
  textile: 'blanket',
  bedding: 'pillow',
  grooming: 'toothbrush',
  container: 'box',
  food: 'apple',
  stationery: 'crayon',
  furnishing: 'cushion',
  storage: 'basket',
  game: 'puzzle',
};

/** Lowercases and drops everything that makes two spellings of one word look
 * different to a lookup table (case, spaces, hyphens, punctuation). */
function squash(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * The forms of one word worth trying, most literal first. The un-stripped
 * form is tried BEFORE any de-pluralised one on purpose: naive 's'-stripping
 * mangles words that merely end in s ("glass" -> "glas"), so the table gets
 * first refusal on the word as written.
 */
function candidates(raw: string): string[] {
  const s = squash(raw);
  if (!s) return [];
  const out = [s];
  if (s.endsWith('es') && s.length > 4) out.push(s.slice(0, -2));
  if (s.endsWith('s') && s.length > 3) out.push(s.slice(0, -1));
  return out;
}

/** Tries every candidate form of one word against both tables. */
function lookupWord(word: string): IconKey | null {
  for (const form of candidates(word)) {
    if (SYNONYMS[form]) return SYNONYMS[form];
    if ((ICON_KEYS as readonly string[]).includes(form)) return form as IconKey;
  }
  return null;
}

/**
 * Picks artwork for one recognised object. Resolution order, most to least
 * specific: the whole name → the name's LAST word (English puts the head
 * noun last, so "big red ball" and "toy car" both land) → its FIRST word →
 * its category → `generic`.
 *
 * Always returns a key that has artwork, so callers never handle a miss.
 * The name is checked before the category deliberately: a "book" the model
 * tagged as a toy should still be drawn as a book.
 */
export function iconKeyFor(name: string, category?: string): IconKey {
  const whole = lookupWord(name);
  if (whole) return whole;

  const words = name.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) {
    for (const word of [words[words.length - 1], words[0]]) {
      const hit = lookupWord(word);
      if (hit) return hit;
    }
  }

  if (category) {
    for (const form of candidates(category)) {
      if (CATEGORY_ICONS[form]) return CATEGORY_ICONS[form];
      if (SYNONYMS[form]) return SYNONYMS[form];
    }
  }
  return 'generic';
}
