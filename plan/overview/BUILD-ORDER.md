# Build Order

> **Status update (post-build): this document is historical.** Every wave
> described below has completed — 19 of 22 planned feature files are
> implemented, tested, and merged into `main`, and the app is wired
> together end to end. See `../../STATUS.md` for the current picture and
> `F.000-INDEX.md` for live per-file status. Kept below for the dependency
> reasoning, which is still accurate even though the work itself is done.

**Not a clock.** A dependency-ordered sequence: what can start now, what has to
wait for what, and where the contracts have to freeze before work fans out.

Waves are **gates, not times**. A wave opens when the previous one's gate
passes. If you're running agents, the wave boundaries are where you fan out and
where you must not.

---

## Wave 0 — Contracts. No code.

Everyone, together. Nothing below can safely fan out until these exist, because
they're the shapes multiple people will build against simultaneously.

- [ ] **The crop tag shape.** What F.006 returns:
      `{name, colour, category, function, bbox}`. P2 and P3 agree it on paper —
      P3's lookup table (F.007) is built against it before the pipeline exists.
- [ ] **The slot list.** The ten slots in §6.4. P1 owns it; P3 and P4 author
      content against it.
- [ ] **The game contract.** What a game declares: skill, interaction shape, how
      it renders a step. P1 and P2, on paper. Twenty minutes now, half a day
      later.
- [ ] **The capability ports** (`../engineering/ARCHITECTURE-RULES.md`) and the
      lint rule that enforces them.
- [ ] **`../engineering/SETUP.md`** on all four machines. One real tablet and
      one real phone in the room (§4.4 — devtools emulation is not sufficient).
- [ ] Skim **§13** together. One page. Every review checks against it.

**Gate:** all four people can state the crop shape and the slot list from
memory.

---

## Wave 1 — Two chains, in parallel

Only two files have zero dependencies. Start both at once.

| Chain | File | Owner |
|---|---|---|
| **Perception** | **F.006** My World pipeline | P2 |
| **Data** | **F.001** Device store & profile model | P1 |

**F.006 first, and start the face-blur spike immediately.** §17 budgets half a
day for it: downscale → detect → map boxes back → blur at full res. If it isn't
working by the end of this wave, switch to the fallback — a hard *"no people in
frame"* confirmation gate. **Never ship an unblurred pipeline.**

Meanwhile, unblocked by contracts alone:
- **P3 → F.007** lookup table. Pure content authoring against the agreed tag
  shape. ~15 objects × 3–4 templates. Doesn't need the pipeline to exist.
- **P4 → F.002** onboarding. Needs only F.001's profile shape, which is a
  conversation, not a finished file.

**Gate:** a real photo of a real room returns tagged crops, with the blurred
image on the wire. **Check the network request body, not the code.**

---

## Wave 2 — Converge on Game 1

| File | Owner | Needs |
|---|---|---|
| F.003 Response profile | P4 | F.002 |
| F.004 Companion capture | P4 | F.001, F.006's face detector |
| F.005 Slot system | P1 | F.001, F.004 |
| F.008 **Game 1, one level** | P2 | F.005, F.006, F.007 |

P4 has three files this wave and they gate the personalisation. If P3 finishes
F.007 early — likely — **P3 floats onto F.004**, because the Companion is the
differentiator and it's the one Tier 0 item most likely to be squeezed.

### ⚑ GATE — TIER 0

> **Audio names a target. A child leaves the screen, finds the real object,
> comes back. The caregiver taps "They brought it." The child taps the matching
> crop. It celebrates.**

Everyone watches this once, on a real tablet. **If it doesn't work, nothing in
Wave 3 starts — the whole team converges here.** §16.4: this gate is what
decides whether you're building Option A or already in Option B.

---

## Wave 3 — The credible product

**Build F.009 before any second game.** Everything else in this wave depends on
the state machine existing, and a second game built without it has to be redone.

