// Central routing. Wires together every screen and game built tonight
// into one flow, per app-guide-v3-FINAL.md §2-§10.
//
// The shape, in order:
//   Onboarding (age + nickname + two equal doors)
//     -> Branch 1 ("my-world"): a ONE-TIME chain through response profile
//        -> Companion capture -> quick preferences -> avoid list, then
//        Branch 1 home (both games, dashboard, switch-branch always
//        available)
//     -> Branch 2 ("worry-to-question"): milestones -> (no concern: back
//        to the two doors, nothing recorded) or (concern: the question
//        card -> immediately offered a Branch 1 activity, per §9.3 step 9)
//
// A RETURNING profile (loaded from storage on mount) skips straight to
// Branch 1 home -- the four Branch-1 onboarding screens only chain forward
// automatically the moment Onboarding.onComplete fires. Each Screen variant
// for those four carries its own `returnToHome: boolean`: false while
// still inside that first forward chain (advance to the next screen),
// true when reached later from Branch 1 home's "Edit: ..." buttons (go
// straight back to home instead). Same components either way, just a
// different next-step wired at the call site -- nothing persisted.
//
// §2's core rule -- "a parent can switch branches at any time, with no
// conditions attached" -- is why every Branch 1 screen carries a
// "Branch 2" affordance and Branch 2's own screens carry one back, with no
// confirmation dialog anywhere in either direction.

import { useEffect, useState } from 'react';
import { Onboarding } from './screens/Onboarding';
import { ResponseProfileScreen } from './screens/ResponseProfile';
import { CompanionCapture } from './screens/CompanionCapture';
import { QuickPreferencesScreen } from './screens/QuickPreferences';
import { AvoidListScreen } from './screens/AvoidList';
import { CaregiverDashboard } from './screens/CaregiverDashboard';
import { Branch2Milestones } from './screens/Branch2Milestones';
import { Branch2Card } from './screens/Branch2Card';
import { NeutralNotePrompt } from './components/NeutralNotePrompt';
import { Game1 } from './games/Game1';
import { Game2 } from './games/Game2';
import { Game3ShadowMatch } from './games/Game3ShadowMatch';
import { getActiveProfile } from './engine/profileStore';
import { installAvoidFilter } from './engine/avoidFilter';
import type { Branch2FlowResult } from './engine/branch2';
import type { ChildProfile } from './types';
import type { ConcernAnswers } from './types';
import './App.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'responseProfile'; returnToHome: boolean }
  | { kind: 'companionCapture'; returnToHome: boolean }
  | { kind: 'quickPreferences'; returnToHome: boolean }
  | { kind: 'avoidList'; returnToHome: boolean }
  | { kind: 'branch1Home' }
  | { kind: 'game1' }
  | { kind: 'game2' }
  | { kind: 'game3' }
  | { kind: 'dashboard' }
  | { kind: 'branch2Milestones' }
  | { kind: 'branch2Card'; answers: ConcernAnswers; childAgeMonths: number }
  | { kind: 'branch2Ended' };

