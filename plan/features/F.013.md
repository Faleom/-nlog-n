# F.013 — Session Cap, Fade & Off-Screen Handoff

**Tier 1** · Owner: **P1** · Reviewer: P3 · Status: Not started

## What
The app ends itself, and gets shorter over time. This is the headline Impact
claim made real: designed against the TOBY adherence finding, where families
dropped off after ~3 months (§7.2). **An app whose success condition is being
used less.**

## Depends on / Blocks
Depends on F.008, F.010. Blocks nothing.

## Done when
- **Session cap: 12 minutes for session 1, −1 minute per session, floor 6.**
  The app ends itself.
- Three exit conditions, one ending: cap reached · 90s total idle · caregiver
  ends it. Session end requires deliberate caregiver action, never a stray
  swipe (§4.4).
- **Child-facing end**: Companion waves goodbye in `{fav_colour}`, one line of
  audio naming a real object from this session — *"{companion} says go find
  your {object} with {caregiver}!"* Then the app goes **non-interactive**.
  **No "play again" button.** The fade, made literal.
- **Caregiver-facing end** (one tap away): recap, longest focus stretch, objects
  recognised, offline suggestion in text.
- Every session ends by handing the family a real-world activity.

## Review checklist
- [ ] Does session 3 cap at 10 minutes? Does it floor at 6?
- [ ] Is there a "play again" button anywhere? There must not be.
- [ ] Does the app actually become non-interactive at the end?
- [ ] Does the handoff line name a **real object from this session**, not a
      generic one?
- [ ] Can a stray swipe end a session? (§4.4)
- [ ] Is shortening framed as progress, never as decline? (§7.9)

## Not in this file
No streaks, no total-time rewards, no "you played 5 days in a row" — the whole
point is the opposite (§7.9).

## Guide refs
§4.4, §7.2, §7.7, §7.9
