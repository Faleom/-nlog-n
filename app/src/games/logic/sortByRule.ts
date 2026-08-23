// F.028 — Sort by rule, the Logic & Quantity track's fourth round.
//
// One example already sits in each basket. That IS the rule -- shown, never
// stated. Nothing to read, nothing to hold in the head: both baskets and
// every loose item stay on screen the whole time, which is what keeps this
// a looking task rather than a remembering one.
//
// THE ONE-DIMENSION INVARIANT, and why it is structural rather than a
// styling note. A round picks ONE dimension to sort by -- shape, size,
// fill or colour -- and every other dimension is held CONSTANT across
// every item and both seeded examples. If two dimensions ever vary at
// once, the round stops having a single answer ("sort by shape? by
// colour?") and stops being answerable by looking, which is the whole
// premise of the track.
//
// This generalises the original rule (all items one colour, sort by
// shape); it does not relax it. The original was this invariant with
// `dimension` pinned to 'shape'. buildSortRound() cannot construct a round
// that violates it, and smoke-f028 asserts it over every dimension.
//
// Everything below is pure. The React file renders it and nothing else.

import { isColourAvoided } from '../../engine/avoidFilter';
import type { AvoidList } from '../../types';

export type ShapeValue = 'round' | 'square' | 'triangle';
export type SizeValue = 'big' | 'small';
export type FillValue = 'solid' | 'hollow';
export type ColourValue = 'blue' | 'green' | 'orange' | 'purple';

/** The dimension a round sorts by. */
export type SortDimension = 'shape' | 'size' | 'fill' | 'colour';

/** Any single value on any dimension -- a basket's identity. */
export type SortValue = ShapeValue | SizeValue | FillValue | ColourValue;

export const SHAPE_VALUES: readonly ShapeValue[] = ['round', 'square', 'triangle'];
export const SIZE_VALUES: readonly SizeValue[] = ['big', 'small'];
export const FILL_VALUES: readonly FillValue[] = ['solid', 'hollow'];
export const COLOUR_VALUES: readonly ColourValue[] = ['blue', 'green', 'orange', 'purple'];

export const SORT_DIMENSIONS: readonly SortDimension[] = ['shape', 'size', 'fill', 'colour'];

const VALUES_BY_DIMENSION: Record<SortDimension, readonly SortValue[]> = {
  shape: SHAPE_VALUES,
  size: SIZE_VALUES,
  fill: FILL_VALUES,
  colour: COLOUR_VALUES,
};

/** Every item carries a full set. Exactly one of these varies per round. */
export interface SortAttributes {
  shape: ShapeValue;
  size: SizeValue;
  fill: FillValue;
  colour: ColourValue;
}

export interface SortItem {
  id: string;
  attrs: SortAttributes;
}

export interface SortRound {
  /** The dimension this round sorts by. */
  dimension: SortDimension;
  /** The two basket identities, values on `dimension`. */
  baskets: readonly [SortValue, SortValue];
  /** The loose items, in tray order. */
  items: readonly SortItem[];
}

export type DepositResult = 'accepted' | 'returned';

/** How the child moved it. Recorded to understand real usage, never scored. */
export type SortInputMethod = 'tap' | 'drag';

/** Item counts a round may use. Both stay an even split per basket. */
export const ITEM_COUNTS: readonly number[] = [4, 6];

/** The value of `item` on `dimension` -- i.e. which basket it belongs in. */
export function valueOn(item: SortItem, dimension: SortDimension): SortValue {
  return item.attrs[dimension];
}

/**
 * Which dimensions can be used at all, given the avoid list.
 *
 * A disliked colour is hard-excluded from generated content (§6.2 Layer 4),
 * so a colour round needs two non-avoided colours to remain. Every other
 * dimension is unaffected -- but the colour HELD CONSTANT in those rounds
 * still has to dodge the avoided one, which `pickConstants` handles.
 */
