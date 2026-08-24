// The room as three photos instead of one. Pure logic — see
// scripts/smoke-game1-quests.ts.
//
// WHY THREE SEPARATE SHOTS AND NOT A PANORAMA
// -------------------------------------------
// A stitched 360 needs a steady sweep, even lighting and a mostly static
// scene. A cluttered bedroom with a toddler in it has none of those, and a
// failed stitch fails at the worst possible moment — after the caregiver
// has already done the work. Three ordinary photos cannot fail to stitch,
// because they are never stitched: the joining happens in CSS, where a
// crooked shot is merely a crooked shot.
//
// It also gives the caregiver something a panorama cannot: control over
// what is included. They shoot the three sides they want the child moving
// around in and leave out the rest of the house.
//
// WHAT THE WALLS ARE FOR
// ----------------------
// Direction. Once an object is pinned to a wall, the caregiver can point:
// "it's on the shelf behind you." That is the whole benefit — it turns the
// on-screen picture into a tool for steering a child around a real room,
// which is the F.009 prompt hierarchy's "gesture" tier made possible for a
// caregiver who cannot see what the app is thinking.

import type { VisionScene } from '../../adapters/ports';
import type { TaggedCrop } from '../../types';

/** Left, ahead, right, as seen by someone standing still and turning. */
export const WALLS = [0, 1, 2] as const;
export type WallIndex = (typeof WALLS)[number];

/** Caregiver-facing wall names. Not shown to the child. */
export const WALL_LABELS: Record<WallIndex, string> = {
  0: 'On your left',
  1: 'Straight ahead',
  2: 'On your right',
};

/** Shorter form, for the tag over a thumbnail. */
export const WALL_SHORT: Record<WallIndex, string> = {
  0: 'Left',
  1: 'Ahead',
  2: 'Right',
};

export interface WallCapture {
  wall: WallIndex;
  crops: TaggedCrop[];
  scene?: VisionScene;
}

/** A crop plus the wall it was photographed on. */
export interface PlacedCrop {
  crop: TaggedCrop;
  wall: WallIndex;
  /** Centre of the crop's bbox as a fraction of its wall, 0-1. Used to
   * position the icon on the panorama. Falls back to the middle when the
   * scene is missing, which is what fixtures do. */
  x: number;
  y: number;
}

export function isWallIndex(n: number): n is WallIndex {
  return n === 0 || n === 1 || n === 2;
}

/**
 * Flattens the per-wall captures into one placed set.
 *
 * Crop ids are namespaced by wall. Two walls of the same bedroom routinely
 * contain two blue cups, and the vision adapter numbers crops per call —
 * so without this, wall 2's first crop and wall 0's first crop can collide
 * and the tray would treat one arriving cup as satisfying both. Everything
 * downstream (the tray, `acceptsCrop`, the dead-crop set) keys off id, so
 * this has to happen once, here, at the join.
 */
export function placeCrops(captures: WallCapture[]): PlacedCrop[] {
  const out: PlacedCrop[] = [];
  for (const cap of captures) {
    const w = cap.scene?.width ?? 0;
    const h = cap.scene?.height ?? 0;
    for (const crop of cap.crops) {
      const box = crop.bbox;
      const cx = w > 0 ? (box.x + box.width / 2) / w : 0.5;
      const cy = h > 0 ? (box.y + box.height / 2) / h : 0.5;
      out.push({
        crop: { ...crop, id: `w${cap.wall}-${crop.id}` },
        wall: cap.wall,
        // Kept off the very edges: an icon centred on 0 or 1 is half
        // outside its wall, and on the angled side walls that is exactly
        // where it becomes unreadable.
        x: clamp01(cx, 0.08),
        y: clamp01(cy, 0.12),
      });
    }
  }
  return out;
}

function clamp01(v: number, inset: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(1 - inset, Math.max(inset, v));
}

export function cropsOf(placed: PlacedCrop[]): TaggedCrop[] {
  return placed.map((p) => p.crop);
}

export function onWall(placed: PlacedCrop[], wall: WallIndex): PlacedCrop[] {
  return placed.filter((p) => p.wall === wall);
}

/** Which wall a given object is on, so the caregiver can point at it. */
export function wallOf(placed: PlacedCrop[], cropId: string): WallIndex | null {
  const hit = placed.find((p) => p.crop.id === cropId);
  return hit ? hit.wall : null;
}

/** A caregiver-facing direction for one object, e.g. "On your left".
 * Returns null when the object is not placed, so the caller can simply
 * omit the hint rather than print a wrong one. */
export function directionFor(placed: PlacedCrop[], cropId: string): string | null {
  const wall = wallOf(placed, cropId);
  return wall === null ? null : WALL_LABELS[wall];
}

/** Whether enough of the room has been photographed to start.
 *
 * ONE wall is enough. Requiring all three would make a caregiver with a
 * single usable photo unable to play at all, and §11's whole posture is
 * that a thinner capture degrades quietly instead of blocking. Two walls
 * read as a corner, three as a bay; one is just the room as it is today. */
export function canStart(captures: WallCapture[]): boolean {
  return captures.some((c) => c.crops.length > 0);
}
