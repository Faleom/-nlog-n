// F.002 — Shared onboarding: age validation + the two-door branch type.
// See app-guide-v3-FINAL.md §5.1.
//
// Pulled out of the screen component so it's testable in plain Node —
// no DOM needed to check "is this a sane age in months".

/**
 * Age in months is the ONLY required field (§5.1). Returns null for
 * anything that isn't a positive whole number of months, or an
 * implausible one (>18 years) — never throws, so the screen can just
 * disable "Continue" on null rather than handling an exception.
 */
export function parseAgeMonths(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > 216) return null;
  return value;
}

/** The two equal doors (§5.1). Neither is a default — see Onboarding.tsx. */
export type Branch = 'my-world' | 'worry-to-question';
