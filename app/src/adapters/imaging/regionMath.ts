// Pure region/box arithmetic shared by the face-blur path and the vision
// crop path (F.006). No DOM, no canvas, no vendor SDK — trivially
// unit-testable in Node. See scripts/smoke-f006.ts.
//
// Two independent uses of "pad a box generously" live in this app, and both
// route through here so the rule is defined once:
//   - Face regions: BlazeFace's box is tight to facial landmarks and misses
//     hair/ears/chin at extreme angles. Padding before redaction means we
//     over-blur rather than under-blur — see TECH-DECISIONS.md "Fail closed".
//   - Vision crop bboxes: Claude localises loosely (TECH-DECISIONS.md
//     "bbox precision" — mitigation #1 is "pad the boxes generously").

import type { Region } from '../../types';

export interface Size {
  width: number;
  height: number;
}

/**
 * Grows a region by `fraction` of its own size on every side (e.g. 0.25 =
 * 25% bigger in each direction), then clamps to the image bounds. Never
 * shrinks. Never produces a negative x/y or a box that overhangs the image.
 */
export function padRegion(region: Region, imageSize: Size, fraction: number): Region {
  const padX = region.width * fraction;
  const padY = region.height * fraction;
  const padded: Region = {
    x: region.x - padX,
    y: region.y - padY,
    width: region.width + padX * 2,
    height: region.height + padY * 2,
  };
  return clampRegion(padded, imageSize);
}

/**
 * Clamps a region to fit entirely within [0, imageSize]. Shrinks width/
 * height rather than merely translating x/y, so the returned box never
 * extends past the image edge on either side.
 */
export function clampRegion(region: Region, imageSize: Size): Region {
  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  const maxWidth = imageSize.width - x;
  const maxHeight = imageSize.height - y;
  // If the box started off-canvas to the left/top, its width/height must
  // shrink by however much x/y just moved, not just get clamped to the
  // full image size.
  const overshootX = x - region.x;
  const overshootY = y - region.y;
  const width = Math.max(0, Math.min(region.width - overshootX, maxWidth));
  const height = Math.max(0, Math.min(region.height - overshootY, maxHeight));
  return { x, y, width, height };
}

/** True if `region` has zero or negative area — a degenerate box that
 * should never be handed to a caller expecting something drawable. */
export function isEmptyRegion(region: Region): boolean {
  return region.width <= 0 || region.height <= 0;
}
