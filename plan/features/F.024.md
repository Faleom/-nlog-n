# F.024 — Generalization Re-Testing

**Tier 4 — DO NOT START** · Owner: unassigned · Status: Spec only

## What
Once a skill is independent in one context (the kitchen), deliberately
re-introduce it in another (the bedroom). A drop back to needing more support is
**never flagged as regression** — it's an expected, logged part of
generalization, and support fades again from there, typically faster.

Spec'd because the **generalization list in the dashboard (F.019)** references
the idea, and because it's the strongest thing to say about what comes next.

## Why it's deferred
It needs multi-session history to be visible at all, which a weekend demo cannot
produce honestly. Faking it would be worse than omitting it.

**What ships instead:** F.012's Level 4 search scope already moves the child to
a different room, and F.019 lists which contexts a skill has been seen in. That
is the visible half, and it's true.

## If it is ever built
- Trigger and context identity must be written down, not inferred.
- **The word "regression", any warning icon, any "went backwards" framing must
  never appear** (§7.6).
- Fading restarts per context, independent of the first context's history.
- Nothing about it is surfaced to the parent as a finding or a concern (§10).

## Guide refs
§7.6, §16.1
