// The real SoundPort. Synthesises a short, soft "tap" tone with the Web
// Audio API rather than shipping an audio file -- this app is fully
// offline (see App.css's own header comment on that), and a synthesised
// tone needs no asset, no fetch, nothing for the service worker to
// precache, and no risk of it going stale relative to the file it's
// supposed to be.
//
// One shared AudioContext, created lazily on the first real click (never
// at module load, which can happen under Node for the smoke harness where
// `window`/`AudioContext` don't exist at all -- same reasoning as
// speech/webSpeechOut.ts reading `window.speechSynthesis` lazily inside
// say() rather than at createWebSpeechOut() time).
//
// iOS/Safari suspends a freshly-created AudioContext until it's resumed
// inside a real user-gesture call stack; every call here originates from
// an actual click event (see App.tsx's global listener), so the resume()
// below is always inside that gesture.

import type { SoundPort } from '../ports';

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null; // no Web Audio support -- degrade to silent, never throw
  if (!sharedContext) sharedContext = new Ctor();
  if (sharedContext.state === 'suspended') {
    // Fire-and-forget; nothing here can usefully await it, and a failed
    // resume just means this one tap stays silent, not a crash.
    void sharedContext.resume();
  }
  return sharedContext;
}

export function createWebClickSound(): SoundPort {
  return {
    playClick(opts) {
      const ctx = getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const peakGain = opts?.quiet ? 0.06 : 0.14;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      // A short downward tick (760Hz -> 520Hz) reads as a soft, neutral
      // "tap" rather than a flat electronic beep -- the same shape a
      // physical key or a soft plastic button click has.
      oscillator.frequency.setValueAtTime(760, now);
      oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.06);

      // Fast attack, faster decay -- audible but brief enough that rapid
      // taps (the confirmation-grid escalation, a caregiver double-tapping
      // Setup rows) never overlap into a smear of tone.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.08);
      // Both nodes are garbage-collected once stopped and disconnected;
      // no manual cleanup needed beyond letting them fall out of scope.
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    },
  };
}
