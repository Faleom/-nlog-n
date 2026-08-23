// The real CapturePort (F.006).
//
// BUILD-ENVIRONMENT DECISION (see TECH-DECISIONS.md § Camera and
// F.006.md's "Done when" list for the full writeup): this build runs and
// is demoed on laptops, which generally have no "point at the room"
// rear/environment camera at all, and whose front webcam sits behind a
// browser permission prompt that a getUserMedia-first flow can hang on
// waiting for. So the DEFAULT, reliable path here is a plain
// `<input type="file" accept="image/*">` file picker — not a live
// getUserMedia viewfinder. This is NOT a reversal of §4.2's "no file
// picker" product vision for the eventual tablet/phone deployment; it's
// this build's environment substituting the only camera-photo path a
// laptop actually has. The getUserMedia viewfinder below is kept fully
// intact and exported under its own name for that future deployment to
// wire back in via one registry-adjacent line — see its doc comment.
//
// This file owns exactly one thing: getting a full-resolution photo out of
// the device. It does NOT downscale, detect faces, or blur — that's
// adapters/pipeline/myWorldPipeline.ts's job, which calls this port first
// and nothing else before it.

import type { CapturePort } from '../ports';

/**
 * THE DEFAULT PATH. Opens the OS-native file-picker dialog and resolves
 * with whatever image the parent chooses.
 *
 * The one rule this function cannot violate: `input.click()` must be
 * called synchronously, with no `await` before it, in the same call stack
 * that reaches `capturePhoto()`. Browsers only honour a synthetic
 * `.click()` on a file input as a real "open the native picker" gesture
 * while the original user-activation (the tap that led here) is still
 * live — and that activation can silently expire across even a single
 * microtask tick on some browsers. Miss this and `.click()` no-ops: no
 * dialog opens, `change` never fires, and this promise never settles —
 * which is exactly the "nothing to press, ever" bug this file was
 * rewritten to fix. `createDeviceCamera()` below calls this with no
 * `await` in front of it for the same reason; keep it that way.
 */
function captureViaFileInput(): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    let settled = false;

    function settle(run: () => void): void {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      if (input.parentNode) document.body.removeChild(input);
      run();
    }

    function onChange(): void {
      void (async () => {
        const file = input.files?.[0];
        if (!file) {
          settle(() => reject(new Error('No photo selected')));
          return;
        }
        try {
          const bitmap = await createImageBitmap(file);
          settle(() => resolve(bitmap));
        } catch (err) {
          settle(() => reject(err instanceof Error ? err : new Error(String(err))));
        }
      })();
    }

    // Modern Chromium/Firefox fire this when the picker is dismissed with
    // no file chosen.
    function onCancel(): void {
      settle(() => reject(new Error('Photo selection cancelled')));
    }

    // Fallback for browsers that don't support the 'cancel' event (notably
    // older Safari): the window regaining focus is a reliable signal the
    // native dialog has closed. Give 'change' a brief window to fire first
    // (it's already queued by the time focus returns, if a file was
    // chosen) before concluding the dialog was cancelled. Without this,
    // cancelling the picker on such a browser would leave capturePhoto()
    // unresolved forever — the same class of hang this rewrite exists to
    // eliminate, just via a different browser's quirk.
    function onWindowFocus(): void {
      setTimeout(() => {
        if (!settled && !input.files?.length) {
          settle(() => reject(new Error('Photo selection cancelled')));
        }
      }, 300);
    }

    input.addEventListener('change', onChange, { once: true });
    input.addEventListener('cancel', onCancel, { once: true });
    window.addEventListener('focus', onWindowFocus);

    document.body.appendChild(input);
    input.click(); // Synchronous. No await above this line. See doc comment.
  });
}

/**
 * NOT CURRENTLY WIRED IN — kept intact for a future real tablet/phone
 * deployment, where §4.2's "point the device at the room and shoot, no
 * file picker" is achievable because the device actually has an
 * environment-facing camera and a mobile browser's permission UX. On
 * today's laptop build this path is unreliable (no rear camera to satisfy
 * `facingMode: 'environment'`, and a permission prompt the developer can
 * miss) and is not used by `createDeviceCamera()`. To bring it back:
 * export a factory here (e.g. `createLiveViewfinderCamera()`) that returns
 * `{ capturePhoto: captureViaGetUserMedia }` and swap it in at
 * adapters/registry.ts's `capture:` line — nothing else needs to change,
 * per ARCHITECTURE-RULES.md's "selection is configuration."
 *
 * Opens an in-app camera viewfinder, lets the parent shoot, and returns
 * the captured frame. Creates and tears down its own <video>/getUserMedia
 * stream and a minimal full-screen overlay with a capture button — this
 * app has no existing camera UI to hook into yet, so the viewfinder is
 * self-contained here rather than assuming a screen component exists.
 */
export async function captureViaGetUserMedia(): Promise<ImageBitmap> {
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

export function createDeviceCamera(): CapturePort {
  return {
    capturePhoto(): Promise<ImageBitmap> {
      // No `await` before this call — see captureViaFileInput's doc
      // comment for why that's load-bearing, not stylistic.
      return captureViaFileInput();
    },
  };
}
