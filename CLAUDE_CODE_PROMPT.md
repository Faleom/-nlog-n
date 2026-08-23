# Claude Code Prompt — Planning & Distribution Generation

## Context

You are planning a hackathon build. Read `APP_GUIDE.md` in full before doing
anything else — it is the complete product specification: what the app does,
why it's split into two branches, the shared game engine architecture, and
what must never be built. Do not invent product behavior that isn't in that
document. If something is genuinely ambiguous or missing, list it under an
"Open questions" section in your output rather than guessing silently.

Team size: **4 people**. Timeframe: a hackathon window (confirm the exact
hours with the team if not stated; assume roughly 24–48 hours of active build
time if unspecified, and make the timeline's granularity match that — hours
and half-day blocks, not days/weeks).

Your job is to turn `APP_GUIDE.md` into an actionable, sequenced build plan,
split into small numbered files, plus a set of per-person handoff files. Do
not write application code in this step — this is a planning pass only.

---

## Working discipline every feature file must follow

Borrow this loop for every unit of work — it's the same shape whether one
person is working alone or a subagent is delegated a piece of it:

```
plan -> confirm -> implement -> review (fresh context) -> verify -> mark done
```

- **Plan**: the F.00X file itself is the plan — what it is, what it depends
  on, its definition of done. Nobody starts implementing until the file's
  scope is read and, ideally, briefly confirmed with whoever owns a
  dependency.
- **Confirm**: before implementation starts on a file with non-trivial
  product-logic ambiguity (most Branch 2 files, and anything touching the
  Branch 1 ↔ Branch 2 handoff), the owner should re-read the relevant
  section of `APP_GUIDE.md` and confirm their planned approach matches it —
  cheap to do, expensive to skip, since these are the areas most likely to
  drift from spec under time pressure.
- **Implement**: build strictly to the file's definition of done — not more,
  not less. Resist scope creep from adjacent Tier-2/roadmap ideas in
  `APP_GUIDE.md`.
- **Review (fresh context)**: before a file is marked done, it must be
  checked by a context that did NOT write it — either a teammate, or a
  separate subagent spun up specifically to review (not the same subagent
  session that implemented it). The reviewer's only job: does this match the
  file's definition of done, and does it violate anything in `APP_GUIDE.md`
  Section 8 ("what this app never does") or the demo scope discipline in
  Section 10? A same-context self-review does not satisfy this step — the
  whole point is to catch what the implementing context is blind to.
- **Verify**: a quick functional check against the definition of done —
  doesn't need to be a formal test suite given the timeframe, but must be a
  real check (actually run it with real input), not a read-through.
- **Mark done**: only after review + verify both pass. Update
  `F.000-INDEX.md`'s status for that file so blocked teammates know to
  start.

Every `F.00X.md` file you generate must include a "Review checklist" section
(see template below) so the reviewer has something concrete to check against
— not just "does this look right."

---

## Output structure to generate

Create a `/plan` directory with the following:

### 1. Numbered feature/task files: `F.001.md`, `F.002.md`, `F.003.md`, ...

Break the app down into discrete, buildable units, each as its own file.
A unit should be small enough that one person could realistically own it
without blocking on someone else's unfinished work for too long, but not so
small that you end up with trivial one-line files.

Use this pattern as a guide for how to slice it (adjust as the actual product
spec demands — this is a starting shape, not a rigid template):

- **Shared engine pieces first** (these block everything else and must be
  built before individual games can be wired up): photo capture → object
  recognition → face-blur → discard-photo pipeline; condition profile system
  (ADHD/Autism as tunable parameters, not hardcoded forks); support-level
  ladder + fading logic; generalization re-testing logic; frustration/
  disengagement heuristic; no-fail feedback model
- **Each of the three games** (Find it in your world / My-toy story
  sequencing / Trace-and-match) as its own file, each explicitly built as a
  thin layer on top of the shared engine, not a standalone pipeline
- **Branch 2 flow** (worry → question card → local referral handoff) as its
  own set of files, since it's structurally separate from Branch 1
- **Branch 1 ↔ Branch 2 handoff logic** as its own file, since the spec is
  explicit that this is the most failure-prone part of the design
- **Onboarding** (shared entry, then branch-specific fields) as its own file
- **Caregiver dashboard** as its own file
- **Social story sub-flow** as its own file
- Anything else the spec implies that isn't listed above

