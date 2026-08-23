// The capability ports. See ../../plan/engineering/ARCHITECTURE-RULES.md.
//
// Every external capability sits behind one of these. Nothing outside
// src/adapters/** may import a vendor SDK directly — the oxlint config
// enforces this. A feature file talks to a port; it never knows which
// adapter is wired in.

import type { Region, SamenessAnswer, TaggedCrop } from '../types';

export interface CapturePort {
  /** Opens the device camera and returns a full-resolution photo. */
  capturePhoto(): Promise<ImageBitmap>;
}

/** Thrown by a CapturePort adapter specifically when the person closed the
 * picker/viewfinder without choosing a photo -- distinct from "no camera
 * available" or "permission denied" (any other rejection). Lets
 * myWorldPipeline.ts's capture-unavailable outcome carry a `cancelled`
 * flag, so a caller can tell "they changed their mind, stop and wait" from
 * "something's actually broken, degrade and keep going" -- see
 * CaptureRoomOutcome's doc comment in myWorldPipeline.ts. */
export class CaptureCancelledError extends Error {
  constructor() {
    super('Photo selection cancelled');
    this.name = 'CaptureCancelledError';
  }
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

/**
 * What a vision adapter hands back: the tagged crops, plus optionally the
 * exact image those crops' bboxes are measured against.
 *
 * `scene` exists so a caller can draw the objects back onto the room they
 * came from (Game 1's end-of-session recap). It is REDACTED and downscaled
 * — the same bytes that were transmitted, never the raw camera photo — and
 * it is the adapter's own transmitted image specifically because every
 * `TaggedCrop.bbox` is in that image's pixel space. Any other copy of the
 * room (a differently-scaled one, say) would put the boxes in the wrong
 * place, so this must be the adapter's, not one the caller re-derives.
 *
 * Optional: an adapter that has no meaningful scene to give (fixtures) just
 * omits it, and callers must render fine without it.
 */
export interface VisionScene {
  /** Data URL of the redacted, downscaled image. Never persisted. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface VisionResult {
  crops: TaggedCrop[];
  scene?: VisionScene;
}

export interface VisionPort {
  /**
   * Sends an already-redacted image for object recognition and returns
   * tagged crops. The image must already have faces blurred — this port
   * does not check that; the caller (F.006's pipeline) is responsible for
   * calling FaceDetectPort + RedactionPort first, always.
   */
  recognizeObjects(image: ImageBitmap): Promise<VisionResult>;
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

/** What Game 2 already has after F.006's pipeline runs -- deliberately
 * NOT the full TaggedCrop (id/bbox/image aren't needed to *generate* a
 * story; the caller re-attaches the real crop by matching `name` once the
 * structure comes back, see engine/game2Story.ts's resolveStoryStepObject). */
export interface DetectedObjectForStory {
  name: string;
  colour: string;
  category: string;
  function: string;
}

/** One step of a generated story. `sentence` still carries unfilled slot
 * tokens (e.g. "{companion}") -- rendering happens at display time via
 * engine/slots.ts, never baked in here, so a cached story stays valid
 * across profile edits. `objectRef` is the `.name` (case-insensitive) of
 * the detected object this step is about. */
export interface StoryStepTemplate {
  sentence: string;
  objectRef: string;
}

export interface GeneratedStoryTemplate {
  steps: StoryStepTemplate[]; // always 2-4, enforced by the real adapter
  /** Whether this came from the real model call or the deterministic
   * fallback. Load-bearing for caching (see engine/game2Story.ts's
   * getOrGenerateStory): a fallback result is cached so repeated failures
   * in quick succession don't hammer the API, but it is NEVER treated as
   * a durable cache hit -- the next attempt for the same photo always
   * gets a real chance to generate again. Without this, a single
   * transient failure (a network blip, a dev-environment gap) would
   * permanently entomb a generic fallback story for that photo forever,
   * even after whatever caused the failure is long fixed. */
  source: 'real' | 'fallback';
}

export interface StoryGenPort {
  /**
   * Generates a short, physically-plausible routine story from whichever
   * real objects were detected in the child's room photo. `stepCount`, if
   * given, is a caregiver-chosen exact target (still clamped to [2, 4] and
   * to however many real objects actually exist); omitted, it defaults to
   * 2-4 at the generator's own discretion. Must validate its own output
   * (right step count, every objectRef matches a detected object) and
   * throw StoryGenerationFailedError if invalid -- callers fall back to
   * the deterministic template adapter (see adapters/story/templateStory.ts),
   * same shape as TextGenPort's GuardrailFailedError contract above.
   */
  generateStory(input: {
    objects: DetectedObjectForStory[];
    childAgeMonths: number;
    sameness?: SamenessAnswer;
    stepCount?: number;
    /** §6.2/§6.4's Layer 4 hard exclusion. Callers must already exclude
     * any object matching these from `objects` (defense at the
     * object-selection layer) -- this is the second, independent layer,
     * telling the real generator to also never use these words in its own
     * incidental descriptive language, since a vivid sentence can
     * reference something the objects list itself never mentions. */
    avoidedColour?: string;
    avoidedTerms?: string[];
    /** Who the story is about. 'companion' (default): the third-person
     * {companion} character every other slot-filled line in this app
     * already uses -- falls back to a generic "your friend" phrase if the
     * caregiver never set a real Companion (§F.017), which reads oddly
     * for a child who doesn't relate to that framing at all. 'child':
     * second person, addressing the child directly ("You climb into..."),
     * no companion character or {companion} token at all. */
    perspective?: 'companion' | 'child';
  }): Promise<GeneratedStoryTemplate>;
}

export class StoryGenerationFailedError extends Error {
  constructor(reason: string) {
    super(`Story generation failed validation: ${reason}`);
    this.name = 'StoryGenerationFailedError';
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
  story: StoryGenPort;
  speechOut: SpeechOutPort;
  storage: StoragePort;
}
