// Game 1 — Find It In Your World. WALKING SKELETON, not the real thing.
//
// Proves the wiring end to end: a real profile (F.001) -> real slot
// rendering through the avoid-filter hook (F.005) -> fixture crops ->
// the interaction state machine (F.009) -> the support ladder + log
// write (F.010) -> fading suggestions (F.011) -> the session cap, idle
// end and off-screen handoff (F.013) -> a persisted SessionLog (F.001).
// F.008 (owned by P2) replaces this with the real loop: real crops from
// F.006, real difficulty levels from F.012.
//
// The session-end state below is deliberately terminal: no "play again"
// button exists anywhere in this file, and once phase is 'sessionEnded'
// there is no path back into 'idle' except a fresh page load. That is
// F.013's fade, not an oversight.

import { useCallback, useEffect, useRef, useState } from 'react';
import { adapters } from '../adapters/registry';
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
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase =
  | 'idle'
  | 'searching'
  | 'confirming'
  | 'celebrating'
  | 'reportingSupport'
  | 'sessionEnded';

interface Game1Props {
  profile: ChildProfile;
}

export function Game1({ profile }: Game1Props) {
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wrongTierNote, setWrongTierNote] = useState<PromptTier | null>(null);
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
      const [session, number] = await Promise.all([
        startSession(profile.id),
        getSessionNumber(profile.id),
      ]);
      setSessionId(session.id);
      setSessionNumber(number);
      sessionStartedAtRef.current = Date.now();
    })();
  }, [profile.id]);

  // The single poller driving both F.009's idle detection and F.013's cap
  // check. Neither has its own internal timer -- both are pure functions
  // of elapsed time, polled from here, matching the design in both files.
  useEffect(() => {
    if (!sessionId || sessionNumber === null || phase === 'sessionEnded') return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - sessionStartedAtRef.current) / 1000));

      const tick = machineRef.current.tick(now);
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

  async function loadRoom() {
    const objects = await adapters.vision.recognizeObjects(
      await adapters.capture.capturePhoto(),
    );
    const picked = objects[Math.floor(Math.random() * objects.length)];
    setCrops(objects);
    setTarget(picked);
    setPhase('searching');
    machineRef.current.startTrial();
    setWrongTierNote(null);
    setFadingSuggestion(null);

    const line = renderLine(
      '{companion} wants something {fav_colour}!',
      slotValuesFromProfile(profile, { fav_colour: picked.colour }),
      profile.context,
    );
    void adapters.speechOut.say(line);
  }

  function handleTheyBroughtIt() {
    setPhase('confirming');
  }

  function handleTap(crop: TaggedCrop) {
    const outcome = machineRef.current.recordAttempt(crop.id === target?.id);
    if (outcome.resolved) {
      setPhase('celebrating');
      lastObjectNameRef.current = crop.name;
      const line = renderLine(
        'Your {object.name}!',
        slotValuesFromProfile(profile, { 'object.name': crop.name }),
        profile.context,
      );
      void adapters.speechOut.say(line);
      setTimeout(() => setPhase('reportingSupport'), 800);
    } else {
      setWrongTierNote(outcome.tier);
    }
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId || !target) return;
    await logActivityOutcome({
      sessionId,
      skillId: `find-${target.category}`,
      context: 'living-room', // TODO(F.008): real context from the capture flow
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
    setPhase('idle');
  }

  if (phase === 'sessionEnded') {
    return (
      <div className="screen">
        {!showCaregiverRecap ? (
          <>
            <p style={{ fontSize: '1.2rem' }}>
              👋 {sessionEndResult && childFacingHandoffLine(profile, sessionEndResult.handoffObjectName)}
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
        <h2>Game 1 — walking skeleton</h2>
        {sessionNumber && capSeconds && (
          <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
            Session {sessionNumber} — cap {Math.round(capSeconds / 60)}min, elapsed{' '}
            {elapsedSeconds}s
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
            💡 {fadingSuggestion.message}
          </p>
        )}
        <button onClick={() => void loadRoom()}>Load room (fixture)</button>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => void handleEndSession('caregiver')}>
          End session
        </button>
      </div>
    );
  }

  const suggestedTierInfo =
    SUPPORT_TIERS.find((t) => t.tier === DEFAULT_STARTING_SUPPORT_TIER) ?? SUPPORT_TIERS[0];

  return (
    <div className="screen">
      {phase === 'searching' && (
        <>
          <p>Caregiver view: find something {target?.colour}.</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            Support tier {suggestedTierInfo.tier} — {suggestedTierInfo.name}:{' '}
            {suggestedTierInfo.instruction}
          </p>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={handleTheyBroughtIt}>
            They brought it
          </button>
        </>
      )}

      {phase === 'confirming' && (
        <>
          <p>Show me — which one did you bring?</p>
          {wrongTierNote !== null && (
            <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
              (prompt tier now {wrongTierNote} — try again, no penalty)
            </p>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            {crops.map((crop) => (
              <button
                key={crop.id}
                style={{ minWidth: 88, minHeight: 88 }}
                onClick={() => handleTap(crop)}
              >
                {crop.name}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'celebrating' && <p>🎉 Your {target?.name}!</p>}

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
    </div>
  );
}
