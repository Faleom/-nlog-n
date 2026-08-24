// F.028 — Sort by rule. Logic & Quantity track, round 4.
//
// One example already sits in each basket; that's the rule, shown rather
// than stated. All the rules live in games/logic/sortByRule.ts; this file
// renders them.
//
// TWO INPUTS, ONE PRIMARY. Tap a shape, then tap a basket -- two taps,
// each a plain discrete press. A drag also works if a child reaches for
// one, but is never required, because a drag needs sustained contact that
// some children in this band genuinely cannot hold. This is the same call
// Game 2's sequencing and Game 3's puzzle mode already made (§8.2 step 5,
// §8.3 Mode C); it is a standing accessibility decision, not a preference,
// so do not quietly promote drag to the only path.
//
// A round sorts by ONE of shape / size / fill / colour, with every other
// dimension held constant -- see the invariant at the top of the logic
// module. This file must render all four dimensions faithfully and add no
// visual difference of its own: a decorative shadow that varies per item,
// or a hover tint on one basket, would introduce a second varying property
// and break the round exactly as surely as a data change would.
//
// Zero text in the child's view (§7.10): shapes carry aria-labels for
// assistive tech and nothing visible. No caption, no counter, no tally of
// how many are left.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SortMachine,
  buildSortRound,
  onScreenTierFromMisses,
  valueOn,
  type SortAttributes,
  type SortInputMethod,
  type SortItem,
  type SortValue,
} from './logic/sortByRule';
import { logActivityOutcome } from '../engine/activityLogging';
import { startSession, endSession } from '../engine/profileStore';
import { SUPPORT_TIERS } from '../config/supportLadder';
import { SessionCelebration } from './SessionCelebration';
import type { ChildProfile, SessionLog, SupportTier } from '../types';

type Phase = 'idle' | 'sorting' | 'reportingSupport' | 'sessionEnded';

