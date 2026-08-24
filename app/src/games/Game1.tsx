// Game 1 — Find It In Your World (F.008, the Tier 0 gate). §8.1.
//
// Replaces the walking skeleton this file used to be. Everything below the
// "engine wiring" — session lifecycle, the interaction state machine, the
// support ladder, fading, logging — is Person 1's already-finished engine,
// unchanged: see interactionMachine.ts, activityLogging.ts, fading.ts,
// sessionLifecycle.ts. This file is the "thin layer" §12.2 describes: what
// skill Game 1 targets, what interaction shape it uses, how it renders a
// step. F.012 (difficulty levels) and F.017 (Companion mechanic) extend
// this same file rather than replacing it.
//
// Two audiences, one device (§8.0): 'idle' / 'capturing' / 'searching' /
// 'reportingSupport' / 'sessionEnded' are the CAREGIVER's screen — text is
// fine there, the caregiver operates the device. 'confirming' and
// 'celebrating' are the CHILD's screen, the moment they're handed the
// device — those two phases must be zero text, icons/photos/audio only
// (§7.7, §13's "no points, stars, confetti").
//
// The capture pipeline is reached ONLY through
// adapters/pipeline/myWorldPipeline.ts's captureRoomAndRecognize() — see
// that file's header for why calling adapters.capture/adapters.vision
// directly here would silently defeat the whole F.006 face-blur
// guarantee. scripts/smoke-f006.ts's static check enforces this.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { adapters } from '../adapters/registry';
import { captureRoomAndRecognize } from '../adapters/pipeline/myWorldPipeline';
import { renderLine, slotValuesFromProfile } from '../engine/slots';
import { InteractionMachine, type PromptTier } from '../engine/interactionMachine';
import { startSession } from '../engine/profileStore';
import { logActivityOutcome } from '../engine/activityLogging';
import { getFadingSuggestion, type FadingSuggestion } from '../engine/fading';
import {
  childFacingHandoffLine,
  describeSessionRecap,
  distinctSkillsThisSession,
  endSessionNow,
  getSessionNumber,
  hasCapBeenReached,
  sessionCapSeconds,
  type SessionEndResult,
} from '../engine/sessionLifecycle';
import { SUPPORT_TIERS, DEFAULT_STARTING_SUPPORT_TIER } from '../config/supportLadder';
import { GENERIC_FALLBACK_CROPS } from './genericFallbackCrops';
import { ObjectIcon } from './objectIcons';
import { pickNextTarget } from './game1Trial';
import { getGame1Level, setGame1Level, type Game1Level } from './game1Level';
import {
  buildQuest,
  isQuestComplete,
  remainingFor,
  questBrief,
  questSkillId,
  type Quest,
} from './game1/quests';
import {
  WALLS,
  WALL_SHORT,
  canStart,
  cropsOf,
  directionFor,
  placeCrops,
  type PlacedCrop,
  type WallCapture,
  type WallIndex,
} from './game1/walls';
import { RoomPanorama, PANORAMA_STYLES } from './game1/RoomPanorama';
import {
  applyProfileTuning,
  buildConfirmationGrid,
  buildSearchPromptTemplate,
  searchScopeLabelForLevel,
  shuffleGrid,
  targetDescriptionForLevel,
} from './game1Difficulty';
import {
  COMPANION_HUNT_PROMPT_TEMPLATE,
  HELPER_FRAMING_PROMPT_TEMPLATE,
  hasCompanion,
  rewardFrameColour,
  shouldUseHelperFraming,
} from './game1Companion';
import type { VisionScene } from '../adapters/ports';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase =
  | 'idle'
  | 'capturing'
  | 'foundObjects'
  | 'searching'
  | 'confirming'
  | 'celebrating'
  | 'reportingSupport'
  | 'movementBreak'
  | 'sessionEnded';

