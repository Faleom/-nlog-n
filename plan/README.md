# Build Plan

Built against **`../app-guide-v3-FINAL.md`** — the single source of truth.
Section refs (§) throughout point at it. Nothing here invents product behaviour.

```
plan/
├── overview/
│   ├── F.000-INDEX.md ...... every file, tier, owner, status, dep graph  ← source of truth
│   └── BUILD-ORDER.md ...... dependency waves and gates (not a clock)
│
├── features/ .............. F.001 … F.026
│
├── assignments/ ........... PERSON-1 … PERSON-4, self-contained
│
└── engineering/
    ├── ARCHITECTURE-RULES.md ... ports and adapters — read before coding
    ├── UI-STANDARDS.md ......... §4 rules every screen obeys
    ├── TECH-DECISIONS.md ....... which technology, and why
    ├── SETUP.md ................ machine setup, ~15 min
    └── SUBAGENT-STRATEGY.md .... where to fan out, where not to
```

---

## Start here

1. `engineering/SETUP.md` — get your machine and a **real tablet and phone**
   running
2. `assignments/PERSON-<your number>.md` — yours, and only yours
3. `overview/BUILD-ORDER.md` — **Wave 0 first.** Nothing fans out safely until
   those contracts exist
4. `engineering/ARCHITECTURE-RULES.md` and `engineering/UI-STANDARDS.md` — short
5. §13 of the guide — one page, all four of you

Then: **P1 opens F.001, P2 opens F.006.** They're the only two files with zero
dependencies.

---

## The three things to hold in your head

**The gate.** Tier 0 — Game 1 running end to end — decides whether you're
building Option A or already in Option B (§16.4). Everything is ordered to
protect it.

**The privacy line.** *"Faces are blurred in the browser before anything is
sent. The photo is processed and discarded, never stored. The only image that
persists is the toy."* **Never say "photos never leave the device"** — room
photos are sent for recognition, and overclaiming is the worst error the pitch
could make.

**The loop.** Every file: plan → confirm → implement → review (fresh context) →
verify → done. A file is Done only when someone who **didn't write it** has
checked it against its Review checklist, and someone has actually run it. At
this timescale, compress by cutting **Tier 3, not the loop.**

---

## Quick answers

| Question | Where |
|---|---|
| What's done? Who owns what? | `overview/F.000-INDEX.md` |
| What can start right now? | `overview/BUILD-ORDER.md` |
| What am *I* building? | `assignments/PERSON-<n>.md` |
| What library for X? | `engineering/TECH-DECISIONS.md` |
| Touch targets, phone layout, sensory settings | `engineering/UI-STANDARDS.md` |
| Can I run agents in parallel on this? | `engineering/SUBAGENT-STRATEGY.md` |
| What do we cut? | `overview/F.000-INDEX.md` → Tiers. **Tier 3 first, without discussion** |
| What's still undecided? | `overview/F.000-INDEX.md` → Open decisions (4 items, §21) |
