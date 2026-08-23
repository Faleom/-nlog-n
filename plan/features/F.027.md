# F.027 — Block-stack match (Logic & Quantity track)

**Tier 2** · Owner: **P1** · Reviewer: P3 · Status: Implemented, self-verified — needs fresh-context review

## What
Build the blue tower to match the yellow one. The third round of the
Logic & Quantity track (`Logic & Quantity Rounds.pdf`), and the only one in
that track marked **grown-up helps** — because it's a loop (look, compare,
adjust, check again) rather than a single answer. The stack starts 1–2
blocks off, so the correction is always short.

## The interaction change this file exists for
The round as specced used a **− / +** button pair. Two problems with that,
and only the second one is fatal:

1. A preschooler doesn't reliably understand plus and minus as *more* and
   *fewer*.
2. **They are two symbols sitting inside the child's view.** A child
   decoding `+` is reading — the exact gate the whole app is built to
   avoid, and the same ground the track's own cut list used to reject
   *counting with numerals*. This is a §7.10 violation, not a usability
   preference.

**Replaced with a vertical gesture on the tower itself.** A gesture carries
no symbol, so there is nothing to read.

### The direction decision — decided, and held in one constant
**Swipe up lifts a block off. Swipe down places one on.** The
physical-hand reading: you lift a block away, you press one down.

The competing reading — *up = the tower grows* — is its exact inverse, and
a child holding that model makes the tower worse on every attempt to fix
it. Because the two are opposites rather than variants, the mapping lives
in a single exported constant (`SWIPE_MEANING` in
`app/src/games/logic/blockStack.ts`) that every vertical gesture in the app
must read from. Do not re-derive it at a call site.

### Tap is a first-class second input
A swipe is cheaper than a drag — no target to hit, no sustained precision —
but it is **not free**: it still wants a clean directional gesture, and some
children in this band cannot produce one. So a tap does the same two
things, resolved by where it lands: tap the empty space above the tower to
place, tap the tower to lift. Spatially literal, so it needs no legend.
**Nothing on screen advertises this** — it simply also works.

### Motion — both directions, capped by the profile
A placed block **falls in**, squashes on contact and settles. A lifted
block **rises out** and fades. The lift needs a transient *ghost*: the
machine has already dropped the block, so nothing remains to animate
unless the render layer keeps one alive for the duration. The ghost is
render state only and never enters `blockStack.ts`.

Every duration and distance comes from **`src/config/motion.ts`**, which
returns the LOWEST of three inputs: `prefers-reduced-motion`, the avoid
list's *fast animation or flashing*, and the response profile's Q1. Adding
motion to this round must never hand a calm-profile child more movement
than they asked for — that cap is the module's whole reason to exist, and
hardcoding a duration here bypasses it. `smoke-f029` enforces it repo-wide.

## Depends on / Blocks
Depends on F.001 (store), F.010 (support ladder), F.013 (session
lifecycle). Blocks nothing.

## Done when
- The child's view contains **two towers and nothing else** — no label, no
  glyph, no caregiver control, no count of blocks.
- Swipe up lifts, swipe down places, on the blue tower only.
- A tap does the same two actions by position.
- A gesture that falls short of the travel minimum does **nothing**, silently.
- The ceiling and the floor are **silent no-ops** — no sound, no shake, no message.
- Overshooting is not a failure state: lifting back down re-matches.
- The round **auto-advances on a match** (§7.7 "no Next button"), into the
  caregiver's support-tier report, which logs through F.010 like every
  other game.
- No score, star, counter, timer or progress bar anywhere.
- **Both directions animate.** Place-in and lift-out, not just place.
- Motion intensity is read from `config/motion.ts`, never hardcoded; a
  lively profile visibly moves more than a calm one, and
  `prefers-reduced-motion` or the avoid list drops it to the floor.

## Review checklist
- [ ] Is there any visible character inside the child-facing phase? Cover
      the screen with your hand except the towers — is anything left?
- [ ] Swipe up on the blue tower: does a block come **off**? (If it goes on,
      the constant has been inverted and the round is now actively
      misleading.)
- [ ] Tap above the tower and on it: do both work, with no on-screen hint
      that they would?
- [ ] Swipe past the top and past the bottom: silence, or a reaction?
- [ ] Any score, star, counter, timer, or "wrong move" feedback?
- [ ] Does the app shell's own header actually disappear during the
      building phase, rather than just fading?
- [ ] Real tablet and real phone. Is the gesture reachable one-handed, and
      is the tower ≥88pt wide?
- [ ] Lift a block: does it visibly *travel* out, or does it snap away?
      (A ghost that inherits the neighbouring `relax` animation instead of
      `lift` looks almost right and is wrong — that exact cascade collision
      already happened once here.)
- [ ] Set the OS to reduce motion, and separately tick "fast animation" on
      the avoid list. Does each independently flatten the animation?

## Not in this file
The other three rounds of the track (More or fewer, Same amount, What comes
next). A second chapter or difficulty ladder. Any use of the child's own
room photos — this round is abstract blocks by design, like the rest of the
track. Sound.

## Tech stack for this file
None beyond React. Pure logic in `src/games/logic/blockStack.ts`, rendering
in `src/games/BlockStackMatch.tsx`, Pointer Events for the gesture. No
library added.

## Suggested subagent approach
One sequential agent. The gesture mapping, the tap fallback and the machine
are one small interlocking piece; splitting them invites two contexts
disagreeing about what "up" means, which is precisely the failure this
file's central decision exists to prevent.