interface Game1Props {
  profile: ChildProfile;
  /** Fires whenever the screen crosses into or out of the CHILD's two
   * phases (§8.0). The shell (App.tsx) uses this to hide its own chrome —
   * the wayfinding header and back button — since any text there would
   * violate the same zero-text rule this file already enforces on its own
   * confirming/celebrating JSX. */
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

/** Loose common-colour-word → CSS colour mapping. The recognised object's
 * own colour is no longer the whole tile (see CropButton) — it's now the
 * tile's border and background tint, sitting behind the object's artwork.
 * Two independent cues, both wordless: what the thing IS (the drawing) and
 * what colour it is (the frame) — which is what makes a level-2 prompt
 * like "find the RED cup" discriminable at all. */
function swatchColour(colour: string): string {
  const known = new Set([
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'grey', 'gray', 'gold', 'silver', 'teal', 'cyan',
  ]);
  return known.has(colour.toLowerCase()) ? colour.toLowerCase() : '#ccc';
}

/** One button rendering a recognised object in the child-facing grid. Zero
 * text (§7.7, §13) — bundled cartoon artwork for the object, on a card
 * tinted and bordered in the object's own colour. Visual state (dead /
 * dimmed / target-highlighted) is driven entirely by CSS classes so the
 * prompt-hierarchy escalation (F.009) has somewhere to land without any of
 * it being a string the child would need to read.
 *
 * Deliberately NOT the photo crop this used to render: see objectIcons.tsx's
 * header — vision bboxes are approximate (types/index.ts says so), so real
 * crops arrive offset and blurry, which is the one thing a pre-literate
 * child cannot recover from. */
function CropButton({
  crop,
  onTap,
  dead,
  dimmed,
  isTargetHighlighted,
  isTargetBouncing,
  disabled,
  celebrating,
}: {
  crop: TaggedCrop;
  onTap: () => void;
  dead: boolean;
  dimmed: boolean;
  isTargetHighlighted: boolean;
  isTargetBouncing: boolean;
  disabled: boolean;
  celebrating: boolean;
}) {
  const classNames = [
    'g1-crop',
    dead && 'g1-crop--dead',
    dimmed && !dead && 'g1-crop--dimmed',
    isTargetHighlighted && 'g1-crop--highlighted',
    isTargetBouncing && 'g1-crop--bouncing',
    celebrating && 'g1-crop--celebrating',
  ]
    .filter(Boolean)
    .join(' ');

  const tint = swatchColour(crop.colour);

  return (
    <button
      type="button"
      className={classNames}
      aria-label={crop.name}
      disabled={dead || disabled}
      onClick={onTap}
      style={{
        // Explicit square, not min-width/height: the artwork inside sizes
        // itself as a % of this box, so the box needs a definite size to
        // resolve against — left implicit, the button sizes to its content
        // while the content sizes to the button, and the tile balloons.
        // 96 keeps it clear of §4.4's 88pt floor and still fits four across
        // inside the 480px app shell.
        width: 96,
        height: 96,
        flexShrink: 0,
        borderRadius: 16,
        border: `3px solid ${tint}`,
        // The coloured border alone disappears when the object's own colour
        // is white or cream — a white ring on a white card. This hairline
        // sits just outside it so the tile always has a visible edge, and
        // "white" still reads as white rather than as nothing.
        boxShadow: '0 0 0 1px rgba(33, 31, 46, 0.16)',
        padding: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor first as the fallback: if color-mix() isn't
        // supported the `background` line below is dropped as invalid and
        // this plain white card survives, keeping the artwork readable
        // (the coloured border still carries the colour cue either way).
        backgroundColor: '#ffffff',
        background: `color-mix(in srgb, ${tint} 16%, #ffffff)`,
      }}
    >
      <ObjectIcon name={crop.name} category={crop.category} />
    </button>
  );
}

/** Local styles for the escalation/celebration animations — plain CSS,
 * injected once. No component library in this repo yet, and these three
 * keyframes don't warrant one. */
const GAME1_STYLES = `
/* --g1-accent: the child's own favourite colour (§8.1's "reward frame in
   {fav_colour}"), extended here from just the reward frame to every
   interactive accent in the game — the level selector, the capture/continue
   buttons, and the escalation pulse/bounce rings all pick it up. Falls back
   to the app's default --color-primary when no favourite colour is set
   (Game1() only ever sets --g1-accent when rewardFrameColour() returns a
   real value — see its render below). color-mix() is what lets a single
   accent value produce the pulse ring's faded edge without needing a
   separate rgba() constant per possible colour. */
@keyframes g1-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--g1-accent, var(--color-primary)) 55%, transparent); } 50% { box-shadow: 0 0 0 10px transparent; } }
@keyframes g1-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes g1-celebrate { 0% { transform: scale(1); } 100% { transform: scale(1.6); } }
.g1-crop { transition: opacity 200ms ease; opacity: 1; }
.g1-crop--dead { opacity: 0.4; }
.g1-crop--dimmed { opacity: 0.6; }
.g1-crop--highlighted { animation: g1-pulse 1.2s ease-in-out infinite; }
.g1-crop--bouncing { animation: g1-bounce 0.6s ease-in-out infinite; }
.g1-crop--celebrating { animation: g1-celebrate 800ms ease-out forwards; z-index: 1; position: relative; }
.g1-btn-accent { border: 2px solid var(--g1-accent, var(--color-primary)) !important; }
.g1-found-thumb { border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 5px; }
/* §4.3: "cap the grid on phones, never shrink the target" — below the
   tablet breakpoint the confirmation grid becomes a horizontally
   scrolling carousel (~2.5 crops visible) instead of wrapping into a
   shrunk grid. flex-shrink:0 on each crop is what actually enforces the
   88pt floor never shrinking; overflow-x:auto is what makes 6 crops fit
   without wrapping. */
@media (max-width: 600px) {
  .g1-grid { flex-wrap: nowrap !important; overflow-x: auto; justify-content: flex-start !important; padding: 0 8px; }
  .g1-crop { flex-shrink: 0; }
}
`;

/**
 * The room photo with every recognised object marked in place — the
 * "here's what we found, and where" view (§8.0's caregiver side; text and
 * the real photo are both fine here, this never renders in the child's two
 * phases).
 *
 * Positions are percentages of the scene's own dimensions rather than
 * pixels, because the <img> is width-constrained by its container and will
 * render at some other size than `scene.width`. Every bbox is in the
 * scene's pixel space (see VisionScene's doc), so dividing by that is what
 * keeps a marker on its object at any display size.
 */
/**
 * Where each badge sits, in percent of the scene.
 *
 * Objects in a real room cluster (a shelf of toys, a pile on the floor), so
 * placing every badge dead-centre on its box stacks them into an unreadable
 * heap. Each badge starts at its object's centre and, if that spot is
 * already taken, tries a short ring of nearby offsets until one is free.
 * Deterministic (fixed candidate order, no randomness), so the same photo
 * always lays out the same way — a badge that jumped around between renders
 * would be worse than the overlap.
 */
const BADGE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, -11], [0, 11], [-11, 0], [11, 0],
  [-9, -9], [9, -9], [-9, 9], [9, 9], [0, -21], [0, 21],
];

function placeBadges(crops: TaggedCrop[], scene: VisionScene) {
  const taken: Array<{ x: number; y: number }> = [];
  const clashes = (x: number, y: number) =>
    taken.some((t) => Math.abs(t.x - x) < 9 && Math.abs(t.y - y) < 10);

  return crops.map((crop) => {
    const cx = ((crop.bbox.x + crop.bbox.width / 2) / scene.width) * 100;
    const cy = ((crop.bbox.y + crop.bbox.height / 2) / scene.height) * 100;
    const spot =
      BADGE_OFFSETS.map(([dx, dy]) => ({
        x: Math.min(94, Math.max(6, cx + dx)),
        y: Math.min(93, Math.max(7, cy + dy)),
      })).find((p) => !clashes(p.x, p.y)) ?? { x: cx, y: cy };
    taken.push(spot);
    return { crop, ...spot };
  });
}

/**
 * The key to the map: every drawing, labelled.
 *
 * The labels live HERE and never on the photo itself — text burned over a
 * room picture is unreadable at this size and would cover the very objects
 * it names. This is also what rescues the case where two objects share one
 * drawing (two soft toys, two cups): the colour word plus the object's own
 * name separates them, where the artwork alone cannot.
 *
 * Caregiver-facing only. Never rendered during 'confirming'/'celebrating',
 * which are the child's zero-text phases (§7.7, §13).
 */
