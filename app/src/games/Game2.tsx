// Game 2 — Toy Story Sequencing. WALKING SKELETON, same maturity level as
// Game1.tsx -- proves the wiring end to end against fixture crops.
//
// Loop: pick a routine anchor -> model the sequence (once, or twice for
// sameness-helps profiles) -> "do it with the real Companion" off-screen ->
// scramble -> child taps in order -> save as a printable visual schedule.
// Step 3 (the real-world act-it-out) is where the learning happens -- the
// screen is only the score (§8.2). Logs through the same F.010/F.011/F.013
// engine as Game 1: support tier + fading + session lifecycle.

import { useEffect, useRef, useState } from 'react';
import { adapters } from '../adapters/registry';
import {
  ROUTINE_ANCHOR_OPTIONS,
  buildSequence,
  modelPlaybackCount,
  SequencingMachine,
  actItOutLine,
  formatVisualSchedule,
  getRoutineAnchors,
  type RoutineAnchor,
  type SequenceStep,
} from '../engine/routineSequencing';
import { logActivityOutcome } from '../engine/activityLogging';
import { startSession, endSession } from '../engine/profileStore';
import { SUPPORT_TIERS } from '../config/supportLadder';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase = 'idle' | 'modelling' | 'actItOut' | 'ordering' | 'complete' | 'reportingSupport';

interface Game2Props {
  profile: ChildProfile;
}

export function Game2({ profile }: Game2Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [anchor, setAnchor] = useState<RoutineAnchor | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [scrambled, setScrambled] = useState<TaggedCrop[]>([]);
  const [placedNote, setPlacedNote] = useState<string | null>(null);
  const [lockedToCorrect, setLockedToCorrect] = useState(false);
  const [modelPlaybacksLeft, setModelPlaybacksLeft] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<string[] | null>(null);

  const machineRef = useRef<SequencingMachine | null>(null);
  const wrongOnCurrentSlot = useRef(0);

  useEffect(() => {
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }, [profile.id]);

  async function startRound() {
    const anchors = getRoutineAnchors(profile);
    const chosen = anchors[0] ?? ROUTINE_ANCHOR_OPTIONS[0];
    const objects = await adapters.vision.recognizeObjects(
      await adapters.capture.capturePhoto(),
    );
    const built = buildSequence(chosen, objects.slice(0, 3));
    if (built.length < 2) {
      // Not enough real crops for this anchor this session -- same
      // no-objects-found degrade pattern as F.006, not an error screen.
      return;
    }
    setAnchor(chosen);
    setSteps(built);
    setModelPlaybacksLeft(modelPlaybackCount(profile.responseProfile.sameness));
    setPhase('modelling');
  }

  function playNextModel() {
    if (!anchor || steps.length === 0) return;
    const line = steps.map((s) => s.label).join('. Then ');
    void adapters.speechOut.say(`First ${line}.`);
    setModelPlaybacksLeft((n) => {
      const remaining = n - 1;
      if (remaining <= 0) {
        setTimeout(() => setPhase('actItOut'), 300);
      }
      return remaining;
    });
  }

  function proceedToOrdering() {
    machineRef.current = new SequencingMachine(steps);
    wrongOnCurrentSlot.current = 0;
    setScrambled([...steps.map((s) => s.crop)].sort(() => Math.random() - 0.5));
    setLockedToCorrect(false);
    setPlacedNote(null);
    setPhase('ordering');
    void adapters.speechOut.say('Now you put them in order.');
  }

  function handleTap(crop: TaggedCrop) {
    const machine = machineRef.current;
    if (!machine) return;
    const result = machine.submitTap(crop.id);
    if (result.correct) {
      wrongOnCurrentSlot.current = 0;
      setLockedToCorrect(false);
      setPlacedNote(`Placed: ${crop.name}`);
      if (result.complete) {
        void finishSequence();
      }
    } else {
      // Silent per §8.2 -- no sound, no colour flash, no mark. Only the
      // lock state (second wrong -> correct-only) is surfaced.
      setLockedToCorrect(result.onlyCorrectRemainsTappable);
    }
  }

  async function finishSequence() {
    setPhase('complete');
    if (!anchor) return;
    const lines = formatVisualSchedule(anchor, steps, profile);
    setSchedule(lines);
    void adapters.speechOut.say(lines.join('. '));
    setTimeout(() => setPhase('reportingSupport'), 600);
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId || !anchor) return;
    await logActivityOutcome({
      sessionId,
      skillId: `sequence-${anchor}`,
      context: 'living-room',
      supportTier: tier,
      onScreenTier: lockedToCorrect ? 3 : 0,
    });
    await endSession(sessionId, 'caregiver');
    setPhase('idle');
    setSessionId(null);
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }

  if (phase === 'idle') {
    return (
      <div className="screen">
        <h2>Game 2 — walking skeleton</h2>
        <button onClick={() => void startRound()}>Start a routine (fixture)</button>
      </div>
    );
  }

  if (phase === 'modelling') {
    return (
      <div className="screen">
        <p>Modelling "{anchor}" ({modelPlaybacksLeft} playback(s) left)</p>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={playNextModel}>
          Play
        </button>
      </div>
    );
  }

  if (phase === 'actItOut') {
    return (
      <div className="screen">
        <p>{actItOutLine(profile)}</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          (off-screen — this is where the learning happens)
        </p>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={proceedToOrdering}>
          They did it — now order it
        </button>
      </div>
    );
  }

  if (phase === 'ordering') {
    return (
      <div className="screen">
        <p>Now you put them in order.</p>
        {placedNote && <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{placedNote}</p>}
        {lockedToCorrect && (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            (only the correct next one is tappable now — no penalty)
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scrambled.map((crop) => (
            <button
              key={crop.id}
              style={{ minWidth: 88, minHeight: 88 }}
              onClick={() => handleTap(crop)}
            >
              {crop.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="screen">
        <p>🎉 That's your {anchor}!</p>
        {schedule && (
          <div style={{ fontSize: '0.85rem' }}>
            {schedule.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
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
    </div>
  );
}
