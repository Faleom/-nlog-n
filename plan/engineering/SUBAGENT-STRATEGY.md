# Subagent Strategy

How to run agents on this build. `BUILD-ORDER.md` says *what* comes next; this
says *how many contexts can safely work on it at once*.

---

## The general rules

**Parallel is safe when** files have no shared state, touch different code, and
build against an interface that is **already frozen**. "Already" carries the
sentence — two agents against a moving interface produce two incompatible
halves, and you find out at integration.

**Sequential is safer when** the work touches shared engine state, or anything
another person's in-progress file depends on. Also when the risk is **coherence
rather than volume** — a schema, a contract, tone-sensitive copy. Splitting
those doesn't make them faster, it makes them inconsistent.

**Fresh-context review is a separate invocation.** Never the same context that
wrote the file. Point a new agent at the diff plus the file's Review checklist
and ask whether it passes and whether it violates §13. A same-context
self-review does not satisfy this — the implementing context cannot see what it
was blind to.

**Verification is run by whoever implemented it**, before review. Review checks
correctness against spec; verification checks it actually runs. A reviewer
reading code cannot tell you the transmitted image was blurred.

**Never hand an agent "make it better" on a file that already meets its Done
criteria.** Every file has a *Not in this file* section, and most of it is scope
creep that would violate §13. A helpful agent adding a progress score to the
dashboard is a realistic failure mode here, not a hypothetical one.

---

## Wave 0 makes everything else parallel

The single highest-leverage thing in this document. Agree the **crop tag shape**,
the **slot list**, the **game contract** and the **ports** before any code — and
three people can then build against interfaces that don't exist yet.

Concretely: P3 authors the entire lookup table (F.007) against a tag shape
agreed on paper, while P2 is still writing the pipeline that produces it. That's
a whole Tier 0 file moved off the critical path for twenty minutes of talking.

**Fixture adapters extend the same trick.** `FixtureVision` returning canned
crops is five lines and unblocks F.008's scaffolding before F.006 lands.

---

## Per grouping

### Engine core — F.001, F.005, F.009, F.010, F.011, F.013 (P1)

**One agent per file, strictly in order. No parallelism.** Each reads state the
previous one defines: F.011's fading reads F.010's log shape, F.013 reads both.
Run them concurrently and the second builds against an interface that moves
underneath it.

Per-file agents are still worth it — hand each the **frozen** interface of the
previous file, pinned in the prompt, plus the F.00X file.

**F.009 deserves its own note.** It's a state machine with exact numbers in
§7.7's config block. Give the agent that table verbatim and ask it to build the
config object first. Then verify by hand: tap wrong three times and watch what
happens. Do not accept "the logic looks right."

**No one else edits engine files while F.009 or F.010 is in progress.**

### Perception — F.006 (P2)

**One agent, and the ordering is sacred.** If one agent owns blur and another
owns the upload, they will negotiate who receives the image, and the
blur-before-send guarantee is exactly what gets lost. Build the chain in one
context, in pipeline order.

**Verification is hands-on with the network inspector open**, using a real photo
with a real face — a team member's, never a child's. Reading the code proves
nothing here.

### Lookup table — F.007 (P3)

**The most parallelisable file in the build.** ~15 objects × 3–4 templates is
bulk authoring against a fixed shape. Fan out: one agent per group of five
objects, each given the tag shape, the slot list, and three worked examples so
the voice stays consistent.

Then **one human pass for tone.** Fifteen agents writing preschool instructions
produce fifteen registers.

### Game 1 — F.008, F.012, F.017 (P2)

**Sequential.** F.008 is the Tier 0 gate and it's where the caregiver/child view
flip lives — subtle, and easy to get wrong in a way that looks fine. F.012 needs
F.009 frozen. F.017 needs F.016.

Within F.008 a split between the caregiver view and the child view is
reasonable, since the flip is the interface between them — but agree that
interface first.

### Onboarding & profile — F.002, F.003, F.004, F.016, F.018 (P4)

**Mostly parallel-safe** — these are separate screens sharing only the profile
schema, which is frozen early.

Two exceptions:
- **F.004** gets its own agent. The no-people gate is a §13 guarantee, not a
  form field, and it needs one context holding both the capture flow and the
  rejection path.
- **F.018's avoid list** must be built by whoever understands that the filter
  runs **last**, after slot substitution. That ordering is the whole feature.

### Branch 2 — F.014, F.015, F.020 (P3)

**Sequential, and the highest-scrutiny group after F.006.**

Do **not** split F.015's card generation from its guardrail. The entire risk
lives at the seam between what the parent said and what the card claims, and
that seam needs one context.

The **review** agent for F.015 should be briefed to attack it: feed adversarial
inputs — one naming a condition outright, one purely emotional, one three words
long — and force the guardrail to fail to confirm the card is withheld.

For **F.020**, the review includes an actual grep for counters over activity
history, including unused ones.

### Tier 3 games — F.021, F.022

**Parallel-safe** once F.009 is frozen — they share the pattern, touch different
modules, and depend on each other not at all. Hand each agent the written game
contract, not "go read the engine."

But re-read §16.3 before starting either: *the second and third games are worth
roughly nothing.*

---

## Review load

| Owner | Reviewer |
|---|---|
| P1 (engine) | **P3** |
| P2 (camera, Game 1) | **P4** |
| P3 (content, Branch 2) | **P2** |
| P4 (onboarding, dashboard) | **P1** |

A one-way cycle. **P3 reviews the engine deliberately** — they own the restraint
rules and have no stake in its implementation, so they review for spec
compliance where P2 would review for usability.

## The four reviews worth doing properly

1. **F.006** — network inspector open. Is the transmitted image blurred?
2. **F.009** — tap wrong three times. Does the child end in success, silently?
3. **F.015** — force the guardrail to fail. Is the card withheld?
4. **F.020** — grep for counters over activity history.

Everything else can be a fast pass against the checklist. These four cannot.
