// Walking skeleton. Proves the wiring holds: real profile store (F.001) ->
// real slot rendering (F.005) -> a game screen. Every real screen replaces
// a piece of this — see plan/overview/BUILD-ORDER.md for the wave each
// file belongs to.
//
// The profile load/create below is a placeholder for F.002 (shared
// onboarding). It exists so F.001 can be verified end-to-end in a real
// browser, not just in the smoke-test script: reload the page and the
// SAME profile loads from IndexedDB instead of a fresh one being created.

import { useEffect, useState } from 'react';
import { Game1 } from './games/Game1';
import { createProfile, getActiveProfile, updateProfile } from './engine/profileStore';
import type { ChildProfile } from './types';
import './App.css';

async function loadOrCreatePlaceholderProfile(): Promise<ChildProfile> {
  const existing = await getActiveProfile();
  if (existing) return existing;

  // TODO(F.002): real onboarding collects age + nickname. This placeholder
  // exists only so F.001's store has something real to persist.
  const created = await createProfile({ ageMonths: 42, nickname: 'Maya' });
  return updateProfile(created.id, {
    context: {
      // TODO(F.004): real Companion capture. Placeholder name/pronoun only —
      // no photo, since a placeholder photo would be dishonest about F.004's
      // no-people gate actually running.
      companion: { photo: '', name: 'Bunbun', pronoun: 'he' },
      quickPreferences: { favColour: 'red' },
    },
  });
}

function App() {
  const [profile, setProfile] = useState<ChildProfile | null>(null);

  useEffect(() => {
    void loadOrCreatePlaceholderProfile().then(setProfile);
  }, []);

  return (
    <div className="app">
      <header>
        <h1>App Guide v3 — walking skeleton</h1>
        <p>
          This is scaffolding, not product. See <code>plan/README.md</code> for
          the real build plan.
        </p>
      </header>
      <main>
        {profile ? (
          <>
            <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
              Profile {profile.id.slice(0, 8)} — reload the page; this should
              stay the same id (F.001 persistence check).
            </p>
            <Game1 profile={profile} />
          </>
        ) : (
          <p>Loading profile…</p>
        )}
      </main>
    </div>
  );
}

export default App;
