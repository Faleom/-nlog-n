// F.020 — Branch handoff & the no-screening rule (§10).
//
// "The most failure-prone part of the design, so the rules are explicit."
//
// Branch 1 -> Branch 2: repeated "didn't want to / couldn't do it" in the
// same skill domain must produce NO warning, NO computation, NO conclusion.
// The only thing that ever appears is this same neutral prompt, everywhere,
// unconditionally. §10: "activity history is the only condition-adjacent
// data in the app now that there's no condition field, and it must never
// become a screen."
//
// The guarantee is enforced at TWO levels, deliberately redundant:
//   1. Structural: getNeutralNotePromptState() below takes a history
//      parameter but the function body never reads it -- see the smoke test
//      for a real round-trip proof (two real profiles, one with a long run
//      of low-support-tier records, one with none, both producing
//      byte-identical output).
//   2. Repo-wide: scripts/smoke-f020.ts greps the ENTIRE codebase (not just
//      this file) for any counter/streak/threshold/pattern-check construct
//      over activity outcomes, and fails if one exists anywhere it isn't on
//      the explicit, documented allowlist (F.011's cross-session support
//      fading and F.009's same-session difficulty stepping -- both about
//      task DIFFICULTY, never about surfacing a concern).

import type { SkillRecord } from '../types';

/** Identical everywhere, always. This exact string, verbatim, is the ONLY
 * thing that ever appears as a result of any activity outcome pattern
 * (§10). Never varies with age, skill, support tier, or history. */
export const NEUTRAL_NOTE_PROMPT_TEXT = 'Want to save a note about this to ask about later?';

export interface NeutralNotePromptState {
  text: string;
}

/**
 * What Branch 1 shows for the neutral note handoff. Deliberately accepts a
 * skill's full history as a parameter -- so a caller who already has it in
 * hand (e.g. a game screen right after logging an outcome) can call this
 * without first stripping it out -- and just as deliberately never reads
 * it. This is the whole mechanism: there is nothing here to compute, so
 * there is nothing here to get wrong.
 *
 * `_history` is intentionally unused -- see scripts/smoke-f020.ts for a
 * real round-trip test proving two genuinely different histories (many
 * low-support-tier records vs. none) still produce identical output.
 */
export function getNeutralNotePromptState(_history: SkillRecord[]): NeutralNotePromptState {
  return { text: NEUTRAL_NOTE_PROMPT_TEXT };
}
