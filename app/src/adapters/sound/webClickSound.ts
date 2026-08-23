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

// ---------------------------------------------------------------------------
// favSound personalisation. QuickPreferences.tsx's SOUNDS array is the
// source of truth for the five values a family can actually pick
// ('bell' | 'chime' | 'giggle' | 'drum' | 'xylophone'); QuickPreferences
// stores favSound as a plain string (types/index.ts), so this file
// validates against a known set the same way game1Companion.ts's
// rewardFrameColour() validates favColour against KNOWN_CSS_COLOURS -- an
// unset or unrecognised value is not an error, it just falls through to
// DEFAULT_TONE, i.e. exactly the click this app has always played.
//
// Every variant below is a small reshaping of the SAME oscillator/gain
// click used before this feature existed: a two-point frequency ramp plus
// a short attack/decay gain envelope. Only pitch, waveform (a touch of
// harmonic content from 'triangle' vs the plain 'sine'), and envelope
// timing vary -- never the peak gain, which stays governed solely by
// `quiet` so a favSound choice can never make a calm-profile click louder
// or busier than the accessibility accommodation allows.
// ---------------------------------------------------------------------------

interface ToneVariant {
  waveform: OscillatorType;
  /** Frequency ramp, Hz -> Hz, over `rampEnd` seconds. */
  freqStart: number;
  freqEnd: number;
  rampEnd: number;
  /** Seconds from the attack peak to fall back to silence. */
  decayEnd: number;
  /** Seconds until the oscillator stops entirely. */
  stopTime: number;
  /** Seconds for the initial attack ramp up to peak gain. */
  attackTime: number;
}

// The original, unpersonalised click: a soft downward tick (760Hz ->
// 520Hz) that reads like a physical key or soft plastic button. Used
// whenever favSound is unset, unrecognised, or belongs to a profile that
// hasn't been through the favourites screen -- byte-for-byte the same
// numbers this file always used, so there is no regression for anyone.
const DEFAULT_TONE: ToneVariant = {
  waveform: 'sine',
  freqStart: 760,
  freqEnd: 520,
  rampEnd: 0.06,
  decayEnd: 0.07,
  stopTime: 0.08,
  attackTime: 0.008,
};

const FAV_SOUND_TONES: Record<string, ToneVariant> = {
  // Bell -- brighter and rings a little longer than the default tick, the
  // way a small handbell sustains after the strike.
  bell: { waveform: 'sine', freqStart: 880, freqEnd: 660, rampEnd: 0.07, decayEnd: 0.12, stopTime: 0.13, attackTime: 0.008 },
  // Chime -- higher still, and 'triangle' adds a touch of harmonic
  // shimmer a plain sine doesn't have, for an airier, glassier feel.
  chime: { waveform: 'triangle', freqStart: 1000, freqEnd: 780, rampEnd: 0.05, decayEnd: 0.09, stopTime: 0.1, attackTime: 0.008 },
  // Giggle -- the only variant that ramps UP instead of down (520Hz ->
  // 760Hz), a quick playful upward chirp, with a crisper attack and the
  // shortest decay of the set so it stays bouncy rather than ringing.
  giggle: { waveform: 'sine', freqStart: 520, freqEnd: 760, rampEnd: 0.05, decayEnd: 0.06, stopTime: 0.07, attackTime: 0.005 },
  // Drum -- low pitch, fast attack, fast decay: a small percussive thump
  // rather than a tone.
  drum: { waveform: 'triangle', freqStart: 300, freqEnd: 180, rampEnd: 0.04, decayEnd: 0.05, stopTime: 0.06, attackTime: 0.004 },
  // Xylophone -- bright and woody, a short mallet-like tap: high pitch, a
  // narrower frequency drop than bell/chime, and a quick decay.
  xylophone: { waveform: 'sine', freqStart: 950, freqEnd: 820, rampEnd: 0.03, decayEnd: 0.055, stopTime: 0.06, attackTime: 0.008 },
};

function toneForFavSound(favSound: string | undefined): ToneVariant {
  if (!favSound) return DEFAULT_TONE;
  return FAV_SOUND_TONES[favSound] ?? DEFAULT_TONE;
}

export function createWebClickSound(): SoundPort {
  return {
    playClick(opts) {
      const ctx = getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // `quiet` (the avoid-list's soundMovement === 'calm' accommodation)
      // is the ONLY thing that sets peak gain, computed independently of
      // which tone variant plays below -- a favSound choice can never
      // raise the volume a calm profile gets.
      const peakGain = opts?.quiet ? 0.06 : 0.14;
      const tone = toneForFavSound(opts?.favSound);

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = tone.waveform;
      // A short tick from freqStart -> freqEnd reads as a soft, neutral
      // "tap" rather than a flat electronic beep -- the same shape a
      // physical key or a soft plastic button click has. Which two
      // frequencies (and which direction) depends on the tone variant.
      oscillator.frequency.setValueAtTime(tone.freqStart, now);
      oscillator.frequency.exponentialRampToValueAtTime(tone.freqEnd, now + tone.rampEnd);

      // Fast attack, faster decay -- audible but brief enough that rapid
      // taps (the confirmation-grid escalation, a caregiver double-tapping
      // Setup rows) never overlap into a smear of tone.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + tone.attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.decayEnd);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + tone.stopTime);
      // Both nodes are garbage-collected once stopped and disconnected;
      // no manual cleanup needed beyond letting them fall out of scope.
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    },
  };
}
