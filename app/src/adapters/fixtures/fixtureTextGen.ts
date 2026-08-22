// Fixture TextGenPort. Deterministic, offline card text — never calls a
// model. Useful for building F.014/F.015's UI before the real HaikuCard
// adapter exists, and structurally identical in shape to RawTextCard (the
// §9.4 guardrail-failure fallback that F.015 must also implement for real).
import type { TextGenPort } from '../ports';

export function createFixtureTextGen(): TextGenPort {
  return {
    async generateCard({ whatNoticed, whenNoticed, whatItLooksLike, childAgeMonths }) {
      return [
        `To ask your health worker: My child is ${childAgeMonths} months old.`,
        `${whatNoticed} I first noticed this at around ${whenNoticed}. ${whatItLooksLike}`,
        '',
        '1. Is this within a typical range for this age?',
        '2. What should I watch for over the next few months?',
        '3. Would a developmental check be worth scheduling?',
      ].join('\n');
    },
  };
}
