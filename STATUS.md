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

19 of 22 planned feature files are implemented, automatically tested, and
merged into `main`. The whole thing is wired together into one real,
click-through app (`app/src/App.tsx`) — onboarding, both branches, all three
games, the dashboard. `tsc`, `oxlint`, all 22 automated test suites, and the
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
npm run smoke      # all 22 automated test suites (fast, no browser needed)
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
(`claude-sonnet-5`, fires when a game's capture button is pressed) and
Branch 2's question-card generation (`claude-haiku-4-5`, fires after
submitting the three guided prompts). Both show visible in-app loading text
while the call is in flight — see `app/src/games/Game1.tsx` (the pipeline)
and `app/src/screens/Branch2Card.tsx`. Everything else in the app costs
nothing and runs fully offline.

---

## What's actually built (19 of 22 feature files)

Full detail, owner, and dependency graph: `plan/overview/F.000-INDEX.md`.
Short version:

| Area | Files | State |
|---|---|---|
| Engine core (store, slots, interaction state machine, support ladder, fading, session lifecycle) | F.001, F.005, F.009, F.010, F.011, F.013 | Done, tested |
| Camera pipeline, Game 1 | F.006, F.008, F.012, F.017 | Done, tested — real capture→blur→recognize pipeline, not a stub. Capture default is now file-picker (laptop-build decision), not live camera — see Session 2 below |
| Game 2 (sequencing) | F.022 | Done, tested — zero-text child turn fixed in Session 2 (was showing text labels) |
| Game 3, Mode A (Shadow Match) | F.021 | Done, tested |
| Lookup table, Branch 2, branch handoff | F.007, F.014, F.015, F.020 | Done, tested — F.015 includes real adversarial guardrail testing against live API calls |
| Onboarding, Companion, preferences, avoid list, dashboard | F.002, F.003, F.004, F.016, F.018, F.019 | Done, tested |
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
