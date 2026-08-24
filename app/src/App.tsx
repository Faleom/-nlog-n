// Central routing. Wires together every screen and game built tonight
// into one flow, per app-guide-v3-FINAL.md §2-§10.
//
// The shape, in order:
//   Onboarding (age + nickname + two equal doors)
//     -> Branch 1 ("my-world"): a ONE-TIME chain through response profile
//        -> Companion capture -> quick preferences, then
//        Branch 1 home (both games, dashboard, switch-branch always
//        available)
//     -> Branch 2 ("worry-to-question"): milestones -> (no concern: back
//        to the two doors, nothing recorded) or (concern: the question
//        card -> immediately offered a Branch 1 activity, per §9.3 step 9)
//
// Both paths open on the same welcome screen first (see `welcome` below);
// a RETURNING profile (loaded from storage on mount) is greeted by name and
// continues straight to Branch 1 home, a first-time visitor gets the branded
// intro into Onboarding. That greeting is local device recognition only --
// no account, no password, no network -- it is a presentation layer over the
// getActiveProfile() storage read and must stay that way.
// From Branch 1 home on: the three Branch-1 onboarding screens only chain forward
// automatically the moment Onboarding.onComplete fires. Each Screen variant
// for those three carries its own `returnToHome: boolean`: false while
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
import { CaregiverDashboard } from './screens/CaregiverDashboard';
import { Branch2Milestones } from './screens/Branch2Milestones';
import { Branch2Card } from './screens/Branch2Card';
import { NeutralNotePrompt } from './components/NeutralNotePrompt';
import { Game1 } from './games/Game1';
import { Game2 } from './games/Game2';
import { Game3ShadowMatch } from './games/Game3ShadowMatch';
import { TraceAndColour } from './games/TraceAndColour';
import { BlockStackMatch } from './games/BlockStackMatch';
import { SortByRule } from './games/SortByRule';
import { adapters } from './adapters/registry';
import { clearActiveProfile, getActiveProfile } from './engine/profileStore';
import { getThemePreference, setThemePreference, type ThemeChoice } from './engine/themePreference';
import type { Branch2FlowResult } from './engine/branch2';
import type { ChildProfile } from './types';
import type { ConcernAnswers } from './types';
import './App.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'welcome' }
  | { kind: 'onboarding' }
  | { kind: 'responseProfile'; returnToHome: boolean }
  | { kind: 'companionCapture'; returnToHome: boolean }
  | { kind: 'quickPreferences'; returnToHome: boolean }
  | { kind: 'branch1Home' }
  | { kind: 'game1' }
  | { kind: 'game2' }
  | { kind: 'game3' }
  | { kind: 'trace' }
  | { kind: 'blockStack' }
  | { kind: 'sortByRule' }
  | { kind: 'branch2Milestones' }
  | { kind: 'branch2Card'; answers: ConcernAnswers; childAgeMonths: number }
  | { kind: 'branch2Ended' };

// The two flow names shown in every screen-header eyebrow -- this, plus
// the back button and (during first-time setup) the step count, is the
// whole answer to "where am I / where am I headed."
const SETUP_FLOW = 'Setting up your child’s profile';
// The three setup editors are reachable twice: inside first-time onboarding
// (where they carry SETUP_FLOW and a step counter) and, later, one at a time
// from the home hub's Setup tab. The second case used to show a bare
// "My World" eyebrow; it now names the tab it was launched from, which is
// the only thing about it the caregiver still needs told.
const SETUP_TAB_FLOW = 'Setup';
const WORRY_FLOW = 'Thinking about development';
// Block-stack match and Sort by rule's own flow name, distinct from "My
// World" -- taken directly from the source branch's own naming for this
// pair (`const LOGIC_FLOW = 'Looking and Sorting';`).
const LOGIC_FLOW = 'Looking and Sorting';

