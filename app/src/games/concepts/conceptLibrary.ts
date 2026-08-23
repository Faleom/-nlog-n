// The concept library — the data half. Pure logic, no React, no JSX, so
// the trial-building rules are testable in Node (scripts/smoke-concepts.ts),
// exactly like objectIconLogic.ts. The drawings live in conceptArt.tsx.
//
// WHAT THIS IS FOR, AND WHY IT IS NOT THE GAME 1 ICON SET
// ------------------------------------------------------
// games/objectIcons.tsx draws ONE picture per object: one cup, one ball,
// one apple. That is right for Game 1, where the icon just has to say
// "this tile is the cup" at 34px on a room map.
//
// It is the wrong shape for teaching generalization. A child who learns
// "apple" from a single picture can end up welding the concept to that
// picture — a well-documented pattern in this population (stimulus
// over-selectivity), and one of the reasons a skill learned in a session
// fails to show up in the kitchen. F.024 ("generalization re-testing") was
// specced for exactly this worry and never built.
//
// So a concept here is a SET of genuinely different instances: a deep red
// round apple, a small green one, a squat golden one. No single drawing
// teaches the concept; the spread does. Nothing here is a transform of
// anything else — a mirrored apple is still the same apple, and teaches
// nothing new.
//
// THE HARD PART: NEAR MISSES
// --------------------------
// `nearMisses` is what lets a trial be hard on purpose. A red ball is
// rounder, redder and glossier than a green apple — closer to a red apple
// on every surface feature. A child matching on APPEARANCE picks the ball.
// A child who has actually got "apple" picks the green one. That single
// contrast is the difference between testing colour-matching and testing
// categorisation, and buildTrial below is built to produce it deliberately
// rather than by luck.
//
// This is why the library grows in CLUSTERS, not alphabetically. A concept
// with no confusable neighbour can only ever pose easy questions, so
// fruit arrived with fruit, and animals with the teddy bear that looks
// like one.

export type ConceptKey =
  | 'apple' | 'orange' | 'tomato' | 'banana' | 'strawberry' | 'carrot'
  | 'dog' | 'cat' | 'bird' | 'teddy'
  | 'ball' | 'car';

/** Coarse buckets, not exact colours — the trial builder compares variants
 * on how DIFFERENT they look, and "#B8232B vs #C63A2E" is a distinction no
 * preschooler is being asked to make. */
export type Hue = 'red' | 'green' | 'yellow' | 'orange' | 'brown' | 'blue' | 'grey' | 'black' | 'white' | 'mixed';
export type Size = 'small' | 'medium' | 'large';
export type Shape = 'round' | 'tall' | 'wide' | 'long';

export interface Variant {
  /** Also the key into conceptArt.tsx's drawing map. */
  id: string;
  concept: ConceptKey;
  hue: Hue;
  size: Size;
  shape: Shape;
  /** Plain word for the caregiver-facing label ("dark red apple"). Never
   * shown to the child — their two phases stay zero-text (§7.7, §13). */
  colourWord: string;
}

export interface Concept {
  key: ConceptKey;
  /** The word a young child would use. Fills the {object.name} slot. */
  name: string;
  /** Matches the vision prompt's own category vocabulary, so a concept and
   * a recognised room object can be sorted by the same rule later — which
   * is what the classification/sorting game will need. */
  category: string;
  variants: Variant[];
  /** Concepts that LOOK like this one but are not it. Ordered most- to
   * least-confusable. */
  nearMisses: ConceptKey[];
}

/** Terser than writing the object literal 36 times. */
function v(
  concept: ConceptKey, slug: string, hue: Hue, size: Size, shape: Shape, colourWord: string,
): Variant {
  return { id: `${concept}-${slug}`, concept, hue, size, shape, colourWord };
}

// ---------------------------------------------------------------------------
// FRUIT — the richest natural variation, and the tightest near-miss cluster
// in the library: apples, oranges, tomatoes and strawberries are all round,
// mostly red-ish, and mostly food.
// ---------------------------------------------------------------------------

