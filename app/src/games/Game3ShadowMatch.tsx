// Game 3, Mode A — Shadow Match (F.021). §8.3.
//
// A thin layer on Person 1's engine, exactly like Game1.tsx: session
// lifecycle, the interaction state machine, support-tier logging and
// fading are all reused unchanged. This file owns only what §12.2 says a
// game may own: what skill it targets (visual discrimination — matching
// an object from progressively less information), what interaction shape
// it uses (silhouette-at-top, photos-below, tap to match — or, at Level 4,
// Game 1's own fetch-and-confirm shape), and how it renders a step.
//
// Reuses F.006's capture pipeline and F.008's game1Trial.ts target
// picker directly — "the cheapest second game because it reuses every
// crop and the whole engine" (F.021.md).

import { useEffect, useRef, useState, useCallback } from 'react';
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
import { pickNextTarget } from './game1Trial';
import { getGame3Level, setGame3Level, type Game3Level } from './game3Level';
import {
  ALTERED_SAMPLE_FILTER,
  ALTERED_SAMPLE_TRANSFORM,
  buildLevel1Pool,
  buildShadowMatchOptions,
  requiresFetchingTheRealObject,
  sampleKindForLevel,
  type SampleKind,
} from './game3ShadowMatchLogic';
import { generateSilhouetteDataUrl } from './silhouetteCanvas';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase =
  | 'idle'
  | 'capturing'
  | 'presenting' // levels 1-3: sample + options, one tap resolves
  | 'searching' // level 4 only: child leaves to fetch the real object
  | 'confirming' // level 4 only: small grid, mirrors Game 1
  | 'celebrating'
  | 'reportingSupport'
  | 'sessionEnded';

interface Game3ShadowMatchProps {
  profile: ChildProfile;
  /** Same contract as Game1's onChildFacingChange: fires whenever the
   * screen crosses into or out of a CHILD-FACING phase, so the shell can
   * hide its own text chrome instead of leaving it visible during the
   * zero-text phases this file already enforces internally. */
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

const GAME3_STYLES = `
@keyframes g3-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(90,150,255,0.6); } 50% { box-shadow: 0 0 0 10px rgba(90,150,255,0); } }
@keyframes g3-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes g3-celebrate { 0% { transform: scale(1); } 100% { transform: scale(1.6); } }
@keyframes g3-dissolve { 0% { opacity: 1; } 100% { opacity: 0; } }
.g3-crop { transition: opacity 200ms ease; opacity: 1; border: none; border-radius: 16px; background-size: cover; background-position: center; }
.g3-crop--dead { opacity: 0.4; }
.g3-crop--dimmed { opacity: 0.6; }
.g3-crop--highlighted { animation: g3-pulse 1.2s ease-in-out infinite; }
.g3-crop--bouncing { animation: g3-bounce 0.6s ease-in-out infinite; }
.g3-crop--celebrating { animation: g3-celebrate 800ms ease-out forwards; position: relative; z-index: 1; }
/* §8.3 reward: "the silhouette dissolves into the real photo of their
   object" — the sample layer sits on top of the real photo and fades its
   own opacity to 0, revealing the photo underneath. */
.g3-dissolve-top { animation: g3-dissolve 900ms ease-in forwards; }
.g3-more { background: #eef; display: flex; align-items: center; justify-content: center; }
`;

/** §4.3's own table: "Grid → Sequential reveal" is the PHONE pattern
 * assigned specifically to "Game 3 options" (its "Defaults" line spells
 * this out by game) — a DIFFERENT pattern from Game 1's "Grid → Carousel"
 * for its confirmation grid. Reusing Game1's horizontal-scroll carousel
 * here (an earlier version of this file did, via the same CSS trick) would
 * satisfy neither: same layout pattern on both games' phones,
 * contradicting the guide's own per-game table. This is genuinely
 * interactive (which 2 options are visible, advancing on "show me more"),
 * so it needs JS state, not just a CSS breakpoint. */
const PHONE_REVEAL_BATCH = 2;
const PHONE_BREAKPOINT_QUERY = '(max-width: 600px)';

/** §8.3 Level 2: simulates "different angle or lighting" over the SAME
 * crop image via CSS transform + filter — see game3ShadowMatchLogic.ts's
 * ALTERED_SAMPLE_FILTER/TRANSFORM header for why there's no second real
 * photo to show instead. Returns plain inline-style values; identity
 * (no-op) for every other sample kind. */
function sampleVisualStyle(kind: SampleKind): { filter?: string; transform?: string } {
  if (kind === 'altered') {
    return { filter: ALTERED_SAMPLE_FILTER, transform: ALTERED_SAMPLE_TRANSFORM };
  }
  return {};
}

function OptionButton({
  crop,
  onTap,
  dead,
  dimmed,
  highlighted,
  bouncing,
  disabled,
  celebrating,
}: {
  crop: TaggedCrop;
  onTap: () => void;
  dead: boolean;
  dimmed: boolean;
  highlighted: boolean;
  bouncing: boolean;
  disabled: boolean;
  celebrating: boolean;
}) {
  const classNames = [
    'g3-crop',
    dead && 'g3-crop--dead',
    dimmed && !dead && 'g3-crop--dimmed',
    highlighted && 'g3-crop--highlighted',
    bouncing && 'g3-crop--bouncing',
    celebrating && 'g3-crop--celebrating',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classNames}
      aria-label={crop.name}
      disabled={dead || disabled}
      onClick={onTap}
      style={{ minWidth: 88, minHeight: 88, backgroundImage: crop.image ? `url(${crop.image})` : undefined, backgroundColor: '#ccc' }}
    />
  );
}

