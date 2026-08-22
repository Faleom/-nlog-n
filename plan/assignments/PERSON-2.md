# Person 2 — Camera & Game 1

You own the pipeline everything is built from, and the game the demo is.

## Your files, in order

| File | Tier | One line |
|---|---|---|
| **F.006** | 0 | Camera → **on-device face blur** → recognise → crops → discard. **Start now** |
| **F.008** | 0 | **Game 1, one level, end to end** ← the Tier 0 gate |
| **F.012** | 1 | Game 1 difficulty levels 1–4 |
| **F.017** | 2 | Companion mechanic in Game 1 — the profile-swap demo moment |
| **F.021** | **2 — required** | Game 3, Mode A: Shadow Match. All three games ship this weekend |
| F.023 | 3 — stretch | Game 3, Modes B & C: Trace and Puzzle. First thing cut if time runs short |

## Your second and third builds: Game 3

**F.021 used to be optional. It isn't any more** — the team decided all three
games ship this weekend. Sequence it after F.017, once Game 1 is genuinely
solid: Shadow Match reuses your own crop and silhouette machinery, so it's a
natural extension of work you're already deep in, not a context switch.

Game 3 is a silhouette-matching game: a silhouette at top, real photos below,
the child picks the match. Four levels, the last of which hands directly into
Game 1's own loop — same skill, different distance. Silhouettes generate
**client-side** from the crop, no extra API call.

**F.023 (Trace and Puzzle, the other two Game 3 modes) is real but genuinely
stretch** — build it only after F.021 is done and tested, and treat it as the
first thing you drop if Sunday runs long. Read `../features/F.023.md` when you
get there; §8.3 says build Puzzle before Trace if only one lands.

## What you're building

**F.006 is half a day of face-blur work before it's anything else.** §17 budgets
that explicitly. Downscale to ≤1024px, detect on the downscaled image, map the
boxes back, blur at full resolution, *then* send. If it isn't working by the end
of Wave 1, switch to the fallback: a hard *"no people in frame"* confirmation
gate. **Never ship an unblurred pipeline.**

Fail closed. If detection throws, discard the photo and offer a retake. The cost
of a dropped upload is an apologetic message. The cost of the alternative is
transmitting a child's face.

Then **F.008 — the whole product in one loop.** Audio says *"Bunbun wants
something red!"* The child leaves the screen and goes and finds it in the actual
room. They come back. The caregiver taps **They brought it**. The screen flips
to the child: a few photos, *"Show me — which one did you bring?"* They tap.

Three things about that loop that are easy to get wrong:

1. **The screen serves two people at different moments.** Caregiver view during
   the search — target, support-tier instruction, the button. Child view at
   confirmation — the crops. It has to flip, and the child must not see the
   answer early.
2. **The button says "They brought it", never "they got it right."** The
   caregiver signals *we're back*. They don't judge. The child's tap decides,
   and even that can't fail.
3. **One photo per session, not per trial.** Fast, offline, and flat-cost.

## Who you depend on

- **P3 → F.007** lookup table, before F.008 has activities. They're building it
  from Wave 1 against the tag shape you agree in Wave 0.
- **P1 → F.005** slots, and **P4 → F.004** the Companion, for the voice. Both
  degrade gracefully — build against a neutral guide if they're late.
- **P1 → F.009** state machine before F.012.

## Who depends on you

- **F.006 blocks F.007 and F.008** — the whole Tier 0 chain.
- **F.008 is the gate.** Everything in Tier 1 waits on it.

## Your gates

- **End of Wave 1** — a real photo returns tagged crops, **with the blurred
  image on the wire.**
- **Tier 0 gate** — Game 1 running on a real tablet, watched by all four.

## Your review responsibilities

**You review P3:** F.007, F.014, F.015, F.020.
**You are reviewed by P4.**

Review P3's Branch 2 work adversarially, not politely. **F.015**: feed it an
input naming a condition outright — does the card carry it forward? Force the
guardrail to fail — is the card withheld and the parent's own text offered?
**F.020**: grep for any counter over activity history. There must be none.

## How to start

Open `../features/F.006.md` and start the face-blur spike. You and P1 are the
only two who can begin immediately.

Test on a **real tablet and a real phone** from the start. §4.4 is explicit that
devtools emulation is not sufficient for touch-target sizing, and 88×88pt is a
hard floor.

And when you verify the blur: **open the network inspector and look at the
request body.** Reading the code doesn't prove anything. That single check is
the most important verification in the entire build.
