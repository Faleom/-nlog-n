// Fading logic (§7.6, §7.7). F.011.
//
// Tracks support tier per SKILL across sessions. A consistent pattern of
// needing less support suggests trying a lower support tier next time — a
// genuine adaptive loop, reading real history, not a one-shot guess.
//
// Two directions, both reading through profileStore.getSkillHistory:
//   - Step UP tier number (toward Independent): N consecutive records
//     where the on-screen confirmation was unprompted (onScreenTier === 0).
//   - Step DOWN tier number (toward more physical help): N consecutive
//     records where the on-screen confirmation hit its maximum (tier 3) —
//     even with the app's own maximum help, the child needed it, so more
//     physical support is likely warranted.
// "Step up"/"step down" here means the SUPPORT TIER NUMBER, matching the
// worked example in §8.4: gesture (3) -> verbal (4) is a step UP (less
// support), following the SUPPORT_TIERS ordering in config/supportLadder.ts.
//
// Moves ONE TIER AT A TIME, in EITHER direction — never a ratchet. Never
// produces a score, percentage, or progress bar (§13). Reads history for
// exactly one skill at a time — never blended across skills into a single
// "ability" figure.

import { INTERACTION_CONFIG } from '../config/interaction';
import { getSupportTierInfo } from '../config/supportLadder';
import { getSkillHistory } from './profileStore';
import type { SupportTier } from '../types';

export interface FadingSuggestion {
  skillId: string;
  direction: 'step-up' | 'step-down';
  fromTier: SupportTier;
  toTier: SupportTier;
  /** Caregiver-facing, in the shape of the §8.4 worked example — a
   * suggestion they can act on or decline, never an instruction that
   * changes anything on its own. */
  message: string;
}

/**
 * Reads a skill's history and decides whether to suggest a tier change.
 * `currentTier` is the tier actually last used for this skill (the
 * caregiver's own most recent report) — the suggestion is relative to it,
 * never computed as some abstract "ideal" tier.
 */
export async function getFadingSuggestion(
  childId: string,
  skillId: string,
  currentTier: SupportTier,
  childName = 'they',
): Promise<FadingSuggestion | null> {
  const history = await getSkillHistory(childId, skillId);

  const upStreak = INTERACTION_CONFIG.STEP_UP_UNPROMPTED_STREAK;
  const recentForUp = history.slice(-upStreak);
  const readyToStepUp =
    currentTier < 5 &&
    recentForUp.length === upStreak &&
    recentForUp.every((r) => r.onScreenTier === 0);

  if (readyToStepUp) {
    return buildSuggestion(skillId, currentTier, 'step-up', childName);
  }

  const downStreak = INTERACTION_CONFIG.STEP_DOWN_TIER3_STREAK;
  const recentForDown = history.slice(-downStreak);
  const readyToStepDown =
    currentTier > 1 &&
    recentForDown.length === downStreak &&
    recentForDown.every((r) => r.onScreenTier === 3);

  if (readyToStepDown) {
    return buildSuggestion(skillId, currentTier, 'step-down', childName);
  }

  return null;
}

function buildSuggestion(
  skillId: string,
  currentTier: SupportTier,
  direction: 'step-up' | 'step-down',
  childName: string,
): FadingSuggestion {
  const toTier = (direction === 'step-up' ? currentTier + 1 : currentTier - 1) as SupportTier;
  const toInfo = getSupportTierInfo(toTier);
  const toName = toInfo.name.toLowerCase();
  const toAction = toInfo.instruction.replace(/\.$/, '').toLowerCase();

  // Deliberately not routed through engine/slots.ts's fillSlots — that
  // vocabulary (companion, fav_colour, ...) is for CHILD-facing content.
  // This sentence is caregiver-facing and has its own small template
  // vocabulary, not worth forcing into the shared SlotValues shape.
  const message =
    direction === 'step-up'
      ? `${childName}'s been doing well. Next time, try ${toName} — ${toAction}`
      : `${childName}'s needed extra help with this one lately. Next time, try ${toName} — ${toAction}`;

  return { skillId, direction, fromTier: currentTier, toTier, message };
}
