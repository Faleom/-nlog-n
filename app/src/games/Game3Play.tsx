// Game 3 — the round-playing screen for one lesson (redesigned F.021).
// Chapter 1, "Match the picture": identical photo at top, real photos
// below, child taps the match. A thin layer over the shared engine —
// InteractionMachine drives the wrong-tap escalation exactly as F.009
// specifies, this file only owns what §12.2 allows: the interaction
// shape (sample + options, tap to match) and how a round renders.
//
// Reuses game1Trial.ts's target-avoid-repeat rule (via roundBuilder.ts),
// the errorless-completion contract, and F.010's support-tier ladder —
// nothing here reimplements engine logic.

import { useEffect, useRef, useState, useCallback } from 'react';
import { adapters } from '../adapters/registry';
import { renderLine, slotValuesFromProfile } from '../engine/slots';
import { InteractionMachine, type PromptTier } from '../engine/interactionMachine';
import { SUPPORT_TIERS } from '../config/supportLadder';
import {
  chapterProgress,
  completeLesson,
  cropsForLesson,
  getRoadmapProgress,
  recordRound,
} from './game3/roadmap';
import { pickRoundTarget, buildRoundOptions } from './game3/roundBuilder';
import { ROUNDS_PER_LESSON, type Lesson, type LessonOutcome, type RoundResult } from './game3/types';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase = 'loading' | 'unavailable' | 'presenting' | 'celebrating' | 'reportingSupport' | 'done';

interface Game3PlayProps {
  profile: ChildProfile;
  lessonId: string;
  onExit: () => void;
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

const GAME3_STYLES = `
@keyframes g3p-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(91,82,232,0.5); } 50% { box-shadow: 0 0 0 10px rgba(91,82,232,0); } }
@keyframes g3p-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes g3p-celebrate { 0% { transform: scale(1); } 100% { transform: scale(1.6); } }
.g3p-crop { transition: opacity 200ms var(--ease-out, ease); opacity: 1; border: none; border-radius: var(--radius-md, 16px); background-size: cover; background-position: center; background-color: var(--color-surface-sunken, #eee); }
.g3p-crop--dead { opacity: 0.4; }
.g3p-crop--dimmed { opacity: 0.6; }
.g3p-crop--highlighted { animation: g3p-pulse 1.2s ease-in-out infinite; }
.g3p-crop--bouncing { animation: g3p-bounce 0.6s ease-in-out infinite; }
.g3p-crop--celebrating { animation: g3p-celebrate 800ms ease-out forwards; }
`;

function OptionButton({
  crop,
  onTap,
  dead,
  dimmed,
  highlighted,
  bouncing,
  disabled,
}: {
  crop: TaggedCrop;
  onTap: () => void;
  dead: boolean;
  dimmed: boolean;
  highlighted: boolean;
  bouncing: boolean;
  disabled: boolean;
}) {
  const classNames = [
    'g3p-crop',
    dead && 'g3p-crop--dead',
    dimmed && !dead && 'g3p-crop--dimmed',
    highlighted && 'g3p-crop--highlighted',
    bouncing && 'g3p-crop--bouncing',
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
        backgroundImage: crop.image ? `url(${crop.image})` : undefined,
      }}
    />
  );
}

