# UI Standards

Cross-cutting rules from §4. **Every file obeys these** — they aren't one
person's job, and a violation in any single screen breaks the accessibility
claim for the whole app.

---

## Non-negotiable, both devices

- **88×88pt minimum touch target.** No exceptions, at any grid size.
- **Zero text in the child's view.** Icons, photos and audio only (§7.10).
- **Immediate visual feedback on every press.** Without it a preschooler presses
  again — and F.009's rapid-tap rule reads that as disengagement (§4.4).
- **No hover states anywhere.** There is no hover on touch. Anything relying on
  it silently breaks — remove all of it.
- **Phone locks to portrait.** Rotation mid-session is a disruption, especially
  for a child who needs predictability.
- **Session end requires a deliberate caregiver action**, never a stray swipe.
- Same audio, prompts, pacing and difficulty ceiling on both devices.

## The layout rule

> **Cap the grid on phones rather than shrinking the buttons.**

Say it out loud in the pitch — it's specific, credible, and most teams wouldn't
think to make it. A phone has ~⅓ the area of a tablet; the answer is a different
layout pattern, never a smaller target.

| Pattern | Tablet | Phone |
|---|---|---|
| Grid → **Carousel** | 6 crops, 3×2 grid | 6 crops, swipeable row, 2.5 visible |
| Grid → **Sequential reveal** | 4 options at once | 2 at a time, "show me more" between |
| Side-by-side → **Stacked** | Sample above a row | Sample pinned top, options scroll beneath |
| Sequence row → **Vertical strip** | 4 steps left to right | 4 steps top to bottom |
| Dashboard columns → **Accordion** | Three panels | Collapsible, recap open by default |

**Defaults:** carousel for Game 1 confirmation · sequential reveal for Game 3
options · vertical strip for Game 2 · accordion for the dashboard.

## Two audiences, one device

> **The screen is the caregiver's. The audio is the child's.**

The child comes to the screen only at the moment of confirmation (§8.0). In
practice this means a **view flip**: during the search the screen shows the
caregiver their support-tier instruction and the action button; on tap it flips
to the child's crops.

Two things this must get right, and they're easy to miss:
- The child must **not see the answer** before their turn.
- The caregiver must be able to read their instruction **while the child is out
  of the room**.

## Sensory settings are real behaviour, not a slider

The four response-profile answers change the app visibly:

- **Sound off** means never calling `speak()` — not muting output.
- **Low animation intensity** visibly reduces motion. Honour
  `prefers-reduced-motion` alongside it.
- **Sameness helps** means identical phrasing trial to trial, fixed layout, the
  reward crop in the same position every time, and **no timer of any kind**.
- **Reduced saturation** visibly changes the palette.

If flipping a setting produces no observable change, it isn't implemented.

## Never, in the child's view

No score · no stars · no confetti · no points · no counter · no timer · no
progress bar · no red X · no buzzer · no shake · no "Try again!" · no sound
identifiable as negative.

A wrong tap is **silence plus fade**, and nothing else (§7.7).

> This is a **research position, not a kindness.** NDBI moves away from
> artificial extrinsic reinforcers because they don't generalize — the child
> learns to perform for the star, not the thing. A star-chart app is actively
> misaligned with the evidence base it would claim to be built on. Defend the
> no-score design on that ground.

## Testing

**One real tablet and one real phone, from Wave 0.** §4.4 is explicit that
devtools emulation is not sufficient for touch-target sizing. Check 88pt at the
largest grid, on the smallest phone you have.
