# Claude Code Prompt — Tech Stack & API Decisions (Phase 2)

*Run after /plan already exists from the first prompt. Copy everything below
this line into Claude Code.*

---

## Context

`/plan` already has the full task breakdown, built with zero tech/API
choices, by design. Read every `F.00X.md` file plus `APP_GUIDE.md`, then add
a technology decision layer on top — additive only, don't restructure or
rescope anything that exists.

## Constraints to weigh on every decision

- Must survive a full week of unsupervised judge testing — reliability over
  polish. Prefer free-tier/browser-native options over paid APIs when the
  quality gap is small, specifically to avoid quota/rate-limit failure
  mid-week.
- Photos must never be stored (`APP_GUIDE.md` §4.4/§9) — for the
  object-recognition/face-blur pipeline, state plainly whether the chosen
  API holds files server-side even transiently, since that's a direct claim
  in the pitch.
- Sessions must run offline once generated (`APP_GUIDE.md` §4.8) — flag
  which pieces are online-only (generation) vs. must work offline (replay).
- No hardware access — software-only, standard laptop/phone.
- Fewer external services beats best-in-class-per-need — every added
  service is another failure point and another thing to configure across 4
  machines.

## Output

### 1. `TECH-DECISIONS.md`

One entry per capability required by the plan (scan the F.00X files for the
actual list — expect at least: object recognition, face detection/blur,
text generation for task-analysis steps, text-to-speech, text
simplification, speech transcription if Branch 2 needs it, local
persistent storage):

```markdown
## [Capability]
**Used in**: [F.00X file(s)]
**Decision**: [chosen tech/API/library]
**Why**: [weighed against the constraints above, specifically]
**Reliability notes**: [rate limits, offline behavior, failure modes]
**Alternatives rejected**: [1-2, with the specific reason each lost]
```

Where a real tradeoff exists and there's no clearly correct answer, don't
guess — put it under "Team decision needed" instead.

### 2. Update each F.00X.md — additive only

Append one new section, don't touch anything existing:

```markdown
## Tech stack for this file
[Pulled from TECH-DECISIONS.md, stated concisely. If none applies:
"None — pure application logic, no external dependency."]
```

### 3. `SETUP.md`

One onboarding file for all 4 people:
- Every account/API key needed, listed once
- Where secrets live (describe the pattern, e.g. `.env.example` — don't
  invent actual values)
- Local tooling/runtime required
- A one-line smoke test per dependency ("run X — if it returns Y, you're
  set")

## Rules

- Don't change scope, ownership, numbering, or dependencies of any F.00X
  file.
- Don't pick the most capable option by default — weigh it against
  reliability-over-a-week and fewer-services every time.
- If a choice creates real tension with the "photos never stored" claim
  (e.g. only viable option sends photos to a third-party server, even
  briefly), say so plainly — don't gloss over it.
- Where cost is unpredictable (LLM calls at unknown judge volume over a
  week), flag it and suggest caching by content hash so repeat use of the
  same file doesn't repeat the call.
- Finish with a chat summary: every capability decided, its chosen tech,
  and any "Team decision needed" items left for a human.
