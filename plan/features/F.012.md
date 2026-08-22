# F.012 — Game 1 Difficulty Levels 1–4

**Tier 1** · Owner: **P2** · Reviewer: P4 · Status: Not started

## What
Four difficulty axes on the Game 1 loop, moving along together.

| Axis | L1 → L4 |
|---|---|
| Prompt type | named object → attribute → category → function |
| Grid size | 2 crops → 6 crops |
| Distractors | unrelated → sharing a feature with the target |
| Search scope | one area → whole room → **a different room** |

## Depends on / Blocks
Depends on F.008, F.009. Blocks nothing.

## Done when
- All four levels reachable and visibly different.
- Prompt phrasing walks the ladder: *"your red cup"* → *"something red"* →
  *"something you drink from"* → *"something you use when you're thirsty"*.
- **Profile tuning applied** (§8.1): calm/sameness/minimal-words → literal
  prompts only, no idioms, identical phrasing every trial, fixed grid layout,
  **no timer of any kind**, reward crop in the same position every time.
  Lively/short-attention → shorter prompt, movement folded into retrieval,
  faster celebration, break every 3 trials.
- Level state is per child and persists.
- Phone: carousel, 2.5 crops visible. Tablet: 3×2 grid. **Cap the grid on
  phones, never shrink the target** (§4.3).

## Review checklist
- [ ] Are all four levels actually distinguishable in play?
- [ ] Under calm/sameness, is phrasing identical trial to trial and layout
      fixed? Any timer anywhere? There must be none.
- [ ] Does tuning come from the four response dimensions, never a condition?
- [ ] On a real phone, are targets still ≥88pt at 6 crops?
- [ ] Does level 4's "different room" scope actually change the prompt?

## Not in this file
No Companion hunt or helper framing (F.017). No camera verify — that's an
optional extra on generalization re-tests only, which is Tier 4.

## Guide refs
§4.3, §8.1
