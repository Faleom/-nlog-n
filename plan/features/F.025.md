# F.025 — Social Story Sub-Flow

**Tier 4 — DO NOT START** · Owner: unassigned · Status: Spec only

## What
Parent photographs a place the child is about to visit; the app generates short,
age-appropriate sentences matched to what's visible; the result is a picture
book shown repeatedly in the days before the visit.

## Why it's spec'd despite not being built
> **§7.8: this is the only place in the entire app where the child looks at a
> screen for any length of time.**
>
> **Say this in the pitch anyway.** It is a stronger screen-time answer than the
> session cap, and stronger than anything a competitor can claim.

The claim is *"the child barely looks at a screen"* — and it holds because
Games 1 and 2 are off-screen by design. Naming the one exception makes the claim
credible rather than glib. You can say it truthfully whether or not this ships.

## If it is ever built
- **Mandatory checkpoint before proceeding**: confirm no other children are
  visible, and that permission was given by whoever manages the location. A hard
  gate, not a dismissible notice (§7.8).
- The checkpoint is a **parent confirmation**, never an automated
  child-detector — §13 forbids analysing people in a photo.
- Sentences describe **only what is visible** — never invented detail.
- The retention question needs an explicit answer: the book needs images across
  several days, and §14 says room photos are discarded. Decide before building.

## Guide refs
§7.8, §13, §14, §16.1