export function Game3Play({ profile, lessonId, onExit, onChildFacingChange }: Game3PlayProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonCrops, setLessonCrops] = useState<TaggedCrop[]>([]);
  const [contextCrops, setContextCrops] = useState<TaggedCrop[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [options, setOptions] = useState<TaggedCrop[]>([]);
  const [promptTier, setPromptTier] = useState<PromptTier>(0);
  const [deadIds, setDeadIds] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);

  const machineRef = useRef<InteractionMachine>(new InteractionMachine());
  const lastTargetIdRef = useRef<string | null>(null);

  useEffect(() => {
    onChildFacingChange?.(phase === 'presenting' || phase === 'celebrating');
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  useEffect(() => {
    void (async () => {
      const progress = await getRoadmapProgress(profile.id);
      if (!progress) {
        setPhase('unavailable');
        return;
      }
      const { lessons } = chapterProgress(progress);
      const found = lessons.find((l) => l.id === lessonId);
      if (!found) {
        setPhase('unavailable');
        return;
      }
      const crops = cropsForLesson(found, progress);
      if (crops.length === 0) {
        setPhase('unavailable');
        return;
      }
      setLesson(found);
      setLessonCrops(crops);
      setContextCrops(progress.contextCrops[found.context] ?? []);
      const resuming = progress.inProgress?.lessonId === lessonId ? progress.inProgress.roundIndex : 0;
      setRoundIndex(resuming);
      startRound(crops, progress.contextCrops[found.context] ?? [], found.fieldSize);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, lessonId]);

  useEffect(() => {
    if (phase !== 'presenting') return;
    const interval = setInterval(() => {
      const tick = machineRef.current.tick(Date.now());
      setPromptTier(tick.tier);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function startRound(crops: TaggedCrop[], allContextCrops: TaggedCrop[], fieldSize: number) {
    const picked = pickRoundTarget(crops, lastTargetIdRef.current);
    lastTargetIdRef.current = picked.id;
    setTarget(picked);
    setOptions(buildRoundOptions(picked, crops, allContextCrops, fieldSize));
    setDeadIds(new Set());
    setPromptTier(0);
    machineRef.current.startTrial();
    setPhase('presenting');
    void adapters.speechOut.say(renderLine('Which one matches?', slotValuesFromProfile(profile), profile.context));
  }

  function handleOptionTap(crop: TaggedCrop) {
    const result = machineRef.current.recordAttempt(crop.id === target?.id);
    if (result.resolved) {
      setPhase('celebrating');
      void adapters.speechOut.say(
        renderLine('Your {object.name}!', slotValuesFromProfile(profile, { 'object.name': target?.name ?? '' }), profile.context),
      );
      setTimeout(() => setPhase('reportingSupport'), 700);
      return;
    }
    // §7.7: a wrong tap is silence plus fade, never a spoken reaction —
    // this branch deliberately calls no speechOut.
    setDeadIds((prev) => new Set(prev).add(crop.id));
    setPromptTier(result.tier);
  }

  const handleSupportTierReport = useCallback(
    async (supportTier: SupportTier) => {
      if (!lesson) return;
      const result: RoundResult = {
        lessonId: lesson.id,
        targetId: target?.name.trim().toLowerCase() ?? '',
        supportTier,
        promptsUsed: machineRef.current.currentTier,
        completedAt: Date.now(),
      };
      await recordRound(profile.id, lesson.id, roundIndex, result);

      const nextIndex = roundIndex + 1;
      if (nextIndex >= ROUNDS_PER_LESSON) {
        const { outcome: finalOutcome } = await completeLesson(profile.id, lesson.id);
        setOutcome(finalOutcome);
        setPhase('done');
        return;
      }
      setRoundIndex(nextIndex);
      startRound(lessonCrops, contextCrops, lesson.fieldSize);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, target, roundIndex, lessonCrops, contextCrops, profile.id],
  );

  if (phase === 'loading') {
    return (
      <div className="screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (phase === 'unavailable') {
    return (
      <div className="screen">
        <p>This lesson isn&rsquo;t ready yet.</p>
        <button className="button-primary" style={{ minWidth: 88, minHeight: 88 }} onClick={onExit}>
          Back to roadmap
        </button>
      </div>
    );
  }

  if (phase === 'done' && outcome) {
    return (
      <div className="screen">
        <style>{GAME3_STYLES}</style>
        <h2>{outcome === 'pass' ? 'Lesson passed' : 'Let’s try that lesson again'}</h2>
        <p style={{ opacity: 0.75 }}>
          {outcome === 'pass'
            ? 'Every round needed only a light touch of support — this one’s mastered for now.'
            : 'One or more rounds needed real hands-on help — that’s expected, not a setback. It’ll come back around.'}
        </p>
        <button className="button-primary" style={{ minWidth: 88, minHeight: 88 }} onClick={onExit}>
          Back to roadmap
        </button>
      </div>
    );
  }

  if (phase === 'reportingSupport') {
    return (
      <div className="screen">
        <p>How much support did they actually need, just now?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SUPPORT_TIERS.map((info) => (
            <button
              key={info.tier}
              className="button-primary"
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

  return (
    <div className="screen">
      <style>{GAME3_STYLES}</style>

      {phase === 'presenting' && target && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div
            aria-hidden
            style={{
              width: 120,
              height: 120,
              borderRadius: 16,
              backgroundColor: 'var(--color-surface-sunken, #ddd)',
              backgroundImage: target.image ? `url(${target.image})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {options.map((crop) => {
              const isTarget = crop.id === target.id;
              return (
                <OptionButton
                  key={crop.id}
                  crop={crop}
                  dead={deadIds.has(crop.id)}
                  dimmed={promptTier >= 2 && !isTarget}
                  highlighted={promptTier === 2 && isTarget}
                  bouncing={promptTier >= 3 && isTarget}
                  disabled={promptTier >= 3 && !isTarget}
                  onTap={() => handleOptionTap(crop)}
                />
              );
            })}
          </div>
        </div>
      )}

      {phase === 'celebrating' && target && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
          <div
            aria-label={target.name}
            className="g3p-crop g3p-crop--celebrating"
            style={{
              width: 120,
              height: 120,
              minWidth: 120,
              minHeight: 120,
              backgroundImage: target.image ? `url(${target.image})` : undefined,
            }}
          />
        </div>
      )}
    </div>
  );
}
