// Game 2 — Toy Story Sequencing (§8.2). F.022.
//
// A thin layer on the shared engine, per §12.2 — this file owns only what's
// specific to sequencing: routine anchors, step ordering, the tap-to-place
// state machine, and the printable visual-schedule text. Support tier
// logging, fading, session lifecycle and slot rendering all come from
// Person 1's existing engine (activityLogging.ts, fading.ts,
// sessionLifecycle.ts, slots.ts) — nothing is duplicated here.
//
// No model call at runtime. Templates and slots only (§8.2's own words).

import { renderLine, slotValuesFromProfile } from './slots';
import type { ChildProfile, SamenessAnswer, TaggedCrop } from '../types';

// ---------------------------------------------------------------------------
// Routine anchors (§6.2 Layer 3) — no dedicated capture screen exists yet
// (Layer 3 wasn't part of anyone's assigned files this pass), so this file
// reads whatever is saved and falls back to a sensible default pair rather
// than blocking on a screen that doesn't exist. saveRoutineAnchors() is
// provided so a future onboarding step can set real ones through the same
// path -- additive to the already-frozen PeopleAndRoutine type, no type
// change needed.
// ---------------------------------------------------------------------------

export const ROUTINE_ANCHOR_OPTIONS = [
  'bath time',
  'bedtime',
  'snack',
  'getting dressed',
  'going out',
] as const;

export type RoutineAnchor = (typeof ROUTINE_ANCHOR_OPTIONS)[number];

const DEFAULT_ROUTINE_ANCHORS: RoutineAnchor[] = ['bath time', 'bedtime'];

export function getRoutineAnchors(profile: ChildProfile): RoutineAnchor[] {
  const saved = profile.context.peopleAndRoutine?.routineAnchors;
  if (saved && saved.length > 0) {
    return saved.filter((a): a is RoutineAnchor =>
      (ROUTINE_ANCHOR_OPTIONS as readonly string[]).includes(a),
    );
  }
  return DEFAULT_ROUTINE_ANCHORS;
}

export async function saveRoutineAnchors(
  profileId: string,
  anchors: RoutineAnchor[],
): Promise<void> {
  const { updateProfile } = await import('./profileStore');
  await updateProfile(profileId, { context: { peopleAndRoutine: { routineAnchors: anchors } } });
}

// ---------------------------------------------------------------------------
// Sequence building — a simple, rules-based step template per anchor,
// filled with whatever real crops are available. No semantic object
// matching beyond "does the crop exist" -- consistent with F.007's own
// admittedly simple rules-based lookup, not model improvisation.
// ---------------------------------------------------------------------------

const ANCHOR_STEP_LABELS: Record<RoutineAnchor, string[]> = {
  'bath time': ['gets in the bath', 'washes up', 'gets dried off'],
  bedtime: ['puts on pyjamas', 'brushes teeth', 'gets into bed'],
  snack: ['picks a snack', 'sits down to eat', 'cleans up after'],
  'getting dressed': ['puts on a top', 'puts on bottoms', 'puts on shoes'],
  'going out': ['puts on shoes', 'grabs a bag', 'goes out the door'],
};

export interface SequenceStep {
  crop: TaggedCrop;
  position: number;
  label: string;
}

/**
 * Builds a 2-4 step sequence for the given anchor from whatever crops are
 * actually available this session. Never invents an object that isn't
 * really there -- if fewer crops exist than step labels, the sequence is
 * simply shorter (2 steps minimum per §8.2's difficulty axis; below that,
 * the caller should fall back to a different anchor or generic activities,
 * same pattern as F.006's own no-objects-found fallback).
 */
export function buildSequence(anchor: RoutineAnchor, crops: TaggedCrop[]): SequenceStep[] {
  const labels = ANCHOR_STEP_LABELS[anchor];
  const usableCrops = crops.slice(0, labels.length);
  return usableCrops.map((crop, i) => ({ crop, position: i, label: labels[i] }));
}

/** §7.7 profile tuning applied to Game 2's modelling step: sameness-helps
 * profiles see the sequence modelled twice, identically; everyone else once. */
export function modelPlaybackCount(sameness: SamenessAnswer | undefined): number {
  return sameness === 'sameness-helps' ? 2 : 1;
}

// ---------------------------------------------------------------------------
// The tap-to-place state machine (§8.2's own interaction rule, distinct
// from F.009's find-it grid — sequencing has its own shape: place items in
// order, not pick-one-of-several).
// ---------------------------------------------------------------------------

export type SequencingTapResult =
  | { correct: true; complete: boolean }
  | { correct: false; onlyCorrectRemainsTappable: boolean };

export class SequencingMachine {
  private readonly steps: SequenceStep[];
  private placedCount = 0;
  private wrongAttemptsOnCurrentSlot = 0;

  constructor(steps: SequenceStep[]) {
    if (steps.length < 2) throw new Error('a sequence needs at least 2 steps');
    this.steps = steps;
  }

  get currentSlotIndex(): number {
    return this.placedCount;
  }

  get isComplete(): boolean {
    return this.placedCount === this.steps.length;
  }

  /**
   * Tap-to-place is the default and fully sufficient interaction (§8.2 —
   * drag is never required). Wrong tap: silence, springs back, nothing
   * marked. A SECOND wrong tap on the SAME slot locks the UI to only the
   * correct next crop -- errorless, same shape as F.009's tier-3 rule, but
   * this file owns its own counter rather than reusing InteractionMachine,
   * since sequencing's error model (place-in-order) is a different shape
   * from find-it's (pick-from-grid, escalating prompt hierarchy).
   */
  submitTap(cropId: string): SequencingTapResult {
    if (this.isComplete) throw new Error('sequence already complete');
    const expected = this.steps[this.placedCount];
    if (cropId === expected.crop.id) {
      this.placedCount += 1;
      this.wrongAttemptsOnCurrentSlot = 0;
      return { correct: true, complete: this.isComplete };
    }
    this.wrongAttemptsOnCurrentSlot += 1;
    return {
      correct: false,
      onlyCorrectRemainsTappable: this.wrongAttemptsOnCurrentSlot >= 2,
    };
  }
}

// ---------------------------------------------------------------------------
// Off-screen act-it-out prompt and the printable visual schedule.
// ---------------------------------------------------------------------------

export function actItOutLine(profile: ChildProfile): string {
  return renderLine('Do it with the real {companion}!', slotValuesFromProfile(profile), profile.context);
}

/**
 * The saved strip -- a real clinical artefact (a visual schedule), not
 * just a game outcome (§8.2). Returns plain lines a screen renders and
 * hands to the browser's native print, per TECH-DECISIONS.md's own
 * "Print & export" guidance elsewhere in this app -- no PDF library, no
 * new persistence type invented here.
 */
export function formatVisualSchedule(
  anchor: RoutineAnchor,
  steps: SequenceStep[],
  profile: ChildProfile,
): string[] {
  const values = slotValuesFromProfile(profile);
  const title = renderLine(`{child}'s ${anchor} schedule`, values, profile.context);
  const ordinal = ['First', 'Then', 'Last', 'And then'];
  const lines = steps.map((step, i) => {
    const position = ordinal[i] ?? `Step ${i + 1}`;
    return renderLine(`${position} — {companion} ${step.label}.`, values, profile.context);
  });
  return [title, ...lines];
}