export function availableDimensions(avoidList: AvoidList | undefined): readonly SortDimension[] {
  return SORT_DIMENSIONS.filter((d) => {
    if (d !== 'colour') return true;
    return COLOUR_VALUES.filter((c) => !isColourAvoided(c, avoidList)).length >= 2;
  });
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

/** Two distinct values from a dimension. */
function pickPair(values: readonly SortValue[], random: () => number): [SortValue, SortValue] {
  const first = pick(values, random);
  const rest = values.filter((v) => v !== first);
  return [first, pick(rest, random)];
}

export interface BuildSortRoundOptions {
  random?: () => number;
  avoidList?: AvoidList;
  /** Force a dimension. Used by tests and by a caregiver pinning a rule. */
  dimension?: SortDimension;
  itemCount?: number;
}

/**
 * Builds a round. The variation between rounds is: which dimension is the
 * rule, which two values it uses, what the other three dimensions are
 * pinned to, and how many items there are.
 */
export function buildSortRound(options: BuildSortRoundOptions = {}): SortRound {
  const random = options.random ?? Math.random;
  const avoidList = options.avoidList;

  const usable = availableDimensions(avoidList);
  const dimension =
    options.dimension && usable.includes(options.dimension)
      ? options.dimension
      : pick(usable, random);

  const dimensionValues =
    dimension === 'colour'
      ? COLOUR_VALUES.filter((c) => !isColourAvoided(c, avoidList))
      : VALUES_BY_DIMENSION[dimension];

  const baskets = pickPair(dimensionValues, random);

  // Everything NOT being sorted by is pinned to one value for the whole
  // round. Picked per round rather than hardcoded, so two shape rounds in
  // a row still look different without either becoming ambiguous.
  const safeColours = COLOUR_VALUES.filter((c) => !isColourAvoided(c, avoidList));
  const constants: SortAttributes = {
    shape: pick(SHAPE_VALUES, random),
    size: pick(SIZE_VALUES, random),
    fill: pick(FILL_VALUES, random),
    colour: safeColours.length > 0 ? pick(safeColours, random) : COLOUR_VALUES[0],
  };

  const requested = options.itemCount ?? pick(ITEM_COUNTS, random);
  // Always an even split, so neither basket is the "mostly right" guess.
  const itemCount = requested % 2 === 0 ? requested : requested + 1;

  const items: SortItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    items.push({
      id: `item-${i}`,
      attrs: { ...constants, [dimension]: baskets[i % 2] } as SortAttributes,
    });
  }

  // Fisher-Yates, seeded by the injected source so tests are deterministic.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return { dimension, baskets, items };
}

/** The example that sits in a basket from the start -- the rule, shown.
 * It matches every loose item on every dimension except the rule one. */
export function seedFor(round: SortRound, basket: SortValue): SortAttributes {
  const any = round.items[0];
  return { ...any.attrs, [round.dimension]: basket } as SortAttributes;
}

/**
 * The round's state.
 *
 * What it deliberately does NOT hold: a score, a star count, a streak, or a
 * tally of wrong drops. A wrong basket returns the item and produces
 * nothing else -- no sound, no mark, no cost. `misses` below is the single
 * exception and it exists only to feed F.009's on-screen prompt tier at the
 * end of the round; it is never rendered, never compared between children,
 * and never shown to a caregiver as a number.
 */
export class SortMachine {
  private readonly round: SortRound;
  private readonly sorted = new Set<string>();
  private missCount = 0;

  constructor(round: SortRound) {
    this.round = round;
  }

  get dimension(): SortDimension {
    return this.round.dimension;
  }

  get baskets(): readonly [SortValue, SortValue] {
    return this.round.baskets;
  }

  /** Items still loose in the tray, in their original order. */
  get remaining(): readonly SortItem[] {
    return this.round.items.filter((i) => !this.sorted.has(i.id));
  }

  /** Items already in a basket. */
  contents(basket: SortValue): readonly SortItem[] {
    return this.round.items.filter(
      (i) => this.sorted.has(i.id) && valueOn(i, this.round.dimension) === basket,
    );
  }

  seed(basket: SortValue): SortAttributes {
    return seedFor(this.round, basket);
  }

  get complete(): boolean {
    return this.sorted.size === this.round.items.length;
  }

  /** Internal only. See the class comment before rendering this anywhere. */
  get misses(): number {
    return this.missCount;
  }

  /**
   * Offers an item to a basket.
   *
   * A match keeps it. A mismatch returns it to the tray and that is the
   * entire response -- the caller must not add a sound, a colour change, a
   * shake, or a message on 'returned'. Quietly nothing is the designed
   * behaviour, not an unfinished branch.
   */
  deposit(itemId: string, basket: SortValue): DepositResult {
    const item = this.round.items.find((i) => i.id === itemId);
    if (!item || this.sorted.has(itemId)) return 'returned';
    if (valueOn(item, this.round.dimension) !== basket) {
      this.missCount++;
      return 'returned';
    }
    this.sorted.add(itemId);
    return 'accepted';
  }
}

/**
 * Maps the round's misses onto F.009's in-trial prompt tier (0-3), so this
 * round logs through exactly the same SkillRecord shape as every other
 * game rather than inventing a parallel metric.
 */
export function onScreenTierFromMisses(misses: number): 0 | 1 | 2 | 3 {
  if (misses <= 0) return 0;
  if (misses === 1) return 1;
  if (misses === 2) return 2;
  return 3;
}