const APPLE: Concept = {
  key: 'apple', name: 'apple', category: 'food',
  nearMisses: ['tomato', 'orange', 'ball'],
  // Four, not five. A two-tone "blushed" variant was cut: a colour GRADATION
  // is not a kind of apple, it is a shading effect, and a set teaching what
  // apples can look like should vary the things that actually distinguish
  // one apple from another — colour, size, silhouette — not the rendering.
  variants: [
    v('apple', 'deep-red', 'red', 'large', 'round', 'dark red'),
    v('apple', 'light-red', 'red', 'medium', 'tall', 'light red'),
    v('apple', 'green', 'green', 'small', 'round', 'green'),
    v('apple', 'golden', 'yellow', 'medium', 'wide', 'yellow'),
  ],
};

const ORANGE: Concept = {
  key: 'orange', name: 'orange', category: 'food',
  nearMisses: ['ball', 'apple', 'tomato'],
  // Named by REAL KIND rather than by shade. An earlier "pale orange" was
  // just the same drawing lightened, which read as a washed-out copy instead
  // of a different fruit. A navel orange, a mandarin and a clementine are
  // genuinely different things a child meets, and differ in size and
  // squatness as well as colour.
  variants: [
    v('orange', 'navel', 'orange', 'large', 'round', 'orange'),
    v('orange', 'mandarin', 'orange', 'small', 'wide', 'deep orange'),
    v('orange', 'clementine', 'yellow', 'medium', 'round', 'light orange'),
  ],
};

const TOMATO: Concept = {
  key: 'tomato', name: 'tomato', category: 'food',
  nearMisses: ['apple', 'strawberry', 'orange'],
  variants: [
    v('tomato', 'red', 'red', 'large', 'wide', 'red'),
    v('tomato', 'small', 'red', 'small', 'round', 'deep red'),
  ],
};

const STRAWBERRY: Concept = {
  key: 'strawberry', name: 'strawberry', category: 'food',
  nearMisses: ['tomato', 'apple'],
  variants: [
    v('strawberry', 'large', 'red', 'large', 'tall', 'red'),
    v('strawberry', 'small', 'red', 'small', 'tall', 'deep red'),
    v('strawberry', 'round', 'red', 'medium', 'round', 'pink'),
  ],
};

const BANANA: Concept = {
  key: 'banana', name: 'banana', category: 'food',
  // Carrot leads deliberately. With only round fruit as neighbours, the
  // smoke suite caught banana posing a FAKE hard trial: no distractor was
  // long, so the correct answer was the closest-looking option on screen
  // and a child could pass every banana trial by picking the long thing.
  // A carrot is the honest confusable — long, tapered, food, yellow-orange.
  nearMisses: ['carrot', 'orange', 'apple'],
  variants: [
    v('banana', 'ripe', 'yellow', 'large', 'long', 'yellow'),
    v('banana', 'green', 'green', 'medium', 'long', 'green'),
    v('banana', 'spotty', 'brown', 'small', 'long', 'spotty yellow'),
  ],
};

const CARROT: Concept = {
  key: 'carrot', name: 'carrot', category: 'food',
  nearMisses: ['banana', 'orange'],
  variants: [
    v('carrot', 'large', 'orange', 'large', 'long', 'orange'),
    v('carrot', 'small', 'orange', 'small', 'long', 'orange'),
    v('carrot', 'pale', 'yellow', 'medium', 'long', 'pale orange'),
  ],
};

// ---------------------------------------------------------------------------
// ANIMALS — "dog" is the textbook generalization case: a dachshund and a
// fluffy white lapdog share almost no surface features, which is exactly
// why a child can learn one and not recognise the other. The teddy bear
// sits in this cluster on purpose — it is the sharpest near miss in the
// library, because it looks like an animal and isn't one.
// ---------------------------------------------------------------------------

const DOG: Concept = {
  key: 'dog', name: 'dog', category: 'animal',
  nearMisses: ['cat', 'teddy'],
  variants: [
    v('dog', 'brown', 'brown', 'large', 'tall', 'brown'),
    v('dog', 'white-fluffy', 'white', 'small', 'round', 'white'),
    v('dog', 'spotted', 'mixed', 'medium', 'wide', 'black and white'),
    v('dog', 'long-tan', 'yellow', 'medium', 'long', 'tan'),
  ],
};

