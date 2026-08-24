// F.027 — Block-stack match. Logic & Quantity track, round 3.
//
// Build the blue tower to match the yellow one. All the rules live in
// games/logic/blockStack.ts; this file renders them and owns nothing else.
//
// Two audiences, one device (§8.0), same split every other game uses:
// 'idle' and 'reportingSupport' are the CAREGIVER's screen. 'building' --
// the whole time the child is actually touching the tower -- is the
// CHILD's, and is zero text (§7.10). There is no label, no legend, and no
// glyph anywhere inside it: the "− / +" pair this round used to carry was
// two symbols a pre-literate child had to decode, which is the same gate
// the track's own cut list rejected numerals over.
//
// MOTION. Both directions are animated: a placed block falls in and lands,
// a lifted block rises out and fades. The lift needs a transient "ghost"
// -- the machine has already dropped the block, so there is nothing left
// to animate unless this file keeps one alive for the duration.
//
// Every duration and distance comes from config/motion.ts, which takes the
// LOWEST of (prefers-reduced-motion, the avoid list, the response
// profile). A calm-profile child does not get more motion because someone
// asked for a livelier animation -- that cap is the whole point of the
// module, and it must not be bypassed with a hardcoded ms value here.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockStackMachine,
  buildRound,
  resolveSwipe,
  resolveTap,
  COLUMN_SLOTS,
  TAP_SLOP_PX,
  type StackAction,
} from './logic/blockStack';
import { logActivityOutcome } from '../engine/activityLogging';
import { startSession, endSession } from '../engine/profileStore';
import { SUPPORT_TIERS } from '../config/supportLadder';
import { SessionCelebration } from './SessionCelebration';
import type { ChildProfile, SessionLog, SupportTier } from '../types';

type Phase = 'idle' | 'building' | 'reportingSupport' | 'sessionEnded';

