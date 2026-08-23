// Pure box-mapping math for the §4.4 face-blur pipeline: "downscale to
// ≤1024px long edge → detect on the downscaled image → map boxes back →
// blur at full resolution → then send." This file is exactly the "map
// boxes back" step, plus the scale-factor arithmetic that makes it
// possible, extracted so it's testable without BlazeFace or a browser at
// all — see scripts/smoke-f006.ts.
//
// adapters/face/blazeFaceLocal.ts is the thin adapter that actually runs
// the model; it calls these functions rather than doing this arithmetic
// inline, so the arithmetic can be verified independently of whether the
// model can even load in the current environment (it cannot, in this
// sandbox — see the file header there).

import type { Region } from '../../types';
import type { Size } from '../imaging/regionMath';

/** §4.4's constant: nothing above this on the long edge needs to reach
 * detection (or, separately but identically, the vision model). */
export const DETECTION_MAX_LONG_EDGE = 1024;

/**
 * The factor to shrink `size` by so its long edge is at most `maxLongEdge`.
 * Returns 1 (no-op) if the image is already within bounds — this function
 * never upscales, since upscaling before detection would just invent
 * detail that was never in the photo.
 */
export function computeDownscaleFactor(size: Size, maxLongEdge = DETECTION_MAX_LONG_EDGE): number {
  const longEdge = Math.max(size.width, size.height);
  if (longEdge <= maxLongEdge) return 1;
  return maxLongEdge / longEdge;
}

/** The pixel dimensions of `size` after applying `factor`, rounded to
 * whole pixels (canvases don't have fractional pixels). */
export function scaledSize(size: Size, factor: number): Size {
  return {
    width: Math.max(1, Math.round(size.width * factor)),
    height: Math.max(1, Math.round(size.height * factor)),
  };
}

/**
 * Maps a box found on the DOWNSCALED image back into full-resolution pixel
 * space, given the same `factor` used to produce that downscaled image
 * (i.e. downscaledPixels = fullResPixels * factor). This is the one piece
 * of arithmetic that, if it's wrong, means every blur lands in the wrong
 * place on the real photo while looking correct on the small one used for
 * detection — exactly the failure mode §4.4 budgets half a day to get
 * right.
 */
export function mapRegionToFullRes(region: Region, factor: number): Region {
  if (factor <= 0) throw new Error(`mapRegionToFullRes: invalid factor ${factor}`);
  const inv = 1 / factor;
  return {
    x: region.x * inv,
    y: region.y * inv,
    width: region.width * inv,
    height: region.height * inv,
  };
}
