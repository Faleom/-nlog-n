// Bridges the concept library into the shape Game 3 already consumes.
//
// Game 3 is built around TaggedCrop[] from a room photo. Rather than fork
// it into a second game, a concept trial is expressed AS TaggedCrops that
// carry `conceptVariantId` instead of an `image` — so every piece of engine
// wiring Game 3 already has (InteractionMachine's wrong-tap escalation, the
// support ladder, activity logging, session lifecycle) keeps working
// untouched, and only the drawing call at the leaf changes.
//
// WHY THIS MATTERS BEYOND ART: with a concept pool, Game 3 needs no photo,
// no camera, no face-blur pass and no API call. It runs offline and starts
// instantly. The room-photo path stays exactly as it was for anyone who
// wants their own objects — this adds a source, it does not replace one.

import type { TaggedCrop } from '../../types';
import {
  CONCEPTS,
  buildShapeTrial,
  buildTrial,
  trialOptions,
  type ConceptKey,
  type Variant,
} from './conceptLibrary';

/** Concepts playable in a GENERALIZATION round, in a fixed order. Needs two
 * variants (there has to be another apple to be the answer), so anything
 * thinner is filtered out here rather than failing later on screen. */
export const PLAYABLE_CONCEPTS: ConceptKey[] = (Object.keys(CONCEPTS) as ConceptKey[])
  .filter((key) => buildTrial(key) !== null);

/** Concepts playable in a SHAPE round. A wider set: matching a silhouette
 * to its own drawing needs only one variant, so thin concepts qualify here
 * even though they cannot carry a generalization round. */
export const SHAPE_CONCEPTS: ConceptKey[] = (Object.keys(CONCEPTS) as ConceptKey[])
  .filter((key) => buildShapeTrial(key) !== null);

/** A concept variant, dressed as the TaggedCrop the game expects.
 *
 * `image` is deliberately empty: there is no photo behind this, and a
 * placeholder data URL would let a rendering bug show a blank box instead
 * of failing visibly. `bbox` is a meaningless unit square — nothing in
 * Game 3 reads it (only the room-photo pipeline does), same convention as
 * game3ShadowMatchLogic.ts's companionAsCrop. */
export function variantAsCrop(variant: Variant): TaggedCrop {
  return {
    id: variant.id,
    name: CONCEPTS[variant.concept].name,
    colour: variant.colourWord,
    category: CONCEPTS[variant.concept].category,
    function: '',
    bbox: { x: 0, y: 0, width: 1, height: 1 },
    image: '',
    conceptVariantId: variant.id,
  };
}

export interface ConceptRound {
  /** What the child matches TO — shown at the top of the screen. */
  sample: TaggedCrop;
  /** The right answer: a different instance of the same concept. */
  target: TaggedCrop;
  /** Everything tappable, target included exactly once. */
  options: TaggedCrop[];
}

/**
 * One playable round.
 *
 * `roundIndex` walks both the concept list and the sample within it, so
 * consecutive rounds move through different concepts instead of drilling
 * one — staleness is an adherence problem at this age (§8.3), and a child
 * shown five apples in a row is learning "tap the apple", not "apple".
 *
 * `shapeMatch` switches which question is being asked, and the two are
 * opposites — see buildShapeTrial's header. Briefly: when the sample is a
 * silhouette the answer must be the SAME drawing (an outline belongs to one
 * specific picture), and when it is a full-colour picture the answer must be
 * a DIFFERENT member of the same concept (that is the generalization).
 * Getting this backwards makes a level literally unwinnable.
 *
 * Returns null only if the library has nothing playable at all, which the
 * smoke suite asserts cannot happen.
 */
export function buildConceptRound(
  roundIndex: number,
  options: { shapeMatch?: boolean } = {},
): ConceptRound | null {
  const pool = options.shapeMatch ? SHAPE_CONCEPTS : PLAYABLE_CONCEPTS;
  if (pool.length === 0) return null;

  const conceptKey = pool[roundIndex % pool.length];
  // Advance the sample only after a full pass through the concepts, so the
  // same concept comes back with a DIFFERENT member next time round.
  const sampleIndex = Math.floor(roundIndex / pool.length);

  const trial = options.shapeMatch
    ? buildShapeTrial(conceptKey, { sampleIndex })
    : buildTrial(conceptKey, { sampleIndex });
  if (!trial) return null;

  return {
    sample: variantAsCrop(trial.sample),
    target: variantAsCrop(trial.correct),
    options: trialOptions(trial).map(variantAsCrop),
  };
}

/** True when a crop is drawn from the concept library rather than a photo.
 * The one check every render site needs. */
export function isConceptCrop(crop: TaggedCrop | null | undefined): boolean {
  return Boolean(crop?.conceptVariantId);
}
