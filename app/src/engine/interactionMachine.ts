// The moment-to-moment interaction state machine (§7.7). F.009.
//
// Core rule — errorless learning: a trial NEVER ends in failure. By
// construction there is no "failed" outcome to represent here — only
// `resolved: true` (correct, at whatever prompt tier) or the trial
// continuing. Tier only ever escalates within a trial, never resets except
// via startTrial(), and never skips.
//
// Deliberately framework-agnostic: no React, no DOM, no timers running
// internally. A game screen polls tick() periodically (e.g. once a second)
// with the current time and reacts to what comes back. That makes this
// class trivially unit-testable with explicit fake timestamps — see
// scripts/smoke-f009.ts — and it's what F.008/F.012/F.021/F.022 build on.

import { INTERACTION_CONFIG } from '../config/interaction';

export type PromptTier = 0 | 1 | 2 | 3;

export interface TrialResolution {
  resolved: true;
  /** The tier the trial resolved at. 0 = unprompted. */
  tier: PromptTier;
  /** tier > 0. Log this as SkillRecord.prompted — never log "failed". */
  prompted: boolean;
  /** Fires every Nth success only (§7.7) — not every time, that's noise. */
  showCoplayPrompt: boolean;
  /** Running count of resolved trials this session. */
  successCount: number;
}

export interface AttemptContinues {
  resolved: false;
  /** The tier to render now. */
  tier: PromptTier;
  /**
   * 4+ wrong taps within RAPID_TAP_WINDOW_MS on this trial. The caller
   * should pause the trial and offer a movement break — this is a
   * different failure mode from "getting it wrong while genuinely trying".
   */
  rapidTapping: boolean;
}

export type AttemptOutcome = TrialResolution | AttemptContinues;

export interface TickResult {
  /** The current tier, recomputed from elapsed time as well as wrong taps —
   * an idle child escalates the hierarchy exactly like a wrong-tapping one. */
  tier: PromptTier;
  tierChanged: boolean;
  /** 45s since trial start with no resolution — offer the co-play handoff. */
  coplayHandoff: boolean;
  /** 90s total idle — end the session gracefully, log as short. */
  endSession: boolean;
}

export interface DifficultySignal {
  /** 3 consecutive trials resolved at tier 3 — step the game's own
   * difficulty down, or switch modality (Game 3). This is F.009's own
   * same-session signal — NOT F.011's cross-session support-tier fading,
   * which is a different mechanism reading different saved history. */
  stepDifficultyDown: boolean;
}

function tierForElapsed(elapsedMs: number): PromptTier {
  const { FIRST_PROMPT_DELAY_MS, TIER_2_DELAY_MS, TIER_3_DELAY_MS } = INTERACTION_CONFIG;
  if (elapsedMs >= TIER_3_DELAY_MS) return 3;
  if (elapsedMs >= TIER_2_DELAY_MS) return 2;
  if (elapsedMs >= FIRST_PROMPT_DELAY_MS) return 1;
  return 0;
}

export class InteractionMachine {
  private tier: PromptTier = 0;
  private trialStartedAt: number;
  private wrongTapTimestampsThisTrial: number[] = [];
  private successCount = 0;
  private consecutiveTier3Trials = 0;
  private movementBreaksTaken = 0;
  private lastInputAt: number;

  constructor(now: number = Date.now()) {
    this.trialStartedAt = now;
    this.lastInputAt = now;
  }

  /** Call when a new trial begins (a target is shown). Resets per-trial state. */
  startTrial(now: number = Date.now()): void {
    this.tier = 0;
    this.trialStartedAt = now;
    this.wrongTapTimestampsThisTrial = [];
    this.lastInputAt = now;
  }

  /** Call every time the child taps an option. */
  recordAttempt(correct: boolean, now: number = Date.now()): AttemptOutcome {
    this.lastInputAt = now;

    if (correct) {
      const prompted = this.tier > 0;
      this.consecutiveTier3Trials = this.tier === 3 ? this.consecutiveTier3Trials + 1 : 0;
      this.successCount += 1;
      const showCoplayPrompt =
        this.successCount % INTERACTION_CONFIG.COPLAY_PROMPT_EVERY_N_SUCCESSES === 0;
      return {
        resolved: true,
        tier: this.tier,
        prompted,
        showCoplayPrompt,
        successCount: this.successCount,
      };
    }

    // Wrong tap. Escalate one tier — never skip, never past 3. At tier 3
    // the UI has made wrong physically impossible ("only it is tappable"),
    // so this branch should not be reachable there in practice; clamping
    // here is a safety net, not the primary mechanism.
    this.wrongTapTimestampsThisTrial.push(now);
    const windowStart = now - INTERACTION_CONFIG.RAPID_TAP_WINDOW_MS;
    const recentWrongTaps = this.wrongTapTimestampsThisTrial.filter((t) => t >= windowStart);
    const rapidTapping = recentWrongTaps.length >= INTERACTION_CONFIG.RAPID_TAP_COUNT;

    this.tier = Math.min(3, this.tier + 1) as PromptTier;

    return { resolved: false, tier: this.tier, rapidTapping };
  }

  /**
   * Call periodically (e.g. once a second) with the current time. Merges
   * time-based tier escalation (a child who never taps at all still
   * escalates through the hierarchy, exactly like one tapping wrong) with
   * the disengagement checks. Tier only ever moves up — this never
   * un-escalates a tier a wrong tap already reached.
   */
  tick(now: number = Date.now()): TickResult {
    const previousTier = this.tier;
    const timeTier = tierForElapsed(now - this.trialStartedAt);
    this.tier = Math.max(this.tier, timeTier) as PromptTier;

    const idleMs = now - this.lastInputAt;

    return {
      tier: this.tier,
      tierChanged: this.tier !== previousTier,
      coplayHandoff: idleMs >= INTERACTION_CONFIG.COPLAY_HANDOFF_DELAY_MS,
      endSession: idleMs >= INTERACTION_CONFIG.SESSION_END_IDLE_MS,
    };
  }

  /** Call after each trial resolves. */
  checkDifficultySignal(): DifficultySignal {
    return {
      stepDifficultyDown:
        this.consecutiveTier3Trials >= INTERACTION_CONFIG.DISENGAGEMENT_TIER3_STREAK,
    };
  }

  /**
   * Takes a movement break if under the per-session cap. Returns false if
   * the cap is already reached — §7.7: "more means the activity is
   * mismatched", so the caller should step difficulty down instead of
   * offering yet another break.
   */
  takeMovementBreak(): boolean {
    if (this.movementBreaksTaken >= INTERACTION_CONFIG.MOVEMENT_BREAK_MAX_PER_SESSION) {
      return false;
    }
    this.movementBreaksTaken += 1;
    return true;
  }

  get movementBreakCount(): number {
    return this.movementBreaksTaken;
  }

  get successCountThisSession(): number {
    return this.successCount;
  }

  get currentTier(): PromptTier {
    return this.tier;
  }
}
