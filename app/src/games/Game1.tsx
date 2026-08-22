// Game 1 — Find It In Your World. WALKING SKELETON, not the real thing.
//
// Proves the wiring end to end: a real profile (F.001) -> real slot
// rendering through the avoid-filter hook (F.005) -> fixture crops ->
// the interaction state machine (F.009) -> the support ladder + log
// write (F.010) -> a persisted SkillRecord (F.001). F.008 (owned by P2)
// replaces this with the real loop: real crops from F.006, real
// difficulty levels from F.012.
//
// Deliberately thin on presentation: no fading suggestions yet (F.011),
// no session cap/fade (F.013). Those come next.

import { useEffect, useRef, useState } from 'react';
import { adapters } from '../adapters/registry';
import { renderLine, slotValuesFromProfile } from '../engine/slots';
import { InteractionMachine, type PromptTier } from '../engine/interactionMachine';
import { startSession } from '../engine/profileStore';
import { logActivityOutcome } from '../engine/activityLogging';
import { SUPPORT_TIERS, DEFAULT_STARTING_SUPPORT_TIER } from '../config/supportLadder';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase = 'idle' | 'searching' | 'confirming' | 'celebrating' | 'reportingSupport';

interface Game1Props {
  profile: ChildProfile;
}

export function Game1({ profile }: Game1Props) {
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wrongTierNote, setWrongTierNote] = useState<PromptTier | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastLoggedTier, setLastLoggedTier] = useState<SupportTier | null>(null);

  const machineRef = useRef<InteractionMachine>(new InteractionMachine());

  useEffect(() => {
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }, [profile.id]);

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
      const line = renderLine(
        'Your {object.name}!',
        slotValuesFromProfile(profile, { 'object.name': crop.name }),
        profile.context,
      );
      void adapters.speechOut.say(line);
      // F.010: after the activity, the caregiver reports how much
      // off-screen support was actually needed — not whether they enjoyed
      // it. Move to that prompt once the celebration beat has played.
      setTimeout(() => setPhase('reportingSupport'), 800);
    } else {
      // Wrong tap: silence + fade per §7.7 — F.009 already updated its own
      // tier; this skeleton just re-renders to reflect it. No sound, no
      // colour change beyond what F.012's real difficulty UI would do.
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
      onScreenPrompted: machineRef.current.currentTier > 0,
    });
    setLastLoggedTier(tier);
    setPhase('idle');
  }

  if (phase === 'idle') {
    return (
      <div className="screen">
        <h2>Game 1 — walking skeleton</h2>
        {lastLoggedTier && (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            Last logged support tier: {lastLoggedTier} (
            {SUPPORT_TIERS.find((t) => t.tier === lastLoggedTier)?.name})
          </p>
        )}
        <button onClick={() => void loadRoom()}>Load room (fixture)</button>
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
