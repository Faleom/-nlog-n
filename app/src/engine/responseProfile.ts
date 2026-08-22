// F.003 — Response profile: four questions + declaration pre-fill.
// See app-guide-v3-FINAL.md §5.2, §5.3.
//
// There is no condition field here, and there never will be — only the
// four named ResponseProfile dimensions the engine actually tunes on.
// The optional declaration is stored separately (OptionalDeclaration) and
// this module never lets it drive tuning: applyDeclarationPrefill only
// ever fills GAPS in the four already-typed dimensions, once, as a
// convenience, and every value stays visible and changeable afterward
// (§5.3, §5.4). No other engine file should read `.declaration` at all —
// see scripts/smoke-f003.ts's static check.

import { updateProfile } from './profileStore';
import type { ChildProfile, OptionalDeclaration, ResponseProfile } from '../types';

/**
 * The single, fixed pre-fill bundle named as the demo config in §0 —
 * "Autism-leaning defaults (calm, sameness, minimal words)". Declaring a
 * diagnosis does not select AMONG different bundles keyed by what was
 * declared — that would just be a condition field wearing a UI disguise.
 * It always offers this one starting point, for whichever of the four
 * dimensions the parent hasn't already answered.
 */
export const DECLARATION_PREFILL_DEFAULTS: Pick<
  ResponseProfile,
  'soundMovement' | 'sameness' | 'communication'
> = {
  soundMovement: 'calm',
  sameness: 'sameness-helps',
  communication: 'not-with-words-yet',
};

/**
 * Fills in only the dimensions not already answered — never overwrites an
 * answer the parent already gave. `attentionSpan` is deliberately left
 * alone: §0's demo config names three of the four dimensions, not all
 * four, so there is no fixed default for it here.
 */
export function applyDeclarationPrefill(existing: ResponseProfile): ResponseProfile {
  return {
    ...existing,
    soundMovement: existing.soundMovement ?? DECLARATION_PREFILL_DEFAULTS.soundMovement,
    sameness: existing.sameness ?? DECLARATION_PREFILL_DEFAULTS.sameness,
    communication: existing.communication ?? DECLARATION_PREFILL_DEFAULTS.communication,
  };
}

/**
 * Persists the four dimensions and (optionally) the declaration, via
 * F.001's real merge-aware updateProfile. The declaration is written
 * as-is — this function does not interpret it either.
 */
export async function saveResponseProfile(
  profileId: string,
  responseProfile: ResponseProfile,
  declaration: OptionalDeclaration | undefined,
): Promise<ChildProfile> {
  return updateProfile(profileId, { responseProfile, declaration });
}
