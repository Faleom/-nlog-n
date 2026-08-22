# App Guide v3 Project

*Melbourne Hack 2026 · Accessible Education track · SDG 4*

An early-learning app for children aged 3–5 who are pre-literate and pre- or
minimally verbal — autistic, ADHD, or still on a diagnosis waiting list. Two
branches: **My World** turns a photo of the child's own room into activities
built from their real objects, and **Worry to Question** turns a parent's vague
concern into a clear question for a health worker, without ever screening or
diagnosing.

Full spec: [`app-guide-v3-FINAL.md`](app-guide-v3-FINAL.md) — the single source
of truth. Build plan: [`plan/`](plan/README.md).

---

## Team

| | Role | What they own |
|---|---|---|
| **Person 1** | Engine core | The shared machinery every game runs on: the device data store, the slot/template system that personalises every line of text, the moment-to-moment interaction rules (right/wrong/idle handling), the support-level ladder and its fading logic, and the session timer that makes the app shrink itself over time |
| **Person 2** | Camera & Game 1 | The camera pipeline — on-device face blurring, object recognition, photo handling — and Game 1 itself, the scavenger-hunt game that's the live demo centrepiece |
| **Person 3** | Content, Branch 2, video | The object-to-activity content table, the entire "worried parent" branch (milestone info, question-card generation, and the safety checks around it), and — once that's done — owns turning the finished build into the pitch video |
| **Person 4** | Onboarding & caregiver view | Everything a parent fills in at setup, including the child's favourite toy becoming the app's in-app character, plus the parent-facing dashboard that shows session history |

Each person's full brief — dependencies, build order, review responsibilities —
is in [`plan/assignments/`](plan/assignments/).

## Where to start

1. [`plan/engineering/SETUP.md`](plan/engineering/SETUP.md) — get your machine
   running, ~15 min
2. `plan/assignments/PERSON-<your number>.md` — your own file
3. [`plan/overview/BUILD-ORDER.md`](plan/overview/BUILD-ORDER.md) — what can
   start now, and what's blocked on what

The app itself lives in [`app/`](app/) — Vite + React + TypeScript, a
mobile-web PWA.
