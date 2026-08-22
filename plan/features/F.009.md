# F.009 — Interaction State Machine

**Tier 1** · Owner: **P1** · Reviewer: P3 · Status: Not started

## What
The moment-to-moment loop: what happens on right, wrong and idle. §7.7 says
this is what a judge will poke at, because it's where every competitor does
something crude. ~40–60 lines of state machine.

**Core principle — errorless learning.** The child never ends a trial in a
failure state. The app adjusts how much help it gives until they succeed.

## Depends on / Blocks
Depends on F.003 (tuning), F.008 (a loop to run inside). Blocks F.012, F.021,
F.022 — build this **before any second game**.

## Done when
**Correct answer**
- <200ms: target scales up + `{fav_sound}` chime if sound enabled
- ~0.5s: audio names it possessively — *"your red cup"*
- ~1.5s: co-play prompt, **every 3rd–4th success only** (every time is noise)
- ~2.5s: auto-advance, no Next button

**Wrong answer — least-to-most, one tier per attempt, never skip, never reset**

| Tier | Trigger | Behaviour |
|---|---|---|
| 0 Wait | trial start | nothing — most wrong answers are rushed |
| 1 Repeat | 1st wrong / 8s | wrong option fades to 40%, dead. Audio repeats, slower |
| 2 Highlight | 2nd wrong / 20s | correct target pulses softly, distractors fade |
| 3 Animate | 3rd wrong / 35s | target bounces, **only it is tappable — cannot fail** |
| 4 Co-play | 45s / tier 3 done | *"Let's do this one together"* — caregiver-facing |

- After tier 3 the trial **completes as correct**. Logged **prompted**, never
  *failed*.
- **Never**: red X, buzzer, shake, "Try again!", or any negative-sounding audio.
  A wrong tap is **silence plus fade**, nothing more.

**Disengagement — behavioural signals only, never emotion, never faces**
- 4+ taps in <2s on non-targets → pause, movement break
- 45s no input → co-play handoff
- 3 consecutive tier-3 trials → step difficulty down or switch modality
- 90s total idle → end session gracefully, log as short

**Movement breaks**: one instruction, 20–30s, *"{movement} like a
{fav_animal}!"* Return to a task **one level easier**. Max 3 per session — more
means the activity is mismatched, so step down instead.

**One config object** with the §7.7 numbers. All timings tunable from it.

## Review checklist
- [ ] Tap wrong three times in a row: does the child end in success, with no
      negative signal at any point?
- [ ] Is a wrong tap genuinely silent — no sound, no colour change, no shake?
- [ ] Does the hierarchy escalate one tier at a time and never reset mid-trial?
- [ ] Is the log entry `prompted`, never `failed`?
- [ ] Do the disengagement signals read touch timing only — nothing from the
      camera, no emotion inference? (§7.7, §13)
- [ ] Does immediate visual feedback fire on every press? Without it a
      preschooler presses again and the rapid-tap rule misfires (§4.4).
- [ ] Are all timings in one config object?

## Not in this file
No cross-session adaptation — that's the support ladder (F.010) and fading
(F.011). No emotion or facial analysis, ever.

## Guide refs
§4.4, §7.7, §12.1, §13
