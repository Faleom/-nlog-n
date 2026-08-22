# F.003 — Response Profile: Four Questions + Declaration Pre-fill

**Tier 0** · Owner: **P4** · Reviewer: P1 · Status: Not started

## What
Replaces the old condition field entirely. Four questions about **what the
parent observes**, which produce all the tuning the engine needs. Plus one
optional diagnosis line that only pre-fills answers.

## Depends on / Blocks
Depends on F.001, F.002. Blocks all tuning — F.009, F.012, F.013.

## Done when
- Four questions, all skippable, all changeable later (§5.2):
  1. Sound and movement on screen → audio, animation intensity, saturation
  2. How long they stay with one thing → session length, reps, break frequency
  3. Sameness or variety → predictability, layout stability, phrasing, rotation
  4. How they let you know what they want → prompt complexity, length,
     starting support tier
- Each answer writes to a **named tuning dimension**, readable by the engine.
- **No condition field.** No `if autism` / `if adhd` anywhere.
- The optional declaration line reads roughly: *"If your child has a diagnosis
  and you'd like to tell us, you can — but you don't have to, and nothing
  changes if you skip it."* If answered it **pre-fills** the four questions with
  defaults, all visible and changeable. It never reaches tuning logic (§5.3).
- **No score, no summary screen, no profile-type name shown back**, no
  completion percentage (§5.4).
- Demo config reachable: calm + sameness + minimal words (§0).

## Review checklist
- [ ] Does the engine read the four dimensions and never the declaration? (§5.3)
- [ ] Is any answer combination displayed back as a label or type? (§5.4)
- [ ] Is the wording observational (*"how does your child let you know…"*), not
      evaluative (*"can your child speak in sentences?"*)? (§5.4)
- [ ] Can you skip all four and still use the app?
- [ ] Does declaring a diagnosis unlock anything? It must not.
- [ ] Does the demo config (calm / sameness / minimal words) produce visibly
      different behaviour from a lively / variety config?

## Not in this file
No scoring. No assessment framing. No condition-specific code paths anywhere.

## Guide refs
§0, §5.2, §5.3, §5.4