interface SortByRuleProps {
  profile: ChildProfile;
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

/** The one place a colour name becomes a pixel value. Muted rather than
 * primary -- §5.2 Q1 tunes colour saturation, and this track's rounds are
 * long-looking tasks where a saturated palette fatigues faster. */
const COLOUR_HEX: Record<string, string> = {
  blue: '#5C7F9E',
  green: '#6E9367',
  orange: '#D99B33',
  purple: '#8B7AA8',
};

// Presentation only. This game arrived built against the app's old
// light-mode system; everything in STYLES below is its pass through the
// dark-first liquid-glass system in src/design/DESIGN-TOKENS.md. What is
// NOT touched: the mark colours (COLOUR_HEX above), the shape outlines
// and every pixel size in the tray/basket items -- those are content and
// hardcoded touch geometry this game deliberately keeps off --touch-min
// (see the app :root comment on that token).
//
// .sbr-stage keeps a LIGHT backing (--color-tile), same reasoning as
// Game3's silhouette tiles and TraceAndColour's drawing surface: the
// basket borders and tray divider below were authored as low-alpha BLACK
// rgba(0,0,0,..) lines, meant to read against a light sheet -- on the
// Nightshade ground directly they would all but disappear. Wrapping the
// stage in --color-tile keeps that physicality intact rather than
// repainting every dashed line to a light rgba.
//
// The caregiver's idle / support-report / session-end screens are the
// same cool, dense card Setup and the dashboard already use --
// --glass-bg-strong + --glass-tint-caregiver, --radius-md,
// --space-caregiver-gap. Neither --color-reward nor --color-companion
// appears anywhere here; those stay reserved for real reward and
// Companion beats.
const STYLES = `
.sbr-caregiver { gap: var(--space-caregiver-gap); }
.sbr-lede { font-size: 0.9rem; color: var(--color-ink-muted); }
.sbr-question {
  font-size: 1rem;
  font-weight: var(--weight-caregiver-strong);
  color: var(--color-ink);
}
.sbr-actions { display: flex; flex-direction: column; gap: var(--space-caregiver-gap); margin-top: 2px; }
.sbr-tier-list { display: flex; flex-direction: column; gap: 8px; }
.sbr-tier {
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
  .sbr-tier { background: var(--color-surface); border-color: var(--color-border-strong); }
}

.sbr-stage {
  padding: 24px 20px 20px;
  border-radius: var(--radius-frame-inner);
  background: var(--color-tile);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.35),
    0 0 0 1px var(--color-tile-border),
    0 18px 40px rgba(0, 0, 0, 0.55);
}
.sbr-baskets {
  display: flex; justify-content: center; gap: clamp(20px, 6vw, 56px);
  margin-bottom: 26px;
}
.sbr-basket {
  width: clamp(128px, 34vw, 168px); min-height: 136px;
  border: 2px solid rgba(0,0,0,.18); border-top-style: dashed;
  border-radius: 12px 12px 20px 20px;
  background: rgba(0,0,0,.03);
  display: flex; flex-wrap: wrap; align-content: flex-end; justify-content: center;
  gap: 8px; padding: 12px;
  transition: border-color .2s, transform .2s;
}
/* Armed state is a BORDER change only. A background tint here would be a
   second varying property in a colour round -- see the file header. */
.sbr-basket--armed { border-color: rgba(0,0,0,.5); transform: scale(1.03); }
.sbr-tray {
  display: flex; justify-content: center; flex-wrap: wrap; gap: 12px;
  min-height: 104px; align-items: center;
  border-top: 1px dashed rgba(0,0,0,.18); padding-top: 18px;
}
.sbr-item {
  width: 88px; height: 88px; display: grid; place-items: center;
  border: none; background: none; padding: 0; cursor: pointer;
  touch-action: none; -webkit-user-select: none; user-select: none;
  transition: transform var(--motion-ms) cubic-bezier(.34, 1.4, .5, 1);
}
.sbr-item--selected { transform: translateY(-10px) scale(1.06); }
.sbr-item--dragging { transition: none; z-index: 5; position: relative; }
.sbr-item--homing   { transition: transform var(--motion-ms) cubic-bezier(.4,0,.2,1); }
.sbr-item svg { display: block; overflow: visible; }
.sbr-item svg .sbr-mark {
  filter: drop-shadow(0 2px 3px rgba(0,0,0,.22));
  transition: filter .2s;
}
.sbr-item--selected svg .sbr-mark { filter: drop-shadow(0 9px 12px rgba(0,0,0,.28)); }

.sbr-basket .sbr-item { width: 60px; height: 60px; cursor: default; }
.sbr-basket .sbr-item--landed { animation: sbr-land var(--motion-ms) cubic-bezier(.34,1.4,.5,1); }
@keyframes sbr-land {
  0%   { transform: translateY(calc(var(--motion-travel) * -1)) scale(1.25); opacity: 0; }
  60%  { transform: translateY(0) scale(.94); opacity: 1; }
  100% { transform: translateY(0) scale(1); }
}

.sbr-stage[data-motion="minimal"] .sbr-item,
.sbr-stage[data-motion="minimal"] .sbr-basket { transition: none !important; animation: none !important; }

@media (prefers-reduced-motion: reduce) {
  .sbr-item, .sbr-basket { transition: none !important; animation: none !important; }
}
`;

/** Motion tuning, sourced locally rather than from a shared config module
 * -- this app has none. What exists instead is the hard
 * `@media (prefers-reduced-motion: reduce)` fallback already written into
 * STYLES above, collapsed into the two-tier scale the CSS already
 * understands: 'full' animates, 'minimal' still changes what is on screen
 * but nothing travels, squashes or lands with a bounce. */
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

/** Renders one item from its full attribute set.
 *
 * Every dimension is drawn here and nowhere else: shape as the SVG
 * element, colour as the paint, fill as painted-vs-stroked, size as the
 * rendered box. SVG rather than CSS because a hollow triangle is trivial
 * here and awkward with borders and clip-paths. */
function Mark({ attrs }: { attrs: SortAttributes }) {
  const px = attrs.size === 'big' ? 62 : 40;
  const hex = COLOUR_HEX[attrs.colour] ?? COLOUR_HEX.blue;
  const hollow = attrs.fill === 'hollow';
  const paint = hollow
    ? { fill: 'none', stroke: hex, strokeWidth: 12, strokeLinejoin: 'round' as const }
    : { fill: hex, stroke: 'none' };

  return (
    <svg width={px} height={px} viewBox="0 0 100 100" aria-hidden="true">
      {attrs.shape === 'round' && <circle className="sbr-mark" cx="50" cy="50" r="44" {...paint} />}
      {attrs.shape === 'square' && (
        <rect className="sbr-mark" x="8" y="8" width="84" height="84" rx="10" {...paint} />
      )}
      {attrs.shape === 'triangle' && (
        <polygon className="sbr-mark" points="50,10 92,88 8,88" {...paint} />
      )}
    </svg>
  );
}

export function SortByRule({ profile, onChildFacingChange }: SortByRuleProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [endedSession, setEndedSession] = useState<SessionLog | null>(null);
  const [machine, setMachine] = useState<SortMachine | null>(null);
  const [, forceRender] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armed, setArmed] = useState<SortValue | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [landedIds, setLandedIds] = useState<Set<string>>(new Set());

