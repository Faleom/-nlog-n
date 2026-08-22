# F.001 — Device Store & Profile Model

**Tier 0** · Owner: **P1** · Reviewer: P3 · Status: Not started

## What
Everything the app remembers, on the device. No account, no login, no cloud sync
(§14). Holds: child age + nickname, the four response-profile answers, the
Child Context Profile, the Companion photo, session logs and support levels,
saved question cards.

## Depends on / Blocks
Nothing. **Start immediately.** Blocks F.002, F.003, F.004, F.005 — most of Tier 0.

## Done when
- A profile works with **only age in months** set and everything else empty.
- The four response answers are stored as **four independent dimensions**, not a
  condition label. There is no `condition` field in the schema (§5.2).
- The optional declaration, if given, is stored **separately** and is never read
  by tuning logic (§5.3).
- The **Companion photo persists** across restarts — it's the one image that
  does (§14). Room photos never touch the store.
- Session logs record: skill, context, support tier used, prompted vs
  unprompted, duration, longest focus stretch, movement breaks.
- Survives an app restart. Nothing written off-device.

## Review checklist
- [ ] Is there a `condition` / `diagnosis` field anywhere in the tuning path?
      There must not be (§5.3).
- [ ] Does a profile with only age set work end to end?
- [ ] Can the schema hold a room photo? It must not be able to (§14).
- [ ] Any score, grade, or percentile field? (§13)
- [ ] Does the Companion photo survive a restart?
- [ ] Is anything written to a network destination? (§14)

## Not in this file
No scoring or aggregation. No sync or backup. No UI. No fading logic (F.011).

## Guide refs
§5.2, §5.3, §12.1, §14
