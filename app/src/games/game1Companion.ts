// F.017 — Companion mechanic in Game 1 (§6.3, §8.1). Pure logic only — no
// React — so the framing/gating rules are testable without a browser. See
// scripts/smoke-f017.ts.
//
// §6.3's hard constraint, restated here because it governs every function
// in this file: the Companion has EXACTLY TWO states, waiting and
// delighted. Never sad, disappointed, or hurt by a wrong answer — there is
// no "companion reacts to a wrong tap" function anywhere in this file or
// in Game1.tsx, and that absence is deliberate, not an oversight.
//
// §6.3 also requires: "the Companion never gives an instruction the
// caregiver can't see on screen." Every template here is spoken via
// adapters.speechOut AND is exactly what Game1.tsx also renders as
// caregiver-facing text in the same phase — see Game1.tsx's 'searching'
// JSX for the visible counterpart of these lines.

import type { ChildProfile } from '../types';

/** Whether this child has a real Companion set (name AND a photo — a name
 * alone, with no photo, isn't enough to run the hunt/reward mechanics that
 * need the actual photo). Every Companion-specific feature in this file
 * gates on this — with no Companion, Game 1 must keep working exactly as
 * it did before F.017, via the neutral 'your friend'/'they' defaults
 * engine/slots.ts already provides (§6.3 review checklist: "with no
 * Companion set, does the neutral guide still work?"). */
export function hasCompanion(profile: ChildProfile): boolean {
  const companion = profile.context.companion;
  return Boolean(companion?.name && companion.photo);
}

// ---------------------------------------------------------------------------
// Guide framing (§6.3: "all instructional audio framed as coming from
// them... never a disembodied app voice") — templates only; slot-filling
// and the avoid-list pass happen in engine/slots.ts's renderLine, same as
// every other child-facing line in this app.
// ---------------------------------------------------------------------------

/** §8.1: "Companion hunt — 'Where's {companion}?' The child hunts their
 * actual toy. Highest-motivation target available." */
export const COMPANION_HUNT_PROMPT_TEMPLATE = "Where's {companion}?";

/** §8.1/§6.3: "Helper who needs help — '{companion} can't reach the
 * {object}. Can you get it for {companion_they}?' Prosocial framing."
 * Uses the existing 'object.name' slot (engine/slots.ts's SlotValues
 * already has it — F.013's childFacingHandoffLine uses the same slot). */
export const HELPER_FRAMING_PROMPT_TEMPLATE =
  "{companion} can't reach the {object.name}. Can you get it for {companion_they}?";

/**
 * Whether trial number `trialIndex` (1-based, i.e. the Nth trial this
 * session) should use the prosocial "helper who needs help" framing
 * instead of the standard "{companion} wants..." framing. Every 3rd trial
 * — frequent enough to be a real, noticeable variant (this is the whole
 * point: staleness is an adherence problem, per §8.3's reasoning for why
 * Game 3 has three modes) without replacing the standard framing outright.
 */
export function shouldUseHelperFraming(trialIndex: number): boolean {
  return trialIndex > 0 && trialIndex % 3 === 0;
}

// ---------------------------------------------------------------------------
// Reward framing (§8.1: "Reward: their photo appears on success, framed in
// {fav_colour}") — a real CSS colour derived straight from the profile's
// quick preference, NOT from engine/slots.ts's text-filled SlotValues
// (whose fallback is the literal word "a colour", not a paintable CSS
// value — see swatchColour() in Game1.tsx for the same
// known-word-or-neutral-fallback pattern used for crop colours).
// ---------------------------------------------------------------------------

const KNOWN_CSS_COLOURS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
  'black', 'white', 'grey', 'gray', 'gold', 'silver', 'teal', 'cyan',
]);

/** Returns a real CSS colour for the reward frame, or null if the child
 * has no favourite colour set (in which case Game1.tsx renders no frame
 * at all, rather than a meaningless default colour standing in for a
 * preference the family never gave). */
export function rewardFrameColour(profile: ChildProfile): string | null {
  const favColour = profile.context.quickPreferences?.favColour?.toLowerCase();
  if (!favColour) return null;
  return KNOWN_CSS_COLOURS.has(favColour) ? favColour : null;
}
