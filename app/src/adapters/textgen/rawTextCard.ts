// The §9.4 mandated fallback adapter. F.015.
//
// "Degrading to the parent's own sentence is always safe; a hallucinated
// symptom never is." This adapter never calls a model and never touches
// the network -- it can't fail the guardrail because it never generates
// anything; it only formats the parent's own literal words. Callers invoke
// this directly (not via the registry) the moment HaikuCard throws
// GuardrailFailedError -- see screens/Branch2Card.tsx.

import { buildRawTextCard } from '../../engine/branch2Card';
import type { TextGenPort } from '../ports';

export function createRawTextCard(): TextGenPort {
  return {
    async generateCard(answers) {
      return buildRawTextCard(answers);
    },
  };
}
