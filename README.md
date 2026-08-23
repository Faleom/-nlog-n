# App Guide v3 Project

*Melbourne Hack 2026 · Accessible Education track · SDG 4*

**→ [`STATUS.md`](STATUS.md) is the current source of truth on what's built,
what's verified, and what's left.** Read it first, especially if you're a
fresh Claude Code session with no prior context on this repo.

An early-learning app for children aged 3–5 who are pre-literate and pre- or
minimally verbal — autistic, ADHD, or still on a diagnosis waiting list. Two
branches: **My World** turns a photo of the child's own room into activities
built from their real objects, and **Worry to Question** turns a parent's vague
concern into a clear question for a health worker, without ever screening or
diagnosing.

Full spec: [`app-guide-v3-FINAL.md`](app-guide-v3-FINAL.md) — the single source
of truth for product behavior. Build plan: [`plan/`](plan/README.md).

The app itself lives in [`app/`](app/) — Vite + React + TypeScript, a
mobile-web PWA. Run it: `cd app && npm install && npm run dev` (see
[`STATUS.md`](STATUS.md) for the API key setup this needs first).

---

## Who built what (historical — see STATUS.md for current state)

The build was split four ways. This table describes the original
assignment; it is **not a live status** — check
[`plan/overview/F.000-INDEX.md`](plan/overview/F.000-INDEX.md) for that.

| | Role | What they owned |
|---|---|---|
| **Person 1** | Engine core, then Game 2 | The shared machinery every game runs on: the device data store, the slot/template system that personalises every line of text, the moment-to-moment interaction rules (right/wrong/idle handling), the support-level ladder and its fading logic, and the session timer that makes the app shrink itself over time. Then Game 2 — Toy Story Sequencing |
| **Person 2** | Camera, Game 1, Game 3 | The camera pipeline — on-device face blurring, object recognition, photo handling — and Game 1, the scavenger-hunt game that's the live demo centrepiece. Then Game 3, a silhouette-matching game |
| **Person 3** | Content, Branch 2, video | The object-to-activity content table, the entire "worried parent" branch (milestone info, question-card generation, and the safety checks around it), and — once that's done — owns turning the finished build into the pitch video |
| **Person 4** | Onboarding & caregiver view | Everything a parent fills in at setup, including the child's favourite toy becoming the app's in-app character, plus the parent-facing dashboard that shows session history |

All three games shipped. Branch 2's video/submission (Person 3's last item)
has not — that's a human task, not a coding one, and remains open.

The per-person assignment briefs this table summarizes have been removed —
the work they described is done, and the four-person split no longer
reflects how this project is worked on.

## Where to start

1. **[`STATUS.md`](STATUS.md)** — what's actually built, verified, and open.
   Read this first.
2. [`plan/engineering/SETUP.md`](plan/engineering/SETUP.md) — machine setup,
   ~15 min.
3. [`plan/overview/F.000-INDEX.md`](plan/overview/F.000-INDEX.md) — the live
   per-file status table and dependency graph.
4. [`plan/engineering/ARCHITECTURE-RULES.md`](plan/engineering/ARCHITECTURE-RULES.md)
   — the ports/adapters pattern every part of the codebase follows.
