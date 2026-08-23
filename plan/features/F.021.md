# F.021 — Game 3 Mode A: Shadow Match

**Tier 2 — required.** All three games ship this weekend. · Owner: **P2** · Reviewer: P4 · Status: Implemented, self-verified — needs fresh-context review

## What
Silhouette at top, real photos below, child picks the match. The cheapest second
game because it reuses every crop and the whole engine.

## Depends on / Blocks
Depends on F.008, F.009. Blocks nothing directly, but this is Game 3's floor —
F.023 (Modes B/C) builds on top of whatever this file establishes.

**Sequenced after Game 1 (F.008 → F.012 → F.017), not before it.** Game 1 is
still the demo centrepiece and still comes first for P2. This is what P2 moves
to once Game 1 is solid, not a parallel track competing for the same hours.

## Done when
- Four levels: identical photo → same object different angle/lighting → black
  silhouette → **silhouette with the answer not on screen**, child fetches the
  real object.
- **Level 4 hands directly into Game 1's loop** — intentional, and it reinforces
  that they're the same skill at different distances (§8.3).
- Silhouettes generated **client-side** from the crop (threshold + fill). No
  extra API cost, no latency.
- Reward: the silhouette **dissolves into the real photo of their object**.
- **The Companion's silhouette is the Level 1 sample every session** — the most
  recognisable shape in the child's world, and the gentlest entry rung.
- Errorless: wrong tap → silence, fade, dead. Same hierarchy as F.009.
- **Level carries across modes** — a child at Level 3 here starts Level 3 in any
  other Game 3 mode. The ladder belongs to the child, not the mode.
- Phone: sequential reveal, 2 options at a time (§4.3).

## Review checklist
- [ ] Is it a thin layer — skill, interaction shape, step rendering only?
      Any engine logic here is a contract violation.
- [ ] Are silhouettes generated locally, with no API call?
- [ ] Does the Companion silhouette open every session at Level 1?
- [ ] Does Level 4 actually hand into Game 1's loop?
- [ ] Does level state carry across modes, not reset per mode?
- [ ] Wrong tap silent, per F.009?

## Not in this file
Modes B (Trace) and C (Puzzle) — **F.023, built after this one lands and is
tested.** Do not start them in parallel with this file; they share this file's
engine and level state, so building them concurrently means two contexts
guessing at an interface that isn't frozen yet.

## Guide refs
§8.3, §16.1