// The four places Branch 1 home is split into. This started as two (Play +
// a single "Family" tab) and "Family" immediately became the dense dashboard
// §4.2 tells us not to build: it carried the caregiver dashboard, four setup
// editors, a divider, the branch switch AND the note prompt. Re-split by
// *job*, not by audience:
//   play      -- the child-pointed half: the games.
//   dashboard -- what has happened: the caregiver dashboard.
//   setup     -- what the activities are built FROM: the four editors,
//                plus the log-out action, since this is the settings home.
//   notes     -- what the caregiver has NOTICED: the neutral note prompt
//                and the Branch 2 switch, which are the same gesture
//                ("I saw something") at two different weights.
// Still a re-layout, not a feature split: every destination the old page
// offered is reachable from exactly one of these four.
type HomeTab = 'play' | 'dashboard' | 'setup' | 'notes';

// Declared once, at module scope, so the bar's order and the copy for each
// tab cannot drift apart the way four parallel ternaries would.
const HOME_TABS: { id: HomeTab; label: string; icon: string }[] = [
  { id: 'play', label: 'Play', icon: '\u{1F388}' },
  { id: 'dashboard', label: 'Dashboard', icon: '\u{1F4CB}' },
  { id: 'setup', label: 'Setup', icon: '\u{2699}\u{FE0F}' },
  { id: 'notes', label: 'Notes', icon: '\u{1F4DD}' },
];

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
      {/* Deliberate, explicit product override: AppHeader (the "Hello
          World" brand pill) now renders even during the child-facing
          phases, so the game never reads as a bare unbranded page. This
          knowingly steps back from §8.0/UI-STANDARDS' original "zero text
          in the child's view" rule for this one static, non-interactive
          element -- AppHeader never speaks, is not a button, and carries
          none of the touch-target rules (see its own header comment), so
          it doesn't reintroduce a navigation control into the child's
          hands. ScreenHeader (the back button + flow eyebrow) stays
          gated on !childFacing -- that one IS interactive and IS the
          rest of §8.0's guarantee, and was never part of this request. */}
      {!childFacing && <ScreenHeader eyebrow={eyebrow} onBack={onBack} backLabel="Activities" />}
      <AppHeader />
      {children(setChildFacing)}
    </>
  );
}

