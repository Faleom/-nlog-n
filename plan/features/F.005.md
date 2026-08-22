# F.005 — Slot System

**Tier 0** · Owner: **P1** · Reviewer: P3 · Status: Implemented, self-verified — needs fresh-context review

## What
Every string the app says is a template with typed blanks, filled from the
profile. **Lookup-and-substitute, not model generation** (§6.4). Instant, free,
and it cannot hallucinate.

## Depends on / Blocks
Depends on F.001, F.004. Blocks every file that emits text or audio.

## Done when
- These slots resolve: `{companion}` `{companion_they}` `{fav_colour}`
  `{fav_animal}` `{fav_food}` `{fav_place}` `{caregiver}` `{child}`
  `{movement}` `{object.name}`.
- **Every** audio line, prompt, story sentence and reward message is authored
  with slots. The engine never emits a generic string when a slot is available.
- Missing slot values degrade to a sensible neutral phrasing — never a visible
  `{placeholder}`, never a crash.
- **The avoid-list filter runs last**, on the final filled output. If an avoided
  term or property survives, the line swaps to a neutral variant. (Filter itself
  is F.018; build the hook now, wire it Tier 2.)
- No runtime model call anywhere in this path.

## Review checklist
- [ ] Grep the codebase for hardcoded child-facing strings that should have
      slots. Any generic line where a slot exists is a bug.
- [ ] With an empty profile, does every line still read naturally?
- [ ] Does a raw `{slot}` ever reach the screen or the speaker?
- [ ] Is the avoid-filter hook the **last** step, after substitution? (§6.4)
- [ ] Any model call in this file? There must be none.

## Not in this file
No AI text generation. No avoid-list content (F.018). No game logic.

## Guide refs
§6.4, §12.1
