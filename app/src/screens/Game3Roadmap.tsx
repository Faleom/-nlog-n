// Game 3's roadmap — the caregiver-facing path view (redesigned F.021).
// §12.2: this is Game 3's own screen, a thin layer over the game3/
// roadmap.ts orchestration module. The child never sees this screen —
// it's reached only from Branch 1 home, and hands off to Game3Play.tsx (a
// separate, genuinely child-facing screen) the moment a lesson is tapped.
//
// Product decision: Game 3 runs entirely on bundled stock assets
// (games/game3/stockAssets.ts), not the child's own room. It never calls
// the capture pipeline at all — see that file's header for why this is a
// deliberate, stated exception to the rest of the app's "no stock
// content" rule, not an oversight. Two named stock sets ("Kitchen",
// "Bedroom") stand in for two rooms so the generalization gate still
// means something.
//
// Structurally inspired by a Duolingo-style path of lesson nodes (per the
// brief) — not its colours or branding, which belong to a different
// product. Locked nodes render no content at all (§13/UI-STANDARDS:
// "locked content is never shown to the child" applies here at the
// caregiver level too — a locked lesson's target objects stay hidden
// until it actually unlocks, so nothing is spoiled either way).

import { useEffect, useState } from 'react';
import { STOCK_CONTEXTS } from '../games/game3/stockAssets';
import {
  addContext,
  chapterProgress,
  ensureChapterStarted,
  getRoadmapProgress,
  lessonState,
  type LessonState,
} from '../games/game3/roadmap';
import { allLessonsPassed } from '../games/game3/advancement';
import type { Chapter, Lesson, RoadmapProgress } from '../games/game3/types';
import type { ChildProfile } from '../types';

interface Game3RoadmapProps {
  profile: ChildProfile;
  onPlayLesson: (lessonId: string) => void;
}

type Phase = 'loading' | 'noProgress' | 'roadmap';

export function Game3Roadmap({ profile, onPlayLesson }: Game3RoadmapProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState<RoadmapProgress | null>(null);

  useEffect(() => {
    void getRoadmapProgress(profile.id).then((existing) => {
      setProgress(existing ?? null);
      setPhase(existing ? 'roadmap' : 'noProgress');
    });
  }, [profile.id]);

  async function handleStartChapter() {
    const first = STOCK_CONTEXTS[0];
    const next = await ensureChapterStarted(profile.id, first.crops, first.label);
    setProgress(next);
    setPhase('roadmap');
  }

  async function handleNextRoom() {
    if (!progress) return;
    const nextStockContext = STOCK_CONTEXTS[progress.contexts.length];
    if (!nextStockContext) return; // every stock context already added
    const next = await addContext(profile.id, nextStockContext.label, nextStockContext.crops);
    setProgress(next);
  }

  if (phase === 'loading') {
    return (
      <div className="screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (phase === 'noProgress') {
    return (
      <div className="screen">
        <h2>Match &amp; Draw</h2>
        <p style={{ opacity: 0.75 }}>
          A path of short picture lessons — each one starts easy and gets harder only
          once they&rsquo;re ready.
        </p>
        <button
          className="button-primary"
          style={{ minWidth: 88, minHeight: 88 }}
          onClick={() => void handleStartChapter()}
        >
          Start
        </button>
      </div>
    );
  }

  if (!progress) return null;

  const { chapter, lessons, complete } = chapterProgress(progress);
  const currentContext = progress.contexts[progress.contexts.length - 1];
  const currentContextLessons = lessons.filter((l) => l.context === currentContext);
  const currentContextDone = allLessonsPassed(currentContextLessons, progress.lessonOutcomes);
  const nextStockContext = STOCK_CONTEXTS[progress.contexts.length];
  const canMoveOn = currentContextDone && !complete && nextStockContext;

  return (
    <div className="screen">
      <RoadmapHeader chapter={chapter} complete={complete} />

      {progress.contexts.map((context) => (
        <ContextPath
          key={context}
          context={context}
          lessons={lessons.filter((l) => l.context === context)}
          progress={progress}
          onPlayLesson={onPlayLesson}
        />
      ))}

      {canMoveOn && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 16,
            background: 'var(--color-primary-soft, #edebfd)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            {profile.nickname ?? 'They'}&rsquo;ve mastered {currentContext}.
          </p>
          <p style={{ margin: '4px 0 12px', opacity: 0.75 }}>
            A different set of pictures checks whether it really stuck, not just where
            things sit on screen.
          </p>
          <button
            className="button-accent"
            style={{ minWidth: 88, minHeight: 88 }}
            onClick={() => void handleNextRoom()}
          >
            Try {nextStockContext.label}
          </button>
        </div>
      )}

      {complete && (
        <p style={{ marginTop: 16, fontWeight: 600 }}>
          Chapter complete — independent in {progress.contexts.length} sets.
        </p>
      )}
    </div>
  );
}

function RoadmapHeader({ chapter, complete }: { chapter: Chapter; complete: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0 }}>{chapter.title}</h2>
      <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: '0.85rem' }}>
        {complete ? 'Complete' : `${chapter.targetPool.length} pictures to match`}
      </p>
    </div>
  );
}

function ContextPath({
  context,
  lessons,
  progress,
  onPlayLesson,
}: {
  context: string;
  lessons: Lesson[];
  progress: RoadmapProgress;
  onPlayLesson: (lessonId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55 }}>
        {context}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {lessons.map((lesson, i) => (
          <LessonNode
            key={lesson.id}
            lesson={lesson}
            state={lessonState(lesson, progress)}
            offset={i % 2 === 0 ? -28 : 28}
            onTap={() => onPlayLesson(lesson.id)}
          />
        ))}
      </div>
    </div>
  );
}

function LessonNode({
  lesson,
  state,
  offset,
  onTap,
}: {
  lesson: Lesson;
  state: LessonState;
  offset: number;
  onTap: () => void;
}) {
  const isConsolidation = lesson.newElement === null;
  const label = isConsolidation ? 'Practice' : lesson.newElement;

  const background =
    state === 'passed'
      ? 'var(--color-primary, #5b52e8)'
      : state === 'available'
        ? isConsolidation
          ? 'var(--color-accent, #ff9d5c)'
          : 'var(--color-primary, #5b52e8)'
        : 'var(--color-surface-sunken, #e6e1d6)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateX(${offset}px)` }}>
      <button
        type="button"
        disabled={state === 'locked'}
        onClick={onTap}
        aria-label={`${label ?? 'Lesson'} — ${state}`}
        style={{
          width: 88,
          height: 88,
          minWidth: 88,
          minHeight: 88,
          borderRadius: '50%',
          border: 'none',
          background,
          color: state === 'locked' ? 'var(--color-ink-muted, #999)' : '#fff',
          fontSize: '1.4rem',
          fontWeight: 700,
          boxShadow: state === 'locked' ? 'none' : 'var(--shadow-sm)',
          cursor: state === 'locked' ? 'default' : 'pointer',
        }}
      >
        {state === 'passed' ? '✓' : state === 'locked' ? '🔒' : isConsolidation ? '↻' : '●'}
      </button>
      <span style={{ fontSize: '0.7rem', opacity: state === 'locked' ? 0.4 : 0.75, marginTop: 2 }}>
        {state === 'locked' ? '' : label}
      </span>
    </div>
  );
}
