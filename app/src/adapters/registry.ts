// The adapter registry. The ONLY file where a port is wired to a concrete
// adapter. See ../../plan/engineering/ARCHITECTURE-RULES.md
// "Adapter selection is configuration, not code".
//
// Everything defaults to fixture adapters so the app runs end-to-end from
// hour zero. Swap a line in as your real adapter lands — nothing outside
// this file needs to change.
//
// DO NOT import a vendor SDK here directly for anything except constructing
// the real adapter — the real adapter's own file (e.g.
// adapters/vision/claudeVision.ts) is where the vendor import lives, per
// the oxlint no-restricted-imports rule.

import { createDeviceCamera } from './capture/deviceCamera';
import { createBlazeFaceLocal } from './face/blazeFaceLocal';
import { createCanvasMosaic } from './redaction/canvasMosaic';
import { createClaudeVision } from './vision/claudeVision';
import { createFixtureTextGen } from './fixtures/fixtureTextGen';
import { createFixtureSpeechOut } from './fixtures/fixtureSpeechOut';
import { createIndexedDbStorage } from './storage/indexedDbStorage';
import type { AdapterRegistry } from './ports';

// -----------------------------------------------------------------------
// Swap points. As each file lands, replace the fixture import + call with
// the real one, e.g.:
//
//   import { createDeviceCamera } from './capture/deviceCamera';
//   capture: createDeviceCamera(),
// -----------------------------------------------------------------------

export const adapters: AdapterRegistry = {
  capture: createDeviceCamera(), // F.006 — done. getUserMedia in-app viewfinder, file-input fallback.
  faceDetect: createBlazeFaceLocal(), // F.006 — done. Local BlazeFace, never a network adapter.
  redaction: createCanvasMosaic(), // F.006 — done. Destructive mosaic + blur on the actual pixel buffer.
  vision: createClaudeVision(), // F.006 — done. claude-sonnet-5 via the serverless proxy, redacted image only.
  textGen: createFixtureTextGen(), // TODO(F.015): swap for HaikuCard
  speechOut: createFixtureSpeechOut(), // TODO(F.010): swap for WebSpeechOut
  storage: createIndexedDbStorage(), // F.001 — done. Real, on-device, persists across restarts.
};
