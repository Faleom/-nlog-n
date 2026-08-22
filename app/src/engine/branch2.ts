// F.014 — Branch 2: milestone narrative + guided prompts (§9.1-9.3).
//
// Pure content + pure logic, no React, so it can be smoke-tested directly
// (see scripts/smoke-f014.ts) the same way F.011/F.013's engine modules are.
// src/screens/Branch2Milestones.tsx is the thin React layer on top.
//
// Everything here obeys §9.2's central argument: a weekend build has no
// business showing a parent anything that resembles a screening result. So:
//   - the milestone content is NARRATIVE, never a checklist item that could
//     be counted or scored (F.014.md "done when")
//   - the open question has exactly two outcomes: "no" ends the flow with
//     NOTHING recorded, "yes" opens exactly THREE FIXED prompts
//   - the three prompts never change, never branch on prior answers, and
//     are never free text (§9.3 -- structured input, lower abandonment,
//     lower hallucination risk downstream in F.015)
//   - the Companion is never referenced anywhere in this file (§10: "a
//     cheerful toy voice next to a worry is tonally wrong")

import type { ConcernAnswers } from '../types';

// ---------------------------------------------------------------------------
// Milestone narrative (§9.3 step 1) -- prose, matched to age in months.
// Deliberately NOT a checklist: no bullet items, no yes/no per-line, nothing
// that sums to a score. Tone carries no risk framing -- no "warning signs",
// "red flags", "delayed", no comparison to a norm the child could "fail"
// (F.014.md done-when list).
// ---------------------------------------------------------------------------

export type MilestoneAgeBand = '36-47' | '48-59' | '60+';

export function getMilestoneAgeBand(ageMonths: number): MilestoneAgeBand {
  if (ageMonths >= 60) return '60+';
  if (ageMonths >= 48) return '48-59';
  return '36-47';
}

const MILESTONE_NARRATIVE: Record<MilestoneAgeBand, string> = {
  '36-47':
    'Around three, children vary hugely in how they get their message across -- ' +
    'some are putting short phrases together, some are pointing and using single ' +
    'words, and some are still mostly finding their own way to communicate. Play ' +
    'often starts to include simple pretend scenes, like feeding a toy or pushing ' +
    'a car and making a sound for it. Many children this age can follow one clear, ' +
    'simple instruction from someone they know well. Every child finds their own ' +
    'path here, and there is a wide range of what that looks like at this age.',
  '48-59':
    'Around four, many children are stringing several words together and asking ' +
    'their own questions. Pretend play often gets more elaborate -- taking on a ' +
    'role, giving a toy a voice, inviting someone else into the game. Following a ' +
    'two-part instruction, taking turns in a simple game, and noticing when ' +
    'someone else is upset are all common around this age, though children reach ' +
    'these in their own time and their own way.',
  '60+':
    'Around five, communication is often becoming more back-and-forth -- telling a ' +
    'short story, answering questions about something that already happened, ' +
    'joining a group game with other children. Many children this age can sit ' +
    'through a short shared activity and manage a change in plan with some ' +
    'support. As always, the pace and shape of getting there varies a lot from ' +
    'child to child.',
};

/** Prose only -- see the module doc comment for why. Matched to age in
 * months, not to any specific skill or condition. */
export function getMilestoneNarrative(ageMonths: number): string {
  return MILESTONE_NARRATIVE[getMilestoneAgeBand(ageMonths)];
}

// ---------------------------------------------------------------------------
// The open question (§9.3 step 2) -- identical every time, for every child,
// regardless of activity history (that guarantee belongs to F.020, but the
// text itself lives here since it's Branch 2 content).
// ---------------------------------------------------------------------------

export const OPEN_QUESTION = "Is there anything here that's been on your mind?";

// ---------------------------------------------------------------------------
// The three fixed guided prompts (§9.3 step 5). Order matters -- this is
// the ONLY order they are ever shown in. Never branches, never reorders,
// never adds/removes a prompt based on a prior answer.
// ---------------------------------------------------------------------------

export interface GuidedPrompt {
  key: keyof ConcernAnswers;
  label: string;
}

export const GUIDED_PROMPTS: readonly GuidedPrompt[] = [
  { key: 'whatNoticed', label: 'What did you notice?' },
  { key: 'whenNoticed', label: 'How old were they when you first noticed?' },
  { key: 'whatItLooksLike', label: 'What does it look like when it happens?' },
];

/** True only when all three guided prompts have a real, non-blank answer. */
export function isConcernAnswersComplete(
  answers: Partial<ConcernAnswers>,
): answers is ConcernAnswers {
  return GUIDED_PROMPTS.every((p) => (answers[p.key] ?? '').trim().length > 0);
}

// ---------------------------------------------------------------------------
// Flow result -- what Branch2Milestones.tsx hands to whoever wires
// navigation (§14 in PERSON-3's brief: "someone will wire the real
// navigation centrally later"). "no" carries no data at all, by
// construction -- there is nothing to record (§9.3 step 3).
// ---------------------------------------------------------------------------

export type Branch2FlowResult =
  | { hasConcern: false }
  | { hasConcern: true; answers: ConcernAnswers; childAgeMonths: number };
