// The real RedactionPort (F.006). TECH-DECISIONS.md § Face detection & blur:
// "Blur destructively. Mosaic the region (downsample and scale back up)
// then apply a canvas blur pass, on the actual pixel buffer — not a CSS
// overlay, which redacts nothing."
//
// This file is deliberately thin: read the ImageBitmap into a pixel
// buffer, hand it to the pure redactPixelsInPlace() (imaging/pixelBuffer.ts,
// which is where all the actual "is this destroyed" logic lives and is
// unit tested), write the mutated buffer back out. See that file's header
// for why the split exists — this file itself can't be exercised in the
// Node smoke-test environment because it needs a real Canvas.
//
// Vendor/DOM boundary: this is the only file that touches the Canvas 2D
// API for redaction. Nothing outside src/adapters/** may do this — see
// ARCHITECTURE-RULES.md.

import type { RedactionPort } from '../ports';
import { redactPixelsInPlace } from '../imaging/pixelBuffer';
import { bitmapToCanvas, canvasToImageBitmap, canvasToPixelBuffer, putPixelBuffer } from '../imaging/canvasUtils';

export function createCanvasMosaic(): RedactionPort {
  return {
    async redactRegions(image, regions) {
      const canvas = bitmapToCanvas(image);
      const buffer = canvasToPixelBuffer(canvas);
      redactPixelsInPlace(buffer, regions);
      putPixelBuffer(canvas, buffer);
      return canvasToImageBitmap(canvas);
    },
  };
}
