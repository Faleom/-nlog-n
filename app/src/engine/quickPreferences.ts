// F.016 — Context profile: quick preferences (Layer 2, §6.2).
// Tap-only, ~30s, all skippable, all editable later — see
// screens/QuickPreferences.tsx for the tap UI. This file owns the save
// path and the one piece of pure logic from §6.5's "keeping preferences
// current": when to ask whether the Companion is still the favourite.

import { updateProfile } from './profileStore';
import type { ChildProfile, QuickPreferences } from '../types';

export async function saveQuickPreferences(
  profileId: string,
  patch: QuickPreferences,
): Promise<ChildProfile> {
  return updateProfile(profileId, { context: { quickPreferences: patch } });
}

/**
 * §6.5 — "After 10 sessions, one caregiver-screen question: 'Is
 * {companion} still the favourite?'". Re-asks every 10th completed
 * session after that (10, 20, 30, ...), never on session 0. A pure
 * function of a count so it's testable without wiring up a real timer or
 * caregiver-screen state machine.
 */
export function shouldAskIsCompanionStillFavourite(completedSessionCount: number): boolean {
  return completedSessionCount > 0 && completedSessionCount % 10 === 0;
}
