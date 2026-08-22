# Person 1 — Engine Core

You own the machinery every game runs on. You start with no dependencies and
end up on the critical path for most of the build.

## Your files, in order

| File | Tier | One line |
|---|---|---|
| **F.001** | 0 | Device store & profile model. **Start now** — three people wait on it |
| **F.005** | 0 | Slot system — every string is a template with blanks |
| **F.009** | 1 | Interaction state machine. **The highest-scrutiny code in the build** |
| **F.010** | 1 | Support ladder + caregiver logging |
| **F.011** | 1 | Fading logic |
| **F.013** | 1 | Session cap, fade, off-screen handoff |
| F.022 | 3 | Game 2 sequencing — only if Tier 2 is done and tested |

F.009 → F.010 → F.011 → F.013 is strictly sequential. Each reads the last one's
state.

## What you're building

The parts that make this an intervention rather than a quiz app.

**F.005** is small but touches everything: no line the app says is ever generic.
*"Bunbun wants something red!"* is a template with two blanks, filled
deterministically. **No model call, ever, in this path** — templates always
work, are instant and free, and cannot hallucinate.

**F.009 is the one to get right.** §7.7 says a judge will poke at it, because
it's where every competitor does something crude. The rule is errorless
learning: the child never ends a trial in a failure state. Wrong tap →
**silence**, the option fades and goes dead. Nothing else. No sound, no colour,
no X, no shake. Escalate one help tier per attempt until only the right answer
is tappable — the child *cannot* fail. Log it as `prompted`, never `failed`.

**F.013 is the pitch's headline claim made literal.** Sessions start at 12
minutes and get one minute shorter each time, floor 6. The app ends itself, with
no replay button, handing the family a real-world activity. An app whose success
condition is being used less. That comes from the TOBY trial: the pedagogy
worked, adherence was the failure point.

## Who you depend on

- **P2 → F.006** for the crop tag shape. **Agree it on paper in Wave 0** — you
  don't need their code.
- **P4 → F.004** Companion name and pronoun, before F.005's slots resolve.
  Build against the schema you defined and wire real values when it lands.

## Who depends on you

- **F.001 blocks P4's onboarding and P2's Game 1.** Freeze its interfaces early
  and **say so in the team channel** — don't wait until it's polished.
- **F.005 blocks every line of text in the app.**
- **F.009 blocks every second game.** Announce the freeze; that message is what
  makes Wave 4 safe.
- **F.010 + F.011 + F.013 block P4's dashboard.**

## Your gates

- **Tier 0 gate** — Game 1 runs end to end. Your F.001 and F.005 are two of its
  three inputs.
- **Tier 1 gate** — the freeze decision. Your four sequential files are most of
  what's being judged complete.

## Your review responsibilities

**You review P4:** F.002, F.003, F.004, F.016, F.018, F.019.
**You are reviewed by P3.**

Two things to hammer in P4's work: is there **any** score, index or percentile
visible (§13), and is the **non-diagnostic banner permanently visible** on the
dashboard rather than shown once.

## How to start

Open `../features/F.001.md`. You and P2 are the only two who can begin with no
dependencies.

First, though — Wave 0. Agree the crop tag shape with P2 and the slot list with
P3 and P4. Twenty minutes, and it's what lets three people build in parallel
while you're still writing the store.

One thing to hold onto while building F.001: **there is no condition field.**
Not ADHD, not autism. Four independent tuning dimensions from four questions the
parent answers. If you ever write `if (condition === ...)`, the architecture is
broken (§5.3).
