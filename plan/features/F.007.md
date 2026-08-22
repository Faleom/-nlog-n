# F.007 — Object → Skill → Steps Lookup Table

**Tier 0** · Owner: **P3** · Reviewer: P2 · Status: Implemented, self-verified — needs fresh-context review

## What
The mapping from a recognised object to something teachable. **§7.5 calls this
the hardest engineering problem in the app, and says that in 48 hours it must be
a rules-based lookup, not model improvisation.**

Mostly content authoring, which is why it's parallel work on Saturday rather
than blocked behind the pipeline.

## Depends on / Blocks
Needs F.006's tag shape (agree it on paper first — don't wait for the code).
Blocks F.008.

## Done when
- ~15 common household objects covered: cup, ball, shoe, spoon, door, chair,
  book, toy animal, plate, towel, brush, box, blanket, bottle, sock.
- Each maps to **3–4 skill templates**, each with ordered steps.
- Steps are authored with slots (F.005) — never generic strings.
- Steps are genuinely small: one thing a preschooler does. If a step needs "and
  then", split it.
- **No model call at runtime.** A table, shipped in the bundle.
- Unknown object → falls through to a generic template for its category, never
  an error.
- Works offline, obviously — it's a table.

## Review checklist
- [ ] Is this a table, or did an AI call creep in? (§7.5)
- [ ] Does every step reference only objects actually in the room?
- [ ] Does any output suggest buying, fetching, or preparing something? (§13)
- [ ] Are steps small enough to read aloud in one breath?
- [ ] Does an unrecognised object degrade to something usable?
- [ ] Do the templates use slots, so the same step reads differently per child?

## Not in this file
No AI. No scoring. No game rendering.

## Guide refs
§7.5, §12.1, §13
