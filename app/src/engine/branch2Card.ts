// F.015 — Branch 2 card: template assembly + the model prompt (§9.4, §9.5).
//
// No vendor SDK import here (this file is NOT in src/adapters/**, so
// oxlint's no-restricted-imports rule forbids it anyway) -- it only builds
// strings. The actual network call lives in api/claude.ts (server-side,
// holds the key) and src/adapters/textgen/haikuCard.ts (client-side, calls
// the proxy). Both of those import buildObservationSystemPrompt /
// buildObservationUserPrompt from here, so the prompt sent for real and the
// prompt exercised in scripts/verify-f015-live.ts are the exact same text
// -- never two copies that could quietly drift apart.
//
// KEY DESIGN CHOICE: the model generates ONLY the observation sentence(s).
// The header ("My child is N months old") and the three fixed questions are
// NEVER model output -- they're assembled here as constants. That shrinks
// the guardrail's job to exactly the surface that can actually hallucinate,
// and it's why the "three fixed questions, identical every time" part of
// §9.4 is true by construction, not just by convention.

import type { ConcernAnswers } from '../types';

/** §9.4's three fixed questions, verbatim, in order. Never model-generated. */
export const FIXED_QUESTIONS: readonly string[] = [
  'Is this within a typical range for this age?',
  'What should I watch for over the next few months?',
  'Would a developmental check be worth scheduling?',
];

export interface CardAnswers extends ConcernAnswers {
  childAgeMonths: number;
}

/**
 * The system prompt for the observation rewrite. Belt-and-suspenders with
 * the guardrail (§9.4: "enforced by a post-generation check, not prompt
 * wording") -- this cannot be the only defense, but a clear instruction
 * still reduces how often the guardrail needs to catch something.
 */
export function buildObservationSystemPrompt(): string {
  return [
    "You rewrite a parent's own words about their child's development into one",
    'short, clear, neutral paragraph, for a health worker.',
    '',
    'STRICT RULES:',
    '- Only rephrase what the parent literally said. Never add, infer, extend,',
    '  or "complete" anything they did not say.',
    '- Never name or imply any medical, developmental, or psychological condition.',
    '- Never use these words: delayed, disorder, risk, concerning, abnormal,',
    '  symptom, likely, probably, suggests.',
    '- Never state a severity, probability, or percentage of any kind.',
    '- Never recommend anything. Do not tell the parent what to do next --',
    '  that is handled elsewhere.',
    '- Output ONLY the rewritten paragraph. No greeting, no heading, no',
    '  questions, no bullet points, no extra commentary, no quotation marks.',
  ].join('\n');
}

export function buildObservationUserPrompt(answers: ConcernAnswers & { childAgeMonths: number }): string {
  return [
    "Parent's own words:",
    `- What they noticed: "${answers.whatNoticed}"`,
    `- When they first noticed it: "${answers.whenNoticed}"`,
    `- What it looks like when it happens: "${answers.whatItLooksLike}"`,
    '',
    `Child's age: ${answers.childAgeMonths} months.`,
    '',
    'Rewrite this into one short, clear, neutral paragraph, following the strict rules exactly.',
  ].join('\n');
}

/**
 * Assembles the final card from a childAgeMonths + a guardrail-checked
 * observation paragraph. This is the ONLY place the fixed template is
 * assembled, so both the real (Haiku) and raw-fallback paths (which pass
 * different `observation` text through the same function) produce
 * byte-identical structure -- see §9.5's worked example for the shape.
 */
export function assembleCard(childAgeMonths: number, observation: string): string {
  const header = `To ask your health worker: My child is ${childAgeMonths} months old. ${observation.trim()}`;
  const questions = FIXED_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return `${header}\n\n${questions}`;
}

/**
 * The §9.4 mandated fallback: the parent's own raw words, never touched by
 * a model, so there is nothing here that can hallucinate. Still includes
 * the three fixed questions -- they're a hardcoded constant, not generated
 * text, so they carry no guardrail risk either way.
 */
export function buildRawTextCard(answers: ConcernAnswers & { childAgeMonths: number }): string {
  const lines = [
    `To ask your health worker: My child is ${answers.childAgeMonths} months old.`,
    '',
    `What I noticed: ${answers.whatNoticed}`,
    `When I first noticed it: ${answers.whenNoticed}`,
    `What it looks like: ${answers.whatItLooksLike}`,
    '',
    ...FIXED_QUESTIONS.map((q, i) => `${i + 1}. ${q}`),
  ];
  return lines.join('\n');
}