Every `F.00X.md` file must contain:

```markdown
# F.00X — [Short Title]

## Status
[Not started / In progress / In review / Done]

## What this is
[1-3 sentences, plain language, referencing the relevant section of
APP_GUIDE.md]

## Depends on
[List other F.00X files that must be done first, or "None — can start
immediately"]

## Blocks
[List F.00X files that cannot start until this one is functionally done]

## Definition of done
[Concrete, testable — "works" is not sufficient. E.g. "uploading a real photo
of a room produces 3-5 activity suggestions with no crash, for both ADHD and
Autism profiles"]

## Review checklist
[3-6 concrete yes/no items a fresh-context reviewer can check against,
derived from the definition of done and from anything in APP_GUIDE.md
Section 8 or Section 10 relevant to this file. E.g. "Does the photo actually
get discarded after processing, not just unreferenced in the UI?" "Does a
face in the test photo get blurred before any processing happens?"]

## Explicitly out of scope for this file
[What NOT to build here, especially anything from APP_GUIDE.md Section 8
("what this app never does") or Section 10 (demo scope discipline) that's
relevant to this piece]

## Suggested owner
[Person 1-4, see distribution files — one primary owner per file, even if
others help]

## Suggested subagent approach
[See SUBAGENT-STRATEGY.md for the general rules — state here specifically
whether this file is safe to split across parallel subagents, or should be
one sequential agent, and why, given what this particular file touches]
```

Number files in the order they should logically be tackled, not alphabetically
by feature name — F.001 should be the first thing anyone touches (almost
certainly a shared-engine piece), later numbers depend on earlier ones. Where
several files have no dependency on each other and could run in parallel,
say so explicitly in each file's "Depends on" section rather than implying a
false sequence through numbering alone.

### 2. `F.000-INDEX.md`

A single file listing every F.00X file with: its title, its owner, its
current status, and its dependency chain, so anyone can see the whole shape
of the build without opening every file. Include a simple dependency graph
in text or mermaid form. This file's status column is the source of truth
for "what's actually done" — every person updates their own rows as they
move files through plan → implement → review → verify → done.

### 3. `TIMELINE.md`