function ObjectLegend({ crops }: { crops: TaggedCrop[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
      {crops.map((crop) => {
        const tint = swatchColour(crop.colour);
        // "red" + "red cup" would read as "red red cup" -- only prepend the
        // colour when the name doesn't already carry it.
        const label = crop.name.toLowerCase().includes(crop.colour.toLowerCase())
          ? crop.name
          : `${crop.colour} ${crop.name}`;
        return (
          <div
            key={crop.id}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 84 }}
          >
            <div
              className="g1-found-thumb"
              style={{
                width: 72,
                height: 72,
                border: `3px solid ${tint}`,
                boxShadow: '0 0 0 1px rgba(33, 31, 46, 0.16)',
                backgroundColor: '#ffffff',
                background: `color-mix(in srgb, ${tint} 16%, #ffffff)`,
              }}
            >
              <ObjectIcon name={crop.name} category={crop.category} />
            </div>
            <span style={{ fontSize: '0.7rem', opacity: 0.85, textAlign: 'center', lineHeight: 1.3 }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RoomMap({ scene, crops }: { scene: VisionScene; crops: TaggedCrop[] }) {
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  const badges = placeBadges(crops, scene);
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(33,31,46,0.14)',
        lineHeight: 0,
      }}
    >
      <img src={scene.dataUrl} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
      {badges.map(({ crop, x, y }) => (
        <div key={crop.id}>
          {/* The box the model actually returned. Kept — it is the
              difference between "the app says it found a cup" and "the app
              can show you which cup" — but drawn as a thin translucent
              outline rather than a heavy white frame, so a dozen of them
              read as annotation instead of scaffolding. */}
          <div
            style={{
              position: 'absolute',
              left: pct(crop.bbox.x, scene.width),
              top: pct(crop.bbox.y, scene.height),
              width: pct(crop.bbox.width, scene.width),
              height: pct(crop.bbox.height, scene.height),
              border: '1.5px solid rgba(255,255,255,0.75)',
              borderRadius: 8,
              boxShadow: '0 0 0 1px rgba(33,31,46,0.22)',
            }}
          />
          <div
            title={crop.name}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              width: 34,
              height: 34,
              padding: 4,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 5px rgba(33,31,46,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ObjectIcon name={crop.name} category={crop.category} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Game1({ profile, onChildFacingChange }: Game1Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [confirmGrid, setConfirmGrid] = useState<TaggedCrop[]>([]);
  const [promptTier, setPromptTier] = useState<PromptTier>(0);
  const [deadCropIds, setDeadCropIds] = useState<Set<string>>(new Set());
  const [captureNotice, setCaptureNotice] = useState<'blur-failed' | null>(null);
  /** The redacted room photo the crops came from, kept for the end-of-session
   * RoomMap. In React state only — never written to StoragePort (§14: this
   * is a real picture of a family's home). Dropped when the screen unmounts. */
  const [scene, setScene] = useState<VisionScene | undefined>(undefined);
  /** Why we're playing with GENERIC_FALLBACK_CROPS instead of the child's own
   * things. §11 forbids showing an ERROR here, and this isn't one — without
   * it the app silently substitutes objects that aren't in the room and the
   * caregiver is left wondering why it keeps asking for a cup they don't own. */
  const [fallbackReason, setFallbackReason] = useState<
    'no-objects' | 'no-photo' | 'failed' | null
  >(null);
  const [slowCapture, setSlowCapture] = useState(false);
  const [level, setLevel] = useState<Game1Level>(1);
  const [companionHuntActive, setCompanionHuntActive] = useState(false);

  // §8.1 "Profile tuning": derived once from the four response-profile
  // dimensions, never a condition (ARCHITECTURE-RULES.md §5.2). Recomputed
  // only if the profile object itself changes, not per trial.
  const tuning = applyProfileTuning(profile);

  // The onboarding "quick preferences" favourite colour (already the source
  // of §8.1's reward-frame colour, see rewardFrameColour) doubles as the
  // whole game's personalised accent — set as a CSS custom property on the
  // outer wrapper below so every button/pulse/ring in this file can read it
  // via var(--g1-accent, var(--color-primary)) without per-element plumbing.
  // null (no favourite colour given) means no property is set at all, so
  // CSS's own fallback quietly takes over — same "real value or nothing,
  // never a meaningless default" rule rewardFrameColour already follows.
  const accentColour = rewardFrameColour(profile);
  const accentStyle = accentColour
    ? ({ '--g1-accent': accentColour } as CSSProperties)
    : undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [lastLoggedTier, setLastLoggedTier] = useState<SupportTier | null>(null);
  const [fadingSuggestion, setFadingSuggestion] = useState<FadingSuggestion | null>(null);
  const [sessionEndResult, setSessionEndResult] = useState<SessionEndResult | null>(null);
  const [showCaregiverRecap, setShowCaregiverRecap] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ---- the room as three walls (games/game1/walls.ts) ----
  const [captures, setCaptures] = useState<WallCapture[]>([]);
  const [placed, setPlaced] = useState<PlacedCrop[]>([]);
  const [activeWall, setActiveWall] = useState<WallIndex | null>(null);

  // ---- what this round is asking for (games/game1/quests.ts) ----
  // A fetch quest holds one object; a collect/combine quest holds several
  // and the child makes one trip to the shelf per member.
  const [quest, setQuest] = useState<Quest | null>(null);
  const [broughtIds, setBroughtIds] = useState<Set<string>>(new Set());

  // Mirrors of the three above. The celebration -> next-object hop runs
  // inside a setTimeout, and a timeout callback closes over the state from
  // the render that scheduled it -- so reading `quest` or `broughtIds`
  // there would see the values from before the object arrived, and a
  // collection would either repeat one object forever or end a trip early.
  const questRef = useRef<Quest | null>(null);
  const broughtIdsRef = useRef<Set<string>>(new Set());
  const placedRef = useRef<PlacedCrop[]>([]);
  /** Walks buildQuest's group list so consecutive rounds differ. */
  const questIndexRef = useRef<number>(0);

  const machineRef = useRef<InteractionMachine>(new InteractionMachine());
  // Seeded with a static value, not Date.now() -- useRef's initial-value
  // argument is evaluated on every render even though only the first call
  // is kept, which is an impure call during render. The real value is set
  // inside the effect below, once, when the session actually starts.
  const sessionStartedAtRef = useRef<number>(0);
  const lastObjectNameRef = useRef<string | null>(null);
  const lastTargetIdRef = useRef<string | null>(null);
  // §8.1 lively/short-attention tuning: "movement break every 3 trials".
  // Counts trials resolved THIS session, not persisted — the cadence is a
  // per-session pacing device, not a fact worth remembering across
  // sessions the way the level itself is.
  const trialCountRef = useRef<number>(0);

  const handleEndSession = useCallback(
    async (reason: 'cap' | 'idle' | 'caregiver') => {
      if (!sessionId) return;
      setPhase('sessionEnded');
      const result = await endSessionNow(sessionId, reason, lastObjectNameRef.current);
      setSessionEndResult(result);
      void adapters.speechOut.say(childFacingHandoffLine(profile, result.handoffObjectName));
    },
    [sessionId, profile],
  );

  useEffect(() => {
    onChildFacingChange?.(phase === 'confirming' || phase === 'celebrating');
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  useEffect(() => {
    void (async () => {
      const [session, number, savedLevel] = await Promise.all([
        startSession(profile.id),
        getSessionNumber(profile.id),
        getGame1Level(profile.id),
      ]);
      setSessionId(session.id);
      setSessionNumber(number);
      setLevel(savedLevel);
      sessionStartedAtRef.current = Date.now();

      // §6.3 "Bookend: greets at start" — the goodbye half already exists
      // (childFacingHandoffLine, called from handleEndSession). With no
      // Companion set this renders through the same neutral 'your friend'
      // default engine/slots.ts already provides — no branching needed.
      if (hasCompanion(profile)) {
        void adapters.speechOut.say(
          renderLine('Hi! {companion} is ready to play!', slotValuesFromProfile(profile), profile.context),
        );
      }
    })();
    // Depends on the whole `profile` object, not just `profile.id` — the
    // greeting reads profile.context.companion, and `handleEndSession`
    // (the goodbye half of this same bookend) already depends on the full
    // `profile` object for the identical reason. This DOES mean the
    // effect (and therefore a fresh session + a repeated greeting) fires
    // again if the parent hands down a new `profile` object with the same
    // id — acceptable here since App.tsx currently only ever produces a
    // new profile reference on a genuine change, not on every render.
  }, [profile]);

  async function handleLevelChange(newLevel: Game1Level) {
    setLevel(newLevel);
    await setGame1Level(profile.id, newLevel);
  }

  // The single poller driving both F.009's idle detection and F.013's cap
  // check, exactly as in the engine's design (see interactionMachine.ts —
  // "a game screen polls tick() periodically"). Also mirrors the current
  // prompt tier into state so the confirming-phase UI can react to
  // time-based escalation (an idle child on the confirmation screen
  // escalates exactly like a wrong-tapping one), not just tap-based
  // escalation.
  useEffect(() => {
    if (!sessionId || sessionNumber === null || phase === 'sessionEnded') return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - sessionStartedAtRef.current) / 1000));

      const tick = machineRef.current.tick(now);
      if (phase === 'searching' || phase === 'confirming') {
        setPromptTier(tick.tier);
      }
      if (tick.endSession) {
        void handleEndSession('idle');
        return;
      }
      const elapsed = Math.floor((now - sessionStartedAtRef.current) / 1000);
      if (hasCapBeenReached(sessionNumber, elapsed)) {
        void handleEndSession('cap');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, sessionNumber, phase, handleEndSession]);

  /**
   * Starts a new trial from the session's existing crop pool. `effectiveLevel`
   * defaults to the caregiver-set level, but the movement-break return path
   * (§7.7: "always to a task one level easier than the one that triggered
   * it") passes a one-lower override for exactly one trial without
   * persisting that as the child's new level.
   */
  function startTrialWith(
    pool: TaggedCrop[],
    effectiveLevel: Game1Level = level,
    forcedTarget?: TaggedCrop,
  ) {
    // A collecting round names the object it still wants; only a free
    // fetch gets to pick. Without this, the child could be asked for the
    // same red ball twice while a red cup sits unfetched, and the
    // collection would never close.
    const picked = forcedTarget ?? pickNextTarget(pool, lastTargetIdRef.current);
    lastTargetIdRef.current = picked.id;
    setTarget(picked);
    setCompanionHuntActive(false);
    const grid = buildConfirmationGrid(pool, picked, effectiveLevel);
    // §8.1: calm/sameness profiles keep the reward crop in the same
    // position every trial (no shuffle); other profiles get a shuffled
    // layout each trial. buildConfirmationGrid itself always stays
    // deterministic — the shuffle is this explicit, separate opt-in step.
    setConfirmGrid(tuning.fixedLayout ? grid : shuffleGrid(grid));
    setDeadCropIds(new Set());
    setPromptTier(0);
    setPhase('searching');
    machineRef.current.startTrial();

    // §6.3/§8.1 "Helper who needs help": every 3rd trial swaps the
    // standard "{companion} wants..." framing for the prosocial
    // "{companion} can't reach the {object}..." framing. Both are spoken
    // AND are what the caregiver's 'searching' screen renders (see the
    // JSX below) — §6.3's "never an instruction the caregiver can't see
    // on screen" requirement.
    const useHelperFraming = hasCompanion(profile) && shouldUseHelperFraming(trialCountRef.current + 1);
    const template = useHelperFraming
      ? HELPER_FRAMING_PROMPT_TEMPLATE
      : buildSearchPromptTemplate(effectiveLevel, picked, tuning);
    const line = renderLine(
      template,
      slotValuesFromProfile(profile, { 'object.name': picked.name }),
      profile.context,
    );
    void adapters.speechOut.say(line);
  }

  /** §8.1 "Companion hunt": the child's own toy, not a room crop — the
   * highest-motivation target available. Caregiver-triggered (see the
   * 'searching' JSX's "Make this a {companion} hunt!" button) rather than
   * app-scheduled, since the app has no reliable way to know in advance
   * which trial will actually be a session's last one (cap/idle/caregiver
   * endings are all unpredictable) — §8.1 says "reserve for the final
   * trial", so letting the caregiver deliberately choose it as the last
   * one is the honest way to satisfy that. Ends the session immediately
   * after, which is what makes it actually "final" rather than a guess. */
  function startCompanionHuntTrial() {
    setCompanionHuntActive(true);
    setDeadCropIds(new Set());
    setPromptTier(0);
    setPhase('searching');
    machineRef.current.startTrial();
    void adapters.speechOut.say(
      renderLine(COMPANION_HUNT_PROMPT_TEMPLATE, slotValuesFromProfile(profile), profile.context),
    );
  }

  /** The companion-hunt equivalent of handleTap: there's only one real
   * object (their actual Companion toy) so, unlike a normal trial, there's
   * no discrimination grid to tap — the caregiver's "They brought it"
   * confirmation IS the resolution. Still logged as a real activity
   * (§7.6's support-tier report still applies) and still resolves through
   * F.009's machine so its tier/timing bookkeeping stays consistent with
   * every other trial. */
  function handleCompanionFound() {
    machineRef.current.recordAttempt(true);
    setPhase('celebrating');
    lastObjectNameRef.current = profile.context.companion?.name ?? null;
    void adapters.speechOut.say(
      renderLine('{companion}!', slotValuesFromProfile(profile), profile.context),
    );
    setTimeout(() => setPhase('reportingSupport'), tuning.fasterCelebration ? 400 : 800);
  }

  /** Recomputes the joined room from whatever walls have been shot. */
  function commitCaptures(next: WallCapture[]) {
    const nextPlaced = placeCrops(next);
    setCaptures(next);
    setPlaced(nextPlaced);
    placedRef.current = nextPlaced;
    setCrops(cropsOf(nextPlaced));
  }

  /**
   * Opens a round at the caregiver-set level.
   *
   * Falls back down the ladder when the room cannot support the level --
   * a room with no colour appearing twice cannot pose a counting task, and
   * §11's posture is to degrade quietly rather than show an error or ask
   * for objects the child does not own.
   */
  function startQuest(pool: TaggedCrop[], effectiveLevel: Game1Level = level) {
    let q = buildQuest(effectiveLevel, pool, questIndexRef.current);
    if (!q) q = buildQuest(1, pool, questIndexRef.current);
    questIndexRef.current += 1;

    const fresh = new Set<string>();
    setQuest(q);
    questRef.current = q;
    setBroughtIds(fresh);
    broughtIdsRef.current = fresh;

    if (!q) {
      // Nothing recognised at all. startTrialWith still runs so the child
      // gets the generic fallback set rather than a dead screen.
      startTrialWith(pool, effectiveLevel);
      return;
    }
    startTrialWith(pool, effectiveLevel, q.members[0]);
  }

  /**
   * One object just arrived in the child's hands.
   *
   * For a fetch that ends the round. For a collection it ticks one member
   * off and sends them back for the next one. What the caregiver sees is
   * a record of trips that ended in an object arriving, never a number
   * shown to the child.
   */
  function advanceOrFinish(broughtCropId: string) {
    const q = questRef.current;
    const delay = tuning.fasterCelebration ? 400 : 800;

    if (!q || q.kind === 'fetch') {
      setTimeout(() => setPhase('reportingSupport'), delay);
      return;
    }

    const next = new Set(broughtIdsRef.current);
    next.add(broughtCropId);
    broughtIdsRef.current = next;
    setBroughtIds(next);

    if (isQuestComplete(q, next)) {
      setTimeout(() => setPhase('reportingSupport'), delay);
      return;
    }

    const stillWanted = remainingFor(q, next)[0];
    setTimeout(() => {
      startTrialWith(cropsOf(placedRef.current), level, stillWanted);
    }, delay);
  }

  async function handleCapturePress(wall: WallIndex) {
    setActiveWall(wall);
    setPhase('capturing');
    setCaptureNotice(null);
    setSlowCapture(false);

    const outcome = await captureRoomAndRecognize({
      onSlow: () => setSlowCapture(true),
    });

    if (outcome.kind === 'blur-failed') {
      // §11 / §4.4: hard stop, discard, offer retake. This is the
      // CAREGIVER's screen (they operate the camera), so plain text here
      // is fine — the zero-text rule is about the child's screen only.
      setCaptureNotice('blur-failed');
      setPhase('idle');
      return;
    }

    // §11: "capture-unavailable" (permission denied / cancelled) and
    // "no-objects-found" (nothing usable recognised, or the vision call
    // itself failed) both degrade the SAME way — quietly, to a generic
    // activity set, never an error shown. Only a real 'success' gets the
    // "found in your room" reveal below — showing it for the generic
    // fallback set would misrepresent placeholder crops as real detections.
    if (outcome.kind === 'success') {
      // One wall of the room, added to whatever has been shot already.
      // Re-shooting a wall REPLACES it rather than appending -- otherwise a
      // caregiver correcting a blurry photo would leave the old wall's
      // objects in the room, and the child would be sent to fetch things
      // that are no longer on screen.
      commitCaptures([
        ...captures.filter((c) => c.wall !== wall),
        { wall, crops: outcome.crops, scene: outcome.scene },
      ]);
      setScene(outcome.scene);
      setFallbackReason(null);
      setPhase('foundObjects');
      return;
    }

    // Still no error screen (§11) — but record WHICH quiet degradation this
    // was, so the caregiver screen can say what to do differently instead of
    // silently asking the child to fetch a cup that isn't in their house.
    setScene(undefined);
    setFallbackReason(
      outcome.kind === 'no-objects-found'
        ? 'no-objects'
        : outcome.kind === 'recognition-failed'
          ? 'failed'
          : 'no-photo',
    );
    setCrops(GENERIC_FALLBACK_CROPS);
    startQuest(GENERIC_FALLBACK_CROPS);
  }

  function handleTheyBroughtIt() {
    if (companionHuntActive) {
      handleCompanionFound();
      return;
    }
    setPhase('confirming');
    void adapters.speechOut.say('Show me — which one did you bring?');
  }

  function handleTap(crop: TaggedCrop) {
    const outcome = machineRef.current.recordAttempt(crop.id === target?.id);

    if (outcome.resolved) {
      setPhase('celebrating');
      setPromptTier(outcome.tier);
      lastObjectNameRef.current = crop.name;
      const line = renderLine(
        'Your {object.name}!',
        slotValuesFromProfile(profile, { 'object.name': crop.name }),
        profile.context,
      );
      void adapters.speechOut.say(line);
      // §8.1 lively/short-attention tuning: "faster celebration". On a
      // collecting round this hop goes back out for the next object
      // instead of straight to the support report.
      advanceOrFinish(crop.id);
      return;
    }

    // Wrong tap (§7.7): silence, fade to dead, nothing else reaches the
    // child. The escalating tier (fade at 1, target highlight at 2, only-
    // target-tappable at 3) is rendered via CSS classes in the JSX below,
    // driven by `promptTier`.
    setDeadCropIds((prev) => new Set(prev).add(crop.id));
    setPromptTier(outcome.tier);
    // Tier 1 ("Repeat"): audio repeats, slightly slower. No visual/verbal
    // acknowledgement of "wrong" beyond that — see §7.7's "never: red X,
    // buzzer... a wrong tap produces silence plus fade and nothing else."
    if (outcome.tier === 1 && target) {
      const template = buildSearchPromptTemplate(level, target, tuning);
      const line = renderLine(template, slotValuesFromProfile(profile), profile.context);
      void adapters.speechOut.say(line, { rate: 0.85 });
    }
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId) return;
    if (!companionHuntActive && !target) return;
    // A collecting round is a different skill from a single fetch, so it
    // logs as one -- otherwise five trips to gather the red things would
    // be recorded as five separate "find a toy" events and the caregiver
    // dashboard would show a burst of activity that never happened.
    const skillId = companionHuntActive
      ? 'find-companion'
      : quest && quest.kind !== 'fetch'
        ? questSkillId(quest.kind)
        : `find-${target?.category}`;

    await logActivityOutcome({
      sessionId,
      skillId,
      context: 'living-room', // TODO(context selection is outside F.008 — see F.007/onboarding)
      supportTier: tier,
      onScreenTier: machineRef.current.currentTier,
    });
    setLastLoggedTier(tier);
    const suggestion = await getFadingSuggestion(profile.id, skillId, tier, profile.nickname ?? 'they');
    setFadingSuggestion(suggestion);

    if (companionHuntActive) {
      // §8.1: the Companion hunt is reserved for the session's FINAL
      // trial (see startCompanionHuntTrial's header for why that's
      // caregiver-triggered rather than app-guessed) — logging its
      // outcome is what actually ends the session, delivering the
      // Companion's goodbye bookend (childFacingHandoffLine, already
      // Companion-framed) immediately after.
      void handleEndSession('caregiver');
      return;
    }

    trialCountRef.current += 1;
    // §8.1 lively/short-attention tuning: "movement break every 3 trials".
    // §7.7's own engine-driven breaks (disengagement-triggered, capped at
    // 3/session via machineRef.current.takeMovementBreak()) are separate
    // and unaffected — this is Game 1 additionally OFFERING one on a fixed
    // cadence for profiles that benefit from predictable pacing, still
    // subject to the same session cap.
    if (
      tuning.movementBreakEveryNTrials !== null &&
      trialCountRef.current % tuning.movementBreakEveryNTrials === 0 &&
      machineRef.current.takeMovementBreak()
    ) {
      setPhase('movementBreak');
      const line = renderLine(
        '{movement} like a {fav_animal}!',
        slotValuesFromProfile(profile),
        profile.context,
      );
      void adapters.speechOut.say(line);
      return;
    }

    // §8.1: "one photo per session, not per trial" — the NEXT round reuses
    // the same crop set rather than re-prompting for a capture. Only the
    // pre-capture 'idle' screen (before crops exist) shows the capture
    // button; every round after the first flows straight back into
    // 'searching'.
    //
    // startQuest, not startTrialWith: this is a NEW ROUND, so it needs a
    // fresh quest. Reusing the finished one leaves a completed collection
    // on screen -- the tray reading "4 of 4" and the brief still naming
    // last round's groups, while the object actually being asked for came
    // from somewhere else entirely.
    startQuest(crops);
  }

  /** §7.7: "Return: always to a task one level easier than the one that
   * triggered it." A one-round-only override — does NOT persist as the
   * child's new level (see startTrialWith's `effectiveLevel` param).
   *
   * A break ENDS the current round rather than resuming it. Dropping a
   * level mid-collection has no coherent meaning -- the collection was
   * built for the harder level and half of it is already in the child's
   * hands -- so the honest reading of "return to a task one level easier"
   * is a fresh, easier task. */
  function handleMovementBreakDone() {
    const easierLevel = Math.max(1, level - 1) as Game1Level;
    startQuest(crops, easierLevel);
  }

  if (phase === 'sessionEnded') {
    return (
      <div className="screen">
        {!showCaregiverRecap ? (
          <>
            <p style={{ fontSize: '1.2rem' }}>
              {sessionEndResult && childFacingHandoffLine(profile, sessionEndResult.handoffObjectName)}
            </p>
            <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
              Session over ({sessionEndResult?.reason}). No play-again button —
              this is deliberate (F.013).
            </p>
            <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => setShowCaregiverRecap(true)}>
              Caregiver recap
            </button>
          </>
        ) : (
          sessionEndResult && (
            <>
              <h3>Session recap</h3>
              {/* The room they actually played in, with everything the app
                  found marked in place. Only ever rendered from a real
                  capture — with fixtures or the fallback set there is no
                  scene, and a map over someone else's room would be a lie. */}
              {scene && (
                <>
                  <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: 4 }}>
                    Everything we found in your room:
                  </p>
                  <RoomMap scene={scene} crops={crops} />
                  <ObjectLegend crops={crops} />
                </>
              )}
              <p>{describeSessionRecap(sessionEndResult.session)}</p>
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                Objects recognised: {distinctSkillsThisSession(sessionEndResult.session).join(', ') || 'none'}
              </p>
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                Offline suggestion: {childFacingHandoffLine(profile, sessionEndResult.handoffObjectName)}
              </p>
              <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                This is an activity log, not a clinical assessment.
              </p>
            </>
          )
        )}
      </div>
    );
  }

  if (phase === 'idle') {
    const capSeconds = sessionNumber ? sessionCapSeconds(sessionNumber) : null;
    return (
      <div className="screen" style={accentStyle}>
        <style>{GAME1_STYLES + PANORAMA_STYLES}</style>
        <h2>Find It In Your World</h2>
        {sessionNumber && capSeconds && (
          <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
            Session {sessionNumber} — cap {Math.round(capSeconds / 60)}min, elapsed{' '}
            {elapsedSeconds}s
          </p>
        )}
        {captureNotice === 'blur-failed' && (
          <p style={{ fontSize: '0.85rem', color: '#a33' }}>
            That photo couldn't be processed — let's try again.
          </p>
        )}
        {lastLoggedTier && (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            Last logged support tier: {lastLoggedTier} (
            {SUPPORT_TIERS.find((t) => t.tier === lastLoggedTier)?.name})
          </p>
        )}
        {fadingSuggestion && (
          <p style={{ fontSize: '0.8rem', background: '#eef', padding: 8, borderRadius: 8 }}>
            {fadingSuggestion.message}
          </p>
        )}
        {/* F.012: caregiver-set difficulty level, persisted per child
            (game1Level.ts). Deliberately no auto-advancement — see that
            file's header for why. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Level:</span>
          {([1, 2, 3, 4, 5] as const).map((l) => (
            <button
              key={l}
              className={l === level ? 'g1-btn-accent' : undefined}
              style={{
                minWidth: 44,
                minHeight: 44,
                fontWeight: l === level ? 'bold' : 'normal',
                border: l === level ? undefined : '1px solid #ccc',
              }}
              onClick={() => void handleLevelChange(l)}
            >
              {l}
            </button>
          ))}
        </div>
        {/* THREE WALLS, not one photo (games/game1/walls.ts). The
            caregiver stands in one spot and shoots left, ahead, right --
            only the part of the room they want the child moving around
            in. Any one wall is enough to start; three just gives more to
            turn towards. */}
        <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '4px 0 0' }}>
          Photograph the sides of the room you want to use:
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {WALLS.map((wall) => {
            const shot = captures.find((c) => c.wall === wall);
            return (
              <button
                key={wall}
                className={shot ? undefined : 'g1-btn-accent'}
                style={{
                  minWidth: 96,
                  minHeight: 96,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  border: shot ? '1px solid #bbb' : undefined,
                }}
                onClick={() => void handleCapturePress(wall)}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{WALL_SHORT[wall]}</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.75 }}>
                  {shot ? `${shot.crops.length} found — retake` : 'add photo'}
                </span>
              </button>
            );
          })}
        </div>
        {captures.length > 0 && (
          <button
            className="g1-btn-accent"
            style={{ minWidth: 88, minHeight: 88 }}
            disabled={!canStart(captures)}
            onClick={() => startQuest(cropsOf(placed))}
          >
            {canStart(captures) ? "Let’s play!" : 'Nothing found yet — try another photo'}
          </button>
        )}
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => void handleEndSession('caregiver')}>
          End session
        </button>
      </div>
    );
  }

  if (phase === 'capturing') {
    // §11: "Slow (>4s) → calm progress state showing the parent's own
    // photo, never a spinner over blank." We deliberately do NOT thread
    // the raw pre-redaction photo out of the pipeline module just to show
    // it here (see myWorldPipeline.ts's module doc on why the raw bitmap
    // never leaves it) — a calm, generic waiting state substitutes for it.
    // A real "show their own (already-redacted) photo while waiting" is a
    // reasonable enhancement but was not built for Tier 0; see PERSON-2's
    // final report.
    return (
      <div className="screen" style={accentStyle}>
        <style>{GAME1_STYLES + PANORAMA_STYLES}</style>
        <p style={{ fontSize: '1rem', opacity: 0.8 }}>
          {slowCapture ? 'Still looking...' : 'Looking...'}
          {activeWall !== null && ` (${WALL_SHORT[activeWall].toLowerCase()})`}
        </p>
      </div>
    );
  }

  if (phase === 'foundObjects') {
    // CAREGIVER-facing (same audience as 'idle'/'capturing'/'searching' —
    // text is fine here, the zero-text rule is the CHILD's two phases
    // only). This is the actual proof-of-detection moment: every crop
    // shown here is a real cutout the vision call just returned from THIS
    // room's photo, with the name/colour/category it tagged — not a
    // fixture, not the generic fallback set (see handleCapturePress: this
    // phase is only reached on a real 'success' outcome).
    return (
      <div className="screen" style={accentStyle}>
        <style>{GAME1_STYLES + PANORAMA_STYLES}</style>
        <h2>Found in your room!</h2>
        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          {crops.length} object{crops.length === 1 ? '' : 's'} across{' '}
          {captures.length} side{captures.length === 1 ? '' : 's'} of the room:
        </p>
        {/* The joined room. Object NAMES stay in the legend underneath --
            nothing is captioned onto a photo, where it would cover the
            very objects it describes. Wall direction is carried by
            position: the left wall is the panel on the left. */}
        <RoomPanorama placed={placed} captures={captures} />
        <ObjectLegend crops={crops} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {WALLS.some((w) => !captures.find((c) => c.wall === w)) && (
            <button style={{ minHeight: 56 }} onClick={() => setPhase('idle')}>
              Add another side
            </button>
          )}
          <button
            className="g1-btn-accent"
            style={{ minWidth: 88, minHeight: 88 }}
            onClick={() => startQuest(cropsOf(placed))}
          >
            Let&rsquo;s play!
          </button>
        </div>
      </div>
    );
  }

  const suggestedTierInfo =
    SUPPORT_TIERS.find((t) => t.tier === DEFAULT_STARTING_SUPPORT_TIER) ?? SUPPORT_TIERS[0];

  return (
    <div className="screen" style={accentStyle}>
      <style>{GAME1_STYLES + PANORAMA_STYLES}</style>

      {phase === 'searching' && (
        <>
          {companionHuntActive ? (
            <p>
              Caregiver view: help them find {profile.context.companion?.name ?? 'their Companion'}!
            </p>
          ) : (
            <>
              <p>
                Caregiver view: find {target && targetDescriptionForLevel(level, target)} —{' '}
                {searchScopeLabelForLevel(level)}. (Level {level})
                {target && directionFor(placed, target.id) && (
                  <>
                    {' '}
                    <strong>{directionFor(placed, target.id)}.</strong>
                  </>
                )}
              </p>
              {/* The whole round, stated once, so the caregiver knows what
                  they are steering towards before the first trip. */}
              {quest && quest.kind !== 'fetch' && (
                <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>{questBrief(quest)}</p>
              )}
              {/* WHAT ARRIVED IS SHOWN AS A TRAY, NOT AS A NUMERAL.
                  A pre-literate child cannot read "3 of 5" -- that is
                  reading, not counting. So what has arrived is shown as a
                  row that gets longer, the same way the tower game shows
                  quantity. The digits in the caption are for the grown-up,
                  who is the only person reading this half of the screen. */}
              {quest && quest.kind !== 'fetch' && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(0,0,0,.05)',
                      minHeight: 56,
                    }}
                  >
                    {quest.members.map((m) => {
                      const here = broughtIds.has(m.id);
                      return (
                        <div
                          key={m.id}
                          title={`${m.colour} ${m.name}`}
                          style={{
                            width: 40,
                            height: 40,
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: 10,
                            padding: 3,
                            background: here ? 'rgba(255,255,255,.95)' : 'transparent',
                            border: here ? '2px solid var(--g1-accent, #5b52e8)' : '2px dashed rgba(0,0,0,.18)',
                            opacity: here ? 1 : 0.4,
                          }}
                        >
                          <ObjectIcon name={m.name} category={m.category} size={30} />
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: '6px 0 0' }}>
                    {broughtIds.size} of {quest.members.length} brought so far
                  </p>
                </div>
              )}
              {/* Where everything is, so the caregiver can gesture
                  towards it instead of describing it. F.009's gesture
                  tier is unusable without this. */}
              {placed.length > 0 && (
                <RoomPanorama
                  placed={placed}
                  captures={captures}
                  wantedIds={target ? new Set([target.id]) : undefined}
                  doneIds={broughtIds}
                />
              )}
            </>
          )}
          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            Support tier {suggestedTierInfo.tier} — {suggestedTierInfo.name}:{' '}
            {suggestedTierInfo.instruction}
          </p>
          {/* Guidance, not an error (§11): the game still runs, and the tone
              stays matter-of-fact. It just says out loud that these are
              stand-in objects, which is the one thing the caregiver cannot
              work out on their own. */}
          {fallbackReason && (
            <p
              style={{
                fontSize: '0.78rem',
                background: 'var(--color-accent-soft, #fff1e3)',
                padding: '8px 10px',
                borderRadius: 8,
                lineHeight: 1.45,
              }}
            >
              {fallbackReason === 'no-photo'
                ? 'No photo was chosen, so these are stand-in objects rather than things from your room.'
                : fallbackReason === 'failed'
                  ? "We couldn't read that photo just now — these are stand-in objects. The photo was probably fine; it's worth another go."
                  : 'Nothing in that photo was something your child could safely go and fetch, so these are stand-in objects.'}{' '}
              <button
                type="button"
                onClick={() => {
                  setFallbackReason(null);
                  setPhase('idle');
                }}
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  padding: '2px 8px',
                  fontSize: '0.78rem',
                  border: '1px solid rgba(33,31,46,0.25)',
                  borderRadius: 6,
                  background: 'transparent',
                  boxShadow: 'none',
                }}
              >
                Try another photo
              </button>
            </p>
          )}
          {fadingSuggestion && (
            <p style={{ fontSize: '0.75rem', background: '#eef', padding: 6, borderRadius: 6 }}>
              {fadingSuggestion.message}
            </p>
          )}
          {/* §8.1: Companion hunt reserved for the session's final trial —
              caregiver-triggered, see startCompanionHuntTrial's header for
              why. Hidden with no Companion set (§6.3 review checklist). */}
          {!companionHuntActive && hasCompanion(profile) && (
            <button
              style={{ minWidth: 88, minHeight: 88, fontSize: '0.8rem' }}
              onClick={startCompanionHuntTrial}
            >
              Make this a {profile.context.companion?.name} hunt!
            </button>
          )}
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={handleTheyBroughtIt}>
            They brought it
          </button>
        </>
      )}

      {phase === 'confirming' && (
        // CHILD-FACING. Zero text below this line — photos/swatches and
        // audio only. Escalation per §7.7: tier 1 fades the wrong crop and
        // makes it dead; tier 2 highlights the target and dims the rest;
        // tier 3 makes only the target tappable (bounce + disabled
        // distractors), so the child literally cannot fail from here.
        <div className="g1-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {confirmGrid.map((crop) => {
            const isTarget = crop.id === target?.id;
            return (
              <CropButton
                key={crop.id}
                crop={crop}
                dead={deadCropIds.has(crop.id)}
                dimmed={promptTier >= 2 && !isTarget}
                isTargetHighlighted={promptTier === 2 && isTarget}
                isTargetBouncing={promptTier >= 3 && isTarget}
                disabled={promptTier >= 3 && !isTarget}
                celebrating={false}
                onTap={() => handleTap(crop)}
              />
            );
          })}
        </div>
      )}

      {phase === 'celebrating' && (companionHuntActive || target) && (
        // CHILD-FACING. The object (or, for a Companion hunt, the
        // Companion's own photo) IS the reward (§7.7) — no confetti, no
        // stars, no text. §8.1 "Reward: their photo appears on success,
        // framed in {fav_colour}" — reward frame colour applies to both
        // paths. §6.3: the Companion is DELIGHTED here — this is its one
        // celebratory state; there is no corresponding "sad" render
        // anywhere in this file for a wrong tap (§7.7's wrong-tap handling
        // is silence + fade only, never a Companion reaction).
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 40,
            position: 'relative',
          }}
        >
          <div
            style={
              rewardFrameColour(profile)
                ? {
                    padding: 8,
                    borderRadius: 20,
                    border: `4px solid ${rewardFrameColour(profile)}`,
                  }
                : undefined
            }
          >
            {companionHuntActive ? (
              <div
                aria-label={profile.context.companion?.name}
                className="g1-crop g1-crop--celebrating"
                style={{
                  minWidth: 88,
                  minHeight: 88,
                  borderRadius: 16,
                  backgroundImage: `url(${profile.context.companion?.photo})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ) : (
              target && (
                <CropButton
                  crop={target}
                  dead={false}
                  dimmed={false}
                  isTargetHighlighted={false}
                  isTargetBouncing={false}
                  disabled
                  celebrating
                  onTap={() => {}}
                />
              )
            )}
          </div>
          {/* Small delighted Companion cameo on a normal (non-hunt)
              celebration — §8.0/§18's "profile-swap demo moment": this
              cameo, the audio greeting, the hunt button, and the helper
              framing are ALL driven by the same profile.context.companion
              read, so changing the Companion in settings changes every one
              of them with no branching code here. */}
          {!companionHuntActive && hasCompanion(profile) && (
            <div
              aria-label={profile.context.companion?.name}
              style={{
                position: 'absolute',
                bottom: -8,
                right: 'calc(50% - 70px)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '3px solid #fff',
                boxShadow: '0 0 0 2px rgba(0,0,0,0.15)',
                backgroundImage: `url(${profile.context.companion?.photo})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}
        </div>
      )}

      {phase === 'reportingSupport' && (
        <>
          <p>How much support did they actually need?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUPPORT_TIERS.map((info) => (
              <button
                key={info.tier}
                style={{ minWidth: 88, minHeight: 88, textAlign: 'left' }}
                onClick={() => void handleSupportTierReport(info.tier)}
              >
                {info.tier}. {info.name} — {info.instruction}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'movementBreak' && (
        // §7.7 "Movement breaks": audio + a simple icon, no scoring, no
        // counting the child's actual movements. Caregiver taps to
        // continue when ready — no timer forcing the pace.
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 40 }}>
          <p style={{ fontSize: '2rem' }}>🤸</p>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={handleMovementBreakDone}>
            Ready to keep going
          </button>
        </div>
      )}
    </div>
  );
}
