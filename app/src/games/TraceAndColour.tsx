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
import { SessionCelebration } from './SessionCelebration';
import { usualSessionMinutes } from '../engine/dashboardSummary';
import { getFadingSuggestion, type FadingSuggestion } from '../engine/fading';
import {
  endSessionNow,
  getSessionNumber,
  hasCapBeenReached,
  type SessionEndResult,
} from '../engine/sessionLifecycle';
import { SUPPORT_TIERS, DEFAULT_STARTING_SUPPORT_TIER } from '../config/supportLadder';
import { PALETTE, realColourOf, type TraceObject } from './trace/tracePaths';
import {
  CRAYON_WIDTH,
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
/* Presentation only. This game arrived built against the app's old
   light-mode system; everything below is its pass through the dark-first
   liquid-glass system in src/design/DESIGN-TOKENS.md. What is NOT touched:
   the five crayon colours, the shape outlines, and every stroke the child
   draws. Those are content.

   The screen set splits the way the rest of the app does. The caregiver's
   idle / support-report / session-end screens are the cool, dense card the
   dashboard and Setup already use -- Periwink-tinted --glass-bg-strong,
   --radius-md, --space-caregiver-gap. The child's trace / colour screens
   are warm, roomy and toy-like: one lit sheet of paper in a soft glass mat,
   an Ember-tinted crayon tray, --space-child-gap between them, and exactly
   one warm action. Neither --color-reward nor --color-companion appears
   anywhere here; those stay reserved for real reward and Companion beats. */

/* ---------------------------------------------------------- caregiver */

.t4-caregiver { gap: var(--space-caregiver-gap); }

.t4-lede { font-size: 0.9rem; color: var(--color-ink-muted); }

.t4-question {
  font-size: 1rem;
  font-weight: var(--weight-caregiver-strong);
  color: var(--color-ink);
}

/* One card rather than four loose asides: the session number, the cap, the
   plan and the last logged tier are one block of status, hairline-divided
   the way the dashboard divides its rows. */
.t4-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background:
    linear-gradient(var(--glass-tint-caregiver), var(--glass-tint-caregiver)),
    var(--glass-bg-strong);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}

.t4-card > p + p {
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.t4-meta { font-size: 0.78rem; color: var(--color-ink-muted); }
.t4-meta-strong { font-size: 0.9rem; color: var(--color-ink); }
.t4-footnote { font-size: 0.72rem; color: var(--color-ink-muted); }

/* A standing note, not a warning -- nothing here is wrong. Same shape as
   the dashboard's banner: --color-info-soft with one Periwink rule down
   the leading edge, and none of the danger palette. */
.t4-note {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-info-soft);
  color: var(--color-ink-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.t4-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-caregiver-gap);
  margin-top: 2px;
}

/* The 88px floors here are the ones this file already carried, moved off
   the JSX and deliberately NOT lowered to --touch-min. */
.t4-action { min-width: 88px; min-height: 88px; }

.t4-tier-list { display: flex; flex-direction: column; gap: 8px; }

.t4-tier {
  min-width: 88px;
  min-height: 88px;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.9rem;
  font-weight: var(--weight-caregiver-body);
  line-height: 1.45;
  color: var(--color-ink);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background:
    linear-gradient(var(--glass-tint-caregiver), var(--glass-tint-caregiver)),
    var(--glass-bg-strong);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .t4-card,
  .t4-tier {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
  }
}

/* -------------------------------------------------------------- child */

.t4-child {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-child-gap);
}

/* The drawing surface stays LIGHT, for the same reason --color-tile does:
   it is a sheet of paper under a lamp. The five crayons and the shape's
   own outline were drawn for paper, and darkening the sheet would have
   meant restyling the content itself. What changed is what the sheet sits
   in -- a 14px glass mat drawn as two spread rings, so the outer corner
   (--radius-frame-inner + --frame-mat = 34px) comes out concentric with
   the inner one exactly the way the Room Frame's mat does -- plus the
   room's own warm light pooling behind it (Ember written out at low alpha,
   the way App.css's .button-accent writes it out).

   No padding and no border on this element, ever: toViewBox() maps pointer
   coordinates through getBoundingClientRect(), so anything that grows the
   box would land the child's finger in the wrong place. Rings and shadows
   are outside the layout box and are safe. */
