# F.020 — Branch Handoff & The No-Screening Rule

**Tier 2** · Owner: **P3** · Reviewer: P2 · Status: Not started

## What
§10 calls this the most failure-prone part of the design. Two directions, two
very different rules.

**Branch 1 → Branch 2.** Repeated "didn't want to / couldn't do it" in the same
skill domain produces **no warning, no computation, no conclusion**. The only
thing that ever appears is the neutral prompt available everywhere:
*"Want to save a note about this to ask about later?"*

**Branch 2 → Branch 1.** After a card is created, immediately offer an activity.

## Depends on / Blocks
Depends on F.010, F.015. Blocks nothing.

## Done when
- The neutral note prompt is **identically available everywhere**. Its presence
  never varies with the child's history.
- **Prove it**: run a profile with a long run of "couldn't do it" marks and one
  with none. The two UIs must be indistinguishable.
- **No counter, threshold, tally or pattern detector exists anywhere over
  activity outcomes.** Nothing to tune, because nothing is counting.
- Card → activity offer works, including for a parent with no Branch 1 profile.
- Branch switching in either direction asks nothing and warns nothing.

## Review checklist
- [ ] **Grep the codebase** for any counter, streak, threshold or pattern check
      over activity outcomes. There must be none — not even unused.
- [ ] Are the two profiles (many "couldn't do it" vs none) truly identical
      on screen?
- [ ] Is the note prompt worded identically everywhere, with no context-specific
      variant?
- [ ] Does the card→activity handoff work with no Branch 1 profile?
- [ ] Does switching branches ever warn or confirm? It must not.

## Not in this file
**No pattern detection over activity history, in any form.** §10: activity
history is the only condition-adjacent data in the app now that there's no
condition field, and it must never become a screen. No "we noticed…" messaging,
ever, at any confidence.

## Guide refs
§10, §13