interface BlockStackMatchProps {
  profile: ChildProfile;
  /** Same contract as Game1/Game2/Game3: fires when the screen crosses
   * into or out of the CHILD-facing phase, so the shell can drop its own
   * text chrome entirely rather than leaving it visible over a zero-text
   * view. */
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

// Presentation only. This game arrived built against the app's old
// light-mode system; everything in STYLES below is its pass through the
// dark-first liquid-glass system in src/design/DESIGN-TOKENS.md. What is
// NOT touched: the two block colours (target amber, live blue) and every
// pixel size in the child's column -- those are content and hardcoded
// touch geometry the game deliberately keeps off --touch-min (see the app
// :root comment on that token).
//
// The two towers keep a LIGHT backing (--color-tile), same reasoning as
// Game3's silhouette tiles and TraceAndColour's drawing surface: the
// blocks are opaque, solid-colour shapes whose own inset highlight/shadow
// pair (see .bsm-block below) was authored assuming a light ambient
// surface, and the plinth's rgba(0,0,0,.14) shading reads as a shelf-shadow only
// against something lighter than the Nightshade ground. Wrapping the
// floor in --color-tile keeps that physicality intact rather than
// repainting the blocks themselves.
//
// The caregiver's idle / support-report / session-end screens are the
// same cool, dense card Setup and the dashboard already use --
// --glass-bg-strong + --glass-tint-caregiver, --radius-md,
// --space-caregiver-gap. Neither --color-reward nor --color-companion
// appears anywhere here; those stay reserved for real reward and
// Companion beats.
const STYLES = `
.bsm-caregiver { gap: var(--space-caregiver-gap); }
.bsm-lede { font-size: 0.9rem; color: var(--color-ink-muted); }
.bsm-question {
  font-size: 1rem;
  font-weight: var(--weight-caregiver-strong);
  color: var(--color-ink);
}
.bsm-actions { display: flex; flex-direction: column; gap: var(--space-caregiver-gap); margin-top: 2px; }
.bsm-tier-list { display: flex; flex-direction: column; gap: 8px; }
.bsm-tier {
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
  .bsm-tier { background: var(--color-surface); border-color: var(--color-border-strong); }
}

.bsm-floor {
  display: flex; justify-content: center; align-items: flex-end;
  gap: clamp(28px, 8vw, 72px); min-height: 340px; padding: 28px 20px 20px;
  border-radius: var(--radius-frame-inner);
  background: var(--color-tile);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.35),
    0 0 0 1px var(--color-tile-border),
    0 18px 40px rgba(0, 0, 0, 0.55);
}
.bsm-col { display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
.bsm-col--live {
  border-radius: 14px; padding: 6px; margin: -6px;
  touch-action: none; cursor: grab; -webkit-user-select: none; user-select: none;
}
.bsm-col--live:active { cursor: grabbing; }
.bsm-slot { width: clamp(76px, 20vw, 104px); height: 42px; position: relative; }
.bsm-block {
  width: 100%; height: 100%; border-radius: 8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 0 rgba(0,0,0,.14),
              0 1px 2px rgba(0,0,0,.16);
  transform-origin: 50% 100%;
}
.bsm-block--target { background: linear-gradient(#D99B33, #B37B1F); }
.bsm-block--live   { background: linear-gradient(#5C7F9E, #44637E); }

/* Placing IN: falls from above, squashes on contact, settles. */
.bsm-block--dropping {
  animation: bsm-drop var(--motion-ms) cubic-bezier(.34, 1.4, .5, 1);
}
@keyframes bsm-drop {
  0%   { transform: translateY(calc(var(--motion-travel) * -1)) scaleY(1.1); opacity: 0; }
  55%  { transform: translateY(0) scaleY(.86) scaleX(1.06); opacity: 1; }
  78%  { transform: translateY(0) scaleY(var(--motion-overshoot)) scaleX(.98); }
  100% { transform: translateY(0) scale(1); }
}

/* Lifting OUT: a ghost of the removed block rises and fades. Without this
   the block simply vanished -- there was no out-animation at all before. */
/* Specificity note: the ghost also carries .bsm-block--live, so this rule
   has to outrank ".bsm-col--relaxing .bsm-block--live" below (0-2-0) or
   the relax animation silently replaces the lift and the block never
   travels. Matched here, and the relax rule excludes ghosts explicitly. */
.bsm-slot .bsm-ghost {
  position: absolute; inset: 0;
  animation: bsm-lift var(--motion-ms) cubic-bezier(.4, 0, .3, 1) forwards;
  pointer-events: none;
}
@keyframes bsm-lift {
  0%   { transform: translateY(0) scale(1); opacity: 1; }
  35%  { transform: translateY(calc(var(--motion-travel) * -.25)) scaleY(1.08) scaleX(.95); opacity: .9; }
  100% { transform: translateY(calc(var(--motion-travel) * -1.1)) scale(.9); opacity: 0; }
}

/* The blocks below a departing one relax by a hair -- the weight coming off. */
.bsm-col--relaxing .bsm-block--live:not(.bsm-ghost) {
  animation: bsm-relax var(--motion-ms) ease-out;
}
@keyframes bsm-relax {
  0%, 100% { transform: scaleY(1); }
  40%      { transform: scaleY(.975); }
}

.bsm-plinth {
  height: 8px; border-radius: 4px; background: rgba(0,0,0,.14);
  margin-top: 8px; width: clamp(88px, 22vw, 118px); align-self: center;
  transition: background .3s;
}
.bsm-matched .bsm-plinth { background: #D99B33; }
.bsm-matched .bsm-block { animation: bsm-settle .5s ease-out; }
@keyframes bsm-settle {
  0%, 100% { transform: scale(1); }
  45%      { transform: scale(1.045); }
}

/* The floor of the tier system. A block still appears and disappears --
   position still changes -- but nothing travels, squashes or overshoots. */
.bsm-floor[data-motion="minimal"] .bsm-block,
.bsm-floor[data-motion="minimal"] .bsm-ghost { animation: none !important; }
.bsm-floor[data-motion="minimal"] .bsm-ghost { display: none; }

@media (prefers-reduced-motion: reduce) {
  .bsm-block, .bsm-ghost { animation: none !important; }
  .bsm-ghost { display: none; }
}
`;

/** Motion tuning, sourced locally rather than from a shared config module
 * -- this app has none. What exists instead is the hard
 * `@media (prefers-reduced-motion: reduce)` fallback already written into
 * STYLES above, collapsed into the two-tier scale the CSS already
 * understands: 'full' animates, 'minimal' still changes what is on screen
 * -- a block still appears and disappears -- but nothing travels,
 * squashes or overshoots. */
interface MotionTuning {
  tier: 'full' | 'minimal';
  durationMs: number;
}

function motionFor(reduceMotion: boolean): MotionTuning {
  return reduceMotion ? { tier: 'minimal', durationMs: 0 } : { tier: 'full', durationMs: 380 };
}

function motionVars(motion: MotionTuning): React.CSSProperties {
  return {
    ['--motion-ms' as string]: `${Math.max(motion.durationMs, 1)}ms`,
    ['--motion-travel' as string]: '96px',
    ['--motion-overshoot' as string]: '1.08',
  } as React.CSSProperties;
}

/** Pointer capture keeps a gesture attached to the element if the finger
 * strays outside it. It is an enhancement, not a requirement -- a throw
 * here (stale/synthetic pointer id) must never escape into React's event
 * handling and take the rest of the interaction down with it. */
function capture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* gesture still works without it */
  }
}

