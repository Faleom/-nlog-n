# Person 3 — Content, Branch 2, and the Video

Your work moves through three distinct phases. The last one is the deliverable.

## Your files, in order

| File | Tier | One line |
|---|---|---|
| **F.007** | 0 | Object → skill → steps lookup table. **Start now** — content, not code |
| **F.014** | 1 | Branch 2: milestones + three guided prompts |
| **F.015** | 1 | Branch 2: the card, and the guardrail that protects it |
| **F.020** | 2 | Branch handoff + the no-screening rule |
| **F.026** | — | **Demo, video & submission** — owned from Wave 0, active from the Tier 1 gate |

## What you're building

**F.007 first, and it's authoring, not engineering.** §7.5 calls the
object→activity mapping the hardest problem in the app, and says that in 48
hours **it must be a rules-based lookup, not model improvisation.** ~15
household objects × 3–4 skill templates each, written with slots. You can start
in Wave 1 against the agreed tag shape — you don't need P2's pipeline to exist.
Say "rules-based mapping" in the pitch: judges respect honest simplicity, and a
table always works on demo day.

**Then Branch 2, which is almost entirely a discipline problem.** A parent
notices something, doesn't know if it's normal, has a relative telling them not
to worry. Three short guided prompts — what did you notice, when did you first
notice, what does it look like — and out comes a card they can hand to a health
worker. Their own observation, cleaned up.

**§9.4 is the file's real content.** The card is a fixed template holding only
what the parent literally said, plus three fixed questions. Banned outright: any
condition name, and the words *delayed, disorder, risk, concerning, abnormal,
symptom, likely, probably, suggests*. Enforced by a **post-generation check, not
prompt wording**. If the check fails, **the card is not shown** — the parent gets
the raw text of their own words instead. Degrading to the parent's own sentence
is always safe; a hallucinated symptom never is.

Read §9.2 before you write a word of milestone copy. It's four sentences and
it's the whole reason this branch works the way it does: the best validated
autism screener is right ~58% of the time on positives, so a weekend build has
no business showing anything that resembles a result.

**Then the video.** §16.4 names it **the task most likely to be quietly dropped
while the build is going well.** That's why it has an owner from Wave 0 and
activates the moment Branch 2 is done.

## Who you depend on

- **P2 → F.006** for the tag shape only. Paper agreement in Wave 0 is enough.
- **P4 → F.002** before F.014 has an entrance.
- **P1 → F.008/F.010** before F.015 can offer an activity and F.020 can exist.
- **Everyone** before the video.

## Who depends on you

- **F.007 blocks F.008** — the Tier 0 gate. This is your urgent one.
- **F.026 blocks submission**, which is the project.
- **You review the entire engine.** If your reviews back up, P1's files can't be
  marked done.

## Your floating role

You finish Tier 0 earliest by design. **Don't start Branch 2 early — float.**
Whatever is behind at that moment is where you go, and the likeliest candidate
is **F.004 Companion capture**, because it's the differentiator and the Tier 0
item most likely to get squeezed.

## Your review responsibilities

**You review P1's engine:** F.001, F.005, F.009, F.010, F.011, F.013.
**You are reviewed by P2.**

This pairing is deliberate. The engine is the most-depended-on code, and you
review it — not P2, who works with it daily and would review it for usability.
You'll review it for spec compliance, which is what it needs.

What to hammer:
- **F.001/F.005** — is there a `condition` field anywhere in the tuning path?
  There must not be (§5.3).
- **F.009** — tap wrong three times. Does the child end in success with no
  negative signal at any point? Is a wrong tap genuinely *silent*?
- **F.010** — grep for counters over activity history (§10).
- **All of them** — any score, index or percentage? (§13)

## How to start

Open `../features/F.007.md`. Agree the crop tag shape with P2 first, then start
writing the table — it's the one Tier 0 file that needs no code from anyone.

One thing to keep in view all weekend: you own both the app's restraint rules
*and* the video. That's not a coincidence in the assignment. The pitch lines
that land hardest — §9.2's refusal to screen, §13's list of things you chose not
to build — are yours to build and yours to say.
