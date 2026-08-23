# F.011 — Fading Logic

**Tier 1** · Owner: **P1** · Reviewer: P3 · Status: Implemented, self-verified — needs fresh-context review

## What
Tracks support tier per skill across sessions. A consistent pattern of needing
less support suggests trying a lower tier next time. A genuine adaptive loop,
not a one-shot recommendation.

## Depends on / Blocks
Depends on F.010. Blocks F.019.

## Done when
- **Step up: 3 consecutive unprompted correct.** **Step down: 2 consecutive
  tier-3 completions.** (§7.7 config block — use these numbers.)
- Moves **one tier at a time**, and moves **both directions** — it is not a
  ratchet.
- The caregiver sees a suggestion they can decline, phrased like §8.4:
  *"Maya's been finding things with just a point. Next time, try only telling
  her — no pointing."*
- Testable with scripted fake log entries — feed a run, confirm the suggestion
  appears at the stated threshold and not before.
- Produces a **tier**, never a score, percentage or progress bar (§13).

## Review checklist
- [ ] Does one good session trigger a drop? It must not.
- [ ] Are the thresholds the §7.7 config values, and readable in one place?
- [ ] Can support move back up?
- [ ] Is it a suggestion the caregiver can decline, or does the tier change
      under them?
- [ ] Any number, percentage or progress bar produced? (§13)
- [ ] Does it read history **per skill**, not blended into one global ability?

## Not in this file
No score. No cross-skill inference. No generalization re-testing (F.024,
Tier 4 — do not start). No conclusions about the child, ever.

## Guide refs
§7.6, §7.7, §13
