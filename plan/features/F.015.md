# F.015 — Branch 2: Card, Guardrail, Save & Handoff Back

**Tier 1** · Owner: **P3** · Reviewer: P2 · Status: Not started

## What
Turns the three answers into a question card for a health worker, behind a hard
output guardrail. Then hands the parent back to Branch 1 so they're never left
worried with nothing to do.

## Depends on / Blocks
Depends on F.014, F.008 (an activity to offer). Blocks nothing.

## Done when
**The card** — fixed template. It may contain only:
- Observations the parent **literally stated**, rephrased for clarity — never
  inferred, extended, or "completed"
- The child's age in months
- Three fixed questions, identical every time: *Is this within a typical range
  for this age? · What should I watch for over the next few months? · Would a
  developmental check be worth scheduling?*

**The guardrail — a post-generation check, not prompt instructions alone (§9.4)**
- Banned: any condition name; the words *delayed, disorder, risk, concerning,
  abnormal, symptom, likely, probably, suggests*; any severity, probability or
  percentage; any recommendation beyond "ask a health worker."
- **If the check fails, the card is not shown.** The parent is offered the raw
  text of their own words instead. Degrading to the parent's own sentence is
  always safe; a hallucinated symptom never is.
- **Show the parent the card before saving, with an edit option.** They are the
  authority on what they observed.

**After**
- Card saves on device, printable, shown with the nearest child-health service
  and its schedule. Placeholder service data must be **visibly marked** (§15).
- Two equal paths: *bring it in* (the app's role ends at the handoff) and *not
  ready yet* (stays saved, no nagging, no reminder, ever).
- **Immediately offer a Branch 1 activity** — a high-motivation Companion trial
  (§9.3 step 9).
- Test against the §9.5 example: same input, compare output to the example card.

## Review checklist
- [ ] Run the §9.5 example. Does the output match, with nothing added?
- [ ] Feed an input that names a condition outright. Does the card carry it
      forward? It must not.
- [ ] **Force the guardrail to fail. Is the card withheld and raw text offered?**
- [ ] Is the guardrail a real post-generation check, or just prompt wording?
- [ ] Can the parent see and edit the card before it saves?
- [ ] Is placeholder service info marked in the UI **and on the printed card**?
- [ ] Does "not ready yet" produce any later nudge or badge? It must not.
- [ ] Does the handoff back offer a real activity, not a dead end?

## Not in this file
No diagnosis, suspected condition, confidence or severity at any strength (§13).
No reassurance either — the app isn't qualified to calm a parent any more than
to worry them. No follow-up tracking. No appointment booking.

## Guide refs
§9.3, §9.4, §9.5, §10, §13, §15