**Sequential (P1, in this order — each reads the last one's state):**
`F.009` state machine → `F.010` support ladder → `F.011` fading → `F.013`
session cap

**Parallel, once F.009 is frozen:**
- **P2 → F.012** Game 1 levels 1–4
- **P3 → F.014 → F.015** Branch 2, end to end
- **P4 → F.016** quick preferences (needs F.005 only)

### ⚑ GATE — TIER 1 · the freeze decision

> **Is Tier 1 complete?** If no — **freeze scope and consolidate.** You are in
> Option B, and that is a fine place to be: §16.3 scores it 24–25.

Make this call **while there is still room to test, rehearse and shoot the
video.** Deciding late means reverting without gaining Option B's actual
benefit. §16.4 is explicit that this is the moment.

**Also at this gate:** P3's Branch 2 is done, so **P3 moves to F.026 — demo and
video.** §16.4 names this the task most likely to be quietly dropped while the
build is going well. It has an owner from Wave 0 and it activates here.

---

## Wave 4 — The differentiators, and the other two games

**Team decision: all three games ship this weekend.** F.021 and F.022 moved
from optional (§16.1's default) to required — see
`F.000-INDEX.md` § Scope decision. Both are sequenced here, not earlier,
because each depends on its owner's own chain being frozen first.

Parallel, no interdependencies between the rows below:

- **P2 → F.017** Companion mechanic in Game 1 — the profile-swap demo moment.
  **Then P2 → F.021** Shadow Match (Game 3, Mode A). Sequential for P2, not
  parallel with each other — F.017 first, because Game 1 is still the
  centrepiece and F.021 reuses machinery P2 is already deep in.
- **P1 → F.022** Game 2 sequencing + routine anchors, once F.013 (the end of
  P1's engine chain) and F.016 (quick preferences, P4) are both in.
- **P4 → F.018** avoid list, then **F.019** dashboard.
- **P3 → F.020** branch handoff, alongside video work.

**F.017 is still the highest-value file in this wave** — it's what turns the
Companion from a stored photo into the thing judges remember. But **F.021 and
F.022 are no longer optional**, so don't let them slip to "if there's time."
They're scheduled, they have a gate, and they're reviewed like everything else.

**Gate:** Tier 2 done **and tested** — which now includes F.021 and F.022, not
just the original differentiators.

---

## Wave 5 — Stretch: the last mile of Game 3

**Only F.023 lives here now.** Real owner (P2), built only after F.021 is done
and tested — not in parallel with it, since Modes B and C share F.021's engine
and level state.

- **P2 → F.023** Trace, then Puzzle if time remains (§8.3's own build order:
  Puzzle is cheaper and more demoable than Trace, so if only one lands, make
  it Puzzle — the file's Done-when section has been updated accordingly).

> This is the wave §16.3's finding actually applies to now: a third *mode*
> inside an already-working Game 3 moves judging scores least of anything left
> to build. Game 1, Game 2 and Game 3's first mode are the required floor —
> **this is the genuinely optional layer on top**, and the first thing cut if
> Sunday runs long.

Start this only if there is genuinely nothing left to polish or test on
anything required.

---

## Wave 6 — Freeze, then ship

**Scope freeze.** Everything not working is cut and **hidden completely** — no
dead buttons, no half-rendered screens, no crash paths. Nothing half-built is
ever visible (§16.4).

Then, and only then:
- Every §11 failure path exercised, **especially the API-outage fallback**
- Real tablet and real phone, both
- Demo path run twice, start to finish, no reset
- **Video recorded early, not last.** Submit early, not on the deadline.

---

## Review is not a wave

It runs continuously, one file behind implementation. A file is Done only when a
context that **did not write it** has checked it against its Review checklist,
and someone has actually run it.

At this timescale the honest compression is **fewer files, not fewer reviews.**
Cut Tier 3 before you cut the loop.

**Highest-value reviews, in order:**
1. **F.006** — is the transmitted image blurred? Check the network request body.
2. **F.009** — tap wrong three times; does the child still end in success with
   no negative signal?
3. **F.015** — force the guardrail to fail; is the card withheld?
4. **F.020** — grep for any counter over activity history.
