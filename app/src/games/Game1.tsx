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

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { getGame1Level, setGame1Level, type Game1Level } from './game1Level';
import {
  applyProfileTuning,
  buildConfirmationGrid,
  buildSearchPromptTemplate,
  searchScopeLabelForLevel,
  shuffleGrid,
  targetDescriptionForLevel,
} from './game1Difficulty';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase =
  | 'idle'
  | 'capturing'
  | 'searching'
  | 'confirming'
  | 'celebrating'
  | 'reportingSupport'
  | 'movementBreak'
  | 'sessionEnded';

interface Game1Props {
  profile: ChildProfile;
}

/** Loose common-colour-word → CSS colour mapping for the swatch fallback
 * shown when a crop has no `image` (the generic fallback set, or a real
 * crop whose image failed to load) — zero text either way, just a plain
 * colour that stands in for the object until a real photo exists. */
function swatchColour(colour: string): string {
  const known = new Set([
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'grey', 'gray', 'gold', 'silver', 'teal', 'cyan',
  ]);
  return known.has(colour.toLowerCase()) ? colour.toLowerCase() : '#ccc';
}

/** One button rendering a crop in the child-facing grid. Zero text (§7.7,
 * §13) — a photo if we have one, otherwise a plain colour swatch. Visual
 * state (dead / dimmed / target-highlighted) is driven entirely by CSS
 * classes so the prompt-hierarchy escalation (F.009) has somewhere to
 * land without any of it being a string the child would need to read. */
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

  return (
    <button
      type="button"
      className={classNames}
      aria-label={crop.name}
      disabled={dead || disabled}
      onClick={onTap}
      style={{
        minWidth: 88,
        minHeight: 88,
        borderRadius: 16,
        border: 'none',
        backgroundColor: swatchColour(crop.colour),
        backgroundImage: crop.image ? `url(${crop.image})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
}

/** Local styles for the escalation/celebration animations — plain CSS,
 * injected once. No component library in this repo yet, and these three
 * keyframes don't warrant one. */
const GAME1_STYLES = `
@keyframes g1-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(90,150,255,0.6); } 50% { box-shadow: 0 0 0 10px rgba(90,150,255,0); } }
@keyframes g1-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes g1-celebrate { 0% { transform: scale(1); } 100% { transform: scale(1.6); } }
.g1-crop { transition: opacity 200ms ease; opacity: 1; }
.g1-crop--dead { opacity: 0.4; }
.g1-crop--dimmed { opacity: 0.6; }
.g1-crop--highlighted { animation: g1-pulse 1.2s ease-in-out infinite; }
.g1-crop--bouncing { animation: g1-bounce 0.6s ease-in-out infinite; }
.g1-crop--celebrating { animation: g1-celebrate 800ms ease-out forwards; z-index: 1; position: relative; }
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

export function Game1({ profile }: Game1Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [confirmGrid, setConfirmGrid] = useState<TaggedCrop[]>([]);
  const [promptTier, setPromptTier] = useState<PromptTier>(0);
  const [deadCropIds, setDeadCropIds] = useState<Set<string>>(new Set());
  const [captureNotice, setCaptureNotice] = useState<'blur-failed' | null>(null);
  const [slowCapture, setSlowCapture] = useState(false);
  const [level, setLevel] = useState<Game1Level>(1);

  // §8.1 "Profile tuning": derived once from the four response-profile
  // dimensions, never a condition (ARCHITECTURE-RULES.md §5.2). Recomputed
  // only if the profile object itself changes, not per trial.
  const tuning = applyProfileTuning(profile);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [lastLoggedTier, setLastLoggedTier] = useState<SupportTier | null>(null);
  const [fadingSuggestion, setFadingSuggestion] = useState<FadingSuggestion | null>(null);
  const [sessionEndResult, setSessionEndResult] = useState<SessionEndResult | null>(null);
  const [showCaregiverRecap, setShowCaregiverRecap] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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
    })();
  }, [profile.id]);

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
  function startTrialWith(pool: TaggedCrop[], effectiveLevel: Game1Level = level) {
    const picked = pickNextTarget(pool, lastTargetIdRef.current);
    lastTargetIdRef.current = picked.id;
    setTarget(picked);
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

    const template = buildSearchPromptTemplate(effectiveLevel, picked, tuning);
    const line = renderLine(template, slotValuesFromProfile(profile), profile.context);
    void adapters.speechOut.say(line);
  }

  async function handleCapturePress() {
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
    // activity set, never an error shown.
    const nextCrops = outcome.kind === 'success' ? outcome.crops : GENERIC_FALLBACK_CROPS;
    setCrops(nextCrops);
    startTrialWith(nextCrops);
  }

  function handleTheyBroughtIt() {
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
      // §8.1 lively/short-attention tuning: "faster celebration".
      setTimeout(() => setPhase('reportingSupport'), tuning.fasterCelebration ? 400 : 800);
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
    if (!sessionId || !target) return;
    await logActivityOutcome({
      sessionId,
      skillId: `find-${target.category}`,
      context: 'living-room', // TODO(context selection is outside F.008 — see F.007/onboarding)
      supportTier: tier,
      onScreenTier: machineRef.current.currentTier,
    });
    setLastLoggedTier(tier);
    const suggestion = await getFadingSuggestion(
      profile.id,
      `find-${target.category}`,
      tier,
      profile.nickname ?? 'they',
    );
    setFadingSuggestion(suggestion);

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

    // §8.1: "one photo per session, not per trial" — the NEXT trial reuses
    // the same crop set rather than re-prompting for a capture. Only the
    // pre-capture 'idle' screen (before crops exist) shows the capture
    // button; every trial after the first flows straight back into
    // 'searching'.
    startTrialWith(crops);
  }

  /** §7.7: "Return: always to a task one level easier than the one that
   * triggered it." A one-trial-only override — does NOT persist as the
   * child's new level (see startTrialWith's `effectiveLevel` param). */
  function handleMovementBreakDone() {
    const easierLevel = Math.max(1, level - 1) as Game1Level;
    startTrialWith(crops, easierLevel);
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
      <div className="screen">
        <style>{GAME1_STYLES}</style>
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
          {([1, 2, 3, 4] as const).map((l) => (
            <button
              key={l}
              style={{
                minWidth: 44,
                minHeight: 44,
                fontWeight: l === level ? 'bold' : 'normal',
                border: l === level ? '2px solid #557' : '1px solid #ccc',
              }}
              onClick={() => void handleLevelChange(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => void handleCapturePress()}>
          Take a photo of the room
        </button>
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
      <div className="screen">
        <style>{GAME1_STYLES}</style>
        <p style={{ fontSize: '1rem', opacity: 0.8 }}>
          {slowCapture ? "Still looking around the room..." : 'Looking around the room...'}
        </p>
      </div>
    );
  }

  const suggestedTierInfo =
    SUPPORT_TIERS.find((t) => t.tier === DEFAULT_STARTING_SUPPORT_TIER) ?? SUPPORT_TIERS[0];

  return (
    <div className="screen">
      <style>{GAME1_STYLES}</style>

      {phase === 'searching' && (
        <>
          <p>
            Caregiver view: find {target && targetDescriptionForLevel(level, target)} —{' '}
            {searchScopeLabelForLevel(level)}. (Level {level})
          </p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            Support tier {suggestedTierInfo.tier} — {suggestedTierInfo.name}:{' '}
            {suggestedTierInfo.instruction}
          </p>
          {fadingSuggestion && (
            <p style={{ fontSize: '0.75rem', background: '#eef', padding: 6, borderRadius: 6 }}>
              {fadingSuggestion.message}
            </p>
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

      {phase === 'celebrating' && target && (
        // CHILD-FACING. The object IS the reward (§7.7) — no confetti, no
        // stars, no text. Just their own crop, scaled up.
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
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