function App() {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    // §6.4: the avoid-list filter is wired once, globally -- it reads
    // whichever profile's context is passed to renderLine() at call time,
    // so this does not need to be re-run per profile switch.
    installAvoidFilter();

    void getActiveProfile().then((existing) => {
      if (existing) {
        setProfile(existing);
        setScreen({ kind: 'branch1Home' });
      } else {
        setScreen({ kind: 'onboarding' });
      }
    });
  }, []);

  function updateProfile(next: ChildProfile) {
    setProfile(next);
  }

  function goToBranch2(): void {
    setScreen({ kind: 'branch2Milestones' });
  }

  function goToBranch1Home(): void {
    setScreen({ kind: 'branch1Home' });
  }

  if (screen.kind === 'loading') {
    return (
      <div className="app">
        <p>Loading…</p>
      </div>
    );
  }

  if (screen.kind === 'onboarding') {
    return (
      <div className="app">
        <Onboarding
          onComplete={(newProfile, branch) => {
            setProfile(newProfile);
            if (branch === 'worry-to-question') {
              setScreen({ kind: 'branch2Milestones' });
            } else {
              setScreen({ kind: 'responseProfile', returnToHome: false });
            }
          }}
        />
      </div>
    );
  }

  // Everything below needs a profile. Onboarding is the only screen that
  // creates one, so by construction every other branch has it -- but the
  // type system doesn't know that, and a null-check here is honest rather
  // than a non-null assertion.
  if (!profile) {
    return (
      <div className="app">
        <p>Something went wrong loading the profile. Reload the page.</p>
      </div>
    );
  }

  if (screen.kind === 'responseProfile') {
    return (
      <div className="app">
        <ResponseProfileScreen
          profile={profile}
          onComplete={(next) => {
            updateProfile(next);
            setScreen(
              screen.returnToHome
                ? { kind: 'branch1Home' }
                : { kind: 'companionCapture', returnToHome: false },
            );
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'companionCapture') {
    const next = screen.returnToHome
      ? { kind: 'branch1Home' as const }
      : { kind: 'quickPreferences' as const, returnToHome: false };
    return (
      <div className="app">
        <CompanionCapture
          profile={profile}
          onComplete={(updated) => {
            updateProfile(updated);
            setScreen(next);
          }}
          onSkip={() => setScreen(next)}
        />
      </div>
    );
  }

  if (screen.kind === 'quickPreferences') {
    return (
      <div className="app">
        <QuickPreferencesScreen
          profile={profile}
          onComplete={(updated) => {
            updateProfile(updated);
            setScreen(
              screen.returnToHome
                ? { kind: 'branch1Home' }
                : { kind: 'avoidList', returnToHome: false },
            );
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'avoidList') {
    return (
      <div className="app">
        <AvoidListScreen
          profile={profile}
          onComplete={(updated) => {
            updateProfile(updated);
            setScreen({ kind: 'branch1Home' });
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'game1') {
    return (
      <div className="app">
        <button onClick={goToBranch1Home}>← Back</button>
        <Game1 profile={profile} />
      </div>
    );
  }

  if (screen.kind === 'game2') {
    return (
      <div className="app">
        <button onClick={goToBranch1Home}>← Back</button>
        <Game2 profile={profile} />
      </div>
    );
  }

  if (screen.kind === 'game3') {
    return (
      <div className="app">
        <button onClick={goToBranch1Home}>← Back</button>
        <Game3ShadowMatch profile={profile} />
      </div>
    );
  }

  if (screen.kind === 'dashboard') {
    return (
      <div className="app">
        <button onClick={goToBranch1Home}>← Back</button>
        <CaregiverDashboard profile={profile} />
      </div>
    );
  }

  if (screen.kind === 'branch2Milestones') {
    return (
      <div className="app">
        <button onClick={goToBranch1Home}>← Back to activities</button>
        <Branch2Milestones
          childAgeMonths={profile.ageMonths}
          onDone={(result: Branch2FlowResult) => {
            if (!result.hasConcern) {
              // §9.3 step 3: the flow simply ends. No score, no result,
              // nothing recorded. Back to daily use, not stranded.
              setScreen({ kind: 'branch1Home' });
              return;
            }
            setScreen({
              kind: 'branch2Card',
              answers: result.answers,
              childAgeMonths: result.childAgeMonths,
            });
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'branch2Card') {
    return (
      <div className="app">
        <Branch2Card
          answers={screen.answers}
          childAgeMonths={screen.childAgeMonths}
          onOfferActivity={() => {
            // §9.3 step 9: immediately after the card, offer a Branch 1
            // activity -- never leave a parent newly aware of a concern
            // with nothing to do. Branch 1 home puts every activity one
            // tap away rather than forcing a specific game on them.
            setScreen({ kind: 'branch1Home' });
          }}
        />
      </div>
    );
  }

  // branch1Home
  return (
    <div className="app">
      <header>
        <h1>{profile.nickname ?? 'Your child'}'s activities</h1>
      </header>
      <main>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => setScreen({ kind: 'game1' })}>
            Play — Find It In Your World
          </button>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => setScreen({ kind: 'game2' })}>
            Play — Toy Story Sequencing
          </button>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => setScreen({ kind: 'game3' })}>
            Play — Shadow Match
          </button>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => setScreen({ kind: 'dashboard' })}>
            Caregiver dashboard
          </button>

          <hr />

          <button
            style={{ minWidth: 88, minHeight: 88 }}
            onClick={() => setScreen({ kind: 'responseProfile', returnToHome: true })}
          >
            Edit: how {profile.nickname ?? 'they'} do best
          </button>
          <button
            style={{ minWidth: 88, minHeight: 88 }}
            onClick={() => setScreen({ kind: 'companionCapture', returnToHome: true })}
          >
            Edit: Companion
          </button>
          <button
            style={{ minWidth: 88, minHeight: 88 }}
            onClick={() => setScreen({ kind: 'quickPreferences', returnToHome: true })}
          >
            Edit: favourites
          </button>
          <button
            style={{ minWidth: 88, minHeight: 88 }}
            onClick={() => setScreen({ kind: 'avoidList', returnToHome: true })}
          >
            Edit: things to avoid
          </button>

          <hr />

          {/* §2's core rule: switching branches is unconditional, no
              confirmation, available from anywhere in Branch 1. */}
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={goToBranch2}>
            I've been thinking about my child's development
          </button>

          {/* F.020: the same neutral prompt, identical regardless of
              activity history -- available here, not tied to any specific
              activity's outcome. */}
          {!noteSaved && (
            <NeutralNotePrompt
              onSaveNote={() => setNoteSaved(true)}
              onDismiss={() => setNoteSaved(true)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
