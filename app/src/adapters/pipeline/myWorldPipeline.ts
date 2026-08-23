// F.006 — the My World pipeline: capture → face-detect → redact →
// recognize → discard. §7.4, §12.1: "capture → face blur → downscale →
// object recognition → discard photo."
//
// THE OTHER FOUR ADAPTER FILES ARE POINTLESS ON THEIR OWN. A correct
// BlazeFaceLocal and a correct CanvasMosaic don't protect anyone if some
// screen calls adapters.vision.recognizeObjects(adapters.capture.
// capturePhoto()) directly and skips both — which is EXACTLY what the
// walking-skeleton Game1.tsx this replaces used to do (see its git
// history). This file exists so that bug class cannot recur: it is the
// ONLY place in the app allowed to call adapters.capture, adapters.
// faceDetect, adapters.redaction and adapters.vision directly. Every game
// screen must call captureRoomAndRecognize() and nothing else — see
// scripts/smoke-f006.ts's "no direct adapter calls outside the pipeline"
// check, and Game1.tsx's own import list.
//
// The ordering guarantee is enforced two ways, not one:
//   1. TYPE-LEVEL: recognize() only accepts a RedactedImage, a branded
//      type that only redact() (in this file) can produce. There is no
//      value of that type reachable from outside this module without an
//      explicit `as` cast — which is a visible, greppable red flag in
//      review, not an accident.
//   2. RUNTIME: redact() also registers the bitmap it returns in
//      `knownRedacted`, a WeakSet. recognize() checks membership and
//      throws if the image wasn't actually produced by redact() — so even
//      a deliberate `as RedactedImage` cast to route around the type
//      system still gets caught at runtime. Belt AND suspenders, per the
//      brief: "make it a type error or an impossible code path."

import { adapters } from '../registry';
import { CaptureCancelledError, type AdapterRegistry } from '../ports';
import type { Region, TaggedCrop } from '../../types';

declare const REDACTED_BRAND: unique symbol;
/** A bitmap that has been through redact() in THIS module. Unconstructable
 * from outside — nothing else in the codebase can produce this type
 * without an explicit unsafe cast (see module header). */
export type RedactedImage = ImageBitmap & { readonly [REDACTED_BRAND]: true };

/** Runtime half of the ordering guarantee — see module header point 2. */
const knownRedacted = new WeakSet<ImageBitmap>();

async function redact(
  ports: Pick<AdapterRegistry, 'redaction'>,
  image: ImageBitmap,
  regions: Region[],
): Promise<RedactedImage> {
  const result = await ports.redaction.redactRegions(image, regions);
  knownRedacted.add(result);
  return result as RedactedImage;
}

async function recognize(
  ports: Pick<AdapterRegistry, 'vision'>,
  image: RedactedImage,
): Promise<TaggedCrop[]> {
  if (!knownRedacted.has(image)) {
    // This should be unreachable through the type system alone — reaching
    // it means someone force-cast a raw ImageBitmap `as RedactedImage` to
    // route around redact(). Fail loudly rather than silently sending an
    // unblurred photo (§13's guarantee is worth a hard crash over).
    throw new Error(
      'recognize() called with an image that never went through redact() in this module. ' +
        'This is a §13 violation, not a normal error — do not catch and retry.',
    );
  }
  return ports.vision.recognizeObjects(image);
}

export type CaptureRoomOutcome =
  | { kind: 'success'; crops: TaggedCrop[] }
  /** §11: "Recognition returns nothing usable → fall back to generic
   * activities for the chosen context. Never show an error." Fires both
   * when vision genuinely found nothing AND when the vision call itself
   * failed (network error, API outage — §11's "demo-day API outage" row
   * names exactly this path: pre-seeded/generic content, not an error
   * screen). Callers render their own generic/fixture activity set here,
   * quietly — not an error screen. */
  | { kind: 'no-objects-found' }
  /** §11 / §4.4: "Face-blur fails or is uncertain → hard stop. Discard the
   * photo, tell the parent it couldn't be processed, offer to retake.
   * Never proceed on an unblurred image." Fires if face detection OR
   * redaction throws for any reason — fail CLOSED, never open. */
  | { kind: 'blur-failed' }
  /** §4.4/§11: "Camera permission denied → both branches still fully
   * usable... camera is an enhancement, not a gate." Fires if capturePhoto
   * itself throws or never resolves with a photo (permission denied, no
   * hardware, file picker cancelled) — distinct from blur-failed, which
   * means a photo WAS captured but couldn't be safely processed.
   * `cancelled: true` specifically means the person closed the picker
   * without choosing anything — a deliberate "not right now", not a
   * technical failure. Callers that quietly degrade to generic content on
   * every other capture-unavailable case may want to treat a cancellation
   * differently (stop and wait, rather than proceed with placeholder
   * content the person never asked for) — see Game2.tsx's startRound. */
  | { kind: 'capture-unavailable'; cancelled?: true };

/** The four real, sequential stages captureRoomAndRecognize actually goes
 * through — for callers that want to show honest progress instead of a
 * single static "please wait" (§11's "calm progress state", extended:
 * calm doesn't have to mean uninformative). Fired at the START of each
 * stage, synchronously, before that stage's own async work begins. */
export type CaptureStage = 'capturing' | 'checking-faces' | 'blurring' | 'looking-at-objects';