export function Game3ShadowMatch({ profile, onChildFacingChange }: Game3ShadowMatchProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [level, setLevel] = useState<Game3Level>(1);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [sampleImage, setSampleImage] = useState<string>('');
  const [sampleLoading, setSampleLoading] = useState(false);
  // §8.3 Level 2: "same object, different angle or lighting" — the sample
  // IMAGE itself never changes (see game3ShadowMatchLogic.ts's
  // ALTERED_SAMPLE_FILTER/TRANSFORM header for why there's no second photo
  // to show), but the sample KIND drives whether that simulated-angle
  // style is applied when rendering it below.
  const [sampleKind, setSampleKind] = useState<SampleKind>('identical');
  const [options, setOptions] = useState<TaggedCrop[]>([]);
  // §4.3 phone pattern for Game 3: "Grid → Sequential reveal ... 2 at a
  // time, 'show me more' between." isPhoneViewport mirrors the SAME
  // 600px breakpoint Game1.tsx's CSS media query uses, kept in sync via
  // matchMedia below since this needs to drive JS (how many options are
  // sliced into view), not just a stylesheet rule.
  const [isPhoneViewport, setIsPhoneViewport] = useState(false);
  const [revealedCount, setRevealedCount] = useState(PHONE_REVEAL_BATCH);
  const [promptTier, setPromptTier] = useState<PromptTier>(0);
  const [deadIds, setDeadIds] = useState<Set<string>>(new Set());
  const [captureNotice, setCaptureNotice] = useState<'blur-failed' | null>(null);
  const [slowCapture, setSlowCapture] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [lastLoggedTier, setLastLoggedTier] = useState<SupportTier | null>(null);
  const [fadingSuggestion, setFadingSuggestion] = useState<FadingSuggestion | null>(null);
  const [sessionEndResult, setSessionEndResult] = useState<SessionEndResult | null>(null);
  const [showCaregiverRecap, setShowCaregiverRecap] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const machineRef = useRef<InteractionMachine>(new InteractionMachine());
  const sessionStartedAtRef = useRef<number>(0);
  const lastObjectNameRef = useRef<string | null>(null);
  const lastTargetIdRef = useRef<string | null>(null);

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
    onChildFacingChange?.(
      phase === 'presenting' || phase === 'confirming' || phase === 'celebrating',
    );
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  useEffect(() => {
    void (async () => {
      const [session, number, savedLevel] = await Promise.all([
        startSession(profile.id),
        getSessionNumber(profile.id),
        getGame3Level(profile.id),
      ]);
      setSessionId(session.id);
      setSessionNumber(number);
      setLevel(savedLevel);
      sessionStartedAtRef.current = Date.now();
    })();
  }, [profile.id]);

  useEffect(() => {
    if (!sessionId || sessionNumber === null || phase === 'sessionEnded') return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - sessionStartedAtRef.current) / 1000));
      const tick = machineRef.current.tick(now);
      if (phase === 'presenting' || phase === 'searching' || phase === 'confirming') {
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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(PHONE_BREAKPOINT_QUERY);
    const sync = () => setIsPhoneViewport(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  /** Sets a fresh options grid AND resets the phone sequential-reveal
   * window back to the first PHONE_REVEAL_BATCH — otherwise a later trial
   * with fewer options, or a phone rotated mid-session (locked out by
   * §4.3, but defensive anyway), could leave a stale revealedCount. */
  function setOptionsForNewTrial(next: TaggedCrop[]) {
    setOptions(next);
    setRevealedCount(PHONE_REVEAL_BATCH);
  }

  function revealMoreOptions() {
    setRevealedCount((count) => Math.min(options.length, count + PHONE_REVEAL_BATCH));
  }

  async function handleLevelChange(newLevel: Game3Level) {
    setLevel(newLevel);
    await setGame3Level(profile.id, newLevel);
  }

  /** Picks this trial's target + pool, per §8.3/F.021's Level 1 rule:
   * "The Companion's silhouette is the Level 1 sample every session." */
  function pickTargetAndPool(pool: TaggedCrop[], effectiveLevel: Game3Level): { target: TaggedCrop; pool: TaggedCrop[] } {
    if (effectiveLevel === 1) {
      const level1 = buildLevel1Pool(profile, pool);
      if (level1) return level1;
      // No Companion set — §6.3's "neutral guide still works" applies:
      // fall through to a normal room-crop target instead of a broken
      // Companion-less Level 1.
    }
    const picked = pickNextTarget(pool, lastTargetIdRef.current);
    return { target: picked, pool };
  }

  async function startTrialWith(pool: TaggedCrop[], effectiveLevel: Game3Level = level) {
    const { target: picked, pool: trialPool } = pickTargetAndPool(pool, effectiveLevel);
    lastTargetIdRef.current = picked.id;
    setTarget(picked);
    setDeadIds(new Set());
    setPromptTier(0);
    machineRef.current.startTrial();

    const kind = sampleKindForLevel(effectiveLevel);
    setSampleKind(kind);
    setSampleLoading(kind === 'silhouette' || kind === 'silhouette-fetch');
    setSampleImage(picked.image);

    if (kind === 'silhouette' || kind === 'silhouette-fetch') {
      try {
        const silhouette = await generateSilhouetteDataUrl(picked.image);
        setSampleImage(silhouette);
      } catch {
        // Silhouette generation is a browser-only Canvas operation and can
        // fail (e.g. a malformed/empty crop image) — fail soft to the
        // identical photo rather than a broken game. Not the §11 "hard
        // stop" cases (those are about faces/privacy); this is cosmetic.
        setSampleImage(picked.image);
      } finally {
        setSampleLoading(false);
      }
    }

    if (requiresFetchingTheRealObject(effectiveLevel)) {
      setPhase('searching');
      void adapters.speechOut.say(
        renderLine('Can you find what {companion} is showing you?', slotValuesFromProfile(profile), profile.context),
      );
      return;
    }

    setOptionsForNewTrial(buildShadowMatchOptions(trialPool, picked));
    setPhase('presenting');
    void adapters.speechOut.say(
      renderLine('Which one matches?', slotValuesFromProfile(profile), profile.context),
    );
  }

  async function handleCapturePress() {
    setPhase('capturing');
    setCaptureNotice(null);
    setSlowCapture(false);
    const outcome = await captureRoomAndRecognize({ onSlow: () => setSlowCapture(true) });

    if (outcome.kind === 'blur-failed') {
      setCaptureNotice('blur-failed');
      setPhase('idle');
      return;
    }
    const nextCrops = outcome.kind === 'success' ? outcome.crops : GENERIC_FALLBACK_CROPS;
    setCrops(nextCrops);
    void startTrialWith(nextCrops);
  }

  function resolveTrial() {
    setPhase('celebrating');
    lastObjectNameRef.current = target?.name ?? null;
    void adapters.speechOut.say(
      renderLine('Your {object.name}!', slotValuesFromProfile(profile, { 'object.name': target?.name ?? '' }), profile.context),
    );
    setTimeout(() => setPhase('reportingSupport'), 800);
  }

  function handleOptionTap(crop: TaggedCrop) {
    const outcome = machineRef.current.recordAttempt(crop.id === target?.id);
    if (outcome.resolved) {
      resolveTrial();
      return;
    }
    setDeadIds((prev) => new Set(prev).add(crop.id));
    setPromptTier(outcome.tier);
  }

  function handleTheyBroughtIt() {
    // Level 4 hands into Game 1's own shape: a small confirmation grid,
    // built the same way (target + a couple of distractors) as levels
    // 1-3's options grid — the point is it's the SAME interaction, not a
    // new one.
    setOptionsForNewTrial(buildShadowMatchOptions(crops, target ?? crops[0]));
    setPhase('confirming');
    void adapters.speechOut.say('Show me — which one did you bring?');
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId || !target) return;
    const skillId = `shadow-match-${target.category || 'companion'}`;
    await logActivityOutcome({
      sessionId,
      skillId,
      context: 'living-room',
      supportTier: tier,
      onScreenTier: machineRef.current.currentTier,
    });
    setLastLoggedTier(tier);
    const suggestion = await getFadingSuggestion(profile.id, skillId, tier, profile.nickname ?? 'they');
    setFadingSuggestion(suggestion);
    void startTrialWith(crops);
  }

  if (phase === 'sessionEnded') {
    return (
      <div className="screen">
        {!showCaregiverRecap ? (
          <>
            <p style={{ fontSize: '1.2rem' }}>
              {sessionEndResult && childFacingHandoffLine(profile, sessionEndResult.handoffObjectName)}
            </p>
            <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => setShowCaregiverRecap(true)}>
              Caregiver recap
            </button>
          </>
        ) : (
          sessionEndResult && (
            <>
              <h3>Session recap</h3>
              <p>{describeSessionRecap(sessionEndResult.session)}</p>
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                Objects recognised: {distinctSkillsThisSession(sessionEndResult.session).join(', ') || 'none'}
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
      <div className="screen">
        <style>{GAME3_STYLES}</style>
        <h2>Shadow Match</h2>
        {sessionNumber && capSeconds && (
          <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
            Session {sessionNumber} — cap {Math.round(capSeconds / 60)}min, elapsed {elapsedSeconds}s
          </p>
        )}
        {captureNotice === 'blur-failed' && (
          <p style={{ fontSize: '0.85rem', color: '#a33' }}>That photo couldn't be processed — let's try again.</p>
        )}
        {lastLoggedTier && (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            Last logged support tier: {lastLoggedTier} ({SUPPORT_TIERS.find((t) => t.tier === lastLoggedTier)?.name})
          </p>
        )}
        {fadingSuggestion && (
          <p style={{ fontSize: '0.8rem', background: '#eef', padding: 8, borderRadius: 8 }}>{fadingSuggestion.message}</p>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Level:</span>
          {([1, 2, 3, 4] as const).map((l) => (
            <button
              key={l}
              style={{ minWidth: 44, minHeight: 44, fontWeight: l === level ? 'bold' : 'normal', border: l === level ? '2px solid #557' : '1px solid #ccc' }}
              onClick={() => void handleLevelChange(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => void handleCapturePress()}>
          Choose a photo of the room
        </button>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => void handleEndSession('caregiver')}>
          End session
        </button>
      </div>
    );
  }

  if (phase === 'capturing') {
    return (
      <div className="screen">
        <style>{GAME3_STYLES}</style>
        <p style={{ fontSize: '1rem', opacity: 0.8 }}>{slowCapture ? 'Still looking around the room...' : 'Looking around the room...'}</p>
      </div>
    );
  }

  const suggestedTierInfo = SUPPORT_TIERS.find((t) => t.tier === DEFAULT_STARTING_SUPPORT_TIER) ?? SUPPORT_TIERS[0];

  /** Shared by the 'presenting' (levels 1-3) and 'confirming' (level 4)
   * screens — both are the same tap-to-match interaction shape over
   * `options`, just with a different target. §4.3: on a phone, Game 3's
   * assigned pattern is "Grid → Sequential reveal ... 2 at a time, 'show
   * me more' between" — NOT the horizontal-scroll carousel Game 1 uses for
   * ITS confirmation grid (a different row of the same table). On a
   * tablet-width viewport every option renders at once, same as before. */
  function renderOptionsGrid() {
    const visible = isPhoneViewport ? options.slice(0, revealedCount) : options;
    const hasMore = isPhoneViewport && revealedCount < options.length;
    return (
      <div className="g3-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {visible.map((crop) => {
          const isTarget = crop.id === target?.id;
          return (
            <OptionButton
              key={crop.id}
              crop={crop}
              dead={deadIds.has(crop.id)}
              dimmed={promptTier >= 2 && !isTarget}
              highlighted={promptTier === 2 && isTarget}
              bouncing={promptTier >= 3 && isTarget}
              disabled={promptTier >= 3 && !isTarget}
              celebrating={false}
              onTap={() => handleOptionTap(crop)}
            />
          );
        })}
        {hasMore && (
          // CHILD-FACING affordance, zero text (§7.7/§13) — a plain "+"
          // glyph, not a word to read (same spirit as Game1.tsx's plain
          // movement-break emoji). Reveals the next PHONE_REVEAL_BATCH
          // options rather than all remaining at once, keeping "2 at a
          // time" true even with a 3rd/4th option queued.
          <button
            type="button"
            className="g3-crop g3-more"
            aria-label="Show more options"
            style={{ minWidth: 88, minHeight: 88, fontSize: '1.5rem' }}
            onClick={revealMoreOptions}
          >
            <span aria-hidden style={{ color: '#557' }}>+</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <style>{GAME3_STYLES}</style>

      {phase === 'presenting' && (
        // CHILD-FACING (Levels 1-3): sample at top, real photos below,
        // zero text — the sample image itself communicates the prompt.
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div
            aria-hidden
            style={{
              width: 120,
              height: 120,
              borderRadius: 16,
              backgroundColor: '#ddd',
              backgroundImage: sampleImage ? `url(${sampleImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: sampleLoading ? 0.4 : 1,
              ...sampleVisualStyle(sampleKind),
            }}
          />
          {renderOptionsGrid()}
        </div>
      )}

      {phase === 'searching' && (
        <>
          {/* CHILD-FACING cue: the silhouette itself, zero text — this IS
              "the answer not on screen", the shape is the only clue the
              child gets for what to go fetch. That is the entire purpose
              of Level 4 (§8.3). The text/instructions below are the
              separate CAREGIVER-facing half of this same screen. */}
          <div
            aria-hidden
            style={{
              width: 120,
              height: 120,
              borderRadius: 16,
              backgroundColor: '#ddd',
              backgroundImage: sampleImage ? `url(${sampleImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: sampleLoading ? 0.4 : 1,
              margin: '0 auto 16px',
            }}
          />
          <p>Caregiver view: Level 4 — the silhouette only, no options on screen. Support them fetching the real object.</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            Support tier {suggestedTierInfo.tier} — {suggestedTierInfo.name}: {suggestedTierInfo.instruction}
          </p>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={handleTheyBroughtIt}>
            They brought it
          </button>
        </>
      )}

      {phase === 'confirming' && renderOptionsGrid()}

      {phase === 'celebrating' && target && (
        // CHILD-FACING. §8.3: "Reward: the silhouette dissolves into the
        // real photo of their object." Real cross-fade, not a swap: the
        // sample (silhouette at L3/4, the shown photo at L1/2) sits on top
        // of the target's real photo and fades its own opacity to 0 via
        // CSS (.g3-dissolve-top), revealing the photo underneath. At L1/2
        // the sample and the real photo are visually close (or identical),
        // so the dissolve is subtle there and dramatic at L3/4 — exactly
        // where the guide's language is aimed.
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
          <div
            className="g3-crop g3-crop--celebrating"
            style={{ width: 120, height: 120, minWidth: 120, minHeight: 120, position: 'relative' }}
          >
            <div
              aria-label={target.name}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 16,
                backgroundImage: target.image ? `url(${target.image})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#ccc',
              }}
            />
            {sampleImage && (
              <div
                aria-hidden
                className="g3-dissolve-top"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 16,
                  backgroundImage: `url(${sampleImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  ...sampleVisualStyle(sampleKind),
                }}
              />
            )}
          </div>
        </div>
      )}

      {phase === 'reportingSupport' && (
        <>
          <p>How much support did they actually need?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUPPORT_TIERS.map((info) => (
              <button key={info.tier} style={{ minWidth: 88, minHeight: 88, textAlign: 'left' }} onClick={() => void handleSupportTierReport(info.tier)}>
                {info.tier}. {info.name} — {info.instruction}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