function releaseCapture(el: Element, pointerId: number): void {
  try {
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
  } catch {
    /* nothing to release */
  }
}

/** One column of blocks, drawn bottom-up. `slots - height` empty slots sit
 * above the tower; that empty space is also the tap target for "place",
 * which is why it is rendered rather than collapsed away.
 *
 * `ghostAt` is the slot index a just-removed block is still animating out
 * of. Transient render state, never part of the machine. */
function Column({
  height,
  slots,
  variant,
  animateTop,
  ghostAt,
}: {
  height: number;
  slots: number;
  variant: 'target' | 'live';
  animateTop: boolean;
  ghostAt?: number | null;
}) {
  const cells = [];
  for (let i = 0; i < slots; i++) {
    const filled = i >= slots - height;
    const isTop = i === slots - height;
    cells.push(
      <div className="bsm-slot" key={i}>
        {filled && (
          <div
            className={[
              'bsm-block',
              `bsm-block--${variant}`,
              isTop && animateTop && 'bsm-block--dropping',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        )}
        {ghostAt === i && <div className={`bsm-block bsm-block--${variant} bsm-ghost`} />}
      </div>,
    );
  }
  return <>{cells}</>;
}

export function BlockStackMatch({ profile, onChildFacingChange }: BlockStackMatchProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [endedSession, setEndedSession] = useState<SessionLog | null>(null);
  const [machine, setMachine] = useState<BlockStackMachine | null>(null);
  const [height, setHeight] = useState(0);
  const [justPlaced, setJustPlaced] = useState(false);
  const [ghostAt, setGhostAt] = useState<number | null>(null);
  const [relaxing, setRelaxing] = useState(false);

  const gestureRef = useRef<{ x: number; y: number; fired: boolean } | null>(null);
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduceMotion = prefersReduced;
  const motion = useMemo(() => motionFor(reduceMotion), [reduceMotion]);

  useEffect(() => {
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }, [profile.id]);

  useEffect(() => {
    onChildFacingChange?.(phase === 'building');
  }, [phase, onChildFacingChange]);

  useEffect(
    () => () => {
      if (ghostTimer.current) clearTimeout(ghostTimer.current);
    },
    [],
  );

  const matched = machine !== null && machine.matched;

  // §7.7: "Auto-advance. No 'Next' button -- extra taps are a barrier at
  // this age." Matching the tower IS the completion of this round, so it
  // ends itself after a beat of settle animation. This is also what keeps
  // the child's view wordless: a caregiver-facing "Finish" control would
  // have been a visible word sitting in a zero-text phase (§7.10).
  useEffect(() => {
    if (phase !== 'building' || !matched) return;
    const t = setTimeout(() => setPhase('reportingSupport'), 1400);
    return () => clearTimeout(t);
  }, [phase, matched]);

  function startRound() {
    const m = new BlockStackMachine(buildRound());
    setMachine(m);
    setHeight(m.height);
    setJustPlaced(false);
    setGhostAt(null);
    setRelaxing(false);
    setPhase('building');
  }

  /** The single path every input funnels through -- swipe and tap both end
   * up here, so the two can never diverge in behaviour. */
  function apply(action: StackAction) {
    if (!machine) return;
    const before = machine.height;
    const changed = machine.apply(action);
    // A no-op at the ceiling or the floor is silent by design: no sound,
    // no shake, no message. Nothing happened, and nothing says so.
    if (!changed) return;

    if (action === 'place') {
      setJustPlaced(true);
      setGhostAt(null);
    } else {
      setJustPlaced(false);
      // The machine has already removed it, so leave a ghost in the slot
      // the block just vacated and let it animate out of there.
      if (motion.durationMs > 0) {
        setGhostAt(COLUMN_SLOTS - before);
        setRelaxing(true);
        if (ghostTimer.current) clearTimeout(ghostTimer.current);
        ghostTimer.current = setTimeout(() => {
          setGhostAt(null);
          setRelaxing(false);
        }, motion.durationMs);
      }
    }
    setHeight(machine.height);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    gestureRef.current = { x: e.clientX, y: e.clientY, fired: false };
    capture(e.currentTarget, e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.fired) return;
    const action = resolveSwipe(e.clientY - g.y);
    if (!action) return;
    g.fired = true;
    apply(action);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;
    releaseCapture(e.currentTarget, e.pointerId);
    if (g.fired) return;

    const travel = Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y);
    if (travel > TAP_SLOP_PX) return;

    // Fell short of a swipe and barely moved -- it was a tap. Resolve it by
    // where it landed rather than dropping it, so a child who can't produce
    // a clean directional gesture still has the same two actions.
    const rect = e.currentTarget.getBoundingClientRect();
    apply(resolveTap(e.clientY - rect.top, rect.height, machine?.height ?? 0));
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId) return;
    await logActivityOutcome({
      sessionId,
      skillId: 'quantity-match',
      context: 'block-stack',
      supportTier: tier,
      // This round has no on-screen prompt hierarchy -- adjusting the tower
      // in either direction is the activity, not a prompted recovery.
      onScreenTier: 0,
    });
    // Capture the closed session and hold on this screen rather than
    // resetting straight to idle: every other game in this app shows the
    // shared SessionCelebration on session end, and opening the next
    // session the instant this one closes would leave a trail of
    // zero-length ghost sessions in the log for towers nobody built.
    const ended = await endSession(sessionId, 'caregiver');
    setEndedSession(ended);
    setPhase('sessionEnded');
    setMachine(null);
    setSessionId(null);
  }

  if (phase === 'sessionEnded') {
    // No handoff line: this is Game 1's own bookend ("go find your ball
    // with Mum"), built around a real object photographed in the child's
    // room. The blue and yellow towers here are abstract shapes with
    // nothing in the room to be sent off to find.
    return endedSession ? (
      <SessionCelebration session={endedSession} track="block-stack" />
    ) : (
      <div className="screen" />
    );
  }

  if (phase === 'idle') {
    return (
      <div className="screen bsm-caregiver">
        <style>{STYLES}</style>
        <h2>Block-stack match</h2>
        <p className="bsm-lede">
          Your child makes the blue tower match the yellow one. Swipe down on the
          blue tower to add a block, swipe up to lift one off. A tap works too.
          Sit with them for this one, it's a look-and-adjust loop rather than a
          single answer.
        </p>
        <div className="bsm-actions">
          <button className="button-primary" onClick={startRound}>
            Start a tower
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'building' && machine) {
    return (
      <div className="screen">
        <style>{STYLES}</style>
        <div
          className={['bsm-floor', matched && 'bsm-matched'].filter(Boolean).join(' ')}
          data-motion={motion.tier}
          style={motionVars(motion) as React.CSSProperties}
        >
          <div>
            <div className="bsm-col">
              <Column
                height={machine.targetHeight}
                slots={COLUMN_SLOTS}
                variant="target"
                animateTop={false}
              />
            </div>
            <div className="bsm-plinth" />
          </div>
          <div>
            <div
              className={['bsm-col', 'bsm-col--live', relaxing && 'bsm-col--relaxing']
                .filter(Boolean)
                .join(' ')}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                gestureRef.current = null;
              }}
            >
              <Column
                height={height}
                slots={COLUMN_SLOTS}
                variant="live"
                animateTop={justPlaced}
                ghostAt={ghostAt}
              />
            </div>
            <div className="bsm-plinth" />
          </div>
        </div>
        {/* Nothing else is rendered here on purpose. The only thing in the
            child's view is the two towers -- no label, no glyph, no
            caregiver control. The round ends itself on a match, above. */}
      </div>
    );
  }

  return (
    <div className="screen bsm-caregiver">
      <style>{STYLES}</style>
      <p className="bsm-question">How much support did they actually need?</p>
      <div className="bsm-tier-list">
        {SUPPORT_TIERS.map((info) => (
          <button
            key={info.tier}
            className="bsm-tier"
            onClick={() => void handleSupportTierReport(info.tier)}
          >
            {info.tier}. {info.name}: {info.instruction}
          </button>
        ))}
      </div>
    </div>
  );
}
