// The real FaceDetectPort (F.006). TECH-DECISIONS.md § Face detection &
// blur: "BlazeFace via TensorFlow.js, in the browser... downscale to
// ≤1024px → detect on the downscaled image → map boxes back → blur at
// full resolution → then send."
//
// LOCAL ONLY, per ARCHITECTURE-RULES.md — this must never be swapped for a
// network adapter. Nothing in this file makes a fetch() call, and nothing
// ever will; that's the whole §13 guarantee.
//
// ⚠ VERIFICATION STATUS — read before trusting this file:
// This adapter could NOT be run end-to-end in this sandbox. A spike
// (roughly 20 minutes, per the brief's own budget) got as far as: BlazeFace
// downloads and loads its model successfully under @tensorflow/tfjs-node
// (confirms the model URL and load path are reachable), but
// model.estimateFaces() then throws inside a transitive dependency
// (`util.isNullOrUndefined is not a function`) — a Node-version
// incompatibility in an old dependency of @tensorflow-models/blazeface
// 0.1.0, unrelated to anything in this file, that only shows up in a
// server-side Node runtime with a very new Node version. Browsers don't
// have this problem because they never touch that Node `util` module at
// all — @tensorflow/tfjs (the browser backend actually wired into the app)
// doesn't depend on it.
// What IS verified (see scripts/smoke-f006.ts): every piece of pure
// arithmetic this file calls — computeDownscaleFactor, scaledSize,
// mapRegionToFullRes — is unit tested directly with plain numbers, with no
// model involved. What is NOT verified by automation: that BlazeFace's
// actual detections, run for real on the downscaled canvas in a browser,
// come back in the coordinate space this file assumes (a normalised or
// pixel box relative to the INPUT canvas it was given — see the mapping
// below). A human must open this in a real browser, photograph a face, and
// confirm the blur lands on the face, not offset from it. That check is
// listed explicitly in PERSON-2's final report.

// Side-effect import only: @tensorflow/tfjs registers the CPU/WebGL
// backends that @tensorflow-models/blazeface (which depends only on
// @tensorflow/tfjs-core) needs but doesn't bundle itself. No binding is
// used from it directly in this file.
import '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import type { Region } from '../../types';
import type { FaceDetectPort } from '../ports';
import { DETECTION_MAX_LONG_EDGE, computeDownscaleFactor, mapRegionToFullRes, scaledSize } from './faceGeometry';
import { drawScaled } from '../imaging/canvasUtils';

let modelPromise: Promise<blazeface.BlazeFaceModel> | null = null;

function getModel(): Promise<blazeface.BlazeFaceModel> {
  // Loaded once, reused across every capture this session — the ~400KB
  // model download only happens the first time (TECH-DECISIONS.md
  // "Reliability: ~400KB model, cached after first load").
  if (!modelPromise) {
    modelPromise = blazeface.load();
  }
  return modelPromise;
}

export function createBlazeFaceLocal(): FaceDetectPort {
  return {
    async findFaces(image: ImageBitmap): Promise<Region[]> {
      const model = await getModel();

      const factor = computeDownscaleFactor(
        { width: image.width, height: image.height },
        DETECTION_MAX_LONG_EDGE,
      );
      const targetSize = scaledSize({ width: image.width, height: image.height }, factor);
      const detectionCanvas = drawScaled(image, targetSize);

      // returnTensors=false — we only want plain box coordinates, not
      // tensors we'd have to remember to dispose.
      const predictions = await model.estimateFaces(detectionCanvas, false);

      const regions: Region[] = predictions.map((p) => {
        // BlazeFace's non-tensor prediction shape gives topLeft/bottomRight
        // as [x, y] pairs in the INPUT canvas's pixel space (i.e. already
        // relative to detectionCanvas, not normalised 0..1) — see the
        // @tensorflow-models/blazeface type defs. Convert to our Region
        // shape (x, y, width, height) in that same downscaled space first.
        const topLeft = p.topLeft as [number, number];
        const bottomRight = p.bottomRight as [number, number];
        const downscaledRegion: Region = {
          x: topLeft[0],
          y: topLeft[1],
          width: bottomRight[0] - topLeft[0],
          height: bottomRight[1] - topLeft[1],
        };
        // Map back to the ORIGINAL full-resolution image, per §4.4 — the
        // whole reason detection ran on a shrunk copy in the first place.
        return mapRegionToFullRes(downscaledRegion, factor);
      });

      // Deliberately NOT calling tf.disposeVariables() here — that would
      // dispose the loaded BlazeFace model's own weight tensors (they're
      // tf.Variables) and break every subsequent detection this session.
      // estimateFaces(..., false) already disposes its own intermediate
      // tensors when returnTensors is false, which is what keeps this
      // adapter leak-free across repeated calls without also destroying
      // the model.

      return regions;
    },
  };
}
