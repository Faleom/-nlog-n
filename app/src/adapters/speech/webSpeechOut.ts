// The real SpeechOutPort. TECH-DECISIONS.md § Audio: "Web Speech API
// speechSynthesis. Free, no quota, no key, offline from OS voices on most
// platforms. Load-bearing, not decorative -- §7.10 requires a zero-text
// child UI, so audio *is* the interface."
//
// This app has NO child-facing text anywhere (§7.10) -- until this file
// existed, every adapters.speechOut.say() call across Game 1, Game 2, and
// Game 3 resolved against the silent fixture (createFixtureSpeechOut()),
// so the app has never actually spoken a word out loud. This is that fix.
//
// ⚠ VERIFICATION STATUS -- read before trusting this file:
// This could NOT be run end-to-end in this sandbox (no browser, no
// speakers, no way to hear whether speech actually plays). What IS true by
// construction and can be reasoned about statically: it calls the real
// window.speechSynthesis / SpeechSynthesisUtterance APIs the way MDN and
// the spec document them, resolves on `onend`, and degrades to a resolved
// (never rejected) promise on `onerror` so a broken or missing voice can
// never gate any game's flow -- same "never gate the experience on this"
// philosophy as every other adapter in this codebase (see
// pipeline/myWorldPipeline.ts and vision/claudeVision.ts). A human must
// open this in a real browser with speakers to confirm audio is actually
// audible, that it isn't garbled, and that the rate feels natural.
//
// TWO REAL CAVEATS THAT REMAIN, PER TECH-DECISIONS.md:
//
// 1. iOS requires a user gesture before ANY speech will play -- Safari
//    (and other iOS browsers, which all use WebKit) silently drops
//    speechSynthesis.speak() calls that aren't in the call stack of a
//    user-initiated event (or close enough to one). TECH-DECISIONS.md's
//    suggested fix is "use the session-start tap to unlock it" -- that is
//    an app-wide sequencing concern (every game's first say() call would
//    need to trace back to a tap with no intervening await), which is out
//    of scope for this single adapter file and has NOT been solved here.
//    What this file *does* do, in the same spirit as
//    capture/deviceCamera.ts's "no await before the activation-sensitive
//    call" fix: say() does not await anything non-essential before calling
//    speechSynthesis.speak() -- the only await is the bounded
//    voiceschanged wait below, and only on an empty voice list, and only
//    up to its timeout. It does not select or wait on a *specific* voice.
//    This does not by itself guarantee iOS activation is preserved across
//    every call site in the app (that depends on what, if anything, each
//    game awaits between the tap and its first say() call) -- that audit
//    is explicitly out of scope here.
//
// 2. Voice quality varies by OS/browser and is not selected for here by
//    design (TECH-DECISIONS.md: "the app must be usable with a poor
//    voice") -- this file speaks with whatever the platform's default
//    voice is.

import type { SpeechOutPort } from '../ports';

/**
 * Voices load asynchronously in many browsers: speechSynthesis.getVoices()
 * can return [] on the very first call, with the real list arriving later
 * via the 'voiceschanged' event. We don't need a specific voice --
 * speechSynthesis.speak() works fine with the platform default even if
 * none was ever explicitly selected -- but if the list is empty on this
 * very first call, wait for one voiceschanged event (bounded by a
 * timeout) so we're not speaking into a browser that hasn't finished
 * initialising its voice list yet. A browser that never fires the event
 * must not hang the caller forever, hence the timeout.
 */
const VOICES_READY_TIMEOUT_MS = 1500;

let voicesReadyOnce: Promise<void> | null = null;

function waitForVoicesOnce(synth: SpeechSynthesis): Promise<void> {
  if (voicesReadyOnce) return voicesReadyOnce;

  if (synth.getVoices().length > 0) {
    voicesReadyOnce = Promise.resolve();
    return voicesReadyOnce;
  }

  voicesReadyOnce = new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      clearTimeout(timer);
      resolve();
    };
    const onVoicesChanged = () => finish();
    synth.addEventListener('voiceschanged', onVoicesChanged);
    const timer = setTimeout(finish, VOICES_READY_TIMEOUT_MS);
  });
  return voicesReadyOnce;
}

export function createWebSpeechOut(): SpeechOutPort {
  return {
    async say(text, opts) {
      // window.speechSynthesis is read here, inside say(), rather than
      // once at createWebSpeechOut() call time -- the registry constructs
      // every adapter eagerly at module load, including under Node for
      // the smoke harness, where `window` doesn't exist at all. Reading
      // it lazily, only once a caller actually speaks, keeps this file
      // importable outside a browser, same as capture/deviceCamera.ts's
      // capturePhoto() only touching navigator.mediaDevices when called.
      const synth = window.speechSynthesis;

      // Only wait when the list is genuinely empty right now -- once
      // voices have loaded (or the bounded wait has already happened
      // once), every later call proceeds straight to speak() with no
      // extra async gap, which matters for preserving user-activation on
      // the very first call (see file header).
      if (synth.getVoices().length === 0) {
        await waitForVoicesOnce(synth);
      }

      return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = opts?.rate ?? 1;

        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          // Diagnostic only -- never shown to a caregiver or child, and
          // never allowed to reject/gate the calling game. A broken or
          // missing voice must degrade silently, same as every other
          // adapter failure mode in this codebase.
          console.warn('[webSpeechOut] speech-failed:', event.error);
          resolve();
        };

        synth.speak(utterance);
      });
    },
  };
}
