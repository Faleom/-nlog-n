// The real CapturePort (F.006). TECH-DECISIONS.md § Camera: "getUserMedia
// in-app viewfinder, with <input type="file" accept="image/*"
// capture="environment"> as fallback." §4.2: "Parent points the device at
// the room and shoots. No file picker, no desktop file system."
//
// ⚠ VERIFICATION STATUS: this file cannot be exercised at all in this
// sandbox — there is no browser, no camera, and getUserMedia doesn't exist
// in Node. It is written correctly per the MDN getUserMedia API shape and
// reviewed against §4.2/§4.4, but it is UNVERIFIED beyond that. A human
// must open this on a real tablet and a real phone (§4.4: "devtools
// emulation is not sufficient") and confirm: the native camera opens
// in-app (not a file picker), a photo capture returns a usable
// ImageBitmap, and camera-permission-denied degrades to the file-input
// fallback rather than crashing. See PERSON-2's final report for the full
// list of what still needs a human check.
//
// This file owns exactly one thing: getting a full-resolution photo out of
// the device. It does NOT downscale, detect faces, or blur — that's
// adapters/pipeline/myWorldPipeline.ts's job, which calls this port first
// and nothing else before it.

import type { CapturePort } from '../ports';

/**
 * Opens an in-app camera viewfinder, lets the parent shoot, and returns the
 * captured frame. Creates and tears down its own <video>/getUserMedia
 * stream and a minimal full-screen overlay with a capture button — this
 * app has no existing camera UI to hook into yet, so the viewfinder is
 * self-contained here rather than assuming a screen component exists.
 */
async function captureViaGetUserMedia(): Promise<ImageBitmap> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });

  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true'); // iOS: avoid full-screen takeover
    video.muted = true;

    await video.play();
    // Wait for real dimensions — immediately after play() they can still
    // be 0x0 on some browsers/devices.
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      await new Promise<void>((resolve) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      });
    }

    const shot = await waitForCaptureTap(video);
    return shot;
  } finally {
    // Always stop every track — leaving the camera light on after the shot
    // is a real trust problem for this app's audience, not just a battery
    // one.
    for (const track of stream.getTracks()) track.stop();
  }
}

/**
 * Shows the live video full-screen with a single large capture button
 * (88×88pt floor, §4.4) and resolves with a frame grabbed from the video at
 * the moment of the tap. Deliberately minimal DOM, no framework — this is
 * an adapter, not a screen component; the caregiver-facing chrome around it
 * belongs to whichever screen calls capturePhoto().
 */
function waitForCaptureTap(video: HTMLVideoElement): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;';
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Take photo');
    button.style.cssText =
      'width:88px;height:88px;border-radius:50%;background:#fff;border:4px solid #ccc;margin:32px;';

    overlay.appendChild(video);
    overlay.appendChild(button);
    document.body.appendChild(overlay);

    function cleanup() {
      document.body.removeChild(overlay);
    }

    button.addEventListener(
      'click',
      () => {
        void (async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('2D canvas context unavailable');
            ctx.drawImage(video, 0, 0);
            const bitmap = await createImageBitmap(canvas);
            cleanup();
            resolve(bitmap);
          } catch (err) {
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      },
      { once: true },
    );
  });
}

/**
 * Fallback path when getUserMedia is unavailable or denied: the file-input
 * `capture="environment"` attribute still opens the device's native camera
 * app directly on mobile (not a generic file browser), matching §4.2's
 * "no file picker" requirement even though it isn't the in-app viewfinder.
 */
function captureViaFileInput(): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';

    input.addEventListener(
      'change',
      () => {
        void (async () => {
          const file = input.files?.[0];
          document.body.removeChild(input);
          if (!file) {
            reject(new Error('No photo captured'));
            return;
          }
          try {
            resolve(await createImageBitmap(file));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}

export function createDeviceCamera(): CapturePort {
  return {
    async capturePhoto(): Promise<ImageBitmap> {
      if (!navigator.mediaDevices?.getUserMedia) {
        return captureViaFileInput();
      }
      try {
        return await captureViaGetUserMedia();
      } catch {
        // Permission denied, no camera hardware, or any other
        // getUserMedia failure — fall back to the native-camera file input
        // rather than surfacing a dead end. §4.4: "camera is an
        // enhancement, not a gate."
        return captureViaFileInput();
      }
    },
  };
}