function App() {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [noteSaved, setNoteSaved] = useState(false);
  // Lives at App level, not inside the home render, so that an "Edit: ..."
  // screen returning with returnToHome:true lands back on the Setup tab it
  // was launched from instead of snapping to Play.
  const [homeTab, setHomeTab] = useState<HomeTab>('play');

  // window.speechSynthesis is a single global, entirely independent of
  // which React component last called say() -- unmounting a game does
  // NOT stop it, so without this, narration keeps playing over whatever
  // screen you navigate to next. Keyed on screen.kind so the cleanup fires
  // on every real navigation (including into/out of a game), stopping
  // whatever the PREVIOUS screen was saying before the next one renders.
  // The visibilitychange listener covers backgrounding the tab/PWA without
  // a full unload (closing the actual document already stops speech on
  // its own -- there is nothing left running to cancel at that point).
  useEffect(() => {
    return () => {
      adapters.speechOut.stop();
    };
  }, [screen.kind]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        adapters.speechOut.stop();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // App-wide button tap sound. One listener at the root rather than
  // wiring adapters.sound.playClick() into every button in every screen —
  // it fires for every real <button> click anywhere in the app, including
  // ones added later, with nothing per-component to remember. Capture
  // phase isn't needed: a disabled button never dispatches a click event
  // at all, so the confirmation grid's faded/dead crops (§7.7 — wrong tap
  // is silence, never a distinct sound) and the "Coming soon" tile stay
  // silent for free, not via special-casing here.
  //
  // `favSound` personalises the tone's pitch/timbre to whichever favourite
  // sound QuickPreferences captured (profile.context.quickPreferences);
  // undefined for a profile that hasn't done that screen yet, or has no
  // profile at all, in which case webClickSound.ts falls back to the
  // original default click. `quiet` is computed the same way it always
  // was, first and independently of favSound, since the calm accommodation
  // must win regardless of which tone would otherwise play.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('button')) return;
      adapters.sound.playClick({
        quiet: profile?.responseProfile.soundMovement === 'calm',
        favSound: profile?.context.quickPreferences?.favSound,
      });
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [profile]);

  // Accent-by-favColour (see App.css's "Accent-by-favColour" block right
  // after :root). The child's chosen favourite colour from QuickPreferences
  // lives on profile.context.quickPreferences.favColour; mirroring it onto
  // <html data-accent="..."> lets every var(--color-primary*) consumer in
  // the app pick it up with no prop drilling. No profile, or a profile
  // saved before this field existed, both fall through to 'purple' --
  // which is also the :root default, so that is a no-op, not a real
  // override. An unrecognised value (should not happen -- QuickPreferences
  // only offers the seven COLOURS chips) simply matches no CSS rule and
  // also falls through to the same default.
  useEffect(() => {
    document.documentElement.dataset.accent = profile?.context.quickPreferences?.favColour ?? 'purple';
  }, [profile]);

  // Two-tap confirm for "Log out". Not a modal system -- one boolean and a
  // swapped-in row of buttons, which is all a single destructive-ish action
  // on a local-only app needs.
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Light/dark. Starts 'dark' -- the same value App.css itself renders with
  // no [data-theme] attribute set -- so there is no flash of the wrong
  // theme while the stored preference loads; a caregiver who chose light
  // sees one dark frame for a moment on cold load, never the reverse.
  // Device-level, not profile-level (see themePreference.ts), so it is
  // loaded once here rather than as part of the profile.
  const [theme, setTheme] = useState<ThemeChoice>('dark');

  // Mirrors `theme` onto <html data-theme>, per App.css's own
  // `:root[data-theme='light']` selector. Dark stays whatever "unset"
  // renders as -- the attribute is only ever written for light, never
  // written as "dark" -- matching the default/unset-state pattern the
  // requirements ask for and the one src/index.css's color-scheme rule
  // also keys off.
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  function chooseTheme(next: ThemeChoice) {
    setTheme(next);
    void setThemePreference(next);
  }

  useEffect(() => {
    void getThemePreference().then(setTheme);

    // Both paths now land on the SAME welcome screen; it is the presence or
    // absence of a locally-stored profile that decides which of its two
    // faces is shown, not which screen is mounted. Deliberately still just
    // a read of local storage -- there is no account, no password and no
    // network call anywhere in this flow, and none should be added: the
    // "Welcome back" is local device recognition, not authentication.
    void getActiveProfile().then((existing) => {
      if (existing) setProfile(existing);
      setScreen({ kind: 'welcome' });
    });
  }, []);

  function updateProfile(next: ChildProfile) {
    setProfile(next);
  }

  function goToBranch2(): void {
    setScreen({ kind: 'branch2Milestones' });
  }

  // Back to home on whichever tab is already selected. Right for the games
  // (launched from Play) and the dashboard (launched from Dashboard).
  function goToBranch1Home(): void {
    setScreen({ kind: 'branch1Home' });
  }

  // The three "Edit: ..." screens now live on the Setup tab, so a
  // returnToHome:true exit has to land there explicitly rather than trusting
  // whatever tab happened to be selected.
  function goToSetupHome(): void {
    setHomeTab('setup');
    setScreen({ kind: 'branch1Home' });
  }

  // Branch 2 and the end of first-time setup both hand back to the
  // activities, never to a settings tab -- §9.3 step 9 is explicit that a
  // parent must never be left newly aware of a concern with nothing to do.
  function goToPlayHome(): void {
    setHomeTab('play');
    setScreen({ kind: 'branch1Home' });
  }

  // "Log out" on a device with no accounts and no passwords: drop the
  // active-profile pointer (the profile's own data is left untouched and
  // is still on the device) and put the app back on the welcome screen's
  // first-run face, without a reload.
  function logOut(): void {
    void clearActiveProfile().then(() => {
      setConfirmLogout(false);
      setNoteSaved(false);
      setHomeTab('play');
      setProfile(null);
      setScreen({ kind: 'welcome' });
    });
  }

  if (screen.kind === 'loading') {
    return (
      <div className="app">
        <AppHeader />
        <p>Loading…</p>
      </div>
    );
  }

  // The welcome moment. One screen, two faces, chosen purely by whether
  // getActiveProfile() found something on THIS device:
  //   - profile found  -> "Welcome back, <nickname>!" + Continue -> home
  //   - nothing found  -> the Hello World intro + Get started  -> onboarding
  // No AppHeader here on purpose: this screen IS the app's identity, so the
  // identity strip would just say the same thing twice.
  if (screen.kind === 'welcome') {
    return (
      <div className="app app--welcome" key={screen.kind}>
        <main className="welcome">
          {profile ? (
            <>
              <p className="welcome-wordmark">
                <span className="welcome-wordmark-mark" aria-hidden="true">
                  🌱
                </span>
                Hello World
              </p>
              <h1 className="welcome-title">Welcome back, {profile.nickname ?? 'friend'}!</h1>
              <p className="welcome-sub">
                Everything is where you left it. This device remembers you on its own. No
                account, nothing saved anywhere else.
              </p>
              <button
                className="button-primary welcome-action"
                onClick={() => setScreen({ kind: 'branch1Home' })}
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <span className="welcome-mark" aria-hidden="true">
                🌱
              </span>
              <h1 className="welcome-title welcome-title--brand">Hello World</h1>
              <p className="welcome-sub">
                Small activities built from your own child's room, toys and favourite things. No
                account. What's saved stays only on this device.
              </p>
              <button
                className="button-primary welcome-action"
                onClick={() => setScreen({ kind: 'onboarding' })}
              >
                Get started
              </button>
            </>
          )}
        </main>
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
          eyebrow={screen.returnToHome ? SETUP_TAB_FLOW : SETUP_FLOW}
          step={screen.returnToHome ? undefined : { current: 1, total: 3 }}
          onBack={screen.returnToHome ? goToSetupHome : undefined}
          backLabel="Setup"
        />
        <ResponseProfileScreen
          profile={profile}
          onComplete={(next) => {
            updateProfile(next);
            if (screen.returnToHome) {
              goToSetupHome();
            } else {
              setScreen({ kind: 'companionCapture', returnToHome: false });
            }
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'companionCapture') {
    const advance = screen.returnToHome
      ? goToSetupHome
      : () => setScreen({ kind: 'quickPreferences', returnToHome: false });
    return (
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader
          eyebrow={screen.returnToHome ? SETUP_TAB_FLOW : SETUP_FLOW}
          step={screen.returnToHome ? undefined : { current: 2, total: 3 }}
          onBack={screen.returnToHome ? goToSetupHome : undefined}
          backLabel="Setup"
        />
        <CompanionCapture
          profile={profile}
          onComplete={(updated) => {
            updateProfile(updated);
            advance();
          }}
          onSkip={advance}
        />
      </div>
    );
  }

  if (screen.kind === 'quickPreferences') {
    return (
      <div className="app" key={screen.kind}>
        <AppHeader />
        <ScreenHeader
          eyebrow={screen.returnToHome ? SETUP_TAB_FLOW : SETUP_FLOW}
          step={screen.returnToHome ? undefined : { current: 3, total: 3 }}
          onBack={screen.returnToHome ? goToSetupHome : undefined}
          backLabel="Setup"
        />
        <QuickPreferencesScreen
          profile={profile}
          onComplete={(updated) => {
            updateProfile(updated);
            // Last screen of the first-time chain, so its no-return exit is
            // the one that should open on the activities, not on Setup.
            if (screen.returnToHome) {
              goToSetupHome();
            } else {
              goToPlayHome();
            }
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'game1') {
    return (
      <div className="app" key={screen.kind}>
        <GameChrome eyebrow="Find It In Your World" onBack={goToBranch1Home}>
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
        <GameChrome eyebrow="Toy Story Sequencing" onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <Game2 profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'game3') {
    return (
      <div className="app" key={screen.kind}>
        {/* Renamed from "Shadow Match": the game gained a real
            concept-generalization trial system (a bundled library of
            distinct-drawing concepts, adversarial distractor selection) on
            top of its original silhouette levels -- "Match the Picture" is
            what it actually asks the child to do now, silhouette matching
            included. */}
        <GameChrome eyebrow="Match the Picture" onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <Game3ShadowMatch profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'trace') {
    return (
      <div className="app" key={screen.kind}>
        <GameChrome eyebrow="Trace and Colour" onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <TraceAndColour profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
      </div>
    );
  }

  if (screen.kind === 'blockStack') {
    return (
      <div className="app" key={screen.kind}>
        <GameChrome eyebrow={`${LOGIC_FLOW} · Block-stack match`} onBack={goToBranch1Home}>
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
        <GameChrome eyebrow={`${LOGIC_FLOW} · Sort by rule`} onBack={goToBranch1Home}>
          {(onChildFacingChange) => (
            <SortByRule profile={profile} onChildFacingChange={onChildFacingChange} />
          )}
        </GameChrome>
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
              goToPlayHome();
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
            goToPlayHome();
          }}
        />
      </div>
    );
  }

  // branch1Home — one screen, FOUR tabs, one bottom tab bar. The first pass
  // split the old single long scroll into Play + Family; Family then held
  // the dashboard, three setup editors, the branch switch and the note
  // prompt, which is exactly the "one dense dashboard" §4.2 rules out. This
  // pass re-splits that half by job (see HOME_TABS above). Nothing was cut:
  // every destination the scrolling version offered is still one tap away.
  const homeCopy: Record<HomeTab, { title: string; sub: string }> = {
    play: {
      title: `${profile.nickname ?? 'Your child'}'s activities`,
      sub: "Everything built from your child's own room and toys.",
    },
    dashboard: {
      title: 'Dashboard',
      sub: `What you and ${profile.nickname ?? 'your child'} have been doing lately.`,
    },
    setup: {
      title: 'Setup',
      sub: 'The details every activity is built from.',
    },
    notes: {
      title: 'Notes',
      sub: 'Somewhere to put what you have noticed.',
    },
  };
  const copy = homeCopy[homeTab];

  return (
    <div className="app app--tabbed" key={screen.kind}>
      <AppHeader />
      {/* No ScreenHeader here, deliberately. It used to render a "MY WORLD ·
          <tab>" eyebrow, and once "My World" went there was nothing left in
          it: the eyebrow would have said "DASHBOARD" directly above an <h1>
          saying "Dashboard", indented ~100px by the back-button spacer while
          that h1 sat at the content edge -- redundant AND misaligned. This
          is a root screen with nowhere to go back to; the tab bar says which
          section is selected and the heading below names it. */}
      <header className="home-greeting">
        <h1>{copy.title}</h1>
        <p>{copy.sub}</p>
      </header>

      <main className="home-main">
        {homeTab === 'play' && (
          <div className="screen">
            {/* Four boxes on a 2x2 grid. Each real tile carries its own
                CSS-drawn scene (see .game-tile--* in App.css) plus an inline
                SVG motif — nothing is fetched, so the offline guarantee is
                untouched. The reserved hues (Sunburst / Blush) are pointedly
                absent: they mean "reward" and "Companion" everywhere else in
                the app and spending them on chrome would flatten that. */}
            <div className="home-play-grid">
              <button
                className="game-tile game-tile--find"
                onClick={() => setScreen({ kind: 'game1' })}
              >
                {/* Zone 1: the art. The painted scene, its SVG motif and the
                    icon badge all live inside this one element now, so the
                    label below is a sibling ZONE of the card rather than a
                    plate floating on top of the picture. */}
                <span className="game-tile-scene">
                  <span className="game-tile-art" aria-hidden="true">
                    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
                      {/* a shelf in a room, three things sitting on it... */}
                      <path d="M0 62 H160" stroke="currentColor" strokeOpacity="0.24" strokeWidth="2" />
                      <path d="M0 78 L160 62" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
                      <rect x="10" y="44" width="14" height="18" rx="3" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2" />
                      <circle cx="40" cy="53" r="9" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2" />
                      <path d="M58 62 L68 42 L78 62 Z" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2" strokeLinejoin="round" />
                      {/* ...and the magnifier hunting across it */}
                      <circle cx="116" cy="32" r="20" stroke="currentColor" strokeOpacity="0.62" strokeWidth="3.5" />
                      <path d="M130 46 L144 60" stroke="currentColor" strokeOpacity="0.62" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="game-tile-icon" aria-hidden="true">
                    🔍
                  </span>
                </span>
                {/* Zone 2: the caption strip, fused to the art's bottom edge. */}
                <span className="game-tile-title">Find It In Your World</span>
              </button>

              <button
                className="game-tile game-tile--toy"
                onClick={() => setScreen({ kind: 'game2' })}
              >
                <span className="game-tile-scene">
                  <span className="game-tile-art" aria-hidden="true">
                    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
                      {/* a stack of building blocks, mid-build */}
                      <rect x="14" y="54" width="38" height="30" rx="8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.42" strokeWidth="2" />
                      <rect x="58" y="54" width="38" height="30" rx="8" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
                      <rect x="36" y="20" width="38" height="30" rx="8" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
                      <path d="M126 38 L138 62 L114 62 Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.34" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="game-tile-icon" aria-hidden="true">
                    🧸
                  </span>
                </span>
                <span className="game-tile-title">Toy Story Sequencing</span>
              </button>

              <button
                className="game-tile game-tile--shadow"
                onClick={() => setScreen({ kind: 'game3' })}
              >
                <span className="game-tile-scene">
                  <span className="game-tile-art" aria-hidden="true">
                    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
                      <defs>
                        {/* the crescent is a disc with a second disc masked out
                            of it — no second fill colour needed, so it sits on
                            whatever is behind the tile */}
                        <mask id="game-tile-crescent">
                          <rect width="160" height="88" fill="white" />
                          <circle cx="112" cy="20" r="17" fill="black" />
                        </mask>
                      </defs>
                      <circle cx="126" cy="28" r="20" fill="currentColor" fillOpacity="0.62" mask="url(#game-tile-crescent)" />
                      <path d="M0 70 H160" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
                      <rect x="58" y="42" width="26" height="28" rx="6" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="game-tile-icon" aria-hidden="true">
                    🌓
                  </span>
                </span>
                <span className="game-tile-title">Match the Picture</span>
              </button>

              <button
                className="game-tile game-tile--trace"
                onClick={() => setScreen({ kind: 'trace' })}
              >
                <span className="game-tile-scene">
                  <span className="game-tile-art" aria-hidden="true">
                    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
                      {/* a dashed outline (the thing to trace) with a solid
                          crayon stroke cutting across part of it (the thing
                          already coloured in) */}
                      <path
                        d="M46 66 C30 66 22 52 22 40 C22 24 36 14 52 14 C68 14 82 24 84 40 C86 54 76 66 60 66 Z"
                        stroke="currentColor"
                        strokeOpacity="0.55"
                        strokeWidth="3"
                        strokeDasharray="1 7"
                        strokeLinecap="round"
                      />
                      <path
                        d="M96 60 C108 44 124 34 140 32"
                        stroke="currentColor"
                        strokeOpacity="0.7"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="game-tile-icon" aria-hidden="true">
                    🖍️
                  </span>
                </span>
                <span className="game-tile-title">Trace and Colour</span>
              </button>

              <button
                className="game-tile game-tile--blockstack"
                onClick={() => setScreen({ kind: 'blockStack' })}
              >
                <span className="game-tile-scene">
                  <span className="game-tile-art" aria-hidden="true">
                    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
                      {/* two towers mid-build: the target on the left already
                          three blocks tall, the child's on the right one
                          block shy -- the same gap the game itself opens
                          every round with */}
                      <path d="M0 78 H160" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
                      <rect x="34" y="58" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" />
                      <rect x="34" y="36" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.26" stroke="currentColor" strokeOpacity="0.46" strokeWidth="2" />
                      <rect x="34" y="14" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.32" stroke="currentColor" strokeOpacity="0.52" strokeWidth="2" />
                      <rect x="100" y="58" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" />
                      <rect x="100" y="36" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.26" stroke="currentColor" strokeOpacity="0.46" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="game-tile-icon" aria-hidden="true">
                    🧱
                  </span>
                </span>
                <span className="game-tile-title">Block-stack match</span>
              </button>

              <button
                className="game-tile game-tile--sortbyrule"
                onClick={() => setScreen({ kind: 'sortByRule' })}
              >
                <span className="game-tile-scene">
                  <span className="game-tile-art" aria-hidden="true">
                    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
                      {/* two baskets, one shape already resting in each --
                          the rule, shown -- with the loose shapes still in
                          the tray between them */}
                      <path d="M10 52 L34 52 L30 78 L10 78 Z" stroke="currentColor" strokeOpacity="0.42" strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="22" cy="45" r="8" fill="currentColor" fillOpacity="0.3" />
                      <path d="M126 52 L150 52 L146 78 L126 78 Z" stroke="currentColor" strokeOpacity="0.42" strokeWidth="2" strokeLinejoin="round" />
                      <rect x="130" y="38" width="14" height="14" rx="3" fill="currentColor" fillOpacity="0.3" />
                      <polygon points="70,26 82,48 58,48" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="98" cy="38" r="9" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="game-tile-icon" aria-hidden="true">
                    🧺
                  </span>
                </span>
                <span className="game-tile-title">Sort by rule</span>
              </button>
            </div>
          </div>
        )}

        {/* The dashboard renders INLINE here, not behind a button that opens
            a separate route. The tab bar is already the navigation; a tab
            whose entire contents was one button saying "Caregiver dashboard"
            made the caregiver tap twice to reach a screen they had already
            asked for, and showed them nothing in between. The old
            { kind: 'dashboard' } route is gone with it. */}
        {homeTab === 'dashboard' && (
          <>
            <CaregiverDashboard profile={profile} onProfileChange={updateProfile} />
            <p className="home-tab-hint dashboard-footnote">
              Sessions and skills are stored on this device only.
            </p>
          </>
        )}

        {homeTab === 'setup' && (
          <div className="screen">
            <div className="home-section">
              <p className="home-section-label">What we build activities from</p>
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
              </div>
            </div>

            <hr className="home-divider" />

            {/* Appearance. Device-level, same as Log out below it, not
                profile-level -- switching child profiles on this device
                should not silently switch the theme too. Dark is this
                app's deliberate default identity (see App.css's own
                header comment), so this is presented as a genuine choice
                between two designed themes, not a "restore default"
                escape hatch. */}
            <div className="home-section">
              <p className="home-section-label" id="home-theme-title">
                Appearance
              </p>
              <div
                className="home-theme-row"
                role="group"
                aria-labelledby="home-theme-title"
              >
                <button
                  type="button"
                  className={theme === 'dark' ? 'home-theme-option is-selected' : 'home-theme-option'}
                  aria-pressed={theme === 'dark'}
                  onClick={() => chooseTheme('dark')}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={theme === 'light' ? 'home-theme-option is-selected' : 'home-theme-option'}
                  aria-pressed={theme === 'light'}
                  onClick={() => chooseTheme('light')}
                >
                  Light
                </button>
              </div>
            </div>

            {/* Log out. There is no account and no password in this app, so
                this clears the "who is active on this device" pointer and
                nothing else — the profile itself stays on the device. Still
                a real state change (onboarding has to be redone to get back
                in), so it is behind a two-tap confirm and painted in
                --color-danger so it never reads as another destination. */}
            <div className="home-section">
              <p className="home-section-label">This device</p>
              {confirmLogout ? (
                <div className="home-logout-confirm">
                  <p className="home-logout-note">
                    Log out of {profile.nickname ?? 'this profile'}? Nothing saved is deleted, but
                    you would set the profile up again to come back.
                  </p>
                  <div className="home-logout-actions">
                    <button className="home-logout-button" onClick={logOut}>
                      Yes, log out
                    </button>
                    <button className="home-secondary-button" onClick={() => setConfirmLogout(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="home-logout-actions">
                  <button className="home-logout-button" onClick={() => setConfirmLogout(true)}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {homeTab === 'notes' && (
          <div className="screen">
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
        )}
      </main>

      {/* Bottom tab bar. A <nav> with aria-current rather than a
          role="tablist", because a tablist promises arrow-key traversal we
          do not implement -- and these read as four places, not four views
          of one thing. The bar is full-bleed and as short as the 88x88
          UI-STANDARDS floor allows; each button still clears that floor on
          its own, which is what sets the bar's height. */}
      <nav className="tab-bar" aria-label="Sections">
        {HOME_TABS.map((tab) => {
          const isActive = tab.id === homeTab;
          return (
            <button
              key={tab.id}
              className={`tab-bar-button${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                // Leaving Setup with the confirm panel half-open and coming
                // back to it later would be a stale, alarming state.
                setConfirmLogout(false);
                setHomeTab(tab.id);
              }}
            >
              <span className="tab-bar-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="tab-bar-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
