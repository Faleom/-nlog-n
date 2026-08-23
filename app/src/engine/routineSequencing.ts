// Game 2 — Toy Story Sequencing (§8.2, redesigned by F.022's generative
// story pass — see CLAUDE_CODE_PROMPT_GAME2_REDESIGN.md). This file used to
// own a small hand-written library of fixed routine "anchors" (bath time,
// bedtime, ...) that a live model call has since replaced — see
// engine/game2Story.ts (the new story-generation contract and
// orchestration) and adapters/story/*.ts (the real generator + its
// deterministic fallback). That anchor system also happened to paper over
// a real gap: there was never actually a screen for a caregiver to set
// real routine anchors, so it silently used a hardcoded default pair every
// time. The object-driven design sidesteps that gap entirely rather than
// fixing it, since the story is now built from whatever objects were
// actually detected, not from a caregiver-picked anchor.
//
// What's left here, unchanged: the tap-to-place interaction state machine
// (reused as-is for the new fill-in-the-blank interaction — a different
// display shape, same underlying "place items in order" mechanics) and the
// sameness-helps playback-count rule. `formatVisualSchedule` is adapted to
// a simpler signature that no longer knows about anchors or SequenceStep,
// since the caller now renders each generated step's sentence itself (via
// engine/game2Story.ts's renderStorySentence) before handing the already-
// rendered lines here.

import { renderLine, slotValuesFromProfile } from './slots';
import type { ChildProfile, SamenessAnswer, TaggedCrop } from '../types';

/** One placed step in the tap-to-place interaction: a real detected-object
 * crop, its correct position in the sequence, and a short label describing
 * what happens at that step (used for the printable schedule / any on-screen
 * caption the caller wants). Callers now build this list themselves from a
 * generated story's steps + the matching TaggedCrop for each `objectRef`
 * (see engine/game2Story.ts's resolveStoryStepObject), rather than from the
 * old buildSequence()/anchor system this file used to own. */
export interface SequenceStep {
  crop: TaggedCrop;
  position: number;
  label: string;
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
 * The saved strip -- a real clinical artefact (a visual schedule), not just
 * a game outcome (§8.2). Returns plain lines a screen renders and hands to
 * the browser's native print, per TECH-DECISIONS.md's own "Print & export"
 * guidance elsewhere in this app -- no PDF library, no new persistence type
 * invented here.
 *
 * `title` still carries unfilled slot tokens (e.g. "{child}'s bedtime
 * schedule") and is rendered here via the same renderLine/slotValuesFromProfile
 * pattern this file always used. `renderedLines` are ALREADY fully rendered
 * step sentences (the caller renders each StoryStepTemplate via
 * engine/game2Story.ts's renderStorySentence first) — this function just
 * prepends the rendered title and returns the combined array.
 */
export function formatVisualSchedule(
  profile: ChildProfile,
  title: string,
  renderedLines: string[],
): string[] {
  const values = slotValuesFromProfile(profile);
  const renderedTitle = renderLine(title, values, profile.context);
  return [renderedTitle, ...renderedLines];
}
