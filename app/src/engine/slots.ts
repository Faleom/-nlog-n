// The slot system (§6.4). F.005.
//
// Every string the app says is a template with typed blanks, filled from
// the profile. Lookup-and-substitute, NEVER model generation at runtime —
// see plan/features/F.005.md.
//
// The pipeline every child-facing line must go through:
//   template string -> fillSlots() -> avoid-list filter -> renderLine()
// Callers should use renderLine(), not fillSlots() directly, so the
// avoid-list filter is never skippable by accident.

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
    fav_animal: 'an animal',
    fav_food: 'a snack',
    fav_place: 'the room',
    caregiver: context.peopleAndRoutine?.caregiverTerm ?? 'your grown-up',
    child: profile.nickname ?? 'you',
    movement: 'jump',
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
    fav_animal: 'an animal',
    fav_food: 'a snack',
    fav_place: 'the room',
    caregiver: context.peopleAndRoutine?.caregiverTerm ?? 'your grown-up',
    child: 'you',
    movement: 'jump',
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

// ---------------------------------------------------------------------------
// Avoid-list filter hook (§6.4 — "runs last, on the final filled output").
// The filter's real content is F.018's job. This file only owns the hook:
// somewhere to register it, and the guarantee that it's always the last
// step before a line reaches the screen or the speaker.
// ---------------------------------------------------------------------------

export type AvoidFilter = (text: string, context: ChildContextProfile) => string;

const noopAvoidFilter: AvoidFilter = (text) => text;

let activeAvoidFilter: AvoidFilter = noopAvoidFilter;

/** F.018 calls this once, at startup, to wire in the real avoid-list filter. */
export function setAvoidFilter(filter: AvoidFilter): void {
  activeAvoidFilter = filter;
}

/** Test-only escape hatch — do not call from feature code. */
export function resetAvoidFilter(): void {
  activeAvoidFilter = noopAvoidFilter;
}

/**
 * The one function feature code should actually call. Fills slots, then
 * runs the avoid-list filter as the last step, per §6.4. Never call
 * fillSlots() directly for anything that reaches a child.
 */
export function renderLine(
  template: string,
  values: SlotValues,
  context: ChildContextProfile,
): string {
  const filled = fillSlots(template, values);
  return activeAvoidFilter(filled, context);
}
