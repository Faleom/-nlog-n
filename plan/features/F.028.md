# F.028 — Sort by rule (Logic & Quantity track)

**Tier 3 — stretch** · Owner: **P1** · Reviewer: P3 · Status: Implemented, self-verified — needs fresh-context review

## What
Two baskets, each with one example already in it. That example **is** the
rule — shown, never stated. The child puts each loose shape in the basket
it belongs to. The fourth round of the Logic & Quantity track, and the one
that track flags as *"only if time is genuinely left over."*

Everything needed to answer stays on screen the whole time: both baskets,
their examples, and every loose item. Nothing to remember, nothing to
scroll to — which is what keeps it a **looking** task rather than an
executive-function one.

## The input decision — tap leads, drag follows
The track's own spec says *"two taps, never a drag, which would add a motor
demand some of these children can't meet."* The main guide independently
says the same thing twice: §8.2 step 5 (Game 2 sequencing) and §8.3 Mode C
(Game 3 puzzle) both specify tap-to-place because sustained-contact
dragging is genuinely hard with fine-motor differences.

**Built as: tap a shape, then tap a basket — primary. A drag also works if
a child reaches for one, but is never required.** That is the house pattern
already, and it gives drag to the children who want it without excluding
the ones who can't hold contact.

**Do not promote drag to the only path.** Three separate documents decided
this; a fourth reversal should be a deliberate, recorded product call, not
a refactor.

## The one-dimension invariant — structural, not styling
A round sorts by **one** of four dimensions — **shape** (circle / square /
triangle), **size** (big / small), **fill** (solid / outline) or **colour**
— and every other dimension is held **constant** across every loose item
*and* both seeded examples.

This generalises the original rule (all items one colour, sort by shape);
it does not relax it. The original was this invariant with the dimension
pinned to `shape`. If two dimensions ever vary at once the round stops
having a single answer — *sort by shape, or by colour?* — and stops being
answerable by looking, which is the premise of the whole track.

`buildSortRound()` cannot construct a violating round, and `smoke-f028`
asserts the invariant over 300 random rounds plus 40 of each dimension.
**The renderer is equally bound:** a per-item shadow, or a background tint
on the armed basket, introduces a second varying property just as surely as
a data change would. The armed-basket state is therefore a border change
only, and the test asserts that too.

**Variation between rounds** comes from: which dimension is the rule, which
two of its values, what the other three are pinned to, and whether there
are 4 or 6 items (always an even split, so neither basket is the
"mostly-right" guess).

**The avoid list is honoured at OFFER time, not render time** (§6.2 Layer
4): a disliked colour is excluded from the palette before a round is built,
and `availableDimensions()` drops the colour dimension entirely if fewer
than two colours survive.

## Depends on / Blocks
Depends on F.001 (store), F.010 (support ladder), F.013 (session
lifecycle). Blocks nothing.

## Done when
- One seeded example sits in each basket from the start — the rule, shown.
- Tap-then-tap works. Drag works. **Both go through the same code path**, so
  they cannot diverge in behaviour.
- A **wrong basket returns the shape and does nothing else** — no sound, no
  colour change, no shake, no mark, no message. It can be repeated forever
  without locking anything out.
- Dropping on nothing behaves identically.
- The child's view has zero visible text: no caption on the shapes, no
  count of what's left.
- The round **ends itself** when the tray empties, into the caregiver's
  support-tier report, logged through F.010.
- 88×88pt items. Motion read from `config/motion.ts`, never hardcoded.
- Exactly one dimension varies per round, seeds included.
- A disliked colour is never offered, on any dimension.

## Review checklist
- [ ] Put a circle in the square basket. Is the response genuinely
      *nothing* — no sound, no flash, no wobble? (Should feel like almost
      nothing happened. That is correct.)
- [ ] Can the whole round be completed **without ever dragging**?
- [ ] Play six rounds. Does each have exactly ONE thing that differs? If
      you can see two, the round has two answers and is broken.
- [ ] Set an avoided colour in the avoid list. Does it ever appear again,
      including as the constant colour of a shape round?
- [ ] Is there any visible word or number inside the sorting view?
- [ ] Does every item still carry a full attribute set, with only the rule
      dimension differing?
- [ ] Is `misses` rendered anywhere? (It must feed the log only — never a
      caregiver-visible number, never a comparison.)
- [ ] Real tablet and real phone: are the 88pt items still 88pt at the
      smallest width, and does drag work with a finger rather than a mouse?

## Not in this file
A third basket or a second rule dimension. Rule types beyond shape. A
difficulty ladder. Any use of the child's own room photos — this round is
abstract by design. Sound.

## Tech stack for this file
None beyond React. Pure logic in `src/games/logic/sortByRule.ts`, rendering
in `src/games/SortByRule.tsx`, Pointer Events for the optional drag. No
drag-and-drop library added — one was deliberately not introduced, since
drag is the secondary path.

## Suggested subagent approach
Safe as one agent. If split, the seam must **not** be "one agent does tap,
one does drag" — that is exactly how the two inputs end up with different
rules for what a wrong basket does. Split by logic-vs-render if at all.
