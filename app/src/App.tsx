// Central routing. Wires together every screen and game built tonight
// into one flow, per app-guide-v3-FINAL.md §2-§10.
//
// The shape, in order:
//   Onboarding (age + nickname + two equal doors)
//     -> Branch 1 ("my-world"): a ONE-TIME chain through response profile
//        -> quick preferences (favourite colour, then Companion capture
//        folded in as its own second page), then Branch 1 home (both
//        games, dashboard, switch-branch always available)
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
// From Branch 1 home on: the two Branch-1 onboarding screens only chain forward
// automatically the moment Onboarding.onComplete fires. Each Screen variant
// for those two carries its own `returnToHome: boolean`: false while
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
import type { Branch2FlowResult } from './engine/branch2';
import type { ChildProfile, TrackId } from './types';
import type { ConcernAnswers } from './types';
import './App.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'welcome' }
  | { kind: 'onboarding' }
  | { kind: 'responseProfile'; returnToHome: boolean }
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

const WORRY_FLOW = 'Thinking about development';
// Block-stack match and Sort by rule's own flow name, distinct from "My
// World" -- taken directly from the source branch's own naming for this
// pair (`const LOGIC_FLOW = 'Looking and Sorting';`).
const LOGIC_FLOW = 'Looking and Sorting';

// Recently played's "View" button launches straight into the game whose
// track it names -- the same screen that track's own Play-tab tile
// opens, just reached from the Dashboard tab instead.
const TRACK_TO_SCREEN: Record<TrackId, Screen> = {
  'find-it': { kind: 'game1' },
  story: { kind: 'game2' },
  match: { kind: 'game3' },
  trace: { kind: 'trace' },
  'block-stack': { kind: 'blockStack' },
  'sort-by-rule': { kind: 'sortByRule' },
};

