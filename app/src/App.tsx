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

import { useEffect, useState, type ReactNode } from 'react';
import { AppHeader } from './components/AppHeader';
import { ScreenHeader } from './components/ScreenHeader';
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
import { Game3Play } from './games/Game3Play';
import { Game3Roadmap } from './screens/Game3Roadmap';
import { BlockStackMatch } from './games/BlockStackMatch';
import { SortByRule } from './games/SortByRule';
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
  | { kind: 'game3Roadmap' }
  | { kind: 'game3Play'; lessonId: string }
  | { kind: 'blockStack' }
  | { kind: 'sortByRule' }
  | { kind: 'dashboard' }
  | { kind: 'branch2Milestones' }
  | { kind: 'branch2Card'; answers: ConcernAnswers; childAgeMonths: number }
  | { kind: 'branch2Ended' };

// The two flow names shown in every screen-header eyebrow -- this, plus
// the back button and (during first-time setup) the step count, is the
// whole answer to "where am I / where am I headed."
const SETUP_FLOW = 'Setting up your child’s profile';
const MY_WORLD_FLOW = 'My World';
const WORRY_FLOW = 'Thinking about development';
// The Logic & Quantity track (F.027, F.028). Its rounds are abstract shapes
// and blocks rather than the child's own room, so it gets its own flow name
// instead of sitting under "My World" and contradicting it.
const LOGIC_FLOW = 'Looking and Sorting';