.t4-stage {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  display: block;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  border-radius: var(--radius-frame-inner);
  background: var(--color-tile);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.4),
    0 0 0 var(--frame-mat) rgba(255, 255, 255, 0.09),
    0 0 0 calc(var(--frame-mat) + 1px) var(--glass-border),
    0 0 64px rgba(255, 176, 103, 0.13),
    0 22px 50px rgba(0, 0, 0, 0.6);
}

/* The reference picture is the same lit tile at thumbnail scale. */
.t4-reference {
  align-self: flex-end;
  width: 84px;
  height: 84px;
  padding: 8px;
  border-radius: var(--radius-md);
  background: var(--color-tile);
  box-shadow:
    0 0 0 1px var(--color-tile-border),
    inset 0 0 0 1px rgba(0, 0, 0, 0.22),
    0 8px 20px rgba(0, 0, 0, 0.5);
}

/* The crayons get their own tray, at the child temperature: the lighter,
   airier --glass-bg under an Ember tint, --radius-lg. */
.t4-crayons {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: center;
  padding: 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(var(--glass-tint-child), var(--glass-tint-child)),
    var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .t4-crayons {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
  }
}

/* Only the HELD state is styled here. Each swatch's fill is one of the five
   real crayon colours and comes straight from the palette. */
.t4-swatch {
  width: 88px;
  height: 88px;
  min-width: 88px;
  min-height: 88px;
  padding: 0;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.24);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.5);
  transition:
    transform 140ms var(--ease-out),
    box-shadow 160ms var(--ease-out),
    border-color 160ms ease;
}

/* Held: it lifts out of the tray and takes a Moonmilk ring. Ivory rather
   than a hue, because the ring has to read against all five crayons at
   once and must not compete with the single warm action below it. */
.t4-swatch[aria-pressed='true'] {
  border-color: var(--color-ink);
  transform: translateY(-6px);
  box-shadow:
    0 0 0 4px rgba(244, 239, 232, 0.9),
    0 14px 26px rgba(0, 0, 0, 0.55);
}

.t4-swatch:active { transform: scale(0.94); }
.t4-swatch[aria-pressed='true']:active { transform: translateY(-6px) scale(0.94); }

/* The one action on the child's screen, so it takes the one warm fill:
   Ember, with --color-accent-ink on it (9.71:1). Still a rounded rectangle
   and still wordless -- it must not read as a sixth crayon. */
.t4-done {
  min-width: var(--child-action-min);
  min-height: 88px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.34);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
    var(--color-accent);
  color: var(--color-accent-ink);
  font-size: 2.1rem;
  line-height: 1;
  box-shadow: 0 12px 30px rgba(255, 176, 103, 0.26), var(--glass-rim-top);
}

