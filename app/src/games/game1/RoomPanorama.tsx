// The three walls, joined — the CAREGIVER's instrument.
//
// This is not something the child operates. It exists so a grown-up can
// see where an object actually is and point at it: "it's on the shelf
// behind you." That is F.009's gesture-tier prompt, which a caregiver
// cannot give if they have no idea what the app is thinking.
//
// NO TEXT OVER ANY PHOTO. Wall direction is carried by POSITION — the left
// wall is the panel on the left — and object names live in the legend
// underneath, never as a caption stamped on the picture. Labels burned into
// a photo are unreadable at this size, sit on top of the very objects they
// describe, and cannot be translated.

import { useRef, useState } from 'react';
import { ObjectIcon } from '../objectIcons';
import { WALLS, onWall, type PlacedCrop, type WallCapture, type WallIndex } from './walls';

export const PANORAMA_STYLES = `
.g1-pano {
  position: relative;
  border-radius: 14px;
  background: rgba(0,0,0,.05);
  padding: 22px 0 16px;
  overflow: hidden;
  perspective: 1200px;
  perspective-origin: 50% 46%;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.g1-pano--grabbing { cursor: grabbing; }
.g1-pano-strip {
  display: flex;
  justify-content: center;
  transform-style: preserve-3d;
}
.g1-pano-wall {
  position: relative;
  flex: 0 0 auto;
  width: 168px;
  height: 126px;
  overflow: hidden;
  background: rgba(120,120,140,.16);
  transform-style: preserve-3d;
  box-shadow: 0 1px 0 rgba(0,0,0,.06);
}
.g1-pano-wall--0 { transform-origin: right center; transform: rotateY(46deg); border-radius: 8px 0 0 8px; }
.g1-pano-wall--2 { transform-origin: left center;  transform: rotateY(-46deg); border-radius: 0 8px 8px 0; }
.g1-pano-wall--empty { display: grid; place-items: center; }
.g1-pano-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.g1-pano-pin {
  position: absolute;
  width: 34px; height: 34px;
  transform: translate(-50%, -50%);
  border-radius: 9px;
  background: rgba(255,255,255,.92);
  border: 2px solid rgba(0,0,0,.14);
  box-shadow: 0 2px 5px rgba(0,0,0,.28);
  display: grid; place-items: center;
  padding: 3px;
}
.g1-pano-pin--wanted {
  border-color: var(--g1-accent, #5b52e8);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--g1-accent, #5b52e8) 34%, transparent), 0 2px 5px rgba(0,0,0,.3);
  z-index: 2;
}
.g1-pano-pin--done { opacity: .3; }
.g1-pano-hint {
  text-align: center;
  font-size: 0.72rem;
  opacity: 0.55;
  margin-top: 6px;
}
.g1-pano-blank { font-size: 0.68rem; opacity: 0.5; padding: 6px; text-align: center; }
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
  /** Objects the current round is asking for — ringed in the accent. */
  wantedIds?: ReadonlySet<string>;
  /** Objects already brought — faded, so the caregiver can see at a glance
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
