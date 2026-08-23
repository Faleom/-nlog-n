# F.023 — Game 3 Modes B & C: Trace and Puzzle

**Tier 3 — stretch, real owner, buildable if there's time** · Owner: **P2** · Reviewer: P4 · Status: Not started

> **Stale relative to F.021's redesign.** F.021 is no longer a single-session
> "level 1-4" Shadow Match with a shared level state — it's a Chapter/Lesson
> roadmap engine (see F.021.md). "On top of F.021's engine" below now means
> "as a later chapter in the same roadmap," not "a second mode sharing a
> `Game3Level`." Still not started, still genuinely optional — this note
> exists so whoever picks this up next doesn't build against the old shape.

## What
The remaining two modes of Game 3, on top of F.021's engine. Team decision: all
three games ship, so this moves from spec-only to a real Tier 3 file — but it
is still the first thing cut if the weekend runs long, and it is still true that
§16.3 found the second and third games move the needle least in judging. Build
F.021 first, get it tested, then come here.

**Mode B — Trace.** Silhouette of one of their objects; the child traces it with
a finger. **No accuracy threshold.** Any sustained contact along the path fills
it in. No wrong stroke, no restart, no "try again". Levels: thick guide line →
thinner → dotted → disappears after a 2-second preview. Reward: the traced
outline fills with the actual photo of their object.

**Mode C — Puzzle.** A photo of one of their objects splits into 2–6 pieces.
Tap-to-place default, drag optional. Levels: 2 pieces with outlined slots → 4
outlined → 4 unoutlined → 6 unoutlined. Errorless: wrong placement silently
returns the piece; after two wrong attempts on one piece, only its correct slot
stays active. Reward: the completed image animates to full size, audio names it.
**The first puzzle of every session is the Companion's photo.**

## Depends on / Blocks
Depends on F.021 (shares its engine, its level state, and its crop reuse
pattern). Blocks nothing.

## Done when
- **Mode B — Trace.** Silhouette of one of their objects; the child traces with
  a finger. **No accuracy threshold** — any sustained contact along the path
  fills it in. No wrong stroke, no restart, no "try again." Levels: thick guide
  line → thinner → dotted → disappears after a 2-second preview. Reward: the
  traced outline fills with the actual photo of their object.
- **Mode C — Puzzle.** A photo of one of their objects splits into 2–6 pieces.
  Tap-to-place default, drag optional. Levels: 2 outlined → 4 outlined → 4
  unoutlined → 6 unoutlined. Errorless: wrong placement silently returns the
  piece; after two wrong attempts on the same piece, only its correct slot stays
  active. Reward: the completed image animates to full size, audio names it.
  **The first puzzle of every session is the Companion's photo.**
- **Level state carries across all three Game 3 modes** — inherited from
  F.021, not reset here.
- **Build order: Puzzle before Trace.** §8.3 calls Puzzle cheaper and more
  demoable. If only one of the two lands, it should be Puzzle.
- Rotation across sessions (A → B → C) works once at least two modes exist —
  wire it here even if only Puzzle is done; Trace slots in when it lands.

## Review checklist
- [ ] Is it a thin layer on F.021's engine, or did engine logic get duplicated?
- [ ] Trace: is there genuinely no accuracy threshold — does any sustained
      contact along the path fill it in?
- [ ] Puzzle: does a wrong placement silently return the piece, with no mark?
- [ ] Does the first puzzle of every session use the Companion's own photo?
- [ ] Does level state carry over from F.021 rather than starting at zero?
- [ ] If only one mode landed, is it Puzzle, per the stated build order?

## Why it's cheap later
Both consume the same crops and the same difficulty ladder as Mode A. Level
carries across modes. Rotation: one mode per session, A → B → C, with Q3
governing speed — *sameness helps* stays on one mode for three sessions and is
**told in advance**; *likes variety* rotates every session.

## Use in the pitch
§16.2: show this spec on screen for four seconds as evidence of the modular
claim. Better than building it badly.

## Guide refs
§8.3, §16.1, §16.2