@keyframes t4-pop { 0% { transform: scale(0.9); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
.t4-celebrate { animation: t4-pop 520ms cubic-bezier(0.23,1,0.32,1) forwards; }

@media (prefers-reduced-motion: reduce) {
  .t4-celebrate { animation: none; }
  .t4-swatch { transition: none; }
}
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

  // The caregiver's usual sitting length (dashboard), which is where
  // this session's cap starts. Read once here so the session poller can
  // depend on the number rather than on the whole profile object.
  const capFirstMinutes = usualSessionMinutes(profile);

  const handleEndSession = useCallback(
    async (reason: 'cap' | 'idle' | 'caregiver' | 'finished') => {
      if (!sessionId) return;
      setPhase('sessionEnded');
      const result = await endSessionNow(sessionId, reason, object?.name ?? null);
      setSessionEndResult(result);
    },
    [sessionId, object],
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
      const [session, number] = await Promise.all([startSession(profile.id, 'trace'), getSessionNumber(profile.id)]);
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

      if (hasCapBeenReached(sessionNumber, elapsed, capFirstMinutes)) {
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
  }, [sessionId, sessionNumber, phase, handleEndSession, capFirstMinutes]);

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
      renderLine('Trace the shape with your finger.', slotValuesFromProfile(profile)),
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
              renderLine('Now colour it in!', slotValuesFromProfile(profile)),
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
      renderLine('Your {object.name}!', slotValuesFromProfile(profile, { 'object.name': object?.name ?? '' })),
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
    // No child-facing "go find X with your grown-up" handoff line. That
    // line is built around Game 1's premise: a REAL object photographed in
    // the child's own room, which they can meaningfully be sent off to
    // find. This game's shapes are traced on screen, not something in the
    // room -- "go find your circle" does not mean anything to send a child
    // off to do. Game 1 keeps that line; it is real there.
    return sessionEndResult ? (
      <SessionCelebration session={sessionEndResult.session} track="trace" />
    ) : (
      <div className="screen t4-caregiver">
        <style>{STYLES}</style>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="screen t4-caregiver">
        <style>{STYLES}</style>
        <h2>Trace and Colour</h2>
        <p className="t4-lede">
          Follow the outline with a finger, then colour it in. Any colour is fine — this
          activity is about the tracing.
        </p>
        {/* The caregiver's own content only. The session/cap/elapsed
            readout that used to head this card is gone: it was plumbing on
            a screen a child is usually looking at too, and every figure in
            it now lands on the dashboard instead, where it can be read
            without a child waiting. */}
        {lastLoggedTier && (
          <div className="t4-card">
            <p className="t4-meta">
              Last logged support tier: {lastLoggedTier} (
              {SUPPORT_TIERS.find((t) => t.tier === lastLoggedTier)?.name})
            </p>
          </div>
        )}
        {fadingSuggestion && <p className="t4-note">{fadingSuggestion.message}</p>}
        <div className="t4-actions">
          <button className="t4-action button-primary" onClick={startRound}>
            Start tracing
          </button>
          <button type="button" className="quiet-action" onClick={() => void handleEndSession('caregiver')}>
            <span className="quiet-action-chip">End session</span>
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'reportingSupport') {
    return (
      <div className="screen t4-caregiver">
        <style>{STYLES}</style>
        <p className="t4-question">How much support did they need to trace it?</p>
        <p className="t4-note">
          Support tier {suggestedTier.tier} — {suggestedTier.name}: {suggestedTier.instruction}
        </p>
        <div className="t4-tier-list">
          {SUPPORT_TIERS.map((info) => (
            <button
              key={info.tier}
              className="t4-tier"
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
      <div className="t4-child">
        {/* A small reference of the finished thing, beside the space being
            coloured. The 10% ghost inside the outline says where the colour
            goes; this says what the object actually looks like, at a size
            worth looking at. Only while colouring — during tracing it would
            give away the shape being followed. */}
        {phase === 'colouring' && object && (
          <div className="t4-reference">
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
          <div className="t4-crayons">
            {/* The fill below is the crayon's own colour and stays inline —
                it is content, not chrome. Everything about HOW a swatch
                looks, held or not, lives in .t4-swatch / its [aria-pressed]
                state, so the selected treatment can be restyled without
                anyone having to touch the five colours. */}
            {PALETTE.map((c) => (
              <button
                key={c.name}
                type="button"
                className="t4-swatch"
                aria-label={c.name}
                aria-pressed={crayon === c.hex}
                onClick={() => {
                  lastActivityRef.current = Date.now();
                  setCrayon(c.hex);
                }}
                style={{ background: c.hex }}
              />
            ))}
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
            className="t4-done"
            onClick={finishRound}
          >
            <span aria-hidden="true">✓</span>
          </button>
        )}
      </div>
    </div>
  );
}
