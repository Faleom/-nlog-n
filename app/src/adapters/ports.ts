// The capability ports. See ../../plan/engineering/ARCHITECTURE-RULES.md.
//
// Every external capability sits behind one of these. Nothing outside
// src/adapters/** may import a vendor SDK directly — the oxlint config
// enforces this. A feature file talks to a port; it never knows which
// adapter is wired in.

import type { Region, TaggedCrop } from '../types';

export interface CapturePort {
  /** Opens the device camera and returns a full-resolution photo. */
  capturePhoto(): Promise<ImageBitmap>;
}

export interface FaceDetectPort {
  /**
   * Finds faces in an image. LOCAL ONLY — never swap this for a network
   * adapter. This is a §13 guarantee, not a preference: the whole "faces
   * are blurred before anything is sent" claim depends on this running
   * on-device before any transmission happens.
   */
  findFaces(image: ImageBitmap): Promise<Region[]>;
}

export interface RedactionPort {
  /** Destructively blurs the given regions. Returns a new image. */
  redactRegions(image: ImageBitmap, regions: Region[]): Promise<ImageBitmap>;
}

export interface VisionPort {
  /**
   * Sends an already-redacted image for object recognition and returns
   * tagged crops. The image must already have faces blurred — this port
   * does not check that; the caller (F.006's pipeline) is responsible for
   * calling FaceDetectPort + RedactionPort first, always.
   */
  recognizeObjects(image: ImageBitmap): Promise<TaggedCrop[]>;
}

export interface TextGenPort {
  /**
   * Generates a Branch 2 question card from the three guided-prompt
   * answers. Must apply the §9.4 post-generation guardrail internally and
   * throw a GuardrailFailedError if it fails — callers fall back to
   * RawTextCard (see adapters/textgen/rawTextCard.ts).
   */
  generateCard(answers: {
    whatNoticed: string;
    whenNoticed: string;
    whatItLooksLike: string;
    childAgeMonths: number;
  }): Promise<string>;
}

export class GuardrailFailedError extends Error {
  constructor() {
    super('Card generation failed the §9.4 post-generation guardrail.');
    this.name = 'GuardrailFailedError';
  }
}

export interface SpeechOutPort {
  /** Speaks a line of text aloud. Must resolve when speech finishes. */
  say(text: string, opts?: { rate?: number }): Promise<void>;
}

export interface StoragePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * The registry. This is the ONLY file where adapters are wired to ports.
 * Swapping an adapter is editing one line here — see ARCHITECTURE-RULES.md
 * "Adapter selection is configuration, not code".
 *
 * Defaults to fixture adapters so the app runs out of the box before any
 * real adapter is written. Each person swaps their own port's line in as
 * their file lands.
 */
export interface AdapterRegistry {
  capture: CapturePort;
  faceDetect: FaceDetectPort;
  redaction: RedactionPort;
  vision: VisionPort;
  textGen: TextGenPort;
  speechOut: SpeechOutPort;
  storage: StoragePort;
}
