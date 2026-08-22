// F.018 — Avoid list: hard exclusion, engine-level, no exceptions.
// See app-guide-v3-FINAL.md §6.2, §6.4.
//
// Owns two things: the actual text filter wired into F.005's slots.ts
// hook (setAvoidFilter), and small flag/query helpers other engine files
// can check for the NON-text exclusions §6.2/§6.4 call out — a silenced
// chime becomes a visual pulse, fast animation drops out, an avoided
// colour never surfaces as a target.
//
// Not a preference weighting — a hard exclusion (§18's "Not in this
// file"). If any avoided term or the avoided colour survives in the
// FINAL filled string, the whole line swaps for ONE fixed neutral variant
// (§6.4). Swapping the whole line, not editing out the offending word, is
// deliberate: word-level surgery risks leaving a grammatically broken or
// still-recognisable fragment of the very thing being avoided.

import { setAvoidFilter } from './slots';
import type { AvoidFilter } from './slots';
import type { AvoidList, ChildContextProfile } from '../types';

/** §6.4's "the line is swapped for its neutral variant" — one fixed,
 * always-safe line, not a per-template variant registry (nothing in
 * F.005/F.015 provides one, and inventing a whole variant-authoring
 * system is out of scope for this file). */
export const NEUTRAL_FALLBACK_LINE = "Let's try something else!";

function avoidedWords(avoidList: AvoidList | undefined): string[] {
  if (!avoidList) return [];
  const words: string[] = [];
  if (avoidList.avoidedColour) words.push(avoidList.avoidedColour);
  if (avoidList.avoidedTerms) words.push(...avoidList.avoidedTerms);
  return words.map((w) => w.trim()).filter((w) => w.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True if `text` contains any avoided term or the avoided colour, as a
 * whole word, case-insensitively — whole-word so avoiding "red" doesn't
 * also strip "bored" or "credit".
 */
export function containsAvoidedContent(text: string, avoidList: AvoidList | undefined): boolean {
  const words = avoidedWords(avoidList);
  if (words.length === 0) return false;
  return words.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(text));
}

/**
 * The real filter. Wired into slots.ts via installAvoidFilter(). Must run
 * LAST, on the fully slot-filled string — engine/slots.ts's renderLine()
 * already guarantees that ordering (it calls fillSlots() before this),
 * and scripts/smoke-f018.ts re-proves it end to end through this exact
 * function rather than trusting that guarantee from a distance.
 */
export const avoidListFilter: AvoidFilter = (text, context: ChildContextProfile) => {
  if (containsAvoidedContent(text, context.avoidList)) {
    return NEUTRAL_FALLBACK_LINE;
  }
  return text;
};

/** Makes the real filter active. Idempotent — safe to call more than
 * once (e.g. once from the AvoidList screen's mount effect, and again by
 * whoever wires app startup centrally). */
export function installAvoidFilter(): void {
  setAvoidFilter(avoidListFilter);
}

// ---------------------------------------------------------------------------
// Non-text exclusions (§6.2, §6.4). Not string filtering — flags other
// engine/game files check before deciding what to play or render.
// ---------------------------------------------------------------------------

/** "Loud or sudden sounds" -> the success chime silently becomes a visual
 * pulse instead of playing (§6.2's five-second demo). Consumers check
 * this before calling SpeechOutPort / playing a chime. */
export function shouldUseVisualPulseInsteadOfChime(avoidList: AvoidList | undefined): boolean {
  return avoidList?.loudSounds === true;
}

/** "Fast animation or flashing" -> drop to the lowest animation
 * intensity tier — the same mechanism UI-STANDARDS.md specifies for
 * prefers-reduced-motion, triggered by an explicit avoid-list entry too. */
export function shouldReduceAnimation(avoidList: AvoidList | undefined): boolean {
  return avoidList?.fastAnimation === true;
}

/** A disliked colour is removed from the accent AND from anything
 * picking a target colour (e.g. Game 1's colour targets, owned by
 * F.012/F.017) — consumers call this before OFFERING a colour, not just
 * before rendering text about one. */
export function isColourAvoided(colour: string, avoidList: AvoidList | undefined): boolean {
  if (!avoidList?.avoidedColour) return false;
  return avoidList.avoidedColour.trim().toLowerCase() === colour.trim().toLowerCase();
}

/** "Surprises and unannounced changes" -> consumers should warn before
 * introducing novel content rather than doing so silently. Exposed as a
 * flag rather than enforced here, since "warn before changing" is a
 * sequencing decision each game owns, not something a string filter can
 * do on its own. */
export function shouldAnnounceChangesInAdvance(avoidList: AvoidList | undefined): boolean {
  return avoidList?.surprises === true;
}
