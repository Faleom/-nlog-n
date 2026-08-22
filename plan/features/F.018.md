# F.018 — Avoid List

**Tier 2** · Owner: **P4** · Reviewer: P1 · Status: Implemented, self-verified — needs fresh-context review

## What
> *"Anything we should stay away from?"*

Multi-select plus free text: loud or sudden sounds · fast animation or flashing
· a specific colour they dislike · specific words or topics that upset them ·
surprises and unannounced changes. **Everything listed is hard-excluded from all
generated content, engine-level, no exceptions.**

## Depends on / Blocks
Depends on F.005 (the filter hook). Blocks nothing.

## Done when
- Multi-select plus free text, defaults to empty, skippable (§6.6).
- **The filter runs last**, on the final filled string, after slot substitution.
  If an avoided term or property survives, the line swaps to a neutral variant
  (§6.4).
- Non-text properties are excluded too: "loud sounds" silences the chime,
  "flashing" drops animation intensity, a disliked colour is removed from the
  accent and from Game 1 colour targets.
- **Demoable in five seconds**: add "loud sounds", the success chime becomes a
  visual pulse (§6.2).

## Review checklist
- [ ] Does the filter run **after** substitution, on the final output? (§6.4)
- [ ] Add a colour to the avoid list — does it vanish from the UI *and* from
      Game 1 targets, not just from text?
- [ ] Add "loud sounds" — does the chime actually change?
- [ ] Any path where a generated string reaches the child without passing
      through the filter? That's the bug to hunt.
- [ ] Empty avoid list — no behaviour change, no cost?

## Not in this file
Not a preference weighting — this is a **hard exclusion**. No "reduce" or
"minimise" semantics.

## Guide refs
§6.2, §6.4, §6.6
