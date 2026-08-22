// F.004 — Companion capture: the no-people gate + save path.
// See app-guide-v3-FINAL.md §6.2, §6.3, §6.6, §13.
//
// Split from the CompanionCapture screen so the part that actually matters
// — the gate — is testable in plain Node, with no canvas/ImageBitmap
// dependency: the screen does the (browser-only) photo -> data-URL
// conversion and passes the already-encoded string in; nothing in this
// file touches canvas.
//
// The same detector as F.006 (§6.3): `FaceDetectPort`. This file never
// assumes which adapter is wired in — it takes the port as a parameter,
// defaulting to whatever the registry currently resolves, so swapping the
// real detector in later changes nothing here.

import { adapters } from '../adapters/registry';
import type { FaceDetectPort } from '../adapters/ports';
import { updateProfile } from './profileStore';
import type { ChildProfile, Companion } from '../types';

/** §6.3's exact rejection copy — avoids blame, suggests the fix. */
export const COMPANION_REJECTION_MESSAGE = "Let's use a toy or object instead.";

export type CompanionCaptureResult =
  | { ok: true; profile: ChildProfile }
  | { ok: false; reason: string };

/**
 * Runs the no-people gate on a captured image. True if ANY face is found
 * — the Companion photo is rejected outright, no partial credit, no
 * "blur and keep going" (§13: "no photos of people, ever", for any
 * capture type, and the Companion is not the room-photo blur pipeline —
 * it simply never gets saved).
 */
export async function detectFaceInCompanionPhoto(
  image: ImageBitmap,
  faceDetect: FaceDetectPort = adapters.faceDetect,
): Promise<boolean> {
  const faces = await faceDetect.findFaces(image);
  return faces.length > 0;
}

/** Saves the Companion — the one image that persists (§7.4, §14). Callers
 * are responsible for having already run the gate; this function does not
 * re-check, so it can also be used standalone by an "edit name/pronoun
 * only" settings flow that never re-captures the photo. */
export async function saveCompanion(
  profileId: string,
  photoDataUrl: string,
  name: string,
  pronoun: Companion['pronoun'],
): Promise<ChildProfile> {
  return updateProfile(profileId, {
    context: { companion: { photo: photoDataUrl, name: name.trim(), pronoun } },
  });
}

/**
 * The full gate-then-save path. Returns a rejection — and saves NOTHING —
 * if a face is found in the photo. `faceDetect` defaults to the
 * currently-registered adapter; tests inject a fake one to exercise the
 * rejection path without depending on which real detector is finished yet.
 */
export async function captureCompanion(
  profileId: string,
  image: ImageBitmap,
  photoDataUrl: string,
  name: string,
  pronoun: Companion['pronoun'],
  faceDetect: FaceDetectPort = adapters.faceDetect,
): Promise<CompanionCaptureResult> {
  const hasFace = await detectFaceInCompanionPhoto(image, faceDetect);
  if (hasFace) {
    return { ok: false, reason: COMPANION_REJECTION_MESSAGE };
  }
  const profile = await saveCompanion(profileId, photoDataUrl, name, pronoun);
  return { ok: true, profile };
}