const CAT: Concept = {
  key: 'cat', name: 'cat', category: 'animal',
  nearMisses: ['dog', 'teddy'],
  variants: [
    v('cat', 'ginger', 'orange', 'medium', 'tall', 'ginger'),
    v('cat', 'black', 'black', 'large', 'tall', 'black'),
    v('cat', 'grey', 'grey', 'small', 'round', 'grey'),
  ],
};

const BIRD: Concept = {
  key: 'bird', name: 'bird', category: 'animal',
  nearMisses: ['cat', 'dog'],
  variants: [
    v('bird', 'blue', 'blue', 'small', 'round', 'blue'),
    v('bird', 'red', 'red', 'medium', 'round', 'red'),
    v('bird', 'yellow', 'yellow', 'small', 'long', 'yellow'),
  ],
};

const TEDDY: Concept = {
  key: 'teddy', name: 'teddy', category: 'toy',
  nearMisses: ['dog', 'cat'],
  variants: [
    v('teddy', 'brown', 'brown', 'large', 'round', 'brown'),
    v('teddy', 'cream', 'white', 'medium', 'tall', 'cream'),
    v('teddy', 'grey', 'grey', 'small', 'round', 'grey'),
  ],
};

// ---------------------------------------------------------------------------
// TOYS
// ---------------------------------------------------------------------------

const BALL: Concept = {
  key: 'ball', name: 'ball', category: 'toy',
  nearMisses: ['orange', 'apple', 'tomato'],
  // Real KINDS of ball, not one ball in four colours. "A red one, a blue
  // one, a green one" teaches that balls come in colours — which a child
  // already knows, and which is the very habit these trials try to loosen.
  // A basketball, a football and a tennis ball differ in markings, size and
  // surface, so the child has to hold on to round-and-for-throwing rather
  // than to any one look.
  variants: [
    v('ball', 'basketball', 'orange', 'large', 'round', 'orange'),
    v('ball', 'soccer', 'white', 'large', 'round', 'white and black'),
    v('ball', 'volleyball', 'white', 'medium', 'round', 'white and blue'),
    v('ball', 'tennis', 'yellow', 'small', 'round', 'yellow'),
    v('ball', 'beach', 'mixed', 'large', 'round', 'many colours'),
  ],
};

const CAR: Concept = {
  key: 'car', name: 'car', category: 'toy',
  nearMisses: ['ball', 'teddy'],
  variants: [
    v('car', 'red', 'red', 'medium', 'wide', 'red'),
    v('car', 'blue-truck', 'blue', 'large', 'wide', 'blue'),
    v('car', 'yellow-small', 'yellow', 'small', 'round', 'yellow'),
  ],
};

export const CONCEPTS: Record<ConceptKey, Concept> = {
  apple: APPLE, orange: ORANGE, tomato: TOMATO, strawberry: STRAWBERRY,
  banana: BANANA, carrot: CARROT,
  dog: DOG, cat: CAT, bird: BIRD, teddy: TEDDY,
  ball: BALL, car: CAR,
};

/** Every variant in the library, flat. Also the canonical list of drawings
 * conceptArt.tsx must provide — it types its map against this, so a variant
 * with no artwork is a compile error rather than a blank tile. */
export const ALL_VARIANTS: Variant[] = Object.values(CONCEPTS).flatMap((c) => c.variants);

export type VariantId = string;

// ---------------------------------------------------------------------------
// Trial building
// ---------------------------------------------------------------------------

/**
 * How different two variants LOOK, ignoring what they are. Hue is weighted
 * heaviest because colour is the feature a young child matches on first —
 * which is precisely the habit these trials are built to stretch.
 */
export function surfaceDistance(a: Variant, b: Variant): number {
  let d = 0;
  if (a.hue !== b.hue) d += 3;
  if (a.shape !== b.shape) d += 2;
  if (a.size !== b.size) d += 1;
  return d;
}

export interface GeneralizationTrial {
  /** What the child is shown at the top. */
  sample: Variant;
  /** Same concept as the sample, chosen to look as UNLIKE it as the library
   * allows — a different apple, not the same one again. */
  correct: Variant;
  /** Different concepts, chosen to look as LIKE the sample as possible. */
  distractors: Variant[];
}

