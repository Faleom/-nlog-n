# Status — read this first

**If you are a fresh Claude Code session with no prior context on this
project, this file is the entry point. Read this before `README.md`, before
`plan/`, before anything else.** Everything below is accurate as of the last
commit on `main` — check `git log -1` if you want to confirm nothing has
moved since.

---

## What this is

A photo-based early-learning app for pre-verbal preschoolers (autistic, ADHD,
or undiagnosed), built for Melbourne Hack 2026. Full product spec:
`app-guide-v3-FINAL.md`. Build plan: `plan/`. **The app itself is real,
mostly built, and mostly working** — this is not a planning-stage repo.

---

## The one-paragraph version

21 of 24 feature files are implemented, automatically tested, and
merged into `main`. The whole thing is wired together into one real,
click-through app (`app/src/App.tsx`) — onboarding, both branches, all three
games, the dashboard. `tsc`, `oxlint`, all 25 automated test suites, and the
production build are clean as of the last commit. **What has NOT happened:
nobody has watched a human click through it start to finish and confirmed it
actually works as a product, no real device testing, and it isn't deployed
anywhere.** That's the actual next work, not more building.

---

## How this repo got built (context you'd otherwise be missing)

This was built solo, overnight, by one Claude Code session working as
"Person 1" and directing three parallel background agents as Persons 2, 3,
and 4 (via the `Agent` tool, each in an isolated git worktree, merged back
into `main` one at a time with full validation after every merge). The
`plan/assignments/PERSON-N.md` files describe the *original* per-person
briefs — useful for understanding the reasoning behind the split, but they
describe what each person was asked to build, not a live status. **This
file, and the Status column in `plan/overview/F.000-INDEX.md`, are the
current truth.** The person briefs are historical.

Two real, non-trivial bugs were caught and fixed during integration — not
hypothetical risks, actual things that would have shipped broken:
- A game screen was sending a camera capture straight to object recognition
  with no face-blur step, bypassing the single most safety-critical
  guarantee in the app. Caught by an automated repo-wide check, fixed for
  real.
- Two files differed only by their first letter's case
  (`Game3ShadowMatch.tsx` vs `game3ShadowMatch.ts`) — collided on this
  machine's case-insensitive filesystem, a real `tsc` error. Renamed, fixed.

Both are recorded in detail in the git log if you want the full reasoning
(`git log --oneline` — commit messages are long and specific on purpose).

---

## Session 2 — UI/UX pass, and a real laptop-testing bug (post-handoff)

After the state above was written, the same human came back and used the
running app for the first time — which immediately surfaced things no
automated check could: the navigation gave no sense of where you were, the
visual design was unstyled prototype chrome, and the capture flow was
**completely broken when testing on a laptop**, not just ugly. All of the
below is done, verified (`tsc`/`oxlint`/full smoke/build all clean), and
merged — but still carries the same caveat as everything else in this file:
self-verified, not yet human-click-tested end to end.

**Navigation & wayfinding.** `app/src/components/ScreenHeader.tsx` (new) —
every screen except the two true roots now shows which flow it's in (eyebrow
text), a consistent back affordance, and — during the one-time four-screen
setup chain — a step counter ("Step 2 of 4") with a progress bar. Previously
there was no header at all on most screens and a bare `← Back` on the rest.

**A real design pass.** `app/src/App.css` now has an actual design system —
color/spacing/radius tokens, a typography scale, and Apple "Liquid Glass"
styled buttons (`backdrop-filter: blur/saturate`, bright edge highlight, soft
shadow, with an `@supports` fallback to solid surfaces where unsupported).
The app shell has a real static gradient background instead of flat
off-white, and `app/src/components/AppHeader.tsx` (new) is a persistent
top identity bar — deliberately using a placeholder name
(`APP_NAME_PLACEHOLDER`, one line to edit) since "Project name" is still an
open decision (see below) and a UI pass shouldn't lock one in. No web fonts,
no UI/animation dependency added — the app's "runs fully offline" claim and
its zero-dependency-CSS convention both held.

