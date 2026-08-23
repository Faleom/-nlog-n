// Game 4 — Trace and Colour. §8.3's Mode B ("silhouette of one of their
// objects; the child traces it with a finger"), which was specced and cut
// as F.023, now built against the bundled shape set instead of a room
// photo — so it needs no camera, no network and no setup.
//
// The round has two halves, and only the FIRST is assessed:
//   1. TRACE  — follow the outline with a finger. Must be completed.
//   2. COLOUR — the shape fills with its real colour at 10% opacity, and
//               five swatches appear. Whichever the child taps is the
//               colour the shape becomes. No colour is wrong.
//
// The 10% ghost is a HINT, not a gate. It shows what an apple usually looks
// like; it does not require the child to agree. A purple apple is a
// finished round, celebrated identically — see traceLogic.ts's header for
// why the logged skill is the tracing alone.
//
// Engine reuse, same as every other game here: InteractionMachine is NOT
// used (there is no wrong tap to escalate against — nothing to be wrong
// about), but sessionLifecycle, activityLogging, fading and the support
// ladder are the same ones Games 1-3 run on.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { adapters } from '../adapters/registry';
import { renderLine, slotValuesFromProfile } from '../engine/slots';
import { startSession } from '../engine/profileStore';
import { logActivityOutcome } from '../engine/activityLogging';
import { getFadingSuggestion, type FadingSuggestion } from '../engine/fading';
import {
  childFacingHandoffLine,
  describeSessionRecap,
  endSessionNow,
  getSessionNumber,
  hasCapBeenReached,
  sessionCapSeconds,
  type SessionEndResult,
} from '../engine/sessionLifecycle';
import { SUPPORT_TIERS, DEFAULT_STARTING_SUPPORT_TIER } from '../config/supportLadder';
import { PALETTE, realColourOf, type TraceObject } from './trace/tracePaths';
import {
  CRAYON_WIDTH,
  ROUNDS_PER_SESSION,
  fixedBag,
  isSessionFinished,
  isTraceComplete,
  objectFromBag,
  shuffledBag,
  traceSkillId,
  visitNearby,
  type Stroke,
  type TracePoint,
} from './trace/traceLogic';
import { applyProfileTuning } from './game1Difficulty';
import { INTERACTION_CONFIG } from '../config/interaction';
import type { ChildProfile, SupportTier } from '../types';

type Phase = 'idle' | 'tracing' | 'colouring' | 'celebrating' | 'reportingSupport' | 'sessionEnded';

const BOX = 240;
/** Checkpoints sampled along the outline. Enough that a finger cannot skip
 * a stretch of the shape, few enough that the per-move scan stays cheap. */
const CHECKPOINTS = 90;

const STYLES = `
@keyframes t4-pop { 0% { transform: scale(0.9); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
.t4-celebrate { animation: t4-pop 520ms cubic-bezier(0.23,1,0.32,1) forwards; }
.t4-swatch { transition: transform 140ms cubic-bezier(0.23,1,0.32,1); }
.t4-swatch:active { transform: scale(0.94); }
.t4-stage { touch-action: none; -webkit-user-select: none; user-select: none; }
@media (prefers-reduced-motion: reduce) { .t4-celebrate { animation: none; } }
`;

