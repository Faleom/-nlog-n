// F.021 — per-child Game 3 difficulty level, persisted, SHARED across all
// three Game 3 modes (§8.3/F.021.md: "Level carries across modes — a
// child at Level 3 here starts Level 3 in any other Game 3 mode. The
// ladder belongs to the child, not the mode.") Mode A (Shadow Match) is
// the only mode built (F.023's Trace/Puzzle are stretch, not built) — but
// this file's storage key and shape are already mode-agnostic so F.023
// can read/write the SAME level state without F.021 needing to change.
//
// Same design as game1Level.ts (separate StoragePort key, no profile-
// shape change, no auto-advancement — see that file's header for the
// reasoning, which applies identically here): caregiver-set, not
// app-inferred.

import { adapters } from '../adapters/registry';

export type Game3Level = 1 | 2 | 3 | 4;

const KEY_PREFIX = 'game3-level-';

export async function getGame3Level(childId: string): Promise<Game3Level> {
  const stored = await adapters.storage.get<number>(KEY_PREFIX + childId);
  if (stored === 1 || stored === 2 || stored === 3 || stored === 4) return stored;
  return 1;
}

export async function setGame3Level(childId: string, level: Game3Level): Promise<void> {
  await adapters.storage.set(KEY_PREFIX + childId, level);
}
