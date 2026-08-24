// Animation intensity, derived once and read by every game that animates.
//
// UI-STANDARDS.md: "Low animation intensity visibly reduces motion. Honour
// prefers-reduced-motion alongside it." And: "If flipping a setting
// produces no observable change, it isn't implemented." So this is not a
// styling nicety -- §5.2 Q1 explicitly tunes animation intensity off the
// response profile, and the avoid list can hard-cap it.
//
// Three inputs, and the LOWEST of them always wins. Adding motion to a
// game must never be able to push a calm-profile child past what their
// profile asked for -- which is exactly the risk when someone is asked to
// "make it more animated".

import { shouldReduceAnimation } from '../engine/avoidFilter';
import type { ChildProfile } from '../types';

/** minimal: position changes only, no travel, no overshoot.
 *  calm:    short, soft, no bounce.
 *  full:    travel, squash and a little overshoot. */
export type MotionTier = 'minimal' | 'calm' | 'full';

export interface MotionSettings {
  tier: MotionTier;
  /** Base duration in ms. 0 at 'minimal' -- callers should skip the
   * animation entirely rather than run a zero-length one. */
  durationMs: number;
  /** How far a block travels before it lands, in px. */
  travelPx: number;
  /** Whether a landing may overshoot and settle back. */
  overshoot: boolean;
}

const SETTINGS: Record<MotionTier, MotionSettings> = {
  minimal: { tier: 'minimal', durationMs: 0, travelPx: 0, overshoot: false },
  calm: { tier: 'calm', durationMs: 220, travelPx: 22, overshoot: false },
  full: { tier: 'full', durationMs: 380, travelPx: 54, overshoot: true },
};

/**
 * Resolves the tier for a child.
 *
 * `prefersReducedMotion` is passed in rather than read here so this stays
 * pure and testable -- the React side reads the media query.
 */
export function motionFor(
  profile: ChildProfile,
  prefersReducedMotion: boolean,
): MotionSettings {
  // Both hard caps, in order. Either one alone forces the floor.
  if (prefersReducedMotion) return SETTINGS.minimal;
  if (shouldReduceAnimation(profile.context.avoidList)) return SETTINGS.minimal;

  const { soundMovement } = profile.responseProfile;
  // "Calm and quiet" is the demo profile's answer and the default a
  // declaration pre-fills, so this is the common path, not an edge case.
  if (soundMovement === 'calm') return SETTINGS.calm;
  if (soundMovement === 'lively') return SETTINGS.full;

  // Unanswered or "doesn't mind" -- sit between the two rather than
  // assuming the liveliest. Every response-profile question is skippable,
  // and a skipped question must never opt a child INTO more stimulation.
  return SETTINGS.calm;
}

/** CSS custom properties for a tier, spread onto the animating container. */
export function motionVars(m: MotionSettings): Record<string, string> {
  return {
    '--motion-ms': `${m.durationMs}ms`,
    '--motion-travel': `${m.travelPx}px`,
    '--motion-overshoot': m.overshoot ? '1.06' : '1',
  };
}
