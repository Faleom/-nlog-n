// The slot system (§6.4). F.005.
//
// Every string the app says is a template with typed blanks, filled from
// the profile. Lookup-and-substitute, NEVER model generation at runtime —
// see plan/features/F.005.md.
//
// The pipeline every child-facing line goes through:
//   template string -> fillSlots() -> renderLine()
// renderLine() is a thin wrapper around fillSlots() -- kept as the call
// site every game uses so filling a template stays one consistent name
// across the codebase, rather than every caller reaching for fillSlots()
// directly.

import type { ChildContextProfile, ChildProfile } from '../types';

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

/**
 * Builds slot values from a full child profile. Every named slot always
 * resolves to something — a neutral default if the real value isn't set —
 * so a template never has to special-case an empty profile.
 */
export function slotValuesFromProfile(
  profile: ChildProfile,
  extra: Partial<SlotValues> = {},
): SlotValues {
  const { context } = profile;
  return {
    companion: context.companion?.name ?? 'your friend',
    companion_they: context.companion?.pronoun ?? 'they',
    fav_colour: context.quickPreferences?.favColour ?? 'a colour',
    fav_animal: context.quickPreferences?.favAnimal ?? 'an animal',
    fav_food: context.quickPreferences?.favFood ?? 'a snack',
    fav_place: context.quickPreferences?.favPlace ?? 'the room',
    caregiver: context.peopleAndRoutine?.caregiverTerm ?? 'your grown-up',
    child: profile.nickname ?? 'you',
    movement: context.quickPreferences?.movement ?? 'jump',
    ...extra,
  };
}

/** Same as slotValuesFromProfile, for callers that only have the context
 * layer (no full ChildProfile) — e.g. the Companion-capture screen before
 * a profile exists. `{child}` falls back to its neutral default. */
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
    caregiver: context.peopleAndRoutine?.caregiverTerm ?? 'your grown-up',
    child: 'you',
    movement: context.quickPreferences?.movement ?? 'jump',
    ...extra,
  };
}

/**
 * Fills `{slot}` placeholders in a template string. A slot with no value —
 * genuinely missing, not just defaulted — degrades to nothing rather than
 * leaking a raw `{fav_colour}` to the child. Collapses the resulting
 * whitespace so a dropped slot doesn't leave a double space or a stray
 * leading/trailing gap.
 */
export function fillSlots(template: string, values: SlotValues): string {
  const filled = template.replace(/\{([a-zA-Z_.]+)\}/g, (_match, key: string) => {
    const value = (values as Record<string, string | undefined>)[key];
    return value ?? '';
  });
  return filled.replace(/\s+/g, ' ').trim();
}

/**
 * The one function feature code should actually call. A thin wrapper
 * around fillSlots() -- kept so every child-facing line renders through
 * one consistent name, rather than every game reaching for fillSlots()
 * directly.
 */
export function renderLine(template: string, values: SlotValues): string {
  return fillSlots(template, values);
}
