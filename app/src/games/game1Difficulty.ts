// F.012 — Game 1 difficulty levels 1-4. Pure logic only (prompt type, grid
// size, distractors, search scope, profile tuning) — no React, no camera,
// fully testable without a browser. See scripts/smoke-f012.ts.
//
// §8.1's axis table:
//   Prompt type   | named object -> attribute -> category -> function
//   Grid size     | 2 crops -> 6 crops
//   Distractors   | unrelated -> sharing a feature with the target
//   Search scope  | one area -> whole room -> a different room
//
// This file layers on top of F.008's game1Trial.ts (target selection) —
// it does not duplicate the support ladder, fading, or session-lifecycle
// logic, which stay Person 1's engine (§12.2: a game is a thin layer).

import type { ChildProfile, TaggedCrop } from '../types';
import type { Game1Level } from './game1Level';

// ---------------------------------------------------------------------------
// Prompt type (§8.1 axis 1) — the exact worked example phrasing:
// "your red cup" -> "something red" -> "something you drink from" ->
// "something you use when you're thirsty"
// ---------------------------------------------------------------------------

/** L4's "function" axis needs a step more abstract than the crop's own
 * `function` field (which already reads like "drink from" — that's L3's
 * "category" wording). L4 asks WHY you'd reach for it, not WHAT you do
 * with it once you have it — a different, higher level of abstraction,
 * per the guide's own single worked example ("something you use when
 * you're thirsty" for a cup). Covers the ~15 objects in §7.5's table by
 * their plausible categories; anything unrecognised degrades to a
 * generic phrase rather than guessing. */
const NEED_BY_CATEGORY: Record<string, string> = {
  drinkware: "you're thirsty",
  tableware: "you're hungry",
  toy: "you're bored",
  clothing: "you're cold",
  footwear: "you're cold",
  furniture: "you're tired",
  textile: "you're cold",
  container: "you need to tidy up",
  stationery: 'you want to draw',
};

function needPhraseForCategory(category: string): string {
  return NEED_BY_CATEGORY[category.toLowerCase()] ?? 'you need it';
}

/**
 * The target-description slot value for `{fav_colour}`/etc-style
 * templates, per level. Returns the FILLED phrase (not a template string)
 * since the vocabulary needed (colour, function, category-derived need)
 * varies per axis in a way a single slot template can't express — see
 * engine/slots.ts's `renderLine`, which this composes with by treating
 * the return value here as the `{target_description}` slot's value.
 */
export function targetDescriptionForLevel(level: Game1Level, target: TaggedCrop): string {
  switch (level) {
    case 1:
      return `your ${target.colour} ${target.name}`;
    case 2:
      return `something ${target.colour}`;
    case 3:
      return `something you ${target.function}`;
    case 4:
      return `something you use when ${needPhraseForCategory(target.category)}`;
  }
}

// ---------------------------------------------------------------------------
// Grid size (§8.1 axis 2) — 2 crops -> 6 crops, clamped to what the room
// actually offered (a 3-object room can't produce a 6-crop grid, and
// clamping rather than padding with duplicates is the honest choice).
// ---------------------------------------------------------------------------

export function gridSizeForLevel(level: Game1Level): number {
  const bySize: Record<Game1Level, number> = { 1: 2, 2: 4, 3: 5, 4: 6 };
  return bySize[level];
}

// ---------------------------------------------------------------------------
// Distractors (§8.1 axis 3) — unrelated at low levels, sharing a feature
// (same category or same colour) at high levels.
// ---------------------------------------------------------------------------

function sharesFeature(a: TaggedCrop, b: TaggedCrop): boolean {
  return a.category === b.category || a.colour === b.colour;
}

/**
 * Builds the confirmation grid: the target plus distractors chosen per
 * the level's distractor rule, clamped to `gridSizeForLevel(level)` or the
 * whole crop pool, whichever is smaller. Always includes the target
 * exactly once. Order is NOT shuffled here — see applyProfileTuning for
 * why layout order is a profile-tuning concern, not a difficulty one.
 */
export function buildConfirmationGrid(
  crops: TaggedCrop[],
  target: TaggedCrop,
  level: Game1Level,
): TaggedCrop[] {
  const desiredSize = Math.min(gridSizeForLevel(level), crops.length);
  const others = crops.filter((c) => c.id !== target.id);

  const wantsSharedFeature = level >= 3;
  const preferred = others.filter((c) => sharesFeature(c, target) === wantsSharedFeature);
  const fallback = others.filter((c) => sharesFeature(c, target) !== wantsSharedFeature);

  const distractors = [...preferred, ...fallback].slice(0, Math.max(0, desiredSize - 1));
  return [target, ...distractors];
}

