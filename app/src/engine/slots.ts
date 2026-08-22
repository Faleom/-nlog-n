// Minimal slot substitution engine (§6.4). F.005 owns this file for real —
// this is a working stub so downstream screens have something to call.
//
// Rule from the guide: lookup-and-substitute, NEVER model generation at
// runtime. Every child-facing string goes through fillSlots.

import type { ChildContextProfile } from '../types';

export interface SlotValues {
  companion?: string;
  companion_they?: string;
  fav_colour?: string;
  fav_animal?: string;
  fav_food?: string;
  fav_place?: string;
  caregiver?: string;
  child?: string;
  movement?: string;
  'object.name'?: string;
}

/** Builds slot values from a child's context profile. Missing values degrade
 * to sensible neutral phrasing — never a visible `{placeholder}`. */
export function slotValuesFromContext(
  context: ChildContextProfile,
  extra: Partial<SlotValues> = {},
): SlotValues {
  return {
    companion: context.companion?.name ?? 'your friend',
    companion_they: context.companion?.pronoun ?? 'they',
    fav_colour: context.quickPreferences?.favColour ?? 'a colour',
    fav_animal: context.quickPreferences?.favAnimal ?? 'an animal',
    fav_food: context.quickPreferences?.favFood ?? 'a snack',
    fav_place: context.quickPreferences?.favPlace ?? 'the room',
    movement: context.quickPreferences?.movement ?? 'jump',
    ...extra,
  };
}

/** Fills `{slot}` placeholders in a template string. Unfilled slots fall
 * back to their bracketed name rather than crashing — F.005's real
 * implementation should tighten this with the avoid-list filter (§6.4,
 * runs LAST, after substitution). */
export function fillSlots(template: string, values: SlotValues): string {
  return template.replace(/\{([a-zA-Z_.]+)\}/g, (match, key: string) => {
    const value = (values as Record<string, string | undefined>)[key];
    return value ?? match;
  });
}