**A real, previously-unfixed bug: capture was silently broken on a laptop.**
`app/src/adapters/capture/deviceCamera.ts` tried `getUserMedia` (a live
camera) first, and its fallback to a file picker called `.click()` from
inside an async `catch` block — by then, several ticks after the original
tap, the browser's user-activation window had expired, so the file dialog
silently never opened. No error, no dialog — `capturePhoto()` just hung
forever, leaving a caregiver on a "please wait" screen with nothing to press.
This is exactly the "laptop build, file upload not live camera" decision
from Session 1 that never actually got carried into this file. Fixed: the
file picker is now the default, synchronous, primary path (`.click()` fires
in the same call stack as the tap, so activation can't expire first), with
graceful handling if the dialog is cancelled. The old live-camera code is
preserved and swappable back in later (one line in `registry.ts`) for a real
tablet/phone deployment — see the comment in `deviceCamera.ts`. Button copy
in `Game1.tsx`/`Game3ShadowMatch.tsx` changed from "Take a photo" to "Choose
a photo of the room" to match what it actually does now.
`plan/engineering/TECH-DECISIONS.md` and `plan/features/F.006.md` were
updated to state this as the actual current decision (a build-environment
call) rather than still contradicting the code — `app-guide-v3-FINAL.md`'s
own product vision (camera-native, tablet/phone, no file picker) was left
untouched, since that describes the eventual shipped product, not this dev
build.

**A second real bug, found while doing the visual pass, not looking for
it: Game 2 (`F.022`) still violated "zero text in the child's view."** Its
own header comment admitted "WALKING SKELETON, same maturity as Game1.tsx
[used to be]" — the child's tap-in-order turn was rendering visible crop
name labels on every button plus caregiver instruction text on the same
screen. Fixed to match Game 1/3's already-correct pattern: photo/colour
tiles, zero text, progress shown by dimming rather than a label. Also fixed:
the new `ScreenHeader`/`AppHeader` chrome would itself have leaked text
into the child's view during Game 1/3's confirming/celebrating phases —
each game now reports its own child-facing state up to `App.tsx` via an
`onChildFacingChange` callback, and the shell hides its chrome entirely
(not just visually) during that window. This is a real, non-hypothetical
compliance rule (`plan/engineering/UI-STANDARDS.md`), not a style choice.

**A design-tips skill was installed**, at `.claude/skills/` (from
[emilkowalski/skills](https://github.com/emilkowalski/skills) —
`emil-design-eng`, `animate`, `review-animations`, `pick-ui-library`, and a
few others). It's local to this Claude Code project config, not part of the
app itself, and governed the easing/timing/press-feedback choices above.

**How this was actually built**: two parallel background agents (one for
the visual pass, one for the capture-bug root-cause + fix), spawned via the
`Agent` tool without git-worktree isolation this time — deliberately, since
they were briefed onto disjoint file sets (visual agent: `App.css`,
`App.tsx`, `ScreenHeader.tsx`; bug-fix agent: `deviceCamera.ts`, the two
docs, and one button-text line each in `Game1.tsx`/`Game3ShadowMatch.tsx`)
and there was uncommitted work in the tree that worktree isolation would
have forked away from. Both were re-verified together (not just trusted
individually) after both landed.

---

## Session 3 — Game 3 redesigned into a roadmap engine (post-handoff)

The human came back with `TASK-game3-roadmap.md` and
`game3-subagent-strategy.md` — a spec for a Duolingo-style Chapter → Lesson →
Round progression engine ("Match and Draw"), written against a different
team/repo context (an "ECC" harness, a `docs/` folder, git branches) than
this one actually has. Before building, two things were confirmed with the
human rather than assumed: (1) this **replaces** Game 3 entirely, not an
add-on beside the old Shadow Match design, and (2) build directly in this
tree with no git branch, since this checkout has no `.git` and the ECC
plugin isn't installed here — a plain implementation pass instead of that
harness's `/ecc:plan` / `/quality-gate` / `/save-session` flow.

**What changed.** `Game3ShadowMatch.tsx`, `game3Level.ts` and
`game3ShadowMatchLogic.ts` are gone. In their place:
- `app/src/games/game3/{types,generator,advancement,roundBuilder,roadmap}.ts`
  — pure generator/advancement logic plus StoragePort-backed persistence.
  Chapter 1 ("Match the picture") only; Chapters 2-6 explicitly out of scope,
  same restraint the original guide's tiering already modelled elsewhere.
- `app/src/screens/Game3Roadmap.tsx` — caregiver-facing path view, owns the
  room-capture flow including the **second-room capture** that's required
  for the chapter-completion generalization gate (§6 of the task spec: all
  lessons passed AND independence shown in 2 different rooms — not just
  "finished every lesson").
- `app/src/games/Game3Play.tsx` — the actual child-facing round loop,
  reached only from an unlocked roadmap node.

**Reused rather than reimplemented:** `InteractionMachine` (F.009) drives
the round-by-round prompt hierarchy unchanged; `SUPPORT_TIERS` (F.010) is
the same caregiver-reported ladder every other game uses;
`game1Trial.ts`'s `pickNextTarget` is reused directly for round-target
selection. `silhouette.ts`/`silhouetteCanvas.ts` were left in place,
unwired — reusable material for a real Chapter 3 later, per the task
spec's own §12, not deleted just because nothing currently imports them.

`scripts/smoke-f021.ts` was rewritten for the new engine (generator rules,
the pass/repeat and two-context chapter gate, persistence + resume-mid-lesson
via fake-indexeddb) — self-verified the same way every other file in this
repo is, i.e. **not yet reviewed by a fresh context, and not yet click-tested
on a device.** `plan/features/F.021.md`, `F.023.md` and
`plan/overview/F.000-INDEX.md` were updated to describe the new design
rather than silently going stale.

**Follow-up, same session: Game 3 moved off real photos entirely.** On
explicit product direction, Game 3 no longer touches the camera at all —
it now runs on `src/games/game3/stockAssets.ts`, two small named sets of
hand-authored SVG icons ("Kitchen", "Bedroom") inlined as `data:` URIs, no
external image files, no network fetch, no licensing question. This is a
**deliberate, stated exception** to the rest of the app's "content is
always the child's own room, never stock" principle
(`app-guide-v3-FINAL.md` §1, §6.1, §7.3) — say that plainly if it comes up
in Q&A, don't let it read as an accidental contradiction of the app's own
pitch. Game 1 and Game 2 are untouched and still work exactly as the guide
describes. `Game3Roadmap.tsx`'s capture flow, `captureNotice`/`slowCapture`
state, and its dependency on F.006 are all gone; `Game3Play.tsx` needed no
changes at all, since it only ever consumed whatever crops it was handed.
`scripts/smoke-f021.ts` gained checks that the two stock sets are
internally distinct and don't silently overlap, and that
`Game3Roadmap.tsx` no longer imports the capture pipeline.

**This time, every verification command was actually run, not just self-
reviewed** — Node hadn't been installed on this machine at all before this
session (nvm + Node 24 LTS installed fresh, no admin password needed).
`npx tsc -b`, `npx oxlint`, `npm run smoke` (649 checks across all 22
suites) and `npm run build` all pass clean as of this commit. A real
generator bug was caught and fixed by the smoke suite along the way (a
second stock set's first lesson was skipping past its intentionally-
dropped starting difficulty) — exactly the kind of thing self-review alone
would have missed. **Still not done:** an actual human click-through in a
browser, and real-device testing — nothing here executes the live
component tree the way a person tapping through it does.

---

## Session 4 — the Logic & Quantity track's first two rounds (post-handoff)

The human brought `Logic & Quantity Rounds.pdf`, a spec for a **fourth
track** of five wordless rounds, and asked for two of them — **Block-stack
match** and **Sort by rule** — with two interaction changes they'd already
reasoned out. Both are built, wired into `App.tsx`, and reachable from
Branch 1 home. `plan/features/F.027.md` and `F.028.md` carry the full
reasoning; `plan/overview/F.000-INDEX.md` has a section on the track.

**F.027 Block-stack match — the − / + buttons are gone.** The human's
objection was that preschoolers don't understand plus and minus. True, and
there's a harder version of it: those two glyphs sat **inside the child's
view**, and a child decoding `+` is reading — the same gate the app exists
to avoid, and the same ground the track's own cut list used to reject
counting with numerals. Replaced with a vertical swipe on the tower.
**Up lifts a block off, down places one on** — held in a single exported
constant (`SWIPE_MEANING`), because the competing reading ("up = the tower
grows") is its exact inverse and a child holding the wrong model makes the
tower worse on every attempt. A **tap** does the same two actions resolved
by where it lands, unadvertised, because a swipe is cheaper than a drag but
still wants a clean directional gesture some children can't produce.

**F.028 Sort by rule — tap-then-tap stayed primary.** The human initially
asked for drag-and-drop. That was flagged rather than built: the track's
own spec rejects drag by name ("would add a motor demand some of these
children can't meet"), and `app-guide-v3-FINAL.md` independently says the
same thing twice (§8.2 step 5, §8.3 Mode C). Built as tap-then-tap primary
**with drag also working, never required** — the existing house pattern,
which gives drag to children who want it without excluding those who can't
hold contact. The human agreed. Both inputs go through one code path so
they can't diverge. All shapes are one colour by construction (`SortItem`
has no colour field), so the rule can only be shape.

**A real bug, found by actually clicking through the built app** — not by
any automated check: both rounds had a caregiver-facing **"Finish" button
rendered inside the child's zero-text phase**. A visible word, in the one
place the app promises there are none. Fixed the way every other game
already behaves: the round **auto-advances on completion** (§7.7's "no Next
button"), and the smoke suites now assert that no JSX text node exists
anywhere in either child-facing view, so it can't come back.

**One design note worth keeping:** F.020's repo-wide guard on
counter/streak/threshold constructs fired on this work. Two of the three
hits were test files that must name the banned words to assert their
absence — allowlisted, with reasons, like the existing entries. The third
was a gesture-distance constant named `SWIPE_THRESHOLD_PX`; rather than
widen the allowlist for it, it was **renamed to `SWIPE_MIN_TRAVEL_PX`**, so
the allowlist stays narrow enough to still mean something.

**Verified, all actually run this session:** `npx tsc -b`, `npx oxlint`,
`npm run smoke` (**693 checks across 24 suites**, up from 649 across 22),
`npm run build` — all clean. Plus a **real click-through of both new rounds
in the production build in a browser**: onboarding → home → block-stack
(swipe up lifts, swipe down places, match auto-advances, support logged) →
sort (wrong basket silently returns, tap-then-tap works, drag works, tray
empties and auto-advances). That is the first time anything in this repo
has been click-tested rather than only self-verified — but it covers
**these two rounds only**. Everything else in this file's "not verified"
list below still stands, and neither round has been tested on real hardware
or reviewed by a fresh context.


### Session 4b — sort variations, and real motion on the stack

Follow-up in the same session, both asked for directly.

**Sort by rule now has four rule types, not one.** A round sorts by
**shape** (circle / square / triangle), **size**, **fill** (solid /
outline) or **colour**, picked at random, 4 or 6 items. The guarantee that
made the original version work was generalised rather than dropped: the old
rule was "all items are one colour so the rule can only be shape"; the new
one is **exactly one dimension varies, every other is held constant across
all items and both seeded examples**. `buildSortRound()` cannot build a
violating round and the smoke suite asserts it over 300 random rounds plus
40 of each dimension. The renderer is bound by it too — the armed-basket
highlight is a border change only, because a background tint would be a
second varying property during a colour round. Colour rounds run through
`isColourAvoided()`, so a disliked colour is never *offered*, not merely
filtered on render.

**The stack now animates in both directions.** It only ever animated
placing; lifting just made the block vanish. Lifting needs a transient
ghost — the machine has already dropped the block, so the render layer
keeps one alive for the animation's duration.

**New: `src/config/motion.ts`, and why it exists.** "Make it more
animated" is exactly the request that can quietly hand a calm-profile child
more movement than they asked for. Motion intensity is now derived once
from the LOWEST of three inputs — `prefers-reduced-motion`, the avoid
list's *fast animation*, and the response profile's Q1 — and both new
rounds read it instead of hardcoding durations. `smoke-f029` enforces this
repo-wide for any game that declares keyframes. An unanswered Q1 resolves
to the middle tier, never the liveliest: a skipped question must not opt a
child into more stimulation.

**A real bug caught live, again by clicking rather than by a test.** The
lift-out animation never played. The ghost also carries
`.bsm-block--live`, so `.bsm-col--relaxing .bsm-block--live` (0-2-0) beat
the bare `.bsm-ghost` rule (0-1-0) and the ghost ran the neighbouring
*relax* animation instead of *lift* — visually almost right, and wrong.
Fixed by excluding ghosts from the relax rule and matching specificity;
smoke-f027 now asserts both halves. Also hardened: `setPointerCapture` is
wrapped, so a throw can never escape a React pointer handler and take the
rest of the gesture down with it.

**A pre-existing finding, recorded but NOT fixed.** `Game1.tsx` (F.008 /
F.012) and `Game3Play.tsx` (F.021) both animate with **no
`prefers-reduced-motion` block at all**, and two of their three animations
are infinite (`g1-pulse`/`g3p-pulse` 1.2s, `g1-bounce`/`g3p-bounce` 0.6s).
Those are the §7.7 tier-2 and tier-3 prompt signals, so they fire exactly
when a child is already struggling. UI-STANDARDS requires both the profile
tuning and `prefers-reduced-motion`. Left alone deliberately — they are
P2's files, already marked implemented, and quietly editing them is the
"make it better on a file that already meets its Done criteria" failure
SUBAGENT-STRATEGY warns about. Recorded as `MOTION_CAP_GAP` in
`scripts/smoke-f029.ts`, with a second test that fails if an entry is fixed
but left on the list. **Worth fixing; needs a decision, not a drive-by.**

**Verified, all actually run:** `tsc -b`, `oxlint`, `npm run smoke`
(**25 suites**), `npm run build` — clean. Click-tested live: place-in and
lift-out animations confirmed by computed `animationName`, motion tier
confirmed to change with the profile answer, and four consecutive sort
rounds each confirmed to vary exactly one dimension with the wrong basket
returning silently every time.


---

## Run it

```bash
cd app
npm install
cp .env.example .env   # then edit .env — see "The API key" below
npm run dev             # http://localhost:5173
```

Other useful commands, all run from `app/`:

```bash
npx tsc -b        # typecheck the whole tree, including test scripts
npx oxlint        # lint, should be zero warnings
npm run smoke      # all 25 automated test suites (fast, no browser needed)
npm run build      # production build
```

All four of the above should be clean right now. If any of them aren't,
something changed since this file was written — trust the tool output over
this document.

---

## The API key

**`app/.env` is gitignored and does not exist in a fresh clone.** A real
Anthropic API key was configured during the build and used for genuine
verification (not mocked) — real vision calls, real card-generation calls,
with adversarial testing. That key lived only in this machine's local
`.env`; it does not travel with the repo.

**If this project moves to a new Claude Code account/machine, someone needs
to either**:
1. Copy the existing `.env` file over manually (outside git), or
2. Generate a fresh key and set `ANTHROPIC_API_KEY` in a new `.env`
   (`cp app/.env.example app/.env`, then edit it).

**Before doing anything with real API calls on a new key: set a spend
cap.** This was flagged repeatedly during the build and its status was never
independently confirmed — check it before assuming it's handled.

Two capabilities cost real money when exercised: object recognition
(`claude-sonnet-5`, fires when Game 1's capture button is pressed — Game 3
no longer has one, see its Session 3 note above) and Branch 2's
question-card generation (`claude-haiku-4-5`, fires after submitting the
three guided prompts). Both show visible in-app loading text while the
call is in flight — see `app/src/games/Game1.tsx` (the pipeline) and
`app/src/screens/Branch2Card.tsx`. Everything else in the app costs
nothing and runs fully offline.

---

## What's actually built (21 of 24 feature files)

Full detail, owner, and dependency graph: `plan/overview/F.000-INDEX.md`.
Short version:

| Area | Files | State |
|---|---|---|
| Engine core (store, slots, interaction state machine, support ladder, fading, session lifecycle) | F.001, F.005, F.009, F.010, F.011, F.013 | Done, tested |
| Camera pipeline, Game 1 | F.006, F.008, F.012, F.017 | Done, tested — real capture→blur→recognize pipeline, not a stub. Capture default is now file-picker (laptop-build decision), not live camera — see Session 2 below |
| Game 2 (sequencing) | F.022 | Done, tested — zero-text child turn fixed in Session 2 (was showing text labels) |
| Game 3 (redesigned — roadmap engine) | F.021 | Done, tested — replaced the earlier single-session Shadow Match with a Duolingo-style Chapter/Lesson/Round progression engine (`app/src/games/game3/`, `screens/Game3Roadmap.tsx`, `games/Game3Play.tsx`) per `TASK-game3-roadmap.md`. See "Session 3" below and `plan/features/F.021.md` |
| Lookup table, Branch 2, branch handoff | F.007, F.014, F.015, F.020 | Done, tested — F.015 includes real adversarial guardrail testing against live API calls |
| Onboarding, Companion, preferences, avoid list, dashboard | F.002, F.003, F.004, F.016, F.018, F.019 | Done, tested |
| **Logic & Quantity track** (Block-stack match, Sort by rule) | F.027, F.028 | Done, tested — a fourth track from `Logic & Quantity Rounds.pdf`. Swipe-based stacking (the − / + buttons removed as a zero-text violation) and shape sorting (tap-then-tap primary, drag optional). See "Session 4" below |
| **Central routing + navigation chrome** — every screen wired in, with real wayfinding (`ScreenHeader`) and app identity (`AppHeader`) | `app/src/App.tsx`, `components/ScreenHeader.tsx`, `components/AppHeader.tsx` | Done. Type-checked and build-verified; **not yet click-tested by a human** |

**Not built, on purpose:**
- **F.023** (Game 3's other two modes — Trace, Puzzle): genuine stretch,
  always the correct first thing to cut, still correct to leave cut unless
  there's real spare time.
- **F.024, F.025** (generalization re-testing, social story): spec-only by
  original design, never meant to be built for the hackathon.
- **F.026** (demo video + Devpost submission): a human task, not a coding
  one. Hasn't started.

Every implemented file's status line reads `Implemented, self-verified —
needs fresh-context review` — deliberately never `Done`. The team's own
stated rule all along: self-review by the same context that wrote the code
doesn't count. **No file has had that review yet.** If a fresh session or a
human is looking for something useful to do, reviewing a file against its
own `plan/features/F.0XX.md` Review checklist and marking it `Done` (or
finding a real problem) is exactly the kind of task that's still open and
valuable.

---

## What genuinely has NOT been verified, and needs a human + real hardware

These cannot be checked by any Claude Code session, background agent, or
automated test — they need eyes and a physical device:

1. **An actual click-through of the whole app in a browser.** Every check
   run tonight was `tsc`/lint/automated-test/build — none of them execute
   the real React component tree the way a human clicking through it does.
2. **Real device testing** — touch target sizing on an actual phone, the
   camera permission flow, iOS Safari's audio-unlock-needs-a-gesture quirk.
   Flagged throughout `plan/engineering/UI-STANDARDS.md` as impossible to
   verify without real hardware, and that's still true.
3. **Deployment.** The app only runs via `npm run dev` on whatever machine
   has this checkout. It is not hosted anywhere. `plan/engineering/
   TECH-DECISIONS.md` has the original hosting reasoning (Vercel was the
   working recommendation, deliberately deferred as a final decision).

---

## Decisions still open (product, not code)

From `plan/overview/F.000-INDEX.md`'s own "Open decisions" section,
unchanged:
- **Project name.**
- **Branch 2's regional framing** (§15 of the guide) — Indonesian context /
  Australian / locale-configurable. Affects the referral-service data shown
  in the question-card flow and the pitch's Impact framing.
- **Branch 2 referral data** — real, verifiable local service info, or
  clearly-marked placeholder. If placeholder, it must say so in the UI —
  this was a hard requirement, check `plan/features/F.019.md` and the
  Branch2Card screen before assuming either way.

---

## If you're a fresh Claude Code session picking this up cold

Read, in order:
1. This file.
2. `app-guide-v3-FINAL.md` — the actual product spec, if you need to verify
   any behavior against source of truth.
3. `plan/overview/F.000-INDEX.md` — the live status table and dependency
   graph.
4. `plan/engineering/ARCHITECTURE-RULES.md` — the ports/adapters pattern
   every piece of the codebase follows. Understanding this before touching
   any adapter file will save you from re-deriving it the hard way.

Then run the four commands under "Run it" above. If they're all clean, you
have an accurate picture of where things stand without needing anything from
whoever was here before you.
