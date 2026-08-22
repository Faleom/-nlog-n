// The five-tier support ladder (§7.6). F.010.
//
// Caregiver-facing, identical across every game. This describes the
// OFF-SCREEN, physical support a caregiver gives while the child searches
// for a real object in the room -- a different axis from F.009's ON-SCREEN
// prompt hierarchy (tiers 0-3: wait/repeat/highlight/animate), which fires
// during the confirmation tap itself. SkillRecord carries both: `supportTier`
// (this ladder, 1-5) and `prompted` (whether F.009's on-screen hierarchy
// fired at all, collapsed to a boolean).
//
// Defined ONCE, here. Every screen that shows a tier renders this copy --
// never a re-typed version of it.

import type { SupportTier } from '../types';

export interface SupportTierInfo {
  tier: SupportTier;
  name: string;
  /** The concrete caregiver instruction -- an action, not a label (§7.6
   * Done-when: "shows the current tier as a concrete instruction"). */
  instruction: string;
}

export const SUPPORT_TIERS: readonly SupportTierInfo[] = [
  { tier: 1, name: 'Full physical', instruction: 'Walk with them and guide their hand to it.' },
  { tier: 2, name: 'Partial physical', instruction: 'Walk with them, touch their elbow to steer.' },
  { tier: 3, name: 'Gesture', instruction: 'Point to it from where you are.' },
  { tier: 4, name: 'Verbal', instruction: "Say ‘it's near the table’." },
  { tier: 5, name: 'Independent', instruction: 'Wait. Let them go.' },
] as const;

export function getSupportTierInfo(tier: SupportTier): SupportTierInfo {
  const info = SUPPORT_TIERS.find((t) => t.tier === tier);
  if (!info) throw new Error(`Unknown support tier: ${String(tier)}`);
  return info;
}

/** Errorless start: begin generous, fade later, never the reverse (§7.6).
 * The default for a skill with no logged history at all. */
export const DEFAULT_STARTING_SUPPORT_TIER: SupportTier = 1;
