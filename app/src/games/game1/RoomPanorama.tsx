// The three walls, joined, and the CAREGIVER's instrument.
//
// This is not something the child operates. It exists so a grown-up can
// see where an object actually is and point at it: "it's on the shelf
// behind you." That is F.009's gesture-tier prompt, which a caregiver
// cannot give if they have no idea what the app is thinking.
//
// NO TEXT OVER ANY PHOTO. Wall direction is carried by POSITION, the left
// wall being the panel on the left, and object names live in the legend
// underneath, never as a caption stamped on the picture. Labels burned into
// a photo are unreadable at this size, sit on top of the very objects they
// describe, and cannot be translated.
//
// STYLING: dark-first liquid glass, per src/design/DESIGN-TOKENS.md, and
// restyled the same way Game3ShadowMatch.tsx and TraceAndColour.tsx were.
// Three things are worth stating outright, because each one looks like an
// oversight otherwise:
//
//   1. The shell is the CAREGIVER card material, not the child one:
//      --glass-bg-strong washed with --glass-tint-caregiver (Periwink),
//      the same slab .dashboard-card and Game 3's .g3-card use. This
//      panel is grown-up chrome and should recede behind its content.
//   2. --color-reward and --color-companion appear nowhere below. §1.3
//      reserves them for reward beats and the Companion, and a reference
//      picture consulted mid-round is neither.
//   3. --touch-min is deliberately absent. It governs caregiver TAP
//      controls, and this component has none: the only interaction is a
//      pointer drag on a panel already far taller than 44px. Nothing here
//      is a child-facing target either, so no hardcoded child floor
//      applies.
//
// The object pins keep a LIGHT backing (--color-tile) on a dark ground.
// That is §1.4's rule, not an oversight: a drawn object on a lit tile
// reads as a thing under a lamp, where a dark tile would read as a hole
// punched through the panorama.

import { useRef, useState } from 'react';
import { ObjectIcon } from '../objectIcons';
import { WALLS, onWall, type PlacedCrop, type WallCapture, type WallIndex } from './walls';

/* The glass fallback this file's two translucent surfaces repeat. Written
 * once so the @supports blocks below cannot drift apart. */
const NO_BACKDROP_FILTER =
  'not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))';

export const PANORAMA_STYLES = `
.g1-pano {
  position: relative;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background:
    linear-gradient(var(--glass-tint-caregiver), var(--glass-tint-caregiver)),
    var(--glass-bg-strong);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  padding: 22px 0 16px;
  overflow: hidden;
  perspective: 1200px;
  perspective-origin: 50% 46%;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
@supports ${NO_BACKDROP_FILTER} {
  .g1-pano { background: var(--color-surface); border-color: var(--color-border-strong); }
}
.g1-pano--grabbing { cursor: grabbing; }
.g1-pano-strip {
  display: flex;
  justify-content: center;
  transform-style: preserve-3d;
}
/* A wall is a WELL cut into the card, not another raised panel: the photo
   inside it is the brightest thing on this screen, so the surround has to
   sit below the card rather than on top of it. --color-surface-sunken is
   the same "deepest thing on screen" token the app shell uses. */
.g1-pano-wall {
  position: relative;
  flex: 0 0 auto;
  width: 168px;
  height: 126px;
  overflow: hidden;
  background: var(--color-surface-sunken);
  transform-style: preserve-3d;
  box-shadow: inset 0 0 0 1px var(--glass-border);
}
.g1-pano-wall--0 { transform-origin: right center; transform: rotateY(46deg); border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.g1-pano-wall--2 { transform-origin: left center;  transform: rotateY(-46deg); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.g1-pano-wall--empty { display: grid; place-items: center; }
.g1-pano-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* The pin keeps a LIGHT tile on purpose (§1.4). --color-tile-border is
   what separates it from a dark photo behind it; the near-black shadow is
   dark mode's own --shadow-sm, since an ink-tinted shadow disappears on
   this ground. */
.g1-pano-pin {
  position: absolute;
  width: 34px; height: 34px;
  transform: translate(-50%, -50%);
  border-radius: var(--radius-sm);
  background: var(--color-tile);
  border: 2px solid var(--color-tile-border);
  box-shadow: var(--shadow-sm);
  display: grid; place-items: center;
  padding: 3px;
}
/* The child's own favourite colour, exactly as every other accent in
   Game 1 reads it, falling back to Periwink when no colour is set. */
.g1-pano-pin--wanted {
  border-color: var(--g1-accent, var(--color-primary));
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--g1-accent, var(--color-primary)) 40%, transparent),
    var(--shadow-sm);
  z-index: 2;
}
.g1-pano-pin--done { opacity: .35; }
.g1-pano-hint {
  text-align: center;
  font-size: 0.72rem;
  color: var(--color-ink-muted);
  letter-spacing: var(--tracking-caregiver);
  margin-top: 8px;
}
.g1-pano-blank {
  font-size: 0.68rem;
  color: var(--color-ink-muted);
  padding: 6px;
  text-align: center;
}
`;

