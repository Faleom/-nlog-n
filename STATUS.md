# Status — read this first

**If you are a fresh Claude Code session with no prior context on this
project, this file is the entry point. Read this before `README.md`, before
`plan/`, before anything else.** Everything below is accurate as of the last
commit on `main` — check `git log -1` if you want to confirm nothing has
moved since.

---

## What this is

A photo-based early-learning app for pre-verbal preschoolers (autistic, ADHD,
or undiagnosed), built for Melbourne Hack 2026. Product name: **"Hello
World"** (settled in Session 3 below — was an open decision before that).
Full product spec: `app-guide-v3-FINAL.md`. Build plan: `plan/`. **The app
itself is real, built, wired, and verified by every automated check this
repo has** — this is not a planning-stage repo.

---

## The one-paragraph version

19 of 22 planned feature files are implemented and automatically tested.
Session 3 (below) went further than "implemented": it found and fixed
several features that were built and tested in isolation but never actually
connected to a real screen (sensory-accommodation toggles, a skill-lookup
table, session focus-stretch measurement), then did a full visual redesign
on top. The whole thing is one real, click-through app
(`app/src/App.tsx`) — onboarding, both branches, all three games, the
dashboard. `tsc`, `oxlint`, every automated test suite, and the production
build are clean as of the last commit. **What has still NOT happened:**
nobody has watched a human click through it start to finish on a real
device, and it isn't deployed anywhere. That's the actual next work, not
more building.

---

## How this repo got built (context you'd otherwise be missing)

This was built solo, overnight, by one Claude Code session working as
"Person 1" and directing three parallel background agents as Persons 2, 3,
and 4 (via the `Agent` tool, each in an isolated git worktree, merged back
into `main` one at a time with full validation after every merge). That
four-person framing is now retired — see "Who's actually working on this,
now" below — but the code it produced is still the foundation everything
else in this file sits on.

Two real, non-trivial bugs were caught and fixed during that original
integration — not hypothetical risks, actual things that would have shipped
broken:
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

## Who's actually working on this, now

Not a four-person hackathon team anymore. Two people:
- **The product owner** (you, if you're reading this as a fresh session
  picking the work back up) — drives every UI/product decision, runs this
  repo via a series of Claude Code sessions.
- **A friend**, working independently on their own machine, on their own
  git branches. Confirmed active as of Session 3: a remote branch called
  **`game3-match-and-draw`** exists on GitHub and is being pushed to right
  now. This is very likely connected to a stated plan to add three more
  games.

**The established workflow for merging their work in** (used once already,
for the original Game 1 branch, and explicitly requested again for
whatever comes off `game3-match-and-draw` or future branches): fetch it
locally, merge it into a real local branch (never blindly auto-merge),
read both sides of any conflict carefully — a conflict is often two people
having independently built the same or complementary thing, not an actual
incompatibility — resolve by combining intent, run the full verification
suite, and **wait for the product owner's explicit approval before pushing
anything back to `origin/main`.** Do not push to `main` without that
approval having been given for that specific push.

**`app/src/games/Game3ShadowMatch.tsx` was deliberately never touched by
Claude across the entire Session 3 redesign**, specifically because of the
friend's active branch. If you're picking this up fresh and considering
touching that file, or anything that file depends on, check with the
product owner first — it may still be off-limits.

---

## Session 2 — UI/UX pass, and a real laptop-testing bug (post-handoff)

After the state above was written, the same human came back and used the
running app for the first time — which immediately surfaced things no
automated check could: the navigation gave no sense of where you were, the
visual design was unstyled prototype chrome, and the capture flow was
**completely broken when testing on a laptop**, not just ugly.

**Navigation & wayfinding.** `app/src/components/ScreenHeader.tsx` (new) —
every screen except the two true roots now shows which flow it's in (eyebrow
text) and a consistent back affordance.

**A real design pass** (superseded by Session 3's full redesign below, but
this is what it replaced): `app/src/App.css` got its first actual design
system — color/spacing/radius tokens, a typography scale, glass-styled
buttons.

