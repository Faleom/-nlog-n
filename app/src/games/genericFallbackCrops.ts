// §11 / F.006: "Recognition returns nothing usable → fall back to generic
// age-appropriate activities for the chosen context. Never show an
// error — the flow continues, quietly degraded." Also covers §4.4's
// "camera permission denied → both branches still fully usable" and the
// demo-day API-outage fallback (TECH-DECISIONS.md § Demo-day resilience).
//
// This is intentionally a SMALL, minimal safety net owned by Game 1 —
// not F.007's real object → skill → steps lookup table (P3's job, a much
// larger ~15-object x 3-4-template authoring effort per §7.5). If F.007
// lands, Game 1 should prefer whatever richer generic set it provides;
// this file exists so Game 1 degrades gracefully even if F.007 hasn't
// landed yet, or if a real capture genuinely fails.
//
// No `image` data URL for these — they render as plain colour swatches in
// Game1.tsx's child-facing grid (see renderCropVisual), which stays zero-
// text either way.

import type { TaggedCrop } from '../types';

// TWO COLOURS APPEAR TWICE, ON PURPOSE.
//
// Levels 3-5 group objects by a shared trait (games/game1/quests.ts), and
// a group needs at least two members to exist at all. The original
// four-object set had four DIFFERENT colours, so it could only ever
// support a level-3 collection by category -- a caregiver who denied
// camera permission and chose level 4 or 5 silently got level 3 every
// time, with nothing on screen explaining why.
//
// Red and blue each appear twice here, which gives buildQuest two colour
// groups to add across. That is what makes the whole ladder reachable on
// the degraded path, which TECH-DECISIONS.md's demo-day resilience note
// cares about specifically: the fallback has to be able to show the
// feature, not just avoid crashing.
export const GENERIC_FALLBACK_CROPS: TaggedCrop[] = [
  { id: 'generic-cup', name: 'cup', colour: 'red', category: 'drinkware', function: 'drink from', bbox: { x: 0, y: 0, width: 1, height: 1 }, image: '' },
  { id: 'generic-plate', name: 'plate', colour: 'red', category: 'tableware', function: 'eat from', bbox: { x: 0, y: 0, width: 1, height: 1 }, image: '' },
  { id: 'generic-ball', name: 'ball', colour: 'blue', category: 'toy', function: 'play with', bbox: { x: 0, y: 0, width: 1, height: 1 }, image: '' },
  { id: 'generic-blanket', name: 'blanket', colour: 'blue', category: 'textile', function: 'snuggle', bbox: { x: 0, y: 0, width: 1, height: 1 }, image: '' },
  { id: 'generic-shoe', name: 'shoe', colour: 'white', category: 'clothing', function: 'wear', bbox: { x: 0, y: 0, width: 1, height: 1 }, image: '' },
  { id: 'generic-book', name: 'book', colour: 'yellow', category: 'toy', function: 'read', bbox: { x: 0, y: 0, width: 1, height: 1 }, image: '' },
];