  const basketRefs = useRef<Map<SortValue, HTMLDivElement | null>>(new Map());
  const dragRef = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const lastInput = useRef<SortInputMethod>('tap');

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduceMotion = prefersReduced;
  const motion = useMemo(() => motionFor(reduceMotion), [reduceMotion]);

  useEffect(() => {
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }, [profile.id]);

  useEffect(() => {
    onChildFacingChange?.(phase === 'sorting');
  }, [phase, onChildFacingChange]);

  // Same rule as every other game: the round ends itself when it is done,
  // rather than putting a worded caregiver control inside the child's
  // zero-text view (§7.7 auto-advance, §7.10 zero text).
  useEffect(() => {
    if (phase !== 'sorting' || !machine?.complete) return;
    const t = setTimeout(() => setPhase('reportingSupport'), 1400);
    return () => clearTimeout(t);
  }, [phase, machine, landedIds]);

  function startRound() {
    setMachine(new SortMachine(buildSortRound()));
    setSelectedId(null);
    setArmed(null);
    setLandedIds(new Set());
    setPhase('sorting');
  }

  /** The single path both inputs funnel through. */
  function offer(itemId: string, basket: SortValue, how: SortInputMethod) {
    if (!machine) return;
    lastInput.current = how;
    const result = machine.deposit(itemId, basket);
    setSelectedId(null);
    if (result === 'accepted') {
      setLandedIds((prev) => new Set(prev).add(itemId));
    }
    // A 'returned' result gets NO branch here on purpose. The item goes back
    // to the tray and that is the entire response -- no sound, no colour, no
    // shake, no message. Adding one breaks §7.7.
    forceRender((n) => n + 1);
  }