**A real, previously-unfixed bug: capture was silently broken on a laptop.**
`app/src/adapters/capture/deviceCamera.ts` tried `getUserMedia` (a live
camera) first, and its fallback to a file picker called `.click()` from
inside an async `catch` block — by then, several ticks after the original
tap, the browser's user-activation window had expired, so the file dialog
silently never opened. Fixed: the file picker is now the default,
synchronous, primary path. The old live-camera code is preserved and
swappable back in later (one line in `registry.ts`) for a real tablet/phone
deployment.

**A second real bug: Game 2 (`F.022`) still violated "zero text in the
child's view."** The child's tap-in-order turn was rendering visible crop
name labels plus caregiver instruction text on the same screen. Fixed to
match Game 1/3's already-correct pattern.

---

## Session 3 — "Hello World" redesign, real engine wiring, and a bug hunt

The largest single pass on this repo since the original overnight build.
Spans many separate requests across one long working session; grouped here
by theme, not chronology. Everything below is committed to `main` and
passed `tsc`/`oxlint`/full smoke/build after every change, most of it
independently re-verified rather than just trusted from a subagent's own
report.

**The app has a real name and a real design system now.**
`APP_NAME_PLACEHOLDER` is gone — the product is called **"Hello World"**,
set in exactly one place (`app/src/components/AppHeader.tsx`) and mirrored
in `index.html`'s `<title>` and the PWA manifest. The entire visual system
was rebuilt dark-first (not light-mode-inverted) as a "liquid glass"
material — **`app/src/design/DESIGN-TOKENS.md` is the locked reference for
the palette, both fonts, and the glass-tuning rules; read it before
touching `App.css`'s `:root` block.** One self-hosted font (Nunito) now
covers the whole app — the original two-face child/caregiver split was
retired because the child's own screens never actually render text, so it
had no real footprint.

**Navigation was restructured.** A new local-device-recognition welcome
screen (no accounts, no passwords — this app has neither). The home hub
split from one long scroll into four tabs (Play / Dashboard / Setup /
Notes) behind a full-width tab bar. Caregiver Dashboard, Setup, and Notes
all moved onto the same glass-card system as everything else.

**Several features were found built, tested, and never actually wired
in — now fixed.** This is the most consequential category, and worth
reading `git log` for the exact commit if you need the full reasoning:
- **F.018's sensory-accommodation toggles** (reduce animation, swap the
  success chime for a visual pulse, announce changes before they happen) —
  `shouldReduceAnimation`/`shouldUseVisualPulseInsteadOfChime`/
  `shouldAnnounceChangesInAdvance` in `engine/avoidFilter.ts` had zero
  callers outside their own smoke test. Now consulted by both Game 1 and
  Game 2.
- **F.007's object → skill → steps lookup table** — described in its own
  header comment as "the hardest engineering problem in the app," and
  Game 1 was bypassing it entirely with a throwaway `find-${category}`
  string. Now drives what actually gets logged, faded, and tracked toward
  generalization.
- **Session focus-stretch measurement** — `updateFocusStretch()` in
  `engine/profileStore.ts` had zero callers anywhere. The caregiver
  dashboard's "Focus-stretch trend" panel — real UI, real aggregation
  logic — was reading 0 minutes for every session, on every device, always.
  Now actually measured in both games.
- **The response-profile quiz's `attentionSpan`/`communication` answers**
  had zero downstream consumers (confirmed by grep, not assumed). Now flow
  into Game 2's AI-generated story (sentence complexity, preferred length),
  phrased as plain behavioural notes through the API prompt, never
  diagnostic language — same rule the pre-existing `sameness` field already
  followed (§5.2: tuning keys off response dimensions, never a condition
  label).