// Wraps a game so its own child-facing state lives right next to the
// header it controls, instead of a piece of App-level state that would
// need an effect to reset between screens. Since the caller always
// renders this under a div keyed on screen.kind, it remounts -- and its
// useState(false) starts fresh -- on every navigation, for free.
function GameChrome({
  eyebrow,
  onBack,
  children,
}: {
  eyebrow: string;
  onBack: () => void;
  children: (onChildFacingChange: (isChildFacing: boolean) => void) => ReactNode;
}) {
  const [childFacing, setChildFacing] = useState(false);
  return (
    <>
      {/* §8.0/UI-STANDARDS "zero text in the child's view": this chrome
          must not render at all while the phone is in the child's hands,
          not just fade or sit behind something. AppHeader is wired into
          the exact same condition as ScreenHeader, not a second parallel
          visibility system. */}
      {!childFacing && (
        <>
          <AppHeader />
          <ScreenHeader eyebrow={eyebrow} onBack={onBack} backLabel="Activities" />
        </>
      )}
      {children(setChildFacing)}
    </>
  );
}

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
        <AppHeader />
        <p>Loading…</p>
      </div>
    );
  }

  if (screen.kind === 'onboarding') {
    return (
      <div className="app">
        <AppHeader />
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
        <AppHeader />
        <p>Something went wrong loading the profile. Reload the page.</p>
      </div>
    );
  }

  if (screen.kind === 'responseProfile') {
    return (
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader
          eyebrow={screen.returnToHome ? MY_WORLD_FLOW : SETUP_FLOW}
          step={screen.returnToHome ? undefined : { current: 1, total: 4 }}
          onBack={screen.returnToHome ? goToBranch1Home : undefined}
          backLabel="Activities"
        />
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
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader
          eyebrow={screen.returnToHome ? MY_WORLD_FLOW : SETUP_FLOW}
          step={screen.returnToHome ? undefined : { current: 2, total: 4 }}
          onBack={screen.returnToHome ? goToBranch1Home : undefined}
          backLabel="Activities"
        />
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
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader
          eyebrow={screen.returnToHome ? MY_WORLD_FLOW : SETUP_FLOW}
          step={screen.returnToHome ? undefined : { current: 3, total: 4 }}
          onBack={screen.returnToHome ? goToBranch1Home : undefined}
          backLabel="Activities"
        />
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
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader
          eyebrow={screen.returnToHome ? MY_WORLD_FLOW : SETUP_FLOW}
          step={screen.returnToHome ? undefined : { current: 4, total: 4 }}
          onBack={screen.returnToHome ? goToBranch1Home : undefined}
          backLabel="Activities"
        />
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
      <div className="app" key={screen.kind}>
        <GameChrome eyebrow={`${MY_WORLD_FLOW} · Find It In Your World`} onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <Game1 profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'game2') {
    return (
      <div className="app" key={screen.kind}>
        <GameChrome eyebrow={`${MY_WORLD_FLOW} · Toy Story Sequencing`} onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <Game2 profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'blockStack') {
    return (
      <div className="app" key={screen.kind}>
        <GameChrome eyebrow={`${LOGIC_FLOW} \u00b7 Block-stack match`} onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <BlockStackMatch profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'sortByRule') {
    return (
      <div className="app" key={screen.kind}>
        <GameChrome eyebrow={`${LOGIC_FLOW} \u00b7 Sort by rule`} onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <SortByRule profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'game3Roadmap') {
    return (
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader eyebrow={`${MY_WORLD_FLOW} · Match & Draw`} onBack={goToBranch1Home} backLabel="Activities" />
        <Game3Roadmap
          profile={profile}
          onPlayLesson={(lessonId) => setScreen({ kind: 'game3Play', lessonId })}
        />
      </div>
    );
  }

  if (screen.kind === 'game3Play') {
    return (
      <div className="app" key={screen.kind}>
        <GameChrome
          eyebrow={`${MY_WORLD_FLOW} · Match & Draw`}
          onBack={() => setScreen({ kind: 'game3Roadmap' })}
        >
          {(onChildFacingChange) => (
            <Game3Play
              profile={profile}
              lessonId={screen.lessonId}
              onExit={() => setScreen({ kind: 'game3Roadmap' })}
              onChildFacingChange={onChildFacingChange}
            />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'dashboard') {
    return (
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader eyebrow={`${MY_WORLD_FLOW} · Caregiver dashboard`} onBack={goToBranch1Home} backLabel="Activities" />
        <CaregiverDashboard profile={profile} />
      </div>
    );
  }

  if (screen.kind === 'branch2Milestones') {
    return (
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader eyebrow={WORRY_FLOW} onBack={goToBranch1Home} backLabel="Activities" />
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
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader eyebrow={`${WORRY_FLOW} · Your question`} />
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
    <div className="app" key={screen.kind}>
      <AppHeader />
      <ScreenHeader eyebrow={`${MY_WORLD_FLOW} · Home`} />
      <header className="home-greeting">
        <h1>{profile.nickname ?? 'Your child'}'s activities</h1>
        <p>Everything built from your child's own room and toys.</p>
      </header>
      <main>
        <div className="screen">
          <div className="home-section">
            <p className="home-section-label">Play</p>
            <div className="home-play-grid">
              <button
                className="button-primary home-play-button"
                onClick={() => setScreen({ kind: 'game1' })}
              >
                <span className="home-play-icon" aria-hidden="true">
                  🔍
                </span>
                Find It In Your World
              </button>
              <button
                className="button-primary home-play-button"
                onClick={() => setScreen({ kind: 'game2' })}
              >
                <span className="home-play-icon" aria-hidden="true">
                  🧸
                </span>
                Toy Story Sequencing
              </button>
              <button
                className="button-primary home-play-button"
                onClick={() => setScreen({ kind: 'game3Roadmap' })}
              >
                <span className="home-play-icon" aria-hidden="true">
                  🌓
                </span>
                Match &amp; Draw
              </button>
              <button
                className="button-primary home-play-button"
                onClick={() => setScreen({ kind: 'blockStack' })}
              >
                <span className="home-play-icon" aria-hidden="true">
                  🧱
                </span>
                Block-stack match
              </button>
              <button
                className="button-primary home-play-button"
                onClick={() => setScreen({ kind: 'sortByRule' })}
              >
                <span className="home-play-icon" aria-hidden="true">
                  🧺
                </span>
                Sort by rule
              </button>
            </div>
          </div>

          <button className="home-play-button" onClick={() => setScreen({ kind: 'dashboard' })}>
            <span className="home-play-icon" aria-hidden="true">
              📋
            </span>
            Caregiver dashboard
          </button>

          <div className="home-section">
            <p className="home-section-label">Set up</p>
            <div className="home-edit-grid">
              <button
                className="home-edit-button"
                onClick={() => setScreen({ kind: 'responseProfile', returnToHome: true })}
              >
                How {profile.nickname ?? 'they'} do best
              </button>
              <button
                className="home-edit-button"
                onClick={() => setScreen({ kind: 'companionCapture', returnToHome: true })}
              >
                Companion
              </button>
              <button
                className="home-edit-button"
                onClick={() => setScreen({ kind: 'quickPreferences', returnToHome: true })}
              >
                Favourites
              </button>
              <button
                className="home-edit-button"
                onClick={() => setScreen({ kind: 'avoidList', returnToHome: true })}
              >
                Things to avoid
              </button>
            </div>
          </div>

          <hr className="home-divider" />

          {/* §2's core rule: switching branches is unconditional, no
              confirmation, available from anywhere in Branch 1. */}
          <div className="home-card">
            <p>Noticed something about how your child is developing?</p>
            <button className="button-accent" onClick={goToBranch2}>
              I've been thinking about my child's development
            </button>
          </div>

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
