// Game 2 — Toy Story Sequencing. WALKING SKELETON, same maturity level as
// Game1.tsx -- proves the wiring end to end against fixture crops.
//
// Loop: pick a routine anchor -> model the sequence (once, or twice for
// sameness-helps profiles) -> "do it with the real Companion" off-screen ->
// scramble -> child taps in order -> save as a printable visual schedule.
// Step 3 (the real-world act-it-out) is where the learning happens -- the
// screen is only the score (§8.2). Logs through the same F.010/F.011/F.013
// engine as Game 1: support tier + fading + session lifecycle.
//
// Two audiences, one device (§8.0), same split as Game1.tsx: 'idle' /
// 'modelling' / 'actItOut' / 'complete' / 'reportingSupport' are the
// CAREGIVER's screen. 'ordering' -- the moment the child actually taps --
// is the CHILD's screen and must be zero text (§7.7), which the crop
// tiles below enforce the same way Game1's CropButton does: a photo or a
// plain colour swatch, aria-label only, no visible caption.

import { useEffect, useRef, useState } from 'react';
import { adapters } from '../adapters/registry';
import { captureRoomAndRecognize } from '../adapters/pipeline/myWorldPipeline';
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
  /** Same contract as Game1/Game3: fires whenever the screen crosses into
   * or out of the CHILD-facing 'ordering' phase, so the shell can hide its
   * own text chrome instead of leaving it visible during the zero-text
   * phase this file enforces internally. */
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

/** Loose common-colour-word → CSS colour mapping for the swatch fallback
 * shown when a crop has no `image`. Duplicated from Game1.tsx rather than
 * shared -- each game owns how it renders a step (§12.2), and this is six
 * lines, not a module. */
function swatchColour(colour: string): string {
  const known = new Set([
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'grey', 'gray', 'gold', 'silver', 'teal', 'cyan',
  ]);
  return known.has(colour.toLowerCase()) ? colour.toLowerCase() : '#ccc';
}

/** One tile in the child-facing ordering strip. Zero text (§7.7) -- a
 * photo if we have one, otherwise a colour swatch; aria-label carries the
 * name for assistive tech only. `dead` means already placed correctly,
 * `dimmed` means "not the correct next tap" after a second miss locks the
 * UI to errorless mode -- both are visual-only, never a score or count. */
function SequenceCropButton({
  crop,
  onTap,
  dead,
  dimmed,
}: {
  crop: TaggedCrop;
  onTap: () => void;
  dead: boolean;
  dimmed: boolean;
}) {
  const classNames = ['g2-crop', dead && 'g2-crop--dead', dimmed && !dead && 'g2-crop--dimmed']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classNames}
      aria-label={crop.name}
      disabled={dead}
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

const GAME2_STYLES = `
.g2-crop { transition: opacity 200ms ease, transform 160ms cubic-bezier(0.23, 1, 0.32, 1); opacity: 1; }
.g2-crop--dead { opacity: 0.35; }
.g2-crop--dimmed { opacity: 0.55; }
`;

export function Game2({ profile, onChildFacingChange }: Game2Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [anchor, setAnchor] = useState<RoutineAnchor | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [scrambled, setScrambled] = useState<TaggedCrop[]>([]);
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set());
  const [lockedToCorrect, setLockedToCorrect] = useState(false);
  const [modelPlaybacksLeft, setModelPlaybacksLeft] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<string[] | null>(null);
  // Mirrors machineRef's currentSlotIndex in real state -- the ref itself
  // must never be read during render (React refs aren't render inputs),
  // so this is what the errorless-mode tile dimming below reads instead.
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);

  const machineRef = useRef<SequencingMachine | null>(null);
  const wrongOnCurrentSlot = useRef(0);

  useEffect(() => {
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }, [profile.id]);

  useEffect(() => {
    onChildFacingChange?.(phase === 'ordering');
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  async function startRound() {
    const anchors = getRoutineAnchors(profile);
    const chosen = anchors[0] ?? ROUTINE_ANCHOR_OPTIONS[0];
    // Routed through the F.006 pipeline, never the raw adapters directly --
    // this is what actually enforces "faces are blurred before anything is
    // sent", not just a convention. See myWorldPipeline.ts's header and
    // scripts/smoke-f006.ts's static check, which fixed exactly this
    // shortcut when it was first written directly against adapters.vision.
    const outcome = await captureRoomAndRecognize();
    if (outcome.kind !== 'success') {
      // §11: capture-unavailable / blur-failed / no-objects-found all
      // degrade quietly here too -- no error screen, same as Game 1.
      return;
    }
    const built = buildSequence(chosen, outcome.crops.slice(0, 3));
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
    setPlacedIds(new Set());
    setCurrentSlotIndex(0);
    setPhase('ordering');
    // The instruction is audio, not on-screen text -- §8.0's "audio is the
    // child's" applies here exactly like Game1's handoff line.
    void adapters.speechOut.say('Now you put them in order.');
  }

  function handleTap(crop: TaggedCrop) {
    const machine = machineRef.current;
    if (!machine) return;
    const result = machine.submitTap(crop.id);
    if (result.correct) {
      wrongOnCurrentSlot.current = 0;
      setLockedToCorrect(false);
      setPlacedIds((prev) => new Set(prev).add(crop.id));
      setCurrentSlotIndex(machine.currentSlotIndex);
      if (result.complete) {
        void finishSequence();
      }
    } else {
      // Silent per §8.2 -- no sound, no colour flash, no mark. Only the
      // lock state (second wrong -> correct-only, shown as a dim rather
      // than any text) is surfaced.
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
        <h2>Toy Story Sequencing</h2>
        <p style={{ color: 'var(--color-ink-muted)' }}>
          A photo of the room, turned into a routine your child puts in order.
        </p>
        <button className="button-primary" onClick={() => void startRound()}>
          Start a routine
        </button>
      </div>
    );
  }

  if (phase === 'modelling') {
    return (
      <div className="screen">
        <h2 style={{ textTransform: 'capitalize' }}>{anchor}</h2>
        <p style={{ color: 'var(--color-ink-muted)' }}>
          {modelPlaybacksLeft} playback{modelPlaybacksLeft === 1 ? '' : 's'} left
        </p>
        <button className="button-primary" onClick={playNextModel}>
          ▶ Play
        </button>
      </div>
    );
  }

  if (phase === 'actItOut') {
    return (
      <div className="screen">
        <p>{actItOutLine(profile)}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
          Off-screen — this is where the learning happens.
        </p>
        <button className="button-primary" onClick={proceedToOrdering}>
          They did it — now order it
        </button>
      </div>
    );
  }

  if (phase === 'ordering') {
    const correctNextId = lockedToCorrect ? steps[currentSlotIndex]?.crop.id : undefined;
    return (
      <div className="screen">
        <style>{GAME2_STYLES}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scrambled.map((crop) => (
            <SequenceCropButton
              key={crop.id}
              crop={crop}
              onTap={() => handleTap(crop)}
              dead={placedIds.has(crop.id)}
              dimmed={correctNextId !== undefined && crop.id !== correctNextId}
            />
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="screen">
        <h2>🎉 That's your {anchor}!</h2>
        {schedule && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem' }}>
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
            style={{ textAlign: 'left' }}
            onClick={() => void handleSupportTierReport(info.tier)}
          >
            {info.tier}. {info.name} — {info.instruction}
          </button>
        ))}
      </div>
    </div>
  );
}
