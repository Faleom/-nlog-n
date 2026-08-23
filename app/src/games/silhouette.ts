// F.021 — client-side silhouette generation (§8.3: "Silhouettes are
// generated client-side from the crop (threshold + fill). No extra API
// cost, no latency.") Split the same way F.006's redaction is split: the
// actual pixel transform is a PURE function over plain typed arrays (no
// canvas, no DOM), so it's unit-testable in Node with fabricated pixel
// data — see scripts/smoke-f021.ts. adapters aren't involved here at all
// (this isn't an external capability behind a port — it's pure local
// image math, like fading.ts or interactionMachine.ts), so it lives next
// to the games that use it rather than under src/adapters/.
//
// HONEST LIMITATION, stated plainly rather than overclaimed: real object-
// silhouette extraction (a clean outline cut from an arbitrary photo's
// background) is a hard computer-vision problem — this is NOT that. It's
// a per-pixel luminance threshold: darker pixels become solid black,
// lighter pixels become transparent. On a well-lit object against a
// plainer background this reads as a recognisable silhouette; on a
// cluttered or low-contrast photo it won't cleanly outline the object.
// That's an accepted, explicit tradeoff for a 48-hour build, not a bug —
// see PERSON-2's final report.

import type { PixelBuffer } from '../adapters/imaging/pixelBuffer';

export interface SilhouetteOptions {
  /** 0-255 luminance threshold. Pixels darker than this become the
   * silhouette (opaque near-black); pixels at or above it become fully
   * transparent. */
  threshold?: number;
  /** Some photos are a light object on a dark background (the opposite of
   * the default assumption) — invert flips which side of the threshold
   * becomes the silhouette. */
  invert?: boolean;
}

const DEFAULT_THRESHOLD = 128;

/** Standard perceptual luminance weighting (ITU-R BT.601) — the same
 * formula used by most simple grayscale/threshold filters. */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Pure: takes a source pixel buffer, returns a NEW buffer of the same
 * dimensions where every pixel is either opaque near-black (the
 * silhouette) or fully transparent (alpha 0) — never anything in between,
 * and never a colour other than near-black, which is what makes the
 * result an actual silhouette shape rather than a tinted photo. Does not
 * mutate its input (unlike pixelBuffer.ts's redaction, which is
 * deliberately destructive on the SAME buffer — this has no reason to be;
 * the source crop still needs to exist afterward for the "reward: the
 * silhouette dissolves into the real photo" reveal).
 */
export function computeSilhouette(source: PixelBuffer, options: SilhouetteOptions = {}): PixelBuffer {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const data = new Uint8ClampedArray(source.data.length) as Uint8ClampedArray<ArrayBuffer>;

  for (let i = 0; i < source.data.length; i += 4) {
    const r = source.data[i];
    const g = source.data[i + 1];
    const b = source.data[i + 2];
    const a = source.data[i + 3];
    const lum = luminance(r, g, b);
    const darkSide = lum < threshold;
    const isSilhouette = a > 0 && (options.invert ? !darkSide : darkSide);

    if (isSilhouette) {
      data[i] = 20;
      data[i + 1] = 20;
      data[i + 2] = 20;
      data[i + 3] = 255;
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }

  return { width: source.width, height: source.height, data };
}

/** Fraction of pixels (0-1) that ended up part of the silhouette — useful
 * both for tests (a degenerate all-transparent or all-opaque result is a
 * sign the threshold is wrong for that image) and, potentially, for a
 * caller wanting to skip an unusably sparse/dense silhouette. Not wired
 * into the real adapter for Tier 2 — flagged as a nice-to-have, not built. */
export function silhouetteCoverage(silhouette: PixelBuffer): number {
  let opaqueCount = 0;
  const totalPixels = silhouette.width * silhouette.height;
  for (let i = 3; i < silhouette.data.length; i += 4) {
    if (silhouette.data[i] > 0) opaqueCount++;
  }
  return totalPixels === 0 ? 0 : opaqueCount / totalPixels;
}