/**
 * Shuffles a confirmation grid's ON-SCREEN ORDER. `rng` is injectable
 * (defaults to Math.random) so the shuffle itself is deterministically
 * testable — see scripts/smoke-f012.ts. Callers gate this behind
 * `!tuning.fixedLayout`: calm/sameness profiles must NEVER call this (§8.1:
 * "reward crop in the same position every time"), so buildConfirmationGrid
 * itself stays deterministic and this is a separate, explicit opt-in step.
 */
export function shuffleGrid<T>(grid: T[], rng: () => number = Math.random): T[] {
  const shuffled = [...grid];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ---------------------------------------------------------------------------
// Search scope (§8.1 axis 4) — one area -> whole room -> a different room
// (the generalization re-test). Wording only at this tier — F.012
// explicitly excludes the camera-verify re-test mechanism (Tier 4).
// ---------------------------------------------------------------------------

export function searchScopeLabelForLevel(level: Game1Level): string {
  if (level === 1) return 'right around you';
  if (level === 2) return 'anywhere in this room';
  return 'in a different room this time';
}

// ---------------------------------------------------------------------------
// Profile tuning (§8.1 "Profile tuning") — reads ONLY the four response-
// profile dimensions, never a condition (ARCHITECTURE-RULES.md §5.2).
// ---------------------------------------------------------------------------

export interface ProfileTuning {
  /** calm/sameness/minimal-words: identical phrasing every trial, no
   * idioms — targetDescriptionForLevel already satisfies "no idioms"
   * (it's literal at every level); this flag tells the caller not to
   * layer any playful/varying wrapper phrase on top. */
  literalPhrasingOnly: boolean;
  /** Fixed grid layout: don't shuffle crop order between trials, and
   * always render the target in the same position (first). */
  fixedLayout: boolean;
  /** Lively/short-attention: shorten the spoken prompt. */
  shortenPrompt: boolean;
  /** Lively/short-attention: fold movement into the retrieval prompt
   * itself ("run and find...") rather than a separate instruction. */
  foldMovementIntoRetrieval: boolean;
  /** Lively/short-attention: celebration auto-advances faster. */
  fasterCelebration: boolean;
  /** Lively/short-attention: offer a movement break every N trials
   * (§8.1: "movement break every 3 trials"). null = no proactive
   * break cadence (calm/sameness profiles rely on the existing
   * disengagement-driven breaks in F.009 only, never a scheduled one —
   * §7.7's movement-break cap and cadence stay engine-owned; this is
   * purely "should Game 1 additionally offer one on a fixed schedule").
   */
  movementBreakEveryNTrials: number | null;
}

const DEFAULT_TUNING: ProfileTuning = {
  literalPhrasingOnly: false,
  fixedLayout: false,
  shortenPrompt: false,
  foldMovementIntoRetrieval: false,
  fasterCelebration: false,
  movementBreakEveryNTrials: null,
};

export function applyProfileTuning(profile: ChildProfile): ProfileTuning {
  const { soundMovement, sameness } = profile.responseProfile;
  const tuning = { ...DEFAULT_TUNING };

  if (sameness === 'sameness-helps' || soundMovement === 'calm') {
    tuning.literalPhrasingOnly = true;
    tuning.fixedLayout = true;
  }

  if (soundMovement === 'lively') {
    tuning.shortenPrompt = true;
    tuning.foldMovementIntoRetrieval = true;
    tuning.fasterCelebration = true;
    tuning.movementBreakEveryNTrials = 3;
  }

  return tuning;
}

/** Renders the caregiver/child-facing search prompt for a trial, applying
 * both the difficulty axis (target description, search scope) and profile
 * tuning (shortened / movement-folded phrasing for lively profiles). Pure
 * string composition — the actual slot-fill + avoid-list pass still
 * happens in engine/slots.ts's renderLine, which the caller applies to
 * this function's OUTPUT (this returns the already-composed template,
 * with {companion}/{movement} slots left in for renderLine to fill). */
export function buildSearchPromptTemplate(
  level: Game1Level,
  target: TaggedCrop,
  tuning: ProfileTuning,
): string {
  const description = targetDescriptionForLevel(level, target);
  if (tuning.foldMovementIntoRetrieval) {
    return `Run and find ${description}!`;
  }
  if (tuning.shortenPrompt) {
    return `Find ${description}!`;
  }
  return `{companion} wants ${description}!`;
}
