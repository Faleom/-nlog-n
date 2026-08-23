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
| Camera pipeline, Game 1 | F.006, F.008, F.012, F.017 | Done, tested — F.006 is the real capture→blur→recognize pipeline, not a stub |
| Game 2 (sequencing) | F.022 | Done, tested |
| Game 3, Mode A (Shadow Match) | F.021 | Done, tested |
| Lookup table, Branch 2, branch handoff | F.007, F.014, F.015, F.020 | Done, tested — F.015 includes real adversarial guardrail testing against live API calls |
| Onboarding, Companion, preferences, avoid list, dashboard | F.002, F.003, F.004, F.016, F.018, F.019 | Done, tested |
| **Central routing** — every screen above wired into one real app | `app/src/App.tsx` | Done. Type-checked and build-verified; **not yet click-tested by a human** |

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
