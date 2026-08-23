// Session cap, fade & off-screen handoff (§7.2, §7.9). F.013.
//
// The headline Impact claim made real: the TOBY trial found the pedagogy
// worked but families dropped off after ~3 months -- adherence was the
// failure point, not the content. This file is the app designed around
// that finding: it gets SHORTER over time and ends ITSELF, on purpose.
//
// Three ways in, one ending: cap reached, 90s total idle (detected by
// F.009's InteractionMachine.tick(), not duplicated here), or the
// caregiver deliberately ends it. All three converge on endSessionNow().

import { sessionCapMinutes } from '../config/interaction';
import { endSession as persistEndSession, getSessionsForChild } from './profileStore';
import { renderLine, slotValuesFromProfile } from './slots';
import type { ChildProfile, SessionLog } from '../types';

export type SessionEndReason = 'cap' | 'idle' | 'caregiver';

export interface SessionEndResult {
  reason: SessionEndReason;
  /** The real object from THIS session, for the handoff line -- never a
   * generic placeholder if a real one exists. */
  handoffObjectName: string;
  session: SessionLog;
}

/** How many PAST sessions this child has completed -- this session is the
 * (count + 1)th, which sets its cap. Call once, when a session starts. */
export async function getSessionNumber(childId: string): Promise<number> {
  const past = await getSessionsForChild(childId);
  return past.length + 1;
}

/** The session cap, in seconds, for this session number. */
export function sessionCapSeconds(sessionNumber: number): number {
  return sessionCapMinutes(sessionNumber) * 60;
}

/** Pure: has the cap been reached, given elapsed seconds since this
 * session started? No internal timer -- the caller polls this, same
 * pattern as InteractionMachine.tick(). */
export function hasCapBeenReached(sessionNumber: number, elapsedSeconds: number): boolean {
  return elapsedSeconds >= sessionCapSeconds(sessionNumber);
}

/**
 * Ends the session for real and persists it via F.001. This is the single
 * path all three exit conditions go through -- one ending, regardless of
 * which of the three triggered it.
 */
export async function endSessionNow(
  sessionId: string,
  reason: SessionEndReason,
  lastObjectName: string | null,
): Promise<SessionEndResult> {
  const session = await persistEndSession(sessionId, reason);
  return {
    reason,
    handoffObjectName: lastObjectName ?? 'favourite thing',
    session,
  };
}

/**
 * The child-facing goodbye line, in the exact shape §7.7/§7.9 specify:
 * "{companion} says go find your {object} with {caregiver}!" -- naming a
 * REAL object from this session, run through the slot system + avoid-list
 * filter like every other child-facing line.
 */
export function childFacingHandoffLine(profile: ChildProfile, objectName: string): string {
  return renderLine(
    '{companion} says go find your {object.name} with {caregiver}!',
    slotValuesFromProfile(profile, { 'object.name': objectName }),
    profile.context,
  );
}

/**
 * Plain-language caregiver recap, matching the §7.9 example shape exactly:
 * "12 minutes, 3 activities, 2 movement breaks. Longest focus stretch: 4 minutes."
 * Shortening sessions are never framed as decline here -- this only
 * reports what happened, with no comparison to past sessions or any
 * streak/total-time framing (that's explicitly forbidden -- see "Not in
 * this file" in plan/features/F.013.md).
 */
export function describeSessionRecap(session: SessionLog): string {
  const minutes = Math.round(session.durationSeconds / 60);
  const focusMinutes = Math.round(session.longestFocusStretchSeconds / 60);
  return `${minutes} minutes, ${session.activitiesRun} activities, ${session.movementBreaks} movement breaks. Longest focus stretch: ${focusMinutes} minutes.`;
}

/**
 * Distinct skills touched this session -- a stand-in for "objects
 * recognised" on the caregiver recap. Derived from existing skillRecords
 * rather than tracked as a second, separate log, so there is only one
 * source of truth for what happened in the session.
 */
export function distinctSkillsThisSession(session: SessionLog): string[] {
  return [...new Set(session.skillRecords.map((r) => r.skillId))];
}