/**
 * Builds one generalization trial for `conceptKey`.
 *
 * Deliberately deterministic given the same inputs — no randomness. A child
 * who benefits from sameness (§5.2's `sameness` dimension) gets the same
 * layout for the same sample every time, and the tests can assert real
 * properties instead of sampling a distribution. Variety comes from the
 * caller rotating `sampleIndex`, not from shuffling in here.
 *
 * The two selections pull in opposite directions on purpose:
 *   correct    = MAXIMISE surface distance from the sample (same concept)
 *   distractor = MINIMISE surface distance from the sample (other concepts)
 *
 * When both succeed, the wrong answer resembles the sample more closely
 * than the right answer does, and only a child working from the CONCEPT can
 * pass. See this module's header.
 */
export function buildTrial(
  conceptKey: ConceptKey,
  options: { sampleIndex?: number; distractorCount?: number } = {},
): GeneralizationTrial | null {
  const concept = CONCEPTS[conceptKey];
  if (!concept || concept.variants.length < 2) return null;

  const sample = concept.variants[(options.sampleIndex ?? 0) % concept.variants.length];

  const correct = concept.variants
    .filter((x) => x.id !== sample.id)
    // Ties broken by id so the choice is stable, not array-order-dependent.
    .sort((a, b) => surfaceDistance(sample, b) - surfaceDistance(sample, a) || a.id.localeCompare(b.id))[0];

  // At most ONE variant per near-miss concept: the closest it can offer.
  // Without this, apple's two tomatoes both scored well and the board came
  // back "apple / tomato / tomato" — a redundant wrong answer that teaches
  // less than a second, different non-apple would, and that makes the board
  // look like it is about tomatoes.
  const distractors = pickDistractors(concept, sample, options.distractorCount ?? 2);

  return { sample, correct, distractors };
}

/** Shared by both builders: at most ONE variant per near-miss concept, the
 * closest each can offer, nearest first. */
function pickDistractors(concept: Concept, sample: Variant, count: number): Variant[] {
  return concept.nearMisses
    .map((key) =>
      (CONCEPTS[key]?.variants ?? [])
        .slice()
        .sort((a, b) => surfaceDistance(sample, a) - surfaceDistance(sample, b) || a.id.localeCompare(b.id))[0],
    )
    .filter((x): x is Variant => Boolean(x))
    .sort((a, b) => surfaceDistance(sample, a) - surfaceDistance(sample, b) || a.id.localeCompare(b.id))
    .slice(0, count);
}

/**
 * A SILHOUETTE round — the opposite rule to buildTrial above.
 *
 * Here the sample is shown as a black outline, so the answer must be THE
 * SAME variant: a silhouette is one particular drawing's own shape, and a
 * tall light-red apple's outline simply is not a small green apple's. Ask a
 * child to match a shape to a thing that has a different shape and the task
 * is unwinnable — and worse, unwinnable in a way that looks like the child
 * failing rather than the board being wrong.
 *
 * So a silhouette round puts exactly ONE member of the concept on screen
 * (the answer), and fills the rest with other objects. That also means no
 * two variants of the same thing ever share a board here, which would be
 * ambiguous anyway: two apples, one silhouette, only one "right" outline.
 *
 * Needs only ONE variant to work, unlike buildTrial — there is no "other
 * apple" required — so thin concepts like tomato are playable at this level.
 */
export function buildShapeTrial(
  conceptKey: ConceptKey,
  options: { sampleIndex?: number; distractorCount?: number } = {},
): GeneralizationTrial | null {
  const concept = CONCEPTS[conceptKey];
  if (!concept || concept.variants.length === 0) return null;

  const sample = concept.variants[(options.sampleIndex ?? 0) % concept.variants.length];
  return {
    sample,
    // The answer IS the sample. That is the whole point of a shape match.
    correct: sample,
    distractors: pickDistractors(concept, sample, options.distractorCount ?? 2),
  };
}

/** The options grid for a trial, correct answer included exactly once.
 * Order is fixed (correct first) — callers that want it shuffled do that
 * themselves, the same way Game 1 keeps `shuffleGrid` an explicit opt-in so
 * sameness-profile children can keep a stable layout. */
export function trialOptions(trial: GeneralizationTrial): Variant[] {
  return [trial.correct, ...trial.distractors];
}
