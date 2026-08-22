# F.010 — Support Ladder & Caregiver Logging

**Tier 1** · Owner: **P1** · Reviewer: P3 · Status: Not started

## What
The five-tier prompting hierarchy, caregiver-facing, identical across all games.
After each activity the caregiver logs **how much support was actually needed**
— not whether the child enjoyed it.

| Tier | Caregiver instruction |
|---|---|
| 1 Full physical | "Walk with them and guide their hand to it" |
| 2 Partial physical | "Walk with them, touch their elbow to steer" |
| 3 Gesture | "Point to it from where you are" |
| 4 Verbal | "Say 'it's near the table'" |
| 5 Independent | "Wait. Let them go." |

## Depends on / Blocks
Depends on F.001, F.008. Blocks F.011, F.019.

## Done when
- Five tiers defined **once**, referenced everywhere by that definition.
- The caregiver screen shows the current tier as a **concrete instruction**, not
  just a tier name — the table above is the copy.
- Errorless start: begin generous, fade later, never the reverse (§7.6).
- Post-activity prompt asks about **support needed**, not enjoyment.
- Log writes skill, context, tier used, prompted/unprompted, to F.001.
- Because the device travels with the child, tiers 1–2 are genuinely usable —
  don't design as if the adult is stuck at a screen (§7.6).
- **Nothing is ever computed from this history** to suggest a concern (§10).

## Review checklist
- [ ] Are the five tiers defined in exactly one place?
- [ ] Does each tier give the caregiver an action, or just a label?
- [ ] Does the post-session prompt ask about support, not enjoyment?
- [ ] Does the log include context, so generalization can tell rooms apart?
- [ ] **Grep for any counter, streak, threshold or pattern check over activity
      history.** There must be none — not even unused (§10).
- [ ] Any score visible to the child? (§7.7)

## Not in this file
No fading decision (F.011). No dashboard (F.019). **No inference from history
of any kind** — §10 is explicit that this is how the app would quietly become a
screening tool.

## Guide refs
§7.6, §10, §12.1
