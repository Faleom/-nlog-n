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

import { createFixtureCapture } from './fixtures/fixtureCapture';
import { createFixtureFaceDetect } from './fixtures/fixtureFaceDetect';
import { createFixtureRedaction } from './fixtures/fixtureRedaction';
import { createFixtureVision } from './fixtures/fixtureVision';
import { createFixtureTextGen } from './fixtures/fixtureTextGen';
import { createFixtureSpeechOut } from './fixtures/fixtureSpeechOut';
import { createInMemoryStorage } from './fixtures/inMemoryStorage';
import type { AdapterRegistry } from './ports';

// -----------------------------------------------------------------------
// Swap points. As each file lands, replace the fixture import + call with
// the real one, e.g.:
//
//   import { createDeviceCamera } from './capture/deviceCamera';
//   capture: createDeviceCamera(),
// -----------------------------------------------------------------------

export const adapters: AdapterRegistry = {
  capture: createFixtureCapture(), // TODO(F.006): swap for DeviceCamera
  faceDetect: createFixtureFaceDetect(), // TODO(F.006): swap for BlazeFaceLocal — NEVER a network adapter
  redaction: createFixtureRedaction(), // TODO(F.006): swap for CanvasMosaic
  vision: createFixtureVision(), // TODO(F.006): swap for ClaudeVision
  textGen: createFixtureTextGen(), // TODO(F.015): swap for HaikuCard
  speechOut: createFixtureSpeechOut(), // TODO(F.010): swap for WebSpeechOut
  storage: createInMemoryStorage(), // TODO(F.001): swap for IndexedDbStorage
};
