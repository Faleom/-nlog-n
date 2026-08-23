// Browser-only Canvas glue. Deliberately thin and deliberately NOT unit
// tested here — there is no DOM in the Node smoke-test environment. Every
// function in this file is a dumb wrapper around the 2D canvas API; the
// actual logic it calls (redactPixelsInPlace, mapRegionToFullRes, etc.)
// lives in pure files next to this one that ARE unit tested. See
// pixelBuffer.ts and faceGeometry.ts headers for why the split exists, and
// this file's own module doc in PERSON-2's final report for what a human
// still needs to verify in a real browser.

import type { PixelBuffer } from './pixelBuffer';
import type { Size } from './regionMath';

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

/** Draws an ImageBitmap onto a same-size canvas so its pixels are
 * readable/writable. Does not close the bitmap — the caller owns that. */
export function bitmapToCanvas(image: ImageBitmap): HTMLCanvasElement {
  const canvas = newCanvas(image.width, image.height);
  context2d(canvas).drawImage(image, 0, 0);
  return canvas;
}

/** Draws `image` onto a canvas scaled to `targetSize`. Used for the
 * detection-resolution downscale (§4.4) and the pre-transmission downscale
 * (TECH-DECISIONS.md "Large photo files"). */
export function drawScaled(image: ImageBitmap, targetSize: Size): HTMLCanvasElement {
  const canvas = newCanvas(targetSize.width, targetSize.height);
  context2d(canvas).drawImage(image, 0, 0, targetSize.width, targetSize.height);
  return canvas;
}

export function canvasToPixelBuffer(canvas: HTMLCanvasElement): PixelBuffer {
  const ctx = context2d(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: imageData.width, height: imageData.height, data: imageData.data };
}

export function putPixelBuffer(canvas: HTMLCanvasElement, buffer: PixelBuffer): void {
  const ctx = context2d(canvas);
  const imageData = new ImageData(buffer.data, buffer.width, buffer.height);
  ctx.putImageData(imageData, 0, 0);
}

export async function canvasToImageBitmap(canvas: HTMLCanvasElement): Promise<ImageBitmap> {
  return createImageBitmap(canvas);
}

/** Cuts a sub-rectangle of `canvas` into its own small canvas — used to
 * produce a single crop's `image` data URL from a full room photo. */
export function cropCanvas(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; width: number; height: number },
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(region.width));
  const height = Math.max(1, Math.round(region.height));
  const out = newCanvas(width, height);
  context2d(out).drawImage(
    canvas,
    Math.round(region.x),
    Math.round(region.y),
    width,
    height,
    0,
    0,
    width,
    height,
  );
  return out;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, mediaType = 'image/jpeg', quality = 0.85): string {
  return canvas.toDataURL(mediaType, quality);
}

/** Base64 payload (no `data:...;base64,` prefix) for sending over the
 * wire — the shape api/claude.ts's VisionRequest expects. */
export function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}
