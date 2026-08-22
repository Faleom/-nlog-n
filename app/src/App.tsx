// Walking skeleton. Proves the wiring holds: adapters -> engine -> a game
// screen, all against fixture data. Every real screen replaces a piece of
// this — see plan/overview/BUILD-ORDER.md for the wave each file belongs to.

import { Game1 } from './games/Game1';
import type { ChildContextProfile } from './types';
import './App.css';

// Placeholder context until F.004 (Companion capture) and F.016 (quick
// preferences) exist. Deliberately empty-ish to prove the "empty profile
// still renders a coherent neutral theme" requirement (§6.6, §16.1).
const placeholderContext: ChildContextProfile = {
  companion: { photo: '', name: 'Bunbun', pronoun: 'he' },
  quickPreferences: { favColour: 'red' },
};

function App() {
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
        <Game1 context={placeholderContext} />
      </main>
    </div>
  );
}

export default App;
