// The single most important guarantee in the whole app (§13: faces must
// never reach the network unblurred). This file is the PURE pixel math —
// plain typed arrays in, mutated typed arrays out. No canvas, no DOM, no
// ImageBitmap. That's deliberate: it makes the actual redaction
// transformation fully unit-testable in Node with fabricated pixel data
// (see scripts/smoke-f006.ts), independent of whether a browser exists.
//
// adapters/redaction/canvasMosaic.ts is the thin Canvas-API wrapper that
// reads an ImageBitmap into a PixelBuffer, calls redactPixelsInPlace here,
// and writes the result back out. All the actual "does this destroy the
// face" logic lives in this file, not there.
//
// The transform is destructive and irreversible by construction: every
// pixel inside a redacted block is overwritten with the block's own
// average colour, so the original per-pixel detail is gone from the
// buffer — there is nothing left to "un-blur". A best-effort Gaussian-ish
// box blur pass then softens the mosaic's hard block edges; it is not what
// provides the privacy guarantee (the averaging is), it's cosmetic.

import type { Region } from '../../types';
import { isEmptyRegion, padRegion, type Size } from './regionMath';

export interface PixelBuffer {
  width: number;
  height: number;
  /** RGBA, length must equal width * height * 4. Pinned to the
   * `ArrayBuffer`-backed generic (not the wider `ArrayBufferLike`, which
   * also covers `SharedArrayBuffer`) because `ImageData`'s constructor —
   * used in canvasUtils.ts's putPixelBuffer — only accepts that narrower
   * type. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** How much bigger than the detected box to redact — see regionMath.ts
 * header for why face regions are padded before blurring. */
export const FACE_REDACT_PADDING_FRACTION = 0.35;

/** Mosaic block size in source pixels. Bigger = more destructive, coarser. */
const DEFAULT_BLOCK_SIZE = 14;

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

/**
 * Destructively mosaics one region of `buffer` in place: divides it into
 * `blockSize`-square blocks and overwrites every pixel in each block with
 * that block's own average RGBA. Irreversible — the per-pixel detail inside
 * the region is gone once this returns.
 */
function mosaicBlock(buffer: PixelBuffer, region: Region, blockSize: number): void {
  const x0 = Math.floor(region.x);
  const y0 = Math.floor(region.y);
  const x1 = Math.min(buffer.width, Math.ceil(region.x + region.width));
  const y1 = Math.min(buffer.height, Math.ceil(region.y + region.height));

  for (let by = y0; by < y1; by += blockSize) {
    for (let bx = x0; bx < x1; bx += blockSize) {
      const blockX1 = Math.min(x1, bx + blockSize);
      const blockY1 = Math.min(y1, by + blockSize);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let count = 0;

      for (let py = by; py < blockY1; py++) {
        for (let px = bx; px < blockX1; px++) {
          const i = (py * buffer.width + px) * 4;
          sumR += buffer.data[i];
          sumG += buffer.data[i + 1];
          sumB += buffer.data[i + 2];
          sumA += buffer.data[i + 3];
          count++;
        }
      }
      if (count === 0) continue;

      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);
      const avgA = Math.round(sumA / count);

      for (let py = by; py < blockY1; py++) {
        for (let px = bx; px < blockX1; px++) {
          const i = (py * buffer.width + px) * 4;
          buffer.data[i] = avgR;
          buffer.data[i + 1] = avgG;
          buffer.data[i + 2] = avgB;
          buffer.data[i + 3] = avgA;
        }
      }
    }
  }
}

/**
 * Cosmetic softening pass: a small box blur confined to `region`, applied
 * AFTER mosaicking. Reads from a snapshot of the buffer taken before this
 * pass so the blur doesn't compound on itself pixel-by-pixel as it sweeps.
 * Purely visual — removing this call would not weaken the privacy
 * guarantee, since mosaicBlock() has already destroyed the original detail.
 */
function boxBlurRegion(buffer: PixelBuffer, region: Region, radius = 2): void {
  const x0 = Math.floor(region.x);
  const y0 = Math.floor(region.y);
  const x1 = Math.min(buffer.width, Math.ceil(region.x + region.width));
  const y1 = Math.min(buffer.height, Math.ceil(region.y + region.height));
  if (x1 <= x0 || y1 <= y0) return;

  const snapshot = Uint8ClampedArray.from(buffer.data);

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const sx = px + dx;
          const sy = py + dy;
          if (sx < x0 || sx >= x1 || sy < y0 || sy >= y1) continue;
          const i = (sy * buffer.width + sx) * 4;
          sumR += snapshot[i];
          sumG += snapshot[i + 1];
          sumB += snapshot[i + 2];
          sumA += snapshot[i + 3];
          count++;
        }
      }
      const i = (py * buffer.width + px) * 4;
      buffer.data[i] = clampByte(Math.round(sumR / count));
      buffer.data[i + 1] = clampByte(Math.round(sumG / count));
      buffer.data[i + 2] = clampByte(Math.round(sumB / count));
      buffer.data[i + 3] = clampByte(Math.round(sumA / count));
    }
  }
}

/**
 * The redaction entry point. Pads each region generously (over-blur, never
 * under-blur — see regionMath.ts), mosaics it destructively, then softens
 * the block edges with a cosmetic blur pass. Mutates `buffer.data` in
 * place; returns nothing, because there is no non-destructive variant of
 * this function to return instead.
 *
 * Empty/degenerate regions (e.g. a detection right at the image edge that
 * clamped to zero area) are skipped rather than throwing — a zero-area
 * "region" redacting nothing is not a redaction failure.
 */
export function redactPixelsInPlace(
  buffer: PixelBuffer,
  regions: readonly Region[],
  opts: { paddingFraction?: number; blockSize?: number } = {},
): void {
  const paddingFraction = opts.paddingFraction ?? FACE_REDACT_PADDING_FRACTION;
  const blockSize = opts.blockSize ?? DEFAULT_BLOCK_SIZE;
  const imageSize: Size = { width: buffer.width, height: buffer.height };

  for (const region of regions) {
    const padded = padRegion(region, imageSize, paddingFraction);
    if (isEmptyRegion(padded)) continue;
    mosaicBlock(buffer, padded, blockSize);
    boxBlurRegion(buffer, padded);
  }
}

/** Mean of R,G,B at one pixel — used by tests to check "is this still red". */
export function pixelAt(buffer: PixelBuffer, x: number, y: number): [number, number, number, number] {
  const i = (y * buffer.width + x) * 4;
  return [buffer.data[i], buffer.data[i + 1], buffer.data[i + 2], buffer.data[i + 3]];
}
