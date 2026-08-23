# F.008 — Game 1 End-to-End, One Level ← **TIER 0 GATE**

**Tier 0** · Owner: **P2** · Reviewer: P4 · Status: Implemented, self-verified — needs fresh-context review

## What
The whole product in one loop. Audio names a target; the child leaves the
screen, finds the real object, comes back; the caregiver taps **They brought
it**; the child taps the matching crop. That tap is the generalization moment
made literal (§8.1).

> **§16.4: if this doesn't exist by Saturday night, you are in Option B whether
> you've called it or not.**

## Depends on / Blocks
Depends on F.005, F.006, F.007. (F.004 for the Companion voice — degrade to a
neutral guide if it's late.) Blocks everything in Tier 1.

## Done when
- **Two audiences, one device** (§8.0). During the search the screen shows the
  caregiver: target, current support-tier instruction, and a large
  **They brought it** button. On tap it **flips to the child's view**: 2–6 crops,
  large, with audio *"Show me — which one did you bring?"*
- The button says **"They brought it"** — never *"they got it right."* The
  caregiver signals *we're back*, they do not judge the answer.
- The child taps. Correct → crop scales up, audio names it **possessively**
  (*"your red cup"*), Companion celebrates, auto-advance ~2.5s. **No Next
  button.**
- Wrong → **silence**, crop fades to ~40% and goes dead. Nothing else. (Full
  hierarchy is F.009; one tier is enough today.)
- **No points, stars, confetti or score counters anywhere** (§7.7).
- Zero text in the child's view. Icons, photos, audio only.
- **One photo capture per session, not per trial** (§8.1).
- Runs offline once the session's crops exist.
- 88×88pt targets; carousel layout on phone (§4.3).

## Review checklist
- [ ] Does the screen actually flip between caregiver view and child view, and
      does the child ever see the answer before their turn?
- [ ] Does the button read *"They brought it"* rather than anything implying a
      verdict?
- [ ] Wrong tap: is it silent? No sound, no colour flash, no X, no shake? (§7.7)
- [ ] Any score, star, timer or counter visible? (§7.7)
- [ ] Can a non-reading child complete a round? Cover all text and try.
- [ ] Does a whole session use exactly one camera capture?
- [ ] Does it run with the network off after capture?
- [ ] Real tablet and real phone, both. Devtools emulation is not enough (§4.4).

## Not in this file
Difficulty levels 1–4 (F.012). Full prompt hierarchy (F.009). Companion hunt
and helper framing (F.017). Fading (F.011).

## Guide refs
§4.3, §7.7, §8.0, §8.1, §16.1, §17
