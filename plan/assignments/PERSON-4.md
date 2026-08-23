# Person 4 — Onboarding, the Companion, and the Caregiver View

> **Status update (post-build): this brief is historical.** All six of
> Person 4's files (F.002, F.003, F.004, F.016, F.018, F.019) are
> implemented, tested, and merged. See `../../STATUS.md` for the current
> picture and `../overview/F.000-INDEX.md` for live per-file status. The
> content below is kept for the reasoning it captures, not as a live task
> list.

You own everything the parent fills in — including the feature the guide calls
the strongest in the product.

## Your files, in order

| File | Tier | One line |
|---|---|---|
| **F.002** | 0 | Shared onboarding: age, nickname, two equal doors |
| **F.003** | 0 | Response profile — four questions, no condition field |
| **F.004** | 0 | **Companion capture** — the differentiator |
| **F.016** | 2 | Context profile: quick preferences |
| **F.018** | 2 | Avoid list |
| **F.019** | 2 | Caregiver dashboard |

Three Tier 0 files — the most on the team — but two of them are small forms.

## What you're building

**F.004 is the one that matters most.** §6.3 calls the Companion mechanic the
single strongest feature in the product, and it's four fields: photograph the
child's favourite toy, name it, pick a pronoun, reject the photo if there's a
face in it.

What those four fields buy: the child's own teddy becomes the app's character.
It gives instructions, stars in the stories, is a findable target, appears as
the reward, and waves goodbye at the end. **Zero art budget** — the character is
a photo the parent took. **Structurally impossible for a competitor with a drawn
mascot to copy.** And it demos in one four-second swap: change the Companion,
the whole app changes.

Guardrail: **no photos of people, ever.** Same face detector as F.006. If a face
is found, reject with *"Let's use a toy or object instead."* And the Companion
has exactly two states — waiting and delighted. Never sad, never disappointed,
never hurt by a wrong answer.

**F.003 replaces the whole ADHD/autism profile system with four questions.**
Sound and movement · how long they stay with one thing · sameness or variety ·
how they let you know what they want. Those four drive every tuning decision in
the engine. A parent *may* tell you a diagnosis — it pre-fills the four answers
and saves them four taps — but **it never reaches the tuning logic**, and it
unlocks nothing. The reason: at 3–5, most children who'll be diagnosed haven't
been yet. Gate anything on a diagnosis and you exclude the families with nothing
else.

Make it not feel like an assessment: no score, no summary screen, no profile
type shown back, no completion percentage. Wording stays observational.

**F.019 is the caregiver's view**, and its most important element is a sentence:
*"This is an activity log, not a clinical assessment."* Permanently visible, not
first-run only. And **shortening sessions are shown as progress, not decline** —
the app is designed to be used less.

## Who you depend on

- **P1 → F.001** before F.002. A conversation about the profile shape is enough
  to start.
- **P2 → F.006's face detector** before F.004's no-people gate.
- **P1 → F.005** slots before F.016 does anything visible.
- **P1 → F.010/F.011/F.013** before the dashboard has data.

## Who depends on you

- **F.003 blocks all tuning** — F.009, F.012 and every profile-driven behaviour.
- **F.004 blocks F.005's slots and F.017's Companion mechanic.**
- Your three Tier 0 files are three of the eight in the gate.

## Your gates

- **Tier 0 gate** — your onboarding, profile and Companion feed Game 1.
- **Tier 2 gate** — done **and tested**, not "written." Wave 5 doesn't open
  otherwise.

## Your review responsibilities

**You review P2:** F.006, F.008, F.012, F.017, F.021.
**You are reviewed by P1.**

**F.006 is the most important review you'll do.** Open the network inspector,
upload a photo with a face in it, and look at the request body. Is the
transmitted image the blurred one? Then force the detector to fail — does the
pipeline discard, or send anyway?

**F.008**: does the screen actually flip between caregiver and child view, and
can the child see the answer early? Is a wrong tap genuinely silent?

## How to start

Open `../features/F.002.md` — it's small and P3's Branch 2 needs it. But agree
the profile shape with P1 in Wave 0 first, so you can build ahead of their store.

Then time yourself through the whole onboarding at a tired-parent pace. §5 caps
it at two minutes and §6.6 flags that the Context Profile puts real pressure on
that. The design rule: **onboarding asks for the Companion. Everything else is
offered, never required.**