**A real, root-cause bug fix, not a workaround.** Game 2's AI story
generator could produce two steps referencing the same real detected
object (e.g. two steps both about "the cushion"). The second reference
would resolve fine individually but collide at render time — its photo was
already claimed by the first step — and silently fall back to an unrelated
generic-coloured swatch (a flat red or blue square with no connection to
that step's sentence). Root cause: `parseStoryResponse` validated that
every object mentioned was real, but never that the same object wasn't
mentioned twice. Fixed at the validation layer (a duplicate objectRef now
fails validation and falls back to the deterministic template generator,
which can't produce this by construction), reinforced in the prompt itself,
and given a client-side defense-in-depth fallback too. Two new smoke tests
cover it.

**Other fixes, each real:**
- Speech synthesis now actually stops on navigation or backgrounding —
  previously nothing ever called `SpeechOutPort.stop()` (it didn't exist),
  so narration kept playing after leaving whatever screen started it.
- Two on-screen privacy claims were factually wrong — "everything stays on
  this device" / "nothing is sent anywhere" — when object recognition and
  story generation both genuinely call the Claude API. Fixed to say what's
  actually true: no account exists, and nothing is *stored* anywhere but
  the device. (`plan/README.md` had already flagged this exact overclaim
  as the thing never to say, in its original planning notes — Session 3
  just found where the code had drifted from that rule.)
- An app-wide button-tap sound was added — synthesised with the Web Audio
  API, no asset file, respects the avoid-list's sound-sensitivity flag.
- The caregiver-UI touch-target floor was deliberately lowered from 88px to
  44px (`--touch-min` in `App.css`) — a knowing, disclosed departure from
  `plan/engineering/UI-STANDARDS.md`'s "no exceptions" text, scoped to
  caregiver-facing chrome only. **Every game's own child-facing tap target
  is a hardcoded pixel value in that game's own file, not this token — none
  of them were touched by this change.**
- An editorial pass removed em dashes from all user-facing and spoken text
  (not from code comments, which still have plenty).

**Explicitly out of scope, on purpose, throughout all of Session 3:**
`Game3ShadowMatch.tsx` was never opened for editing, for the reason
described in "Who's actually working on this, now" above.

---

## Run it

```bash
cd app
npm install
cp .env.example .env   # then edit .env — see "The API key" below
npm run dev             # http://localhost:5173 (or the next free port)
```

Other useful commands, all run from `app/`:

```bash
npx tsc -b        # typecheck the whole tree, including test scripts
npx oxlint        # lint, should be zero warnings
npm run smoke      # every automated test suite (fast, no browser needed)
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
real story-generation calls, with adversarial testing on the guardrail
paths. That key lived only in this machine's local `.env`; it does not
travel with the repo.

**If this project moves to a new Claude Code account/machine, someone needs
to either**:
1. Copy the existing `.env` file over manually (outside git), or
2. Generate a fresh key and set `ANTHROPIC_API_KEY` in a new `.env`
   (`cp app/.env.example app/.env`, then edit it).

**Before doing anything with real API calls on a new key: set a spend
cap.** This was flagged repeatedly during the build and its status was never
independently confirmed — check it before assuming it's handled.

Three capabilities cost real money when exercised: object recognition
(`claude-sonnet-5`, fires when a game's capture button is pressed), Game 2's
story generation (`claude-haiku-4-5`, fires when a room photo is confirmed),
and Branch 2's question-card generation (`claude-haiku-4-5`, fires after
submitting the three guided prompts). Everything else in the app costs
nothing and runs fully offline.

---

## What's actually built (19 of 22 feature files)

Full detail, owner, and dependency graph: `plan/overview/F.000-INDEX.md`
(the "owner"/tier columns there still reflect the original four-person
split historically — see "Who's actually working on this, now" above for
current reality). Short version:

| Area | Files | State |
|---|---|---|
| Engine core (store, slots, interaction state machine, support ladder, fading, session lifecycle) | F.001, F.005, F.009, F.010, F.011, F.013 | Done, tested |
| Camera pipeline, Game 1 | F.006, F.008, F.012, F.017 | Done, tested — real capture→blur→recognize pipeline. Capture default is file-picker (laptop-build decision), not live camera |
| Game 2 (sequencing) | F.022 | Done, tested — real AI-generated stories, not a template stub; a real duplicate-object bug found and fixed in Session 3 |
| Game 3, Mode A (Shadow Match) | F.021 | Done, tested. **Untouched since Session 2** — a teammate's active domain, see above |
| Lookup table, Branch 2, branch handoff | F.007, F.014, F.015, F.020 | Done, tested — **F.007 was dead code until Session 3** (see above), now actually consulted by Game 1 |
| Onboarding, Companion, preferences, avoid list, dashboard | F.002, F.003, F.004, F.016, F.018, F.019 | Done, tested — **F.018's sensory toggles were dead code until Session 3**, now actually consulted by Game 1 and Game 2 |
| **Central routing + navigation chrome + design system** | `app/src/App.tsx`, `App.css`, `src/design/`, `components/` | Done, fully redesigned in Session 3. Type-checked and build-verified; **not yet click-tested by a human** |

**Not built, on purpose:**
- **F.023** (Game 3's other two modes — Trace, Puzzle): genuine stretch,
  still correctly cut. (Possibly superseded by whatever the friend's
  `game3-match-and-draw` branch turns out to be — check before assuming
  this is still the plan.)
- **F.024, F.025** (generalization re-testing, social story): spec-only by
  original design, never meant to be built for the hackathon.
- **F.026** (demo video + Devpost submission): a human task, not a coding
  one. Hasn't started.

---

## What genuinely has NOT been verified, and needs a human + real hardware

Still true, unchanged by Session 3 — these cannot be checked by any Claude
Code session, background agent, or automated test:

1. **An actual click-through of the whole app in a browser**, on a real
   device. Every check run this whole project has been `tsc`/lint/
   automated-test/build — none of them execute the real React component
   tree, or play real audio, the way a human clicking through it does.
   This matters more after Session 3 than before it: the click sound, the
   sensory-toggle behavior (does the visual pulse actually read clearly?),
   and the AI story-generation fix all have real audio/AI-output components
   that no automated check can fully confirm sound or read right.
2. **Real device testing** — touch target sizing on an actual phone
   (including the newly-lowered 44px caregiver floor), the camera
   permission flow, iOS Safari's audio-unlock-needs-a-gesture quirk.
3. **Deployment.** The app only runs via `npm run dev` on whatever machine
   has this checkout. It is not hosted anywhere.

---

## Decisions still open (product, not code)

- **Branch 2's regional framing** (§15 of the guide) — Indonesian context /
  Australian / locale-configurable. Affects the referral-service data shown
  in the question-card flow and the pitch's Impact framing. Untouched all
  session.
- **Branch 2 referral data** — real, verifiable local service info, or
  clearly-marked placeholder. If placeholder, it must say so in the UI —
  this was a hard requirement, check `plan/features/F.019.md` and the
  Branch2Card screen before assuming either way. Untouched all session.

(**"Project name" is resolved** — it's "Hello World," as of Session 3. No
longer an open decision.)

---

## If you're a fresh Claude Code session picking this up cold

Read, in order:
1. This file.
2. `app/src/design/DESIGN-TOKENS.md` — the visual system's source of truth.
   Skip this only if you're doing pure logic/engine work with no UI at all.
3. `app-guide-v3-FINAL.md` — the actual product spec, if you need to verify
   any behavior against source of truth.
4. `plan/overview/F.000-INDEX.md` — the live status table and dependency
   graph (owner columns are historical, see "Who's actually working on this,
   now" above).
5. `plan/engineering/ARCHITECTURE-RULES.md` — the ports/adapters pattern
   every piece of the codebase follows. Understanding this before touching
   any adapter file will save you from re-deriving it the hard way.

Then run the four commands under "Run it" above. If they're all clean, you
have an accurate picture of where things stand without needing anything from
whoever was here before you.

**Two things worth internalizing before you touch anything:** don't edit
`Game3ShadowMatch.tsx`, and don't push to `origin/main` without the product
owner's explicit go-ahead for that specific push — both are explained above,
under "Who's actually working on this, now."
