// Trace-and-colour: the rules. Pure — no React, no DOM, no SVG — so the
// coverage maths is testable in Node (scripts/smoke-trace.ts), the same
// split as objectIconLogic.ts and conceptLibrary.ts.
//
// The browser half owns only the bit that genuinely needs a document:
// turning an SVG path into a list of points via getTotalLength /
// getPointAtLength. Everything downstream of that is plain arithmetic and
// lives here.
//
// WHAT THIS GAME MEASURES
// -----------------------
// The TRACING, and nothing else. The colour step that follows is
// expression, not assessment: no colour is wrong, nothing about the choice
// is scored, and the support tier the caregiver reports afterwards is about
// how much help the child needed to trace — which is why the logged skill
// id below is built from the tracing, never from the colour.

import { TRACE_OBJECTS, type TraceObject } from './tracePaths';

export interface TracePoint {
  x: number;
  y: number;
}

/**
 * How much of the outline counts as traced.
 *
 * Not 100%: a 3-5 year old with an unsteady finger will always miss a
 * checkpoint or two, and demanding perfection turns "you did it" into a
 * task that cannot be finished. 88% is enough to mean the child went round
 * the whole shape while leaving room for the wobble.
 */
export const COMPLETE_AT = 0.88;

/**
 * How near the finger has to pass for a checkpoint to count, in viewBox
 * units (the shapes live in a 240x240 box).
 *
 * Deliberately generous. This is the same reasoning as §4.4's 88pt touch
 * targets: a tolerance tuned to an adult's precision would lock out exactly
 * the children this app is for. Fine motor control is a thing being
 * PRACTISED here, not a prerequisite.
 */
export const TOUCH_RADIUS = 26;

/**
 * Marks every checkpoint within `radius` of (x, y) as visited.
 *
 * Order-free on purpose: the child may start anywhere on the outline and go
 * either way round, in as many passes as they like. Requiring a stroke
 * order or direction would fail children whose difficulty is motor
 * planning, which is a large part of this audience — and would fail them at
 * something that is not the skill being taught.
 *
 * Returns a NEW set; never mutates the one passed in (React state).
 */
export function visitNearby(
  points: readonly TracePoint[],
  visited: ReadonlySet<number>,
  x: number,
  y: number,
  radius: number = TOUCH_RADIUS,
): Set<number> {
  const next = new Set(visited);
  const r2 = radius * radius;
  for (let i = 0; i < points.length; i++) {
    if (next.has(i)) continue;
    const dx = points[i].x - x;
    const dy = points[i].y - y;
    if (dx * dx + dy * dy <= r2) next.add(i);
  }
  return next;
}

/** Fraction of the outline covered so far, 0..1. */
export function traceProgress(visited: ReadonlySet<number>, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, visited.size / total);
}

/** Whether the child has been all the way round (see COMPLETE_AT).
 * Condition: colouring does not unlock until this is true. */
export function isTraceComplete(visited: ReadonlySet<number>, total: number): boolean {
  return total > 0 && traceProgress(visited, total) >= COMPLETE_AT;
}

// ---------------------------------------------------------------------------
// Colouring
// ---------------------------------------------------------------------------

/** One crayon stroke: a colour and the trail the finger left. Strokes
 * accumulate, so a child can switch colours mid-picture the way they would
 * swap crayons. */
export interface Stroke {
  colour: string;
  points: TracePoint[];
}

/** How thick the crayon draws, in viewBox units. Wide, so a small hand
 * fills a shape in a few passes rather than dozens. */
export const CRAYON_WIDTH = 34;

// NO COMPLETION RULE FOR COLOURING, DELIBERATELY.
//
// An earlier version ended the round automatically once enough of the
// inside was covered, and it kept snatching the picture away mid-scribble.
// Colouring is not a task with a finish line the app gets to decide: a
// child is done when they feel done, which might be one stripe or ten
// minutes of layering. So there is no coverage threshold here, no progress
// bar, and nothing measuring the fill — the round ends when the Done button
// is pressed.
//
// Tracing keeps its threshold (COMPLETE_AT above) because that one IS a
// gate: it decides when colouring unlocks.

/**
 * How many shapes a session runs before it finishes itself.
 *
 * A fixed, small number rather than "until the clock stops you". A child
 * this age cannot read a session cap and has no way to tell how much longer
 * an open-ended activity will last; five shapes is a shape of session they
 * can actually hold — and it ends on a completed picture rather than being
 * interrupted mid-scribble by a timer.
 *
 * Fewer than TRACE_OBJECTS.length on purpose, so a session never repeats a
 * shape and never has to refill the bag.
 *
 * The session cap and the idle timeout still apply underneath; whichever
 * comes first wins. This is the expected ending, not the only one.
 */
export const ROUNDS_PER_SESSION = 5;

/** Whether every planned shape has been done. `completed` is how many
 * rounds have been finished, not the index of the current one. */
export function isSessionFinished(completed: number): boolean {
  return completed >= ROUNDS_PER_SESSION;
}

/**
 * The order shapes come in, as a shuffled bag.
 *
 * A BAG, not per-round randomness. Rolling a die each round can hand a
 * child the apple three times running while the leaf never appears — which
 * looks broken and wastes the variety the set exists to provide. Drawing
 * from a shuffled bag means every shape is seen once before any repeats.
 *
 * `rand` is injectable so the shuffle is deterministically testable, the
 * same convention game1Difficulty.ts's shuffleGrid uses.
 *
 * `avoidFirst` keeps a refilled bag from opening on the shape the last one
 * ended with — the one place a bag can still produce a back-to-back repeat.
 */
export function shuffledBag(
  rand: () => number = Math.random,
  avoidFirst?: string,
): TraceObject[] {
  const bag = [...TRACE_OBJECTS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (avoidFirst && bag.length > 1 && bag[0].key === avoidFirst) {
    [bag[0], bag[1]] = [bag[1], bag[0]];
  }
  return bag;
}

/**
 * The fixed, unshuffled order.
 *
 * Used for children whose profile asks for sameness (§5.2's `sameness`
 * dimension, surfaced as ProfileTuning.fixedLayout). Game 1 makes the same
 * distinction for its grid: predictability is a genuine accommodation for
 * some children and a randomiser applied to everyone would take it away.
 * Same shapes, same sequence, every session.
 */
export function fixedBag(): TraceObject[] {
  return [...TRACE_OBJECTS];
}

/**
 * Which shape to trace this round, from a bag the caller holds.
 *
 * Kept index-based rather than popping from a mutable queue so a round can
 * be re-derived at any time — React state, replays and tests all stay
 * straightforward.
 */
export function objectFromBag(bag: TraceObject[], indexInBag: number): TraceObject {
  return bag[indexInBag % bag.length];
}

/**
 * The skill logged for a completed round.
 *
 * Named for the TRACING, because that is the only thing this game
 * assesses — see the module header. A child who traced an apple beautifully
 * and then coloured it blue has succeeded at this activity completely.
 */
export function traceSkillId(object: TraceObject): string {
  return `trace-${object.key}`;
}
