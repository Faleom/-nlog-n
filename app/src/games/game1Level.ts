// F.012 — per-child Game 1 difficulty level, persisted. §8.1: "Level state
// is per child and persists."
//
// Deliberately does NOT touch ChildProfile or profileStore.ts (Person 1's
// engine/domain layer) — it goes straight through the generic StoragePort
// with its own key, exactly the way profileStore.ts itself is built on
// top of StoragePort. This keeps Game 1's own difficulty state out of the
// shared profile shape (which is frozen — see src/types/index.ts) without
// needing a new additive field there.
//
// No auto-advancement logic lives here on purpose: the guide gives an
// explicit axis table for what changes AT each level (§8.1) but no rule
// for WHEN to move between them, and §13 is explicit that this app never
// scores a child's development — inventing a hidden "you did well enough,
// levelling you up" mechanic would be exactly that kind of unspecified
// scoring logic. The level is caregiver-set (see Game1.tsx's level
// picker), same spirit as §7.6's support ladder being caregiver-reported
// rather than app-inferred.

import { adapters } from '../adapters/registry';

export type Game1Level = 1 | 2 | 3 | 4;

const KEY_PREFIX = 'game1-level-';

export async function getGame1Level(childId: string): Promise<Game1Level> {
  const stored = await adapters.storage.get<number>(KEY_PREFIX + childId);
  if (stored === 1 || stored === 2 || stored === 3 || stored === 4) return stored;
  return 1;
}

export async function setGame1Level(childId: string, level: Game1Level): Promise<void> {
  await adapters.storage.set(KEY_PREFIX + childId, level);
}
