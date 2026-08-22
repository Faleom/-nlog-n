// Core domain types. Every port and every engine/game file imports from here.
// Do not redefine these shapes elsewhere — that's how two people's code drifts.
//
// See ../../plan/overview/BUILD-ORDER.md § Wave 0 and
// ../../plan/engineering/ARCHITECTURE-RULES.md for why these are frozen early.

// ---------------------------------------------------------------------------
// Region / crops (§8.0 — "the entire content library" every game consumes)
// ---------------------------------------------------------------------------

/** A bounding box in the original (full-resolution) image's pixel space. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One object identified in a room or Companion photo, with its cutout image.
 *
 * `bbox` may be approximate — vision models describe well and localise
 * loosely. Consumers (esp. games rendering a crop as a tappable target) must
 * tolerate padding around the box. See TECH-DECISIONS.md § Object recognition.
 */
export interface TaggedCrop {
  id: string;
  name: string;
  colour: string;
  category: string;
  function: string;
  bbox: Region;
  /** Data URL or object URL for the cropped image. Never the full room photo. */
  image: string;
}

// ---------------------------------------------------------------------------
// Response profile (§5.2) — replaces any "condition" field. There is no
// condition field anywhere in this codebase. If you're tempted to add one,
// re-read app-guide-v3-FINAL.md §5.3 first.
// ---------------------------------------------------------------------------

export type SoundMovementAnswer = 'calm' | 'neutral' | 'lively';
export type AttentionSpanAnswer = 'brief' | 'moderate' | 'sustained';
export type SamenessAnswer = 'sameness-helps' | 'somewhat' | 'variety';
export type CommunicationAnswer =
  | 'not-with-words-yet'
  | 'single-words'
  | 'short-phrases'
  | 'full-sentences';

/** The four response-profile dimensions (§5.2). Each is independently skippable. */
export interface ResponseProfile {
  soundMovement?: SoundMovementAnswer;
  attentionSpan?: AttentionSpanAnswer;
  sameness?: SamenessAnswer;
  communication?: CommunicationAnswer;
}

/**
 * The optional diagnosis declaration (§5.3). Stored separately from
 * ResponseProfile. Tuning logic must NEVER read this — only the four
 * dimensions above. It exists purely to pre-fill ResponseProfile defaults.
 */
export interface OptionalDeclaration {
  declared: boolean;
  /** Free text if the parent wants to say more. Never shown back, never scored. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Child Context Profile (§6) — the differentiator
// ---------------------------------------------------------------------------

export interface Companion {
  /** Stored on device — the one image that persists (§7.4, §14). */
  photo: string;
  name: string;
  pronoun: 'he' | 'she' | 'they' | 'it';
}

export type MotivatingMovement = 'jump' | 'spin' | 'stomp' | 'clap' | 'splash';

/** Layer 2 quick preferences (§6.2), all tap-only, all skippable. */
export interface QuickPreferences {
  favColour?: string;
  favAnimal?: string;
  favFood?: string;
  favPlace?: string;
  favSound?: string;
  movement?: MotivatingMovement;
}

/** Layer 3 — people and routine (§6.2). Tier 2/3. */
export interface PeopleAndRoutine {
  caregiverTerm?: string;
  routineAnchors?: string[];
}

/** Layer 4 — hard-excluded from ALL generated content, engine-level (§6.2). */
export interface AvoidList {
  loudSounds?: boolean;
  fastAnimation?: boolean;
  avoidedColour?: string;
  avoidedTerms?: string[];
  surprises?: boolean;
}

export interface ChildContextProfile {
  companion?: Companion;
  quickPreferences?: QuickPreferences;
  peopleAndRoutine?: PeopleAndRoutine;
  avoidList?: AvoidList;
}

// ---------------------------------------------------------------------------
// Child profile (§1)
// ---------------------------------------------------------------------------

export interface ChildProfile {
  id: string;
  ageMonths: number;
  nickname?: string;
  responseProfile: ResponseProfile;
  declaration?: OptionalDeclaration;
  context: ChildContextProfile;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Support ladder (§7.6) — identical across every game
// ---------------------------------------------------------------------------

/** 1 = full physical, 5 = independent. See engineering config for tier copy. */
export type SupportTier = 1 | 2 | 3 | 4 | 5;

/** F.009's in-trial prompt hierarchy tier (0-3: wait/repeat/highlight/animate).
 * A different axis from SupportTier (1-5, F.010's caregiver ladder) — see
 * engine/activityLogging.ts for how the two relate. */
export type OnScreenPromptTier = 0 | 1 | 2 | 3;

export interface SkillRecord {
  skillId: string;
  context: string;
  /** Caregiver-reported, F.010's five-tier ladder (off-screen physical support). */
  supportTier: SupportTier;
  /** F.009's raw in-trial prompt tier for the confirmation tap. F.011's
   * fading logic reads this specifically (e.g. "reached tier 3") — a
   * collapsed boolean can't tell "needed the maximum on-screen prompting"
   * apart from "just needed one gentle repeat". */
  onScreenTier: OnScreenPromptTier;
  /** Derived convenience — onScreenTier > 0. Kept alongside onScreenTier
   * (not computed on read) so simple consumers don't need the tier detail. */
  prompted: boolean;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Session logging (§7.7, §7.9)
// ---------------------------------------------------------------------------

export interface SessionLog {
  id: string;
  childId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  activitiesRun: number;
  movementBreaks: number;
  longestFocusStretchSeconds: number;
  skillRecords: SkillRecord[];
  endedBy: 'cap' | 'idle' | 'caregiver';
}

// ---------------------------------------------------------------------------
// Branch 2 (§9)
// ---------------------------------------------------------------------------

export interface ConcernAnswers {
  whatNoticed: string;
  whenNoticed: string;
  whatItLooksLike: string;
}

export interface QuestionCard {
  id: string;
  childAgeMonths: number;
  observationText: string;
  createdAt: string;
  /** True only if the card passed the §9.4 guardrail. */
  guardrailPassed: boolean;
}

// ---------------------------------------------------------------------------
// Skill lookup (§7.5) — the rules-based object -> skill -> steps table
// ---------------------------------------------------------------------------

export interface SkillStep {
  /** Slot-templated instruction text, e.g. "Find something {fav_colour}!" */
  promptTemplate: string;
}

export interface SkillTemplate {
  skillId: string;
  targetObjectCategories: string[];
  steps: SkillStep[];
}