interface Props {
  profile: ChildProfile;
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

export function TraceAndColour({ profile, onChildFacingChange }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [object, setObject] = useState<TraceObject | null>(null);
  const [points, setPoints] = useState<TracePoint[]>([]);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  /** The crayon currently in hand. Tapping another swatch swaps it, so one
   * picture can hold several colours. */
  const [crayon, setCrayon] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [lastLoggedTier, setLastLoggedTier] = useState<SupportTier | null>(null);
  const [fadingSuggestion, setFadingSuggestion] = useState<FadingSuggestion | null>(null);
  const [sessionEndResult, setSessionEndResult] = useState<SessionEndResult | null>(null);
  const [showCaregiverRecap, setShowCaregiverRecap] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pathRef = useRef<SVGPathElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const roundRef = useRef(0);
  const startedAtRef = useRef(0);
  const drawingRef = useRef(false);
  /** Last time the child actually did something. F.013's 90s idle ending
   * needs this; see the timer effect below. */
  const lastActivityRef = useRef(Date.now());

  // §5.2: children whose profile asks for sameness keep the fixed order.
  // A randomiser applied to everyone would take away an accommodation some
  // of them depend on — the same call Game 1 makes about its grid.
  const wantsSameness = applyProfileTuning(profile).fixedLayout;
  const bagRef = useRef<TraceObject[]>(wantsSameness ? fixedBag() : shuffledBag());
  /** Unique per mounted component. SVG clipPath is referenced by document
   * id, so a hardcoded one would collide if this screen ever rendered
   * twice — and the crayon strokes would spill out of the wrong shape. */
  const clipId = `trace-clip-${useId().replace(/:/g, '')}`;

  const handleEndSession = useCallback(
    async (reason: 'cap' | 'idle' | 'caregiver' | 'finished') => {
      if (!sessionId) return;
      setPhase('sessionEnded');
      const result = await endSessionNow(sessionId, reason, object?.name ?? null);
      setSessionEndResult(result);
      void adapters.speechOut.say(childFacingHandoffLine(profile, result.handoffObjectName));
    },
    [sessionId, profile, object],
  );

  // §8.0: 'tracing', 'colouring' and 'celebrating' are the CHILD's screens —
  // the shell hides its own chrome for them, same contract Game 1 uses.
  useEffect(() => {
    const childFacing = phase === 'tracing' || phase === 'colouring' || phase === 'celebrating';
    onChildFacingChange?.(childFacing);
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  useEffect(() => {
    void (async () => {
      const [session, number] = await Promise.all([startSession(profile.id), getSessionNumber(profile.id)]);
      setSessionId(session.id);
      setSessionNumber(number);
      startedAtRef.current = Date.now();
    })();
  }, [profile]);

  // F.013 gives a session THREE ways to end — cap, 90s idle, caregiver —
  // and this game originally implemented only two. Games 1 and 3 get idle
  // detection free from InteractionMachine's tick(); this one deliberately
  // has no InteractionMachine (there is no wrong tap to escalate against),
  // so without the check below a child who wandered off mid-picture left
  // the session running until the cap.
  useEffect(() => {
    if (!sessionId || sessionNumber === null || phase === 'sessionEnded') return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startedAtRef.current) / 1000);
      setElapsedSeconds(elapsed);

      if (hasCapBeenReached(sessionNumber, elapsed)) {
        void handleEndSession('cap');
        return;
      }
      // Only while the child is the one being waited on. The caregiver
      // reading the support-tier list is not idleness, and ending the
      // session out from under them would lose the trial they just watched.
      const childsTurn = phase === 'tracing' || phase === 'colouring';
      if (childsTurn && now - lastActivityRef.current >= INTERACTION_CONFIG.SESSION_END_IDLE_MS) {
        void handleEndSession('idle');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, sessionNumber, phase, handleEndSession]);

  /**
   * Samples the outline into checkpoints as soon as the path element
   * attaches.
   *
   * A ref callback rather than an effect, because getPointAtLength needs a
   * path that is actually in the document, and this is the exact moment it
   * becomes one — no extra render pass, and nothing to keep in sync. The
   * <path> is keyed by the shape below, so swapping shapes remounts it and
   * re-runs this with the new outline.
   */
  const attachPath = useCallback((el: SVGPathElement | null) => {
    pathRef.current = el;
    if (!el) return;
    const len = el.getTotalLength();
    if (!len) return;

    const outline: TracePoint[] = [];
    for (let i = 0; i < CHECKPOINTS; i++) {
      const p = el.getPointAtLength((len * i) / CHECKPOINTS);
      outline.push({ x: p.x, y: p.y });
    }
    setPoints(outline);
  }, []);

  function startRound() {
    // Refill the bag once every shape has been seen, so nothing repeats
    // until everything has had a turn.
    const indexInBag = roundRef.current % bagRef.current.length;
    if (roundRef.current > 0 && indexInBag === 0 && !wantsSameness) {
      bagRef.current = shuffledBag(Math.random, object?.key);
    }
    const next = objectFromBag(bagRef.current, indexInBag);
    lastActivityRef.current = Date.now();
    setObject(next);
    setVisited(new Set());
    setStrokes([]);
    setCrayon(null);
    setPhase('tracing');
    void adapters.speechOut.say(
      renderLine('Trace the shape with your finger.', slotValuesFromProfile(profile), profile.context),
    );
  }

  /** Converts a pointer event to viewBox coordinates. The SVG is rendered
   * at whatever size the layout gives it, so screen pixels have to be
   * scaled back into the 240x240 space the path lives in. */
  function toViewBox(e: React.PointerEvent): TracePoint | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {
      x: ((e.clientX - r.left) / r.width) * BOX,
      y: ((e.clientY - r.top) / r.height) * BOX,
    };
  }

  /**
   * Keeps pointer events coming even if the finger slides off the SVG.
   *
   * NEVER call this before doing the actual work: setPointerCapture throws
   * NotFoundError when the pointer is already gone — a real race on touch
   * hardware, not a theoretical one — and an uncaught throw here abandons
   * the rest of the handler, losing the stroke the child just started. It
   * is an enhancement; drawing has to survive without it.
   */
  function tryCapture(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // No active pointer to capture. Events still arrive while the finger
      // stays over the shape, which is the normal case anyway.
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    lastActivityRef.current = Date.now();
    if (phase === 'tracing') {
      drawingRef.current = true;
      handlePointerMove(e);
      tryCapture(e);
      return;
    }
    if (phase === 'colouring' && crayon) {
      const p = toViewBox(e);
      if (!p) return;
      drawingRef.current = true;
      // Open a new stroke. Each press-drag-release is its own stroke, so
      // lifting the finger and starting elsewhere does not draw a line
      // across the picture between the two.
      setStrokes((prev) => [...prev, { colour: crayon, points: [p] }]);
      tryCapture(e);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const p = toViewBox(e);
    if (!p) return;
    lastActivityRef.current = Date.now();

    if (phase === 'tracing') {
      if (points.length === 0) return;
      setVisited((prev) => {
        const next = visitNearby(points, prev, p.x, p.y);
        if (next.size !== prev.size && isTraceComplete(next, points.length)) {
          // Finished going round. Hand over to the colouring half.
          drawingRef.current = false;
          setTimeout(() => {
            setPhase('colouring');
            void adapters.speechOut.say(
              renderLine('Now colour it in!', slotValuesFromProfile(profile), profile.context),
            );
          }, 260);
        }
        return next;
      });
      return;
    }

    if (phase === 'colouring') {
      // Extend the stroke in progress. Nothing measures how much has been
      // filled — the child decides when the picture is finished, not a
      // coverage rule. See traceLogic.ts.
      setStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, points: [...last.points, p] }];
      });
    }
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  /** The picture is coloured in. Nothing here inspects WHICH colours were
   * used — a blue apple finishes exactly like a red one. See the header. */
  function finishRound() {
    setPhase('celebrating');
    void adapters.speechOut.say(
      renderLine('Your {object.name}!', slotValuesFromProfile(profile, { 'object.name': object?.name ?? '' }), profile.context),
    );
    setTimeout(() => setPhase('reportingSupport'), 900);
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId || !object) return;
    await logActivityOutcome({
      sessionId,
      skillId: traceSkillId(object),
      context: 'living-room',
      supportTier: tier,
      // No InteractionMachine in this game — there is no wrong tap to
      // escalate against — so the on-screen prompt tier is always 0.
      onScreenTier: 0,
    });
    setLastLoggedTier(tier);
    setFadingSuggestion(
      await getFadingSuggestion(profile.id, traceSkillId(object), tier, profile.nickname ?? 'they'),
    );
    roundRef.current += 1;

    // The session has a planned length. Ending on a finished picture beats
    // being cut off mid-scribble by a clock the child cannot see.
    if (isSessionFinished(roundRef.current)) {
      void handleEndSession('finished');
      return;
    }
    startRound();
  }

  const suggestedTier =
    SUPPORT_TIERS.find((t) => t.tier === DEFAULT_STARTING_SUPPORT_TIER) ?? SUPPORT_TIERS[0];

  // ---------------------------------------------------------------- screens

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
        <style>{STYLES}</style>
        <h2>Trace and Colour</h2>
        {sessionNumber && capSeconds && (
          <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
            Session {sessionNumber} — cap {Math.round(capSeconds / 60)}min, elapsed {elapsedSeconds}s
          </p>
        )}
        <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
          Follow the outline with a finger, then colour it in. Any colour is fine — this
          activity is about the tracing.
        </p>
        {/* The plan, told to the CAREGIVER only. The child never sees a
            count: "3 of 5" on their screen would be the running total §13
            rules out, and would turn a finished picture into a score. */}
        <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          {ROUNDS_PER_SESSION} shapes, then the session finishes on its own.
          {roundRef.current > 0 &&
            ` ${ROUNDS_PER_SESSION - roundRef.current} left.`}
        </p>
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
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={startRound}>
          Start tracing
        </button>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => void handleEndSession('caregiver')}>
          End session
        </button>
      </div>
    );
  }

  if (phase === 'reportingSupport') {
    return (
      <div className="screen">
        <p>How much support did they need to trace it?</p>
        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          Support tier {suggestedTier.tier} — {suggestedTier.name}: {suggestedTier.instruction}
        </p>
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

  // CHILD-FACING from here down: tracing / colouring / celebrating.
  // Zero text (§7.7, §13) — the shape, the swatches and the audio carry it.
  const ghost = object ? realColourOf(object) : '#000';

  return (
    <div className="screen">
      <style>{STYLES}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        {/* A small reference of the finished thing, beside the space being
            coloured. The 10% ghost inside the outline says where the colour
            goes; this says what the object actually looks like, at a size
            worth looking at. Only while colouring — during tracing it would
            give away the shape being followed. */}
        {phase === 'colouring' && object && (
          <div
            style={{
              alignSelf: 'flex-end',
              width: 84,
              height: 84,
              padding: 8,
              borderRadius: 16,
              background: '#fff',
              border: '2px solid rgba(33,31,46,0.14)',
              boxShadow: '0 2px 8px rgba(33,31,46,0.12)',
            }}
          >
            <svg viewBox={`0 0 ${BOX} ${BOX}`} width="100%" height="100%" aria-hidden="true">
              <path d={object.d} fill={ghost} stroke="rgba(33,31,46,0.3)" strokeWidth="4" />
            </svg>
          </div>
        )}
        <svg
          ref={svgRef}
          className={`t4-stage${phase === 'celebrating' ? ' t4-celebrate' : ''}`}
          viewBox={`0 0 ${BOX} ${BOX}`}
          width="100%"
          style={{ maxWidth: 320, display: 'block' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            {/* Keeps crayon inside the lines. Not a rule the child has to
                obey — a scribble that runs past the edge simply lands
                inside the shape anyway, so going "outside the lines" can
                never be something they did wrong. */}
            <clipPath id={clipId}>
              <path d={object?.d ?? ''} />
            </clipPath>
          </defs>

          {/* The shape itself. Empty while tracing, then the 10% ghost of
              its real colour — a hint of what it usually looks like, under
              whatever the child draws on top. */}
          <path
            key={object?.key}
            ref={attachPath}
            d={object?.d ?? ''}
            fill={ghost}
            fillOpacity={phase === 'tracing' ? 0 : 0.1}
            stroke="rgba(33,31,46,0.28)"
            strokeWidth="3"
            strokeDasharray={phase === 'tracing' ? '7 9' : undefined}
            style={{ transition: 'fill-opacity 260ms ease' }}
          />

          {/* The child's crayon work. */}
          <g clipPath={`url(#${clipId})`}>
            {strokes.map((s, i) => (
              <polyline
                key={i}
                points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={s.colour}
                strokeWidth={CRAYON_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                // Slightly translucent so passes build up density where the
                // child goes over the same spot twice, the way wax does.
                strokeOpacity="0.88"
              />
            ))}
          </g>

          {/* Redraw the outline over the crayon so the shape's edge stays
              readable once colour covers it. */}
          {phase !== 'tracing' && (
            <path d={object?.d ?? ''} fill="none" stroke="rgba(33,31,46,0.35)" strokeWidth="3" />
          )}

          {/* Checkpoints already covered, drawn as dots along the outline —
              wordless progress the child can see building as they go. */}
          {phase === 'tracing' &&
            points.map((p, i) =>
              visited.has(i) ? <circle key={i} cx={p.x} cy={p.y} r="5" fill={ghost} /> : null,
            )}
        </svg>

        {/* No progress bar anywhere. While tracing, the dots appearing
            along the outline already show how far round the child has got —
            a second indicator of the same thing added nothing, and a bar
            filling toward a target reads uncomfortably close to the score
            §13 rules out. While colouring there is nothing to show progress
            TOWARD, since the picture is finished when the child says so. */}

        {phase === 'colouring' && (
          // The crayons stay out for the whole picture, so colours can be
          // swapped as often as the child likes. The chosen one lifts and
          // gains a ring — wordless, since this is the child's screen.
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            {PALETTE.map((c) => {
              const held = crayon === c.hex;
              return (
                <button
                  key={c.name}
                  type="button"
                  className="t4-swatch"
                  aria-label={c.name}
                  aria-pressed={held}
                  onClick={() => {
                    lastActivityRef.current = Date.now();
                    setCrayon(c.hex);
                  }}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: '50%',
                    background: c.hex,
                    border: held ? '5px solid #fff' : '3px solid rgba(255,255,255,0.9)',
                    boxShadow: held
                      ? `0 0 0 4px ${c.hex}, 0 6px 14px rgba(33,31,46,0.3)`
                      : '0 2px 8px rgba(33,31,46,0.22)',
                    transform: held ? 'translateY(-6px)' : undefined,
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
        )}

        {phase === 'colouring' && (
          // "I'm finished." The ONLY way a colouring round ends — nothing
          // measures the fill or decides on the child's behalf.
          //
          // A tick, not the word "Done": this is the child's screen and it
          // stays wordless (§7.7, §13). Deliberately a rounded rectangle
          // rather than a circle, so it cannot be mistaken for a sixth
          // crayon, and set apart from the palette with its own spacing.
          <button
            type="button"
            aria-label="Finished colouring"
            onClick={finishRound}
            style={{
              marginTop: 6,
              minWidth: 132,
              minHeight: 88,
              borderRadius: 22,
              border: '3px solid rgba(255,255,255,0.9)',
              background: '#3F7D54',
              color: '#fff',
              fontSize: '2.1rem',
              lineHeight: 1,
              boxShadow: '0 3px 10px rgba(33,31,46,0.25)',
            }}
          >
            <span aria-hidden="true">✓</span>
          </button>
        )}
      </div>
    </div>
  );
}