// The four places Branch 1 home is split into. This started as two (Play +
// a single "Family" tab) and "Family" immediately became the dense dashboard
// §4.2 tells us not to build: it carried the caregiver dashboard, four setup
// editors, a divider, the branch switch AND the note prompt. Re-split by
// *job*, not by audience:
//   play      -- the child-pointed half: the games.
//   dashboard -- what has happened: the caregiver dashboard.
//   setup     -- what the activities are built FROM: the two editors,
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
  // `quiet` softens the tap sound for a profile whose response profile
  // says calm/quiet suits them best; undefined for a profile that hasn't
  // done that screen yet, or has no profile at all, in which case
  // webClickSound.ts falls back to its original default click. (This used
  // to also pass a `favSound` pulled from QuickPreferences to personalise
  // the tone's pitch/timbre -- QuickPreferences no longer captures a
  // favourite sound, so that personalisation has nothing left to read.)
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('button')) return;
      adapters.sound.playClick({
        quiet: profile?.responseProfile.soundMovement === 'calm',
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

  // The light/dark toggle that used to live in Setup is gone. Toki
  // replaces both themes screen by screen rather than sitting beside
  // them, so there is no second theme left to switch to and nothing
  // writes [data-theme] any more.

  useEffect(() => {
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
        <main className="toki-screen">
          <div className="toki-blobs" aria-hidden="true" />
          <div className="toki-clouds" aria-hidden="true">
            <span className="toki-cloud-1" />
            <span className="toki-cloud-2" />
            <span className="toki-cloud-3" />
          </div>
          {profile ? (
            <div className="toki-welcome-body">
              <span className="toki-mark" aria-hidden="true">
                🌱
              </span>
              <p className="toki-eyebrow">Hello World</p>
              <h1 className="toki-title">Welcome back, {profile.nickname ?? 'friend'}!</h1>
              <p className="toki-sub">
                Everything is where you left it. This device remembers you on its own. No
                account, nothing saved anywhere else.
              </p>
            </div>
          ) : (
            <div className="toki-welcome-body">
              <span className="toki-mark" aria-hidden="true">
                🌱
              </span>
              <p className="toki-eyebrow">Hello World</p>
              <h1 className="toki-title">
                Small things,
                <br />
                their own world
              </h1>
              <p className="toki-sub">
                Small activities built from your own child's room, toys and favourite things. No
                account. What's saved stays only on this device.
              </p>
            </div>
          )}
          <div className="toki-actions">
            <button
              className="toki-cta"
              onClick={() =>
                setScreen({ kind: profile ? 'branch1Home' : 'onboarding' })
              }
            >
              {profile ? 'Continue' : 'Get started'}
            </button>
            <p className="toki-caption">Nothing to sign up for. Nothing leaves the device.</p>
          </div>
        </main>
      </div>
    );
  }

  if (screen.kind === 'onboarding') {
    return (
      <div className="app app--welcome">
        <Onboarding
          onBack={() => setScreen({ kind: 'welcome' })}
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
      <div className="app app--welcome" key={screen.kind}>
        <ResponseProfileScreen
          profile={profile}
          onBack={screen.returnToHome ? goToSetupHome : undefined}
          onComplete={(next) => {
            updateProfile(next);
            if (screen.returnToHome) {
              goToSetupHome();
            } else {
              setScreen({ kind: 'quickPreferences', returnToHome: false });
            }
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'quickPreferences') {
    return (
      <div className="app app--welcome" key={screen.kind}>
        <QuickPreferencesScreen
          profile={profile}
          onBack={screen.returnToHome ? goToSetupHome : undefined}
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
      title: 'Caregiver Dashboard',
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
    <div className="app app--welcome" key={screen.kind}>
      <div className="toki-home-screen">
        <div className="toki-home-blobs" aria-hidden="true" />
        <div className="toki-home-header">
          <span className="toki-home-wordmark">
            <span className="toki-home-wordmark-mark" aria-hidden="true">
              🌱
            </span>
            Hello World
          </span>
          <span className="toki-home-avatar" aria-hidden="true">
            👤
          </span>
        </div>
        {/* No ScreenHeader/back button here, deliberately -- this is a root
            screen with nowhere to go back to. The tab bar says which
            section is selected and the heading below names it. */}
        <header className="toki-home-greeting">
          <h1>{copy.title}</h1>
          <p>{copy.sub}</p>
        </header>

      <main className="toki-home-main">
        {homeTab === 'play' && (
          <div className="toki-path-container">
            {/* Mockup screen 06's own winding path, unchanged in spirit:
                "every node is open, none carries stars or a count" -- no
                gating, matching this app's existing zero-score-in-the-
                child's-view rule and the tab's own prior behaviour (all
                six games always reachable). The curve is drawn once in a
                fixed 330x470 viewBox; the six buttons below share that
                same coordinate space via percentages (see the CSS), so
                the path and the nodes scale together at any real width. */}
            <svg
              className="toki-path-svg"
              viewBox="0 0 330 470"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M62 44 C150 44 238 60 238 120 S 86 150 86 200 S 250 230 250 278 S 74 304 74 354 S 244 380 244 428"
                stroke="#ffffff"
                strokeWidth="20"
                strokeLinecap="round"
                opacity="0.92"
              />
              <path
                d="M62 44 C150 44 238 60 238 120 S 86 150 86 200 S 250 230 250 278 S 74 304 74 354 S 244 380 244 428"
                stroke="#bcd9f2"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="2 12"
              />
            </svg>

            <button
              className="toki-path-node toki-path-node--find"
              style={{ left: '1.8%', top: '0%' }}
              onClick={() => setScreen({ kind: 'game1' })}
            >
              <span className="toki-path-icon" aria-hidden="true">
                🔍
              </span>
              <span className="toki-path-label">
                Find It In
                <br />
                Your World
              </span>
            </button>

            <button
              className="toki-path-node toki-path-node--right toki-path-node--toy"
              style={{ right: '1.8%', top: '14.9%' }}
              onClick={() => setScreen({ kind: 'game2' })}
            >
              <span className="toki-path-icon" aria-hidden="true">
                🧸
              </span>
              <span className="toki-path-label">
                Toy Story
                <br />
                Sequencing
              </span>
            </button>

            <button
              className="toki-path-node toki-path-node--match"
              style={{ left: '6.7%', top: '32.3%' }}
              onClick={() => setScreen({ kind: 'game3' })}
            >
              <span className="toki-path-icon" aria-hidden="true">
                🌓
              </span>
              <span className="toki-path-label">
                Match the
                <br />
                Picture
              </span>
            </button>

            <button
              className="toki-path-node toki-path-node--right toki-path-node--trace"
              style={{ right: '0.6%', top: '48.9%' }}
              onClick={() => setScreen({ kind: 'trace' })}
            >
              <span className="toki-path-icon" aria-hidden="true">
                🖍️
              </span>
              <span className="toki-path-label">
                Trace and
                <br />
                Colour
              </span>
            </button>

            <button
              className="toki-path-node toki-path-node--blockstack"
              style={{ left: '4.2%', top: '65.1%' }}
              onClick={() => setScreen({ kind: 'blockStack' })}
            >
              <span className="toki-path-icon" aria-hidden="true">
                🧱
              </span>
              <span className="toki-path-label">
                Block-stack
                <br />
                match
              </span>
            </button>

            <button
              className="toki-path-node toki-path-node--right toki-path-node--sortbyrule"
              style={{ right: '1.8%', top: '80.9%' }}
              onClick={() => setScreen({ kind: 'sortByRule' })}
            >
              <span className="toki-path-icon" aria-hidden="true">
                🧺
              </span>
              <span className="toki-path-label">Sort by rule</span>
            </button>
          </div>
        )}

        {/* The dashboard renders INLINE here, not behind a button that opens
            a separate route. The tab bar is already the navigation; a tab
            whose entire contents was one button saying "Caregiver dashboard"
            made the caregiver tap twice to reach a screen they had already
            asked for, and showed them nothing in between. The old
            { kind: 'dashboard' } route is gone with it. */}
        {homeTab === 'dashboard' && (
          <CaregiverDashboard
            profile={profile}
            onProfileChange={updateProfile}
            onPlayTrack={(track) => setScreen(TRACK_TO_SCREEN[track])}
          />
        )}

        {homeTab === 'setup' && (
          <div className="toki-setup-screen">
            {/* The mockup's own Setup screen shows a third row here, "The
                room photo". There is no room-photo management anywhere in
                this app -- Game 1 captures and re-captures the room inside
                its own flow -- so the row would lead nowhere. Two real
                rows, matching the two screens that actually exist. */}
            <div className="toki-setup-section">
              <span className="toki-setup-label">What we build activities from</span>
              <div className="toki-setup-list">
                <button
                  type="button"
                  className="toki-setup-row"
                  onClick={() => setScreen({ kind: 'responseProfile', returnToHome: true })}
                >
                  How {profile.nickname ?? 'they'} do best
                  <span className="toki-setup-row-chevron" aria-hidden="true">
                    &rsaquo;
                  </span>
                </button>
                <button
                  type="button"
                  className="toki-setup-row"
                  onClick={() => setScreen({ kind: 'quickPreferences', returnToHome: true })}
                >
                  Favourites
                  <span className="toki-setup-row-chevron" aria-hidden="true">
                    &rsaquo;
                  </span>
                </button>
              </div>
            </div>

            {/* The mockup also shows an "Appearance" (Light/Dark) and a
                "Movement" (Normal/Low animation) section. Neither is here
                on purpose. Toki replaces the dark theme rather than sitting
                beside it, so there is nothing left to choose between and
                the toggle is retired; motion reduction is read from the
                OS via prefers-reduced-motion, so a second, manual copy of
                that setting would only be able to disagree with it. */}

            {/* Log out. There is no account and no password in this app, so
                this clears the "who is active on this device" pointer and
                nothing else -- the profile itself stays on the device. Still
                a real state change (onboarding has to be redone to get back
                in), so it is behind a two-tap confirm and painted in the
                danger skin so it never reads as another destination. */}
            <div className="toki-setup-section toki-setup-section--device">
              <span className="toki-setup-label">This device</span>
              {confirmLogout ? (
                <div className="toki-setup-confirm">
                  <p className="toki-lede">
                    Log out of {profile.nickname ?? 'this profile'}? Nothing saved is deleted, but
                    you would set the profile up again to come back.
                  </p>
                  <div className="toki-footer-row">
                    <button
                      type="button"
                      className="toki-secondary-btn"
                      onClick={() => setConfirmLogout(false)}
                    >
                      Cancel
                    </button>
                    <button type="button" className="toki-danger-btn" onClick={logOut}>
                      Yes, log out
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="toki-danger-btn"
                    onClick={() => setConfirmLogout(true)}
                  >
                    Log out
                  </button>
                  <p className="toki-caption">Nothing saved is deleted.</p>
                </>
              )}
            </div>
          </div>
        )}

        {homeTab === 'notes' && (
          <div className="screen">
            {/* §2's core rule: switching branches is unconditional, no
                confirmation, available from anywhere in Branch 1.

                Toki revamp: the Notes tab has no mockup of its own (the
                source file's own footer says the tab and the worry-to-
                question branch were not covered), so it is assembled from
                the vocabulary the revamped screens already share -- the
                same white card as Dashboard/Setup, and a real CTA, because
                this is the caregiver's one deliberate door into Branch 2
                and not a throwaway link. */}
            <div className="toki-dcard">
              <p className="toki-dcard-title">Noticed something about how your child is developing?</p>
              <button className="toki-cta toki-cta--card" onClick={goToBranch2}>
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
            of one thing. */}
        <nav className="toki-tab-bar" aria-label="Sections">
          {HOME_TABS.map((tab) => {
            const isActive = tab.id === homeTab;
            return (
              <button
                key={tab.id}
                className={`toki-tab-button${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  // Leaving Setup with the confirm panel half-open and coming
                  // back to it later would be a stale, alarming state.
                  setConfirmLogout(false);
                  setHomeTab(tab.id);
                }}
              >
                <span className="toki-tab-icon" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="toki-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default App;