  function basketAtPoint(x: number, y: number): SortValue | null {
    for (const [value, el] of basketRefs.current) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return value;
    }
    return null;
  }

  function handleItemPointerDown(e: React.PointerEvent<HTMLButtonElement>, item: SortItem) {
    dragRef.current = { id: item.id, x: e.clientX, y: e.clientY, moved: false };
    capture(e.currentTarget, e.pointerId);
  }

  function handleItemPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 10) return;
    if (!d.moved) {
      d.moved = true;
      setDragId(d.id);
      setSelectedId(null);
    }
    setDragOffset({ x: dx, y: dy });
    setArmed(basketAtPoint(e.clientX, e.clientY));
  }

  function handleItemPointerUp(e: React.PointerEvent<HTMLButtonElement>, item: SortItem) {
    const d = dragRef.current;
    dragRef.current = null;
    releaseCapture(e.currentTarget, e.pointerId);
    setArmed(null);
    setDragId(null);
    setDragOffset({ x: 0, y: 0 });
    if (!d) return;

    if (!d.moved) {
      // A plain press: select it, or deselect if it was already selected.
      setSelectedId((prev) => (prev === item.id ? null : item.id));
      return;
    }

    const basket = basketAtPoint(e.clientX, e.clientY);
    if (basket) offer(item.id, basket, 'drag');
    // Dropped on nothing: it simply returns. Same silence as a wrong basket.
  }

  function handleBasketTap(basket: SortValue) {
    if (!selectedId) return;
    offer(selectedId, basket, 'tap');
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId || !machine) return;
    await logActivityOutcome({
      sessionId,
      skillId: `sort-by-${machine.dimension}`,
      context: 'logic-track',
      supportTier: tier,
      onScreenTier: onScreenTierFromMisses(machine.misses),
    });
    // Capture the closed session and hold on this screen rather than
    // resetting straight to idle: every other game in this app shows the
    // shared SessionCelebration on session end, and opening the next
    // session the instant this one closes would leave a trail of
    // zero-length ghost sessions in the log for rounds nobody sorted.
    const ended = await endSession(sessionId, 'caregiver');
    setEndedSession(ended);
    setPhase('sessionEnded');
    setMachine(null);
    setSessionId(null);
  }

  if (phase === 'sessionEnded') {
    // No handoff line: this is Game 1's own bookend ("go find your ball
    // with Mum"), built around a real object photographed in the child's
    // room. This game's shapes are abstract marks with nothing in the
    // room to be sent off to find.
    return endedSession ? (
      <SessionCelebration session={endedSession} track="sort-by-rule" />
    ) : (
      <div className="screen" />
    );
  }

  if (phase === 'idle') {
    return (
      <div className="screen sbr-caregiver">
        <style>{STYLES}</style>
        <h2>Sort by rule</h2>
        <p className="sbr-lede">
          One thing already sits in each basket. That's the rule, shown rather
          than explained. Your child taps a shape, then taps a basket. Dragging
          works too if they reach for it, but it's never needed. Each round sorts
          by one thing only: shape, size, outline, or colour.
        </p>
        <div className="sbr-actions">
          <button className="button-primary" onClick={startRound}>
            Start sorting
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'sorting' && machine) {
    return (
      <div className="screen">
        <style>{STYLES}</style>
        <div
          className="sbr-stage"
          data-motion={motion.tier}
          style={motionVars(motion) as React.CSSProperties}
        >
          <div className="sbr-baskets">
            {machine.baskets.map((basket) => (
              <div
                key={String(basket)}
                ref={(el) => {
                  basketRefs.current.set(basket, el);
                }}
                className={['sbr-basket', armed === basket && 'sbr-basket--armed']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleBasketTap(basket)}
              >
                {/* The seeded example. This is the rule. */}
                <div className="sbr-item">
                  <Mark attrs={machine.seed(basket)} />
                </div>
                {machine.contents(basket).map((item) => (
                  <div
                    key={item.id}
                    className={['sbr-item', landedIds.has(item.id) && 'sbr-item--landed']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <Mark attrs={item.attrs} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="sbr-tray">
            {machine.remaining.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-label={String(valueOn(item, machine.dimension))}
                className={[
                  'sbr-item',
                  selectedId === item.id && 'sbr-item--selected',
                  dragId === item.id && 'sbr-item--dragging',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  dragId === item.id
                    ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.06)` }
                    : undefined
                }
                onPointerDown={(e) => handleItemPointerDown(e, item)}
                onPointerMove={handleItemPointerMove}
                onPointerUp={(e) => handleItemPointerUp(e, item)}
                onPointerCancel={() => {
                  dragRef.current = null;
                  setDragId(null);
                  setArmed(null);
                }}
              >
                <Mark attrs={item.attrs} />
              </button>
            ))}
          </div>
        </div>
        {/* Nothing else is rendered here on purpose -- no caregiver
            control, no label, no count of what's left. The round ends
            itself once the tray is empty, above. */}
      </div>
    );
  }

  return (
    <div className="screen sbr-caregiver">
      <style>{STYLES}</style>
      <p className="sbr-question">How much support did they actually need?</p>
      <div className="sbr-tier-list">
        {SUPPORT_TIERS.map((info) => (
          <button
            key={info.tier}
            className="sbr-tier"
            onClick={() => void handleSupportTierReport(info.tier)}
          >
            {info.tier}. {info.name}: {info.instruction}
          </button>
        ))}
      </div>
    </div>
  );
}
