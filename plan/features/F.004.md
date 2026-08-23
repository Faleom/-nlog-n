# F.004 — Companion Capture

**Tier 0** · Owner: **P4** · Reviewer: P1 · Status: Implemented, self-verified — needs fresh-context review

## What
The parent photographs the child's favourite toy, names it, picks a pronoun.
That toy becomes the app's character. **§6.3 calls this the single strongest
feature in the product** — it is not a nice-to-have and it is Tier 0.

## Depends on / Blocks
Depends on F.001. Blocks F.005 (slot values), F.008, F.017.

## Done when
- Parent photographs the toy on its own, types or speaks a name (*"Bunbun"*),
  picks a pronoun: he / she / they / it.
- **No-people gate**: run face detection on the Companion photo. If a face is
  found, reject with *"Let's use a toy or object instead."* (§6.3, §13). Same
  detector as F.006.
- **The Companion photo is stored on device** — the one image that persists,
  because it's needed every session (§7.4, §14).
- Skippable, falling back to a neutral guide — but this is the one thing worth
  pushing for (§6.6).
- Editable later from settings, no re-onboarding (§6.5).
- The name and pronoun are available to the slot system as `{companion}` and
  `{companion_they}`.

## Review checklist
- [ ] Does a photo containing a face get rejected, every time? Test it.
- [ ] Does the rejection message avoid blame and suggest the fix? (§6.3)
- [ ] Does the photo survive an app restart?
- [ ] Does skipping leave a working neutral guide, not a broken app?
- [ ] Is the pronoun actually used downstream, or hardcoded to "it"?
- [ ] Is the Companion ever shown sad, disappointed or hurt? It must have
      exactly two states: waiting and delighted (§6.3).

## Not in this file
No photos of people, ever. No Companion behaviour in games (F.008, F.017).
No drawn or illustrated character — the art budget is zero by design.

## Guide refs
§6.2, §6.3, §6.5, §6.6, §7.4, §13, §14
