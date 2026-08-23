// The §7.7 config block, verbatim from app-guide-v3-FINAL.md.
// F.009 (interaction state machine) reads these. Do not hardcode these
// numbers anywhere else — if a value needs to change, it changes here once.
//
// "One config object. If asked why these numbers: tuned for preschool
// processing speed, and adjustable per child."

export const INTERACTION_CONFIG = {
  FIRST_PROMPT_DELAY_MS: 8_000,
  TIER_2_DELAY_MS: 20_000,
  TIER_3_DELAY_MS: 35_000,
  COPLAY_HANDOFF_DELAY_MS: 45_000,
  SESSION_END_IDLE_MS: 90_000,

  RAPID_TAP_WINDOW_MS: 2_000,
  RAPID_TAP_COUNT: 4,

  MAX_ATTEMPTS_PER_TRIAL: 3, // then errorless completion

  // Cross-session support-tier fading (F.011 — the 5-tier support ladder:
  // full physical -> partial -> gesture -> verbal -> independent). Reads
  // saved history across sessions. NOT the same mechanism as
  // DISENGAGEMENT_TIER3_STREAK below.
  STEP_UP_UNPROMPTED_STREAK: 3, // consecutive unprompted correct
  STEP_DOWN_TIER3_STREAK: 2, // consecutive tier-3 completions

  // Same-session difficulty signal (F.009's own disengagement detection —
  // §7.7: "3 consecutive tier-3 trials -> step difficulty down or switch
  // modality"). This is the in-trial prompt hierarchy (tiers 0-3: wait /
  // repeat / highlight / animate), a different tier concept from the
  // support ladder above, and a different threshold (3, not 2).
  DISENGAGEMENT_TIER3_STREAK: 3,

  SESSION_CAP_FIRST_MINUTES: 12,
  SESSION_CAP_DECREMENT_MINUTES: 1,
  SESSION_CAP_FLOOR_MINUTES: 6,

  MOVEMENT_BREAK_MAX_PER_SESSION: 3,

  TOUCH_TARGET_MIN_PT: 88,

  // Correct-answer timing (§7.7)
  ACKNOWLEDGE_MS: 200,
  NAME_IT_MS: 500,
  COPLAY_PROMPT_MS: 1_500,
  ADVANCE_MS: 2_500,
  COPLAY_PROMPT_EVERY_N_SUCCESSES: 3, // fires every 3rd-4th success only
} as const;

/** Session cap for a given session number (1-indexed), in minutes. */
export function sessionCapMinutes(sessionNumber: number): number {
  const { SESSION_CAP_FIRST_MINUTES, SESSION_CAP_DECREMENT_MINUTES, SESSION_CAP_FLOOR_MINUTES } =
    INTERACTION_CONFIG;
  const cap = SESSION_CAP_FIRST_MINUTES - (sessionNumber - 1) * SESSION_CAP_DECREMENT_MINUTES;
  return Math.max(cap, SESSION_CAP_FLOOR_MINUTES);
}