A phased build timeline broken into blocks (e.g. "Hour 0-4", "Hour 4-10",
etc. — adjust granularity to the actual confirmed hackathon window). For each
block: which F.00X files should be in progress, which should be done by the
end of the block, and what the team should sanity-check together at that
checkpoint (e.g. "by end of block 2, the shared engine must accept a photo
and return activity suggestions for at least one game — if this isn't true,
stop adding new games and fix this first"). Build in at least one explicit
"integration checkpoint" where all 4 people's pieces get plugged together
and tested end-to-end before continuing, and one "scope cut" checkpoint late
in the timeline where anything not yet working gets explicitly cut rather
than left half-done (protects Technical Execution — a missing feature scores
better than a broken one). Note in each block which files are due for
fresh-context review, not just implementation, so review doesn't get
skipped under time pressure at the end.

### 4. Per-person distribution files: `PERSON-1.md`, `PERSON-2.md`,
`PERSON-3.md`, `PERSON-4.md`

Each file is a self-contained handoff — written so that a team member can
pull the repo, open only their own `PERSON-N.md`, and know exactly what to
do without needing to read anything else first (though they still can).
Each file must contain:

```markdown
# Person N — Your Build Assignment

## Your files, in order
[List their assigned F.00X files in the order they should tackle them, with
a one-line reminder of what each is]

## What you're building, in plain language
[A short paragraph synthesizing their assigned pieces into a coherent
description of what they personally own]

## Who you depend on
[Which other person's output you need before you can finish which of your
files, and roughly when in the timeline you should expect it]

## Who depends on you
[Same, in reverse — so they know what's blocked on them and can flag early
if they're falling behind]

## Your integration checkpoints
[Pulled from TIMELINE.md — the specific points where their work needs to
plug into someone else's]

## Your review responsibilities
[Which OTHER person's files you are the designated fresh-context reviewer
for, per the plan -> confirm -> implement -> review -> verify loop — pick
pairings so nobody reviews their own work, and ideally so nobody reviews the
same person who reviews them exclusively (avoid two people just rubber-
stamping each other all event)]

## How to start
[A concrete first command/action — "open F.001.md and F.003.md, they're
your first two files, start with F.001 since nothing else can proceed until
the photo pipeline exists"]
```

Assign files to people based on natural ownership boundaries (e.g. one person
on the shared engine core, one person split across the three games since
they share a pattern, one person on Branch 2 end-to-end since it's
structurally separate, one person on onboarding + dashboard + integration).
Balance workload roughly evenly across all 4 — don't let one person's
assignment be trivially small while another's is the whole shared engine.
State your reasoning for the split briefly at the top of `F.000-INDEX.md`.

Assign review pairings so review load is also balanced, and so the person
who owns the shared engine (the highest-risk, most-depended-on piece) gets
reviewed by whoever has the clearest head for spec-compliance, not just
whoever's free — call this out explicitly if relevant.

### 5. `SUBAGENT-STRATEGY.md`

This file must do two things: state the general rules once, then map them
onto the actual feature split so each person knows exactly how to run their
own subagents for their own files — not a generic Claude Code tutorial.

**Part A — General rules (state once):**

- **Parallel subagents are safe when** files have no shared-state
  dependency and touch different parts of the codebase — e.g. one subagent
  scaffolding a game's UI while another wires up its interaction logic, if
  the shared engine's interfaces are already stable and both subagents are
  building against a fixed contract, not still negotiating it.
- **A single sequential agent is safer when** the work touches the shared
  engine core, or touches anything another person's in-progress file
  depends on — conflicting concurrent changes to shared-engine files block
  the whole team, not just the person making them. Nobody should run
  parallel subagents against the shared-engine files at the same time as
  someone else is also editing them.
- **Fresh-context review must be a separate subagent invocation** (or a
  teammate), never the same conversation/context that implemented the
  file — this is the whole mechanism that catches blind spots, and it's
  cheap to do since it's just a new subagent pointed at the diff plus the
  file's Review checklist.
- **Verification should be run by whoever implemented the file**, before
  handing to review — review checks correctness against spec, verification
  checks that it actually runs; don't conflate the two roles.

**Part B — Mapped onto this project's actual feature split:**

For each major grouping of F.00X files (shared engine, the three games,
Branch 2, the handoff logic, onboarding/dashboard), state explicitly:
- Whether that grouping is a good candidate for parallel subagents within
  one person's own work, and what the split would be if so (e.g. "for the
  three game files, since they share the same thin-layer-on-engine pattern,
  the owner can likely run one subagent per game in parallel once the
  shared-engine files are done and stable, since the games don't depend on
  each other — only on the finished engine")
- Whether that grouping should instead be one sequential agent per file, and
  why (e.g. "the shared engine files should be built by one subagent at a
  time, sequentially, since the support-level ladder reads state that the
  condition profile system defines — running these in parallel risks
  building against an interface that changes underneath the second agent")
- Who the fresh-context reviewer is for that grouping, cross-referenced with
  the review pairings in the PERSON-N.md files, so this file and the person
  files agree with each other

---

## Rules for this planning pass

- Do not silently expand scope beyond what's in `APP_GUIDE.md`. If you think
  something is missing from the spec that the build genuinely needs, flag it
  in an "Open questions" section in `F.000-INDEX.md` rather than deciding it
  yourself.
- Do not make technology/library/API choices. Reference capabilities
  generically (e.g. "an object-recognition call," "a face-detection step")
  the way `APP_GUIDE.md` does, not specific vendors or packages — that's a
  separate decision the team will make later.
- Keep every file's language plain and skimmable — these will be read fast,
  under time pressure, by people who did not necessarily read the full
  `APP_GUIDE.md` first.
- Respect the demo scope discipline in `APP_GUIDE.md` Section 10 explicitly
  in the timeline and in the F.00X files — the plan should make it easy to
  build one condition end-to-end first, not tempt the team into building
  breadth before depth.
- Keep the plan -> confirm -> implement -> review -> verify -> mark done
  loop intact for every file — don't let any F.00X file skip straight from
  "implement" to "done" without a review step performed by a different
  context than the one that built it.
- When finished, print a short summary in the chat (not a file) listing
  every file you created and one line on what each contains, so the team can
  sanity-check the output before splitting up to build.