export interface CaptureRoomOptions {
  /** Fired once, at 4s (§11: "slow (>4s) → calm progress state showing
   * the parent's own photo, never a spinner over blank"), if the pipeline
   * hasn't resolved yet. The caller is responsible for rendering that
   * calm state; this function only tells it when to start. */
  onSlow?: () => void;
  /** Fired at the start of each real stage -- see CaptureStage. Optional;
   * a caller that doesn't care can ignore it and nothing changes. */
  onStage?: (stage: CaptureStage) => void;
  /** Test-only escape hatch — inject fake ports instead of the real
   * registry so this function's control flow (fail-closed, no-objects
   * fallback, the ordering guarantee itself) can be exercised in Node
   * with no camera, no model, and no network. Feature code should never
   * pass this. */
  ports?: Pick<AdapterRegistry, 'capture' | 'faceDetect' | 'redaction' | 'vision'>;
}

/**
 * The single entry point for turning a room photo into tagged crops.
 * Captures ONE photo (§8.1: "one photo per session, not per trial" — this
 * function is called once per session, never per trial), detects faces on
 * device, redacts them destructively, then — and only then — sends the
 * result for recognition. The raw and redacted bitmaps are local variables
 * that fall out of scope (and are explicitly `.close()`d where the
 * environment supports it) once this returns; neither is ever passed to
 * StoragePort or written anywhere. That IS the "photo discarded" guarantee
 * — there is no separate discard step because there is nothing else
 * holding a reference to discard.
 */
export async function captureRoomAndRecognize(
  options: CaptureRoomOptions = {},
): Promise<CaptureRoomOutcome> {
  const ports = options.ports ?? adapters;

  const slowTimer = options.onSlow ? setTimeout(options.onSlow, 4000) : null;
  let raw: ImageBitmap | null = null;
  try {
    options.onStage?.('capturing');
    try {
      raw = await ports.capture.capturePhoto();
    } catch (err) {
      // §4.4: "camera is an enhancement, not a gate." Permission denied,
      // no camera hardware, or the parent cancelled the picker — none of
      // that should dead-end the app on its own; see the `cancelled` flag
      // above for how a caller can still treat a deliberate cancel
      // differently from an actual technical failure.
      //
      // The console.warn calls in this function are diagnostic only —
      // never shown to a caregiver or child, never anything more than the
      // technical error itself (never photo content, never anything §13
      // would forbid). This app's own quiet-degrade design (§11: "never
      // show an error") makes every failure mode here look IDENTICAL to
      // every other one from the screen alone, which made a real bug
      // (the dev proxy not existing) indistinguishable from a different
      // real bug (this catch block) for a human clicking through it. This
      // is what actually lets that distinction be made from the browser
      // console instead of guessing blind.
      console.warn('[myWorldPipeline] capture-unavailable:', err);
      return {
        kind: 'capture-unavailable',
        cancelled: err instanceof CaptureCancelledError ? true : undefined,
      };
    }

    options.onStage?.('checking-faces');
    let faces: Region[];
    try {
      faces = await ports.faceDetect.findFaces(raw);
    } catch (err) {
      // Fail closed (§11, §4.4): detection threw, so we do not know
      // whether a face is present. Discard and stop — never redact-and-
      // send on an assumption. Nothing downstream of this branch ever
      // sees `raw`.
      console.warn('[myWorldPipeline] blur-failed (face detection threw):', err);
      closeIfPossible(raw);
      return { kind: 'blur-failed' };
    }

    options.onStage?.('blurring');
    let redacted: RedactedImage;
    try {
      redacted = await redact(ports, raw, faces);
    } catch (err) {
      console.warn('[myWorldPipeline] blur-failed (redaction threw):', err);
      closeIfPossible(raw);
      return { kind: 'blur-failed' };
    }

    // `raw` must never be used again past this point — everything from
    // here on operates on `redacted`. Closing it and nulling the binding
    // immediately means a future edit that mistakenly reaches for `raw`
    // gets a real runtime failure (either a closed-bitmap error or a
    // null-access) instead of silently reading the pre-redaction photo.
    closeIfPossible(raw);
    raw = null;

    options.onStage?.('looking-at-objects');
    let crops: TaggedCrop[];
    try {
      crops = await recognize(ports, redacted);
    } catch (err) {
      // §11 "demo-day API outage" row: a failed vision call degrades to
      // the same quiet generic-activities fallback as "found nothing" —
      // never an error screen, never a retry loop burning API calls.
      console.warn('[myWorldPipeline] no-objects-found (vision call threw):', err);
      closeIfPossible(redacted);
      return { kind: 'no-objects-found' };
    }
    closeIfPossible(redacted);

    if (crops.length === 0) {
      // §11: no error shown, caller falls back to generic activities.
      console.warn('[myWorldPipeline] no-objects-found (vision returned zero objects)');
      return { kind: 'no-objects-found' };
    }
    return { kind: 'success', crops };
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
    if (raw) closeIfPossible(raw);
  }
}

/** ImageBitmap.close() releases the underlying bitmap data immediately
 * rather than waiting for GC — real evidence the photo isn't being held
 * onto, not just "nothing references it anymore". Guarded because the
 * test-double images used in scripts/smoke-f006.ts aren't real
 * ImageBitmaps and may not implement it. */
function closeIfPossible(image: ImageBitmap): void {
  const closable = image as { close?: () => void };
  if (typeof closable.close === 'function') closable.close();
}
