# F.021 — Game 3: the roadmap engine (Match and Draw)

**Tier 2 — required.** All three games ship this weekend. · Owner: **P2** · Reviewer: P4 · Status: Implemented, self-verified — needs fresh-context review

> **Redesigned, twice.** This file originally described a single-session
> "Shadow Match" mode (identical photo → altered → silhouette → fetch-the-
> real-object, levels 1-4, no persistence across sessions). That was
> replaced with a Duolingo-style **Chapter → Lesson → Round** progression
> engine, per `TASK-game3-roadmap.md` and `game3-subagent-strategy.md`,
> initially built from the child's own captured crops. **Then, on explicit
> product direction, content was changed again: Game 3 no longer touches
> the camera at all.** It runs entirely on a small set of bundled,
> hand-illustrated stock icons (`src/games/game3/stockAssets.ts`) — a
> deliberate, stated exception to the rest of the app's "content is always
> the child's own room, never stock" principle (app-guide-v3-FINAL.md §1,
> §6.1, §7.3). Game 1 and Game 2 are unaffected and still use real captured
> content; this deviation is scoped to Game 3 only. The
> `newElement === null` "silhouette matching" concept from the original
> design is still future scope (a later chapter), not this one — see "Not
> in this file."

## What
A path of short lessons, each 4 rounds of "which picture matches", built
from a small set of bundled illustrated icons (not the child's own room —
see the redesign note above). Lessons introduce one new object at a time,
alternating with the field of options growing, with a consolidation lesson
after every 2nd new object. A lesson passes only once every round needed
tier-3-or-lighter support; the chapter itself only completes once the same
objects are recognised independently (tier 5) in **two named stock sets**
("Kitchen", "Bedroom") standing in for two rooms — finishing every lesson
is not enough on its own, generalization is a separate, explicit gate.

## Where it lives
- `src/games/game3/types.ts` — Chapter/Lesson/RoundResult/RoadmapProgress.
- `src/games/game3/stockAssets.ts` — the bundled content itself: two named,
  hand-authored SVG icon sets (inlined as `data:` URIs, no external image
  files, no network fetch, no licensing question).
- `src/games/game3/generator.ts` — the pure lesson-walk (per-context).
- `src/games/game3/advancement.ts` — pass/repeat and the chapter-complete gate.
- `src/games/game3/roundBuilder.ts` — target + options-grid selection for one round.
- `src/games/game3/roadmap.ts` — StoragePort persistence, orchestration, the
  sequential lesson-unlock rule. Agnostic to where crops come from — it
  took real captured photos in an earlier version of this file.
- `src/screens/Game3Roadmap.tsx` — caregiver-facing path view. No longer
  calls the capture pipeline at all; "start" and "try the next set" both
  just pull the next bundled stock set in.
- `src/games/Game3Play.tsx` — the actual round loop; the only genuinely
  child-facing piece, reached only by tapping an unlocked lesson node.
  Unchanged by the stock-asset switch — it only ever consumed whatever
  crops it was handed, regardless of origin.

## Depends on / Blocks
Depends on F.009's InteractionMachine (reused directly for the round loop,
not reimplemented) and F.010's support-tier ladder. **No longer depends on
F.006** (the capture pipeline) — that was true in the previous redesign,
not this one. Blocks nothing directly — F.023 (originally "Modes B & C, on
top of F.021's level state") no longer has a level state to build on in
the old sense; see that file's own note.

## Done when
- Lesson generator matches §4's rules: alternates introducing a new target and
  growing the field size, consolidates after every 2nd new target, drops the
  field size one step on a context change, never emits a target absent from
  the crop set, and produces a shorter chapter for a smaller pool.
- A lesson passes only when **all 4 rounds** resolved at support tier ≥3;
  any round at tier 1-2 sends the whole lesson back to repeat.
- Chapter completion requires **both** every lesson passed **and** tier-5
  independence demonstrated in **2 distinct stock sets** — moving to the
  second set is a real, first-class action in the roadmap view, not a stub.
- Round loop reuses `InteractionMachine` unchanged — errorless completion,
  the same 4-tier prompt hierarchy, silence-plus-fade on a wrong tap.
- Progress (`RoadmapProgress`) survives reload via the real StoragePort —
  including resuming mid-lesson at the exact next round, not restarting.
- No score/star/confetti/points, no counter/streak/tally/threshold construct
  (checked by `scripts/smoke-f021.ts`, same convention as `smoke-f020.ts`'s
  repo-wide allowlist).
- Locked lessons render no content to the roadmap view — a lock glyph only.

## Review checklist
- [ ] Is the generator pure, and does it match §4's four rules (not
      necessarily the illustrative table byte-for-byte — see generator.ts's
      own header for why that distinction is deliberate)?
- [ ] Does `lessonOutcome` require all 4 rounds and reject on any tier <3?
- [ ] Does chapter completion actually require 2 independent contexts, not
      just "every lesson passed"?
- [ ] Does Game3Play.tsx reuse InteractionMachine, or did engine logic creep
      back into a game file?
- [ ] Does a wrong tap stay silent (no `speechOut.say` in that branch)?
- [ ] Does `RoadmapProgress` (not the derived `Lesson[]`) is the only thing
      persisted, so lessons can never drift from saved progress?

## Not in this file
Chapters 2-6 (new angle, silhouette, partial reveal, find-the-two, puzzle) —
explicitly out of scope, not stubbed. The old Shadow Match level-4 "fetch the
real object" idea and the silhouette-dissolve reward both remain valid
material for a **later chapter**, not a rewrite of Chapter 1.

## Guide refs
§8.3, §16.1 (original product framing) · `TASK-game3-roadmap.md`,
`game3-subagent-strategy.md` (this redesign's actual spec).
