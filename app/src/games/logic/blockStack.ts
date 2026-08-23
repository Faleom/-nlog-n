// F.027 — Block-stack match, the Logic & Quantity track's third round.
//
// Build the right tower to match the left. This is a LOOP, not a single
// answer -- look, compare, adjust, check again -- which is why it's the one
// round in the track that assumes a grown-up alongside.
//
// The interaction here replaced a "− / +" button pair. Those two glyphs sat
// inside the child's view, and a preschooler decoding "+" is reading -- the
// exact gate this app exists to avoid, and the same ground the track already
// used to reject counting with numerals. A gesture carries no symbol, so
// there is nothing to read.
//
// Everything below is pure. The React file renders it and nothing else.

/** Which way the finger travelled. */
export type SwipeDirection = 'up' | 'down';

/** What that does to the tower. */
export type StackAction = 'lift' | 'place';

/**
 * THE DIRECTION DECISION, made once and held here.
 *
 * `up` lifts a block OFF; `down` presses one ON. This is the physical-hand
 * reading -- you lift a block away from a tower, you put a block down onto
 * it -- chosen over the competing "up = the tower grows" reading, which is
 * its exact inverse. Getting this backwards means a child trying to fix the
 * tower makes it worse on every attempt, so it is deliberately a single
 * constant rather than a per-call argument: every round that ever uses a
 * vertical gesture reads it from here, and they cannot drift apart.
 */
export const SWIPE_MEANING: Readonly<Record<SwipeDirection, StackAction>> = {
  up: 'lift',
  down: 'place',
};

/** Vertical travel before a drag counts as a swipe at all. Named
 * "min travel" rather than a threshold deliberately: F.020 guards the word
 * "threshold" repo-wide, and this is a gesture distance in pixels, nothing
 * to do with activity outcomes. Keeping it off that allowlist keeps the
 * allowlist narrow enough to still mean something. */
export const SWIPE_MIN_TRAVEL_PX = 26;

/** Total travel under which a pointer down/up counts as a tap, not a drag. */
export const TAP_SLOP_PX = 12;

/** How tall the column can get. Fixed, so empty slots are always visible
 * above the tower -- that empty space is the tap target for "place". */
export const COLUMN_SLOTS = 7;

/** §"The stack starts 1–2 blocks off so the correction is short." */
export const MIN_START_OFFSET = 1;
export const MAX_START_OFFSET = 2;

export interface BlockStackRound {
  /** The yellow tower on the left. Fixed for the whole round. */
  targetHeight: number;
  /** Where the blue tower starts -- always 1-2 blocks away from target. */
  startHeight: number;
}

/**
 * Resolves a completed vertical drag into an action, or null if the finger
 * didn't travel far enough to mean anything. A gesture that falls short is
 * not an error -- nothing happens, and nothing is said about it.
 */
export function resolveSwipe(dy: number, minTravel = SWIPE_MIN_TRAVEL_PX): StackAction | null {
  if (Math.abs(dy) < minTravel) return null;
  return SWIPE_MEANING[dy < 0 ? 'up' : 'down'];
}

/**
 * Resolves a tap on the column into an action, by where it landed.
 *
 * Tap the empty space above the tower -> place a block there. Tap the tower
 * itself -> lift its top block off. Spatially literal, so it needs no
 * explaining and no legend on screen.
 *
 * This exists because a swipe is cheaper than a drag but is NOT free: it
 * still wants a clean directional gesture, and some children in this band
 * can't produce one. Tap is the same two actions through a lower-effort
 * input. Nothing on screen advertises it; it simply also works.
 */
export function resolveTap(
  yWithinColumn: number,
  columnHeight: number,
  currentHeight: number,
  slots = COLUMN_SLOTS,
): StackAction {
  const emptyPx = columnHeight * ((slots - currentHeight) / slots);
  return yWithinColumn < emptyPx ? 'place' : 'lift';
}

/**
 * Picks a round. `pickOffset` and `pickTarget` are injected so tests can
 * drive them deterministically -- there is no global RNG in this codebase.
 */
export function buildRound(
  random: () => number = Math.random,
  slots = COLUMN_SLOTS,
): BlockStackRound {
  // Leave room to overshoot in both directions, so a child who swipes the
  // wrong way still has somewhere to go and can correct back.
  const minTarget = MAX_START_OFFSET + 1;
  const maxTarget = slots - MAX_START_OFFSET;
  const span = maxTarget - minTarget + 1;
  const targetHeight = minTarget + Math.floor(random() * span);

  const offsetSpan = MAX_START_OFFSET - MIN_START_OFFSET + 1;
  const magnitude = MIN_START_OFFSET + Math.floor(random() * offsetSpan);
  // Start below target when there's room, otherwise above. Either way the
  // correction is at most two blocks.
  const startHeight =
    targetHeight - magnitude >= 0 ? targetHeight - magnitude : targetHeight + magnitude;

  return { targetHeight, startHeight };
}

/**
 * The round's state. Deliberately holds no counter of attempts, no score,
 * and no notion of a "wrong" move -- adjusting the tower in either
 * direction is the activity, not a mistake to be tallied.
 */
export class BlockStackMachine {
  readonly targetHeight: number;
  readonly slots: number;
  private currentHeight: number;

  constructor(round: BlockStackRound, slots = COLUMN_SLOTS) {
    this.targetHeight = round.targetHeight;
    this.slots = slots;
    this.currentHeight = round.startHeight;
  }

  get height(): number {
    return this.currentHeight;
  }

  get matched(): boolean {
    return this.currentHeight === this.targetHeight;
  }

  /** Adds a block. Returns false at the ceiling -- silently, with no event. */
  place(): boolean {
    if (this.currentHeight >= this.slots) return false;
    this.currentHeight++;
    return true;
  }

  /** Removes the top block. Returns false at an empty tower, silently. */
  lift(): boolean {
    if (this.currentHeight <= 0) return false;
    this.currentHeight--;
    return true;
  }

  apply(action: StackAction): boolean {
    return action === 'lift' ? this.lift() : this.place();
  }
}