const MAX_TURN = 32;
/** Pixels of drag per degree of turn. Slow on purpose: this is a reference
 * picture being consulted mid-activity, not something to fling around. */
const DRAG_SENSITIVITY = 0.16;

export function RoomPanorama({
  placed,
  captures,
  wantedIds,
  doneIds,
}: {
  placed: PlacedCrop[];
  captures: WallCapture[];
  /** Objects the current round is asking for, ringed in the accent. */
  wantedIds?: ReadonlySet<string>;
  /** Objects already brought: faded, so the caregiver can see at a glance
   * what is left without counting. */
  doneIds?: ReadonlySet<string>;
}) {
  const [turn, setTurn] = useState(0);
  const [grabbing, setGrabbing] = useState(false);
  // A ref, not state: pointerdown and the first pointermove can land in one
  // React batch, so a handler reading the gesture's origin back out of
  // state could still see the value from before the drag began.
  const dragRef = useRef<{ x: number; from: number } | null>(null);

  function sceneFor(wall: WallIndex) {
    return captures.find((c) => c.wall === wall)?.scene;
  }

  return (
    <div>
      <div
        className={`g1-pano${grabbing ? ' g1-pano--grabbing' : ''}`}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, from: turn };
          setGrabbing(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* the drag still works without capture */
          }
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          const next = d.from + (e.clientX - d.x) * DRAG_SENSITIVITY;
          setTurn(Math.max(-MAX_TURN, Math.min(MAX_TURN, next)));
        }}
        onPointerUp={(e) => {
          dragRef.current = null;
          setGrabbing(false);
          try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          } catch {
            /* nothing to release */
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setGrabbing(false);
        }}
      >
        <div className="g1-pano-strip" style={{ transform: `rotateY(${turn}deg)` }}>
          {WALLS.map((wall) => {
            const scene = sceneFor(wall);
            const pins = onWall(placed, wall);
            const captured = captures.some((c) => c.wall === wall);
            return (
              <div key={wall} className={`g1-pano-wall g1-pano-wall--${wall}${!captured ? ' g1-pano-wall--empty' : ''}`}>
                {scene ? (
                  // Decorative: the objects on it are listed in the legend
                  // below, so a screen reader gets the content as text
                  // rather than as an unhelpful "photo of a room".
                  <img className="g1-pano-photo" src={scene.dataUrl} alt="" />
                ) : !captured ? (
                  <span className="g1-pano-blank">not photographed</span>
                ) : null}
                {pins.map((p) => (
                  <div
                    key={p.crop.id}
                    className={[
                      'g1-pano-pin',
                      wantedIds?.has(p.crop.id) && 'g1-pano-pin--wanted',
                      doneIds?.has(p.crop.id) && 'g1-pano-pin--done',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    title={`${p.crop.colour} ${p.crop.name}`}
                  >
                    <ObjectIcon name={p.crop.name} category={p.crop.category} size={26} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="g1-pano-hint">Drag to look around the room</p>
    </div>
  );
}
