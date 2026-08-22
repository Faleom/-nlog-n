// F.010's log-write path. Bridges F.009's per-trial outcome (was the
// on-screen confirmation prompted?) and the caregiver's self-reported
// support tier (F.010's ladder, off-screen physical support) into one
// SkillRecord, persisted via F.001.
//
// Deliberately does nothing else. No counting, no streaks, no thresholds,
// no reading of past records — that is explicitly forbidden here (§10) and
// belongs to F.011 (fading) alone, reading through
// profileStore.getSkillHistory.

import { appendSkillRecord } from './profileStore';
import type { OnScreenPromptTier, SessionLog, SupportTier } from '../types';

export interface LogActivityOutcomeInput {
  sessionId: string;
  skillId: string;
  context: string;
  /** Caregiver-reported, from F.010's five-tier ladder — how much
   * off-screen support was actually needed, not what was suggested. */
  supportTier: SupportTier;
  /** From F.009's trial resolution (`resolution.tier`) — the raw in-trial
   * prompt tier the confirmation tap resolved at. `prompted` is derived
   * from this, not passed separately, so the two can never disagree. */
  onScreenTier: OnScreenPromptTier;
}

export async function logActivityOutcome(input: LogActivityOutcomeInput): Promise<SessionLog> {
  return appendSkillRecord(input.sessionId, {
    skillId: input.skillId,
    context: input.context,
    supportTier: input.supportTier,
    onScreenTier: input.onScreenTier,
    prompted: input.onScreenTier > 0,
    timestamp: new Date().toISOString(),
  });
}
