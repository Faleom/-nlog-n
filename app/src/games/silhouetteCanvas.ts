// Browser-only Canvas glue for F.021's silhouette generation. Thin on
// purpose, same split as adapters/redaction/canvasMosaic.ts vs
// adapters/imaging/pixelBuffer.ts: all the actual pixel logic lives in
// silhouette.ts's computeSilhouette (pure, unit tested); this file just
// gets a crop's data URL onto a canvas, calls that, and re-encodes the
// result. Not exercised by the automated smoke suite — no DOM in Node.
//
// Reuses adapters/imaging/canvasUtils.ts's helpers rather than
// duplicating canvas boilerplate — legitimate cross-import since this
// isn't a vendor SDK, just this app's own thin wrapper functions.

import { canvasToDataUrl, canvasToPixelBuffer, putPixelBuffer } from '../adapters/imaging/canvasUtils';
import { computeSilhouette, type SilhouetteOptions } from './silhouette';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load crop image for silhouette generation'));
    img.src = dataUrl;
  });
}

/**
 * Turns a crop's `image` data URL into a silhouette data URL (PNG, so
 * transparency survives). §8.3: "generated client-side from the crop
 * (threshold + fill). No extra API cost, no latency."
 */
export async function generateSilhouetteDataUrl(
  cropImageDataUrl: string,
  options?: SilhouetteOptions,
): Promise<string> {
  const img = await loadImage(cropImageDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(img, 0, 0);

  const buffer = canvasToPixelBuffer(canvas);
  const silhouette = computeSilhouette(buffer, options);
  putPixelBuffer(canvas, silhouette);

  return canvasToDataUrl(canvas, 'image/png');
}
