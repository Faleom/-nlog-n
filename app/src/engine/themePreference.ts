// The caregiver's light/dark choice. Device-level, like ACTIVE_PROFILE_KEY
// in profileStore.ts — not scoped to a child profile, since the same
// device's screen brightness/legibility preference has nothing to do with
// which child is currently active. Uses the same StoragePort every other
// caregiver preference already goes through (see profileStore.ts's own
// header comment); no separate persistence mechanism, no localStorage.

import { adapters } from '../adapters/registry';

const THEME_KEY = 'themePreference';

export type ThemeChoice = 'dark' | 'light';

/**
 * Dark is the app's default identity, not a fallback — see App.css's
 * header comment. A missing or corrupt stored value resolves to 'dark',
 * never to reading the OS's prefers-color-scheme.
 */
export async function getThemePreference(): Promise<ThemeChoice> {
  const stored = await adapters.storage.get<ThemeChoice>(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export async function setThemePreference(theme: ThemeChoice): Promise<void> {
  await adapters.storage.set(THEME_KEY, theme);
}
