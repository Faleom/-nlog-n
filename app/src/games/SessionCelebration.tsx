// The end of a session, for the child. One screen, shared by all four
// games, so a finished activity concludes the same way everywhere.
//
// Replaces the caregiver diagnostics panel that used to sit here ("Session
// 10 — cap 6min, elapsed 21s"). That panel told the child nothing and the
// caregiver very little; the same figures now land on the dashboard, where
// a caregiver can read them without a child waiting on the screen.
//
// Palette: this is a CHILD screen, so it is the one place the reserved
// hues belong -- DESIGN-TOKENS §1.3 keeps Sunburst for "reward beats only,
// the moment a child gets it right". The confetti is drawn from Sunburst,
// Blush and Ember for exactly that reason, and none of it appears anywhere
// on the caregiver side.
//
// prefers-reduced-motion drops the fall entirely rather than shortening
// it: this audience includes children for whom motion is the reason a
// screen becomes unusable, and a celebration that has to move is not one.

import { useEffect } from 'react';
import { adapters } from '../adapters/registry';
import { describeAchievement, spokenAchievement } from './sessionEndingLogic';
import type { SessionLog, TrackId } from '../types';

interface SessionCelebrationProps {
  session: SessionLog;
  track: TrackId;
  /** Said after the celebration line -- Game 1's Companion bookend
   * ("go find your ball with Mum"). Omitted where it would be a lie: the
   * other three games have no real object in the room to send anyone to. */
  handoffLine?: string;
}

// Fixed, not random: the same shape every time is the point for a child
// who needs to know what a screen is going to do. Left offset, delay,
// drift and hue index per piece.
const CONFETTI = [
  { x: 6, delay: 0, drift: 14, hue: 0 },
  { x: 18, delay: 120, drift: -10, hue: 1 },
  { x: 29, delay: 60, drift: 8, hue: 2 },
  { x: 41, delay: 200, drift: -14, hue: 0 },
  { x: 52, delay: 20, drift: 12, hue: 1 },
  { x: 63, delay: 160, drift: -8, hue: 2 },
  { x: 74, delay: 90, drift: 10, hue: 0 },
  { x: 86, delay: 240, drift: -12, hue: 1 },
  { x: 94, delay: 40, drift: 6, hue: 2 },
  { x: 12, delay: 300, drift: -6, hue: 2 },
  { x: 35, delay: 340, drift: 10, hue: 1 },
  { x: 58, delay: 280, drift: -10, hue: 0 },
  { x: 80, delay: 380, drift: 8, hue: 2 },
] as const;

const STYLES = `
.celebrate {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 60vh;
  padding: 24px 20px 40px;
  text-align: center;
  overflow: hidden;
}
.celebrate-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.celebrate-piece {
  position: absolute;
  top: -16px;
  width: 10px;
  height: 14px;
  border-radius: 2px;
  opacity: 0;
  animation: celebrate-fall 2.6s cubic-bezier(0.3, 0.7, 0.4, 1) forwards;
}
.celebrate-piece--0 { background: var(--color-reward); }
.celebrate-piece--1 { background: var(--color-companion); }
.celebrate-piece--2 { background: var(--color-accent); }
@keyframes celebrate-fall {
  0% { transform: translate3d(0, -10px, 0) rotate(0deg); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate3d(var(--drift), 78vh, 0) rotate(420deg); opacity: 0; }
}
.celebrate-mark {
  display: grid;
  place-items: center;
  width: 108px;
  height: 108px;
  border-radius: 50%;
  background: var(--color-reward);
  color: var(--color-reward-ink);
  box-shadow: 0 0 0 14px var(--color-reward-glow);
  animation: celebrate-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes celebrate-pop {
  0% { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.celebrate-headline {
  margin: 0;
  font-size: 1.7rem;
  line-height: 1.25;
  font-weight: 800;
}
.celebrate-detail {
  margin: 0;
  font-size: 1rem;
  color: var(--color-ink-muted);
}
.celebrate-handoff {
  margin: 8px 0 0;
  font-size: 1.05rem;
  line-height: 1.4;
}
@media (prefers-reduced-motion: reduce) {
  .celebrate-piece { display: none; }
  .celebrate-mark { animation: none; }
}
`;

export function SessionCelebration({ session, track, handoffLine }: SessionCelebrationProps) {
  const { headline, detail } = describeAchievement(session, track);

  useEffect(() => {
    // Said, not just shown: the child this is for may not read. The line
    // goes through the same speech port as every other spoken line.
    const line = spokenAchievement(session, track);
    void adapters.speechOut.say(handoffLine ? `${line} ${handoffLine}` : line);
  }, [session, track, handoffLine]);

  return (
    <div className="screen celebrate">
      <style>{STYLES}</style>

      <div className="celebrate-burst" aria-hidden="true">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className={`celebrate-piece celebrate-piece--${piece.hue}`}
            style={{
              left: `${piece.x}%`,
              animationDelay: `${piece.delay}ms`,
              ['--drift' as string]: `${piece.drift}px`,
            }}
          />
        ))}
      </div>

      <span className="celebrate-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="52" height="52" fill="none">
          <path
            d="M12 25.5 L20.5 34 L36 15"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <h2 className="celebrate-headline">{headline}</h2>
      {detail && <p className="celebrate-detail">{detail}</p>}
      {handoffLine && <p className="celebrate-handoff">{handoffLine}</p>}
    </div>
  );
}
