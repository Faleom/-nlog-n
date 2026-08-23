# F.006 — My World Pipeline: Camera → Face Blur → Recognise → Crops → Discard

**Tier 0** · Owner: **P2** · Reviewer: P4 · Status: Implemented, self-verified — needs fresh-context review

## What
Parent points the device at the room and shoots. Faces blurred **on device**
before anything is sent. Photo downscaled, sent for object identification,
crops extracted, **photo discarded**. Output: a set of crops tagged
`{name, colour, category, function, bbox}` — the entire content library for
every game (§8.0).

**§17 budgets half a day for the face-blur spike. Start it first.**

## Depends on / Blocks
Nothing. **Start immediately, in parallel with F.001.** Blocks F.007, F.008 —
and therefore the Tier 0 gate.

## Done when
- **Capture path (this build): file picker.** §4.2's product vision is still
  "native camera, no file picker" for the eventual tablet/phone product — that
  is unchanged. But this build runs on laptops, which generally have no
  environment-facing camera to satisfy that vision at all, so the
  `getUserMedia` in-app viewfinder is kept in `deviceCamera.ts` (exported,
  unwired) for that future device and a plain `<input type="file"
  accept="image/*">` picker is the default, reliably-invoked path here — see
  `TECH-DECISIONS.md` § Camera for the full reasoning and the one-line swap
  back.
- **Face blur, on device, before transmission** (§4.4): downscale to ≤1024px
  long edge → detect on the downscaled image → map boxes back → blur at full
  res → then send.
- **Fail closed.** If blur fails or is uncertain: discard the photo, tell the
  parent it couldn't be processed, offer a retake. **Never proceed on an
  unblurred image** (§11).
- **Fallback ready by Saturday night** if the blur spike isn't working: a hard
  *"no people in frame"* confirmation gate. Never ship an unblurred pipeline.
- Recognition returns crops tagged with name, colour, category, function, bbox.
- **Photo discarded after processing.** Check disk and cache, not just the UI.
- Recognition returns nothing usable → fall back to generic activities for the
  chosen context, **no error shown** (§11).
- Slow (>4s) → calm progress state showing the parent's own photo, never a
  spinner over blank (§11).
- Camera permission denied → both branches still fully usable (§4.4).

## Review checklist
- [ ] **Open the network inspector, shoot a photo with a face in it, and look at
      the request body. Is the transmitted image the blurred one?** This is the
      single most important check in the build.
- [ ] Force face detection to fail — does the pipeline discard, or send anyway?
- [ ] After processing, is the photo gone from disk and cache?
- [ ] Deny camera permission — does the app still work?
- [ ] Return zero objects — does the flow degrade quietly with no error?
- [ ] Does it detect **objects only** — never a person, expression, or
      behaviour, and no prompt inviting it? (§13)
- [ ] Any hazard detection, tidiness inference, or comment about the home?
      Forbidden even in a debug log (§13).

## Not in this file
No activity generation (F.007). No per-trial capture — **one photo per session**
(§8.1). No hazard detection. No analysis of people.

## Guide refs
§4.2, §4.4, §7.4, §8.0, §11, §13, §14
