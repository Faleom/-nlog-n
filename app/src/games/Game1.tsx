// Game 1 — Find It In Your World (F.008, the Tier 0 gate). §8.1.
//
// Replaces the walking skeleton this file used to be. Everything below the
// "engine wiring" — session lifecycle, the interaction state machine, the
// support ladder, fading, logging — is Person 1's already-finished engine,
// unchanged: see interactionMachine.ts, activityLogging.ts, fading.ts,
// sessionLifecycle.ts. This file is the "thin layer" §12.2 describes: what
// skill Game 1 targets, what interaction shape it uses, how it renders a
// step. F.012 (difficulty levels) and F.017 (Companion mechanic) extend
// this same file rather than replacing it.
//
// Two audiences, one device (§8.0): 'idle' / 'capturing' / 'searching' /
// 'reportingSupport' / 'sessionEnded' are the CAREGIVER's screen — text is
// fine there, the caregiver operates the device. 'confirming' and
// 'celebrating' are the CHILD's screen, the moment they're handed the
// device — those two phases must be zero text, icons/photos/audio only
// (§7.7, §13's "no points, stars, confetti").
//
// The capture pipeline is reached ONLY through
// adapters/pipeline/myWorldPipeline.ts's captureRoomAndRecognize() — see
// that file's header for why calling adapters.capture/adapters.vision
// directly here would silently defeat the whole F.006 face-blur
// guarantee. scripts/smoke-f006.ts's static check enforces this.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { adapters } from '../adapters/registry';
import { captureRoomAndRecognize } from '../adapters/pipeline/myWorldPipeline';
import { renderLine, slotValuesFromProfile } from '../engine/slots';
import { InteractionMachine, type PromptTier } from '../engine/interactionMachine';
import { startSession } from '../engine/profileStore';
import { logActivityOutcome } from '../engine/activityLogging';
import { SessionCelebration } from './SessionCelebration';
import { getFadingSuggestion, type FadingSuggestion } from '../engine/fading';
import { getSkillTemplatesForCrop, getSkillTemplatesForObject } from '../engine/skillLookup';
import { endSessionNow, getSessionNumber, type SessionEndResult } from '../engine/sessionLifecycle';
import { SUPPORT_TIERS, DEFAULT_STARTING_SUPPORT_TIER } from '../config/supportLadder';
import { GENERIC_FALLBACK_CROPS } from './genericFallbackCrops';
import { ObjectIcon } from './objectIcons';
import { iconKeyFor } from './objectIconLogic';
import { pickNextTarget } from './game1Trial';
import { getGame1Level, setGame1Level, type Game1Level } from './game1Level';
import {
  buildQuest,
  isQuestComplete,
  remainingFor,
  questBrief,
  questSkillId,
  type Quest,
} from './game1/quests';
import {
  WALLS,
  WALL_SHORT,
  canStart,
  cropsOf,
  directionFor,
  onWall,
  placeCrops,
  type PlacedCrop,
  type WallCapture,
  type WallIndex,
} from './game1/walls';
import { RoomPanorama, PANORAMA_STYLES } from './game1/RoomPanorama';
import {
  applyProfileTuning,
  buildConfirmationGrid,
  buildSearchPromptTemplate,
  searchScopeLabelForLevel,
  shuffleGrid,
  targetDescriptionForLevel,
} from './game1Difficulty';
import {
  COMPANION_HUNT_PROMPT_TEMPLATE,
  HELPER_FRAMING_PROMPT_TEMPLATE,
  hasCompanion,
  rewardFrameColour,
  shouldUseHelperFraming,
} from './game1Companion';
import type { VisionScene } from '../adapters/ports';
import type { ChildProfile, SkillTemplate, SupportTier, TaggedCrop } from '../types';

type Phase =
  | 'idle'
  | 'capturing'
  | 'foundObjects'
  | 'searching'
  | 'confirming'
  | 'celebrating'
  | 'reportingSupport'
  | 'movementBreak'
  | 'sessionEnded';

interface Game1Props {
  profile: ChildProfile;
  /** Fires whenever the screen crosses into or out of the CHILD's two
   * phases (§8.0). The shell (App.tsx) uses this to hide its own chrome —
   * the wayfinding header and back button — since any text there would
   * violate the same zero-text rule this file already enforces on its own
   * confirming/celebrating JSX. */
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

/** Loose common-colour-word → CSS colour mapping. The recognised object's
 * own colour is no longer the whole tile (see CropButton) — it's now the
 * tile's border and background tint, sitting behind the object's artwork.
 * Two independent cues, both wordless: what the thing IS (the drawing) and
 * what colour it is (the frame) — which is what makes a level-2 prompt
 * like "find the RED cup" discriminable at all. */
function swatchColour(colour: string): string {
  const known = new Set([
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'grey', 'gray', 'gold', 'silver', 'teal', 'cyan',
  ]);
  return known.has(colour.toLowerCase()) ? colour.toLowerCase() : 'var(--color-border-strong)';
}

/** Never let two objects the child can't reliably tell apart end up as
 * separate options in the same trial. A real room routinely has several
 * objects that draw the identical icon (three cushions on one couch, two
 * near-identical cups) -- same shape, only a subtle tint different, which
 * is not a reliable cue for a preschooler being asked "which one did you
 * bring?" (and isn't a reliable cue for the app either: if the picked
 * target and the child's real physical object are two DIFFERENT cushions
 * that happen to share a tile, there is no way to confirm correctly).
 * Keeps the first crop for each distinct icon; everything downstream
 * (target picking, the confirmation grid) only ever sees one candidate
 * per look. Deliberately does NOT touch the `crops` state used by
 * ObjectLegend/RoomMap -- those are caregiver-facing, have real text
 * names, and showing "found 3 cushions" there is honest information, not
 * a confusing choice. */
function dedupeCropsByIcon(pool: TaggedCrop[]): TaggedCrop[] {
  const seen = new Set<string>();
  const result: TaggedCrop[] = [];
  for (const crop of pool) {
    const key = iconKeyFor(crop.name, crop.category);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(crop);
  }
  return result;
}

/** F.007 (§7.5): the authored skill a trial is actually practising.
 *
 * engine/skillLookup.ts returns every skill an object can teach (3-4 per
 * object, degrading exact object -> category -> fully generic, never
 * empty). Game 1's interaction shape is exactly ONE of them: go and fetch
 * the thing and bring it back — the retrieval template, which every
 * branch of that table authors and names `find-<something>`. Selecting it
 * by that prefix rather than blindly taking [0] keeps this honest if the
 * table's ordering ever changes; the ?? is a pure safety net (the lookup
 * documents that it never returns an empty array).
 *
 * This is a DIFFERENT axis from game1Difficulty's
 * targetDescriptionForLevel: F.007 decides WHICH SKILL is being practised
 * — and therefore what is logged, faded, and generalization-tracked per
 * skill — while the difficulty level decides HOW ABSTRACTLY to phrase the
 * search prompt for it. Neither replaces the other, and this file
 * deliberately keeps the level-based phrasing untouched.
 */
function retrievalSkillFor(templates: SkillTemplate[]): SkillTemplate {
  return templates.find((t) => t.skillId.startsWith('find-')) ?? templates[0];
}

/** One button rendering a recognised object in the child-facing grid. Zero
 * text (§7.7, §13) — bundled cartoon artwork for the object, on a card
 * tinted and bordered in the object's own colour. Visual state (dead /
 * dimmed / target-highlighted) is driven entirely by CSS classes so the
 * prompt-hierarchy escalation (F.009) has somewhere to land without any of
 * it being a string the child would need to read.
 *
 * Deliberately NOT the photo crop this used to render: see objectIcons.tsx's
 * header — vision bboxes are approximate (types/index.ts says so), so real
 * crops arrive offset and blurry, which is the one thing a pre-literate
 * child cannot recover from. */
function CropButton({
  crop,
  onTap,
  dead,
  dimmed,
  isTargetHighlighted,
  isTargetBouncing,
  disabled,
  celebrating,
}: {
  crop: TaggedCrop;
  onTap: () => void;
  dead: boolean;
  dimmed: boolean;
  isTargetHighlighted: boolean;
  isTargetBouncing: boolean;
  disabled: boolean;
  celebrating: boolean;
}) {
  const classNames = [
    'g1-crop',
    dead && 'g1-crop--dead',
    dimmed && !dead && 'g1-crop--dimmed',
    isTargetHighlighted && 'g1-crop--highlighted',
    isTargetBouncing && 'g1-crop--bouncing',
    celebrating && 'g1-crop--celebrating',
  ]
    .filter(Boolean)
    .join(' ');

  const tint = swatchColour(crop.colour);

  return (
    // Relative wrapper, not the button itself: the button stays the exact
    // 96x96 tap target §4.4 requires, and the corner badge below is purely
    // decorative (aria-hidden) — overlapping it onto the button would
    // otherwise grow the hit area or shift the icon off-centre.
    <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
      <button
        type="button"
        className={classNames}
        aria-label={crop.name}
        disabled={dead || disabled}
        onClick={onTap}
        style={{
          // Explicit square, not min-width/height: the artwork inside sizes
          // itself as a % of this box, so the box needs a definite size to
          // resolve against — left implicit, the button sizes to its content
          // while the content sizes to the button, and the tile balloons.
          // 96 keeps it clear of §4.4's 88pt floor and still fits four across
          // inside the 480px app shell.
          width: 96,
          height: 96,
          borderRadius: 16,
          border: `3px solid ${tint}`,
          // The coloured border alone disappears when the object's own colour
          // is white or cream — a white ring on a white card. This hairline
          // sits just outside it so the tile always has a visible edge, and
          // "white" still reads as white rather than as nothing.
          boxShadow: '0 0 0 1px rgba(33, 31, 46, 0.16)',
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // backgroundColor first as the fallback: if color-mix() isn't
          // supported the `background` line below is dropped as invalid and
          // this plain white card survives, keeping the artwork readable
          // (the coloured border still carries the colour cue either way).
          backgroundColor: 'var(--color-tile)',
          background: `color-mix(in srgb, ${tint} 16%, var(--color-tile))`,
        }}
      >
        <ObjectIcon name={crop.name} category={crop.category} />
      </button>
      {/* The icon stays the primary, always-legible tap cue (§7.7's whole
          reason for existing: real bbox crops are blurry/offset/half-cut,
          unreadable to a pre-literate 3-5 year old). This corner photo is
          additive, not a replacement — it's what lets the child (or a
          caregiver pointing alongside them) match the tile to the actual
          physical object in the room, the same correspondence problem the
          de-duped icons alone can't solve. Still a photo, not text, so it
          doesn't break this phase's own "photos/swatches and audio only"
          rule. Guarded on crop.image so GENERIC_FALLBACK_CROPS tiles
          (image: '') render no badge rather than an empty circle. */}
      {crop.image && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '2px solid var(--color-tile-border)',
            boxShadow: '0 1px 4px rgba(33,31,46,0.35)',
            backgroundImage: `url(${crop.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
    </div>
  );
}

/** OS-level prefers-reduced-motion -> lowest animation intensity tier.
 * Every animated escalation/celebration cue still HAPPENS — losing the
 * tier-2 highlight or the tier-3 "only this one is tappable" cue would
 * break errorless learning (§7.7) — it just lands as an instant state
 * change instead of a moving one. */
const reducedMotionRules = (scope: string) => `
${scope}.g1-crop--highlighted { animation: none; box-shadow: 0 0 0 6px color-mix(in srgb, var(--g1-accent, var(--color-primary)) 55%, transparent); }
${scope}.g1-crop--bouncing { animation: none; transform: translateY(-8px); box-shadow: 0 0 0 6px color-mix(in srgb, var(--g1-accent, var(--color-primary)) 55%, transparent); }
${scope}.g1-crop--celebrating { animation: none; transform: scale(1.2); }
`;

/** Local styles for the escalation/celebration animations — plain CSS,
 * injected once. No component library in this repo yet, and these three
 * keyframes don't warrant one. */
const GAME1_STYLES = `
/* --g1-accent: the child's own favourite colour (§8.1's "reward frame in
   {fav_colour}"), extended here from just the reward frame to every
   interactive accent in the game — the level selector, the capture/continue
   buttons, and the escalation pulse/bounce rings all pick it up. Falls back
   to the app's default --color-primary when no favourite colour is set
   (Game1() only ever sets --g1-accent when rewardFrameColour() returns a
   real value — see its render below). color-mix() is what lets a single
   accent value produce the pulse ring's faded edge without needing a
   separate rgba() constant per possible colour. */
@keyframes g1-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--g1-accent, var(--color-primary)) 55%, transparent); } 50% { box-shadow: 0 0 0 10px transparent; } }
@keyframes g1-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes g1-celebrate { 0% { transform: scale(1); } 100% { transform: scale(1.6); } }
.g1-crop { transition: opacity 200ms ease; opacity: 1; }
.g1-crop--dead { opacity: 0.4; }
.g1-crop--dimmed { opacity: 0.6; }
.g1-crop--highlighted { animation: g1-pulse 1.2s ease-in-out infinite; }
.g1-crop--bouncing { animation: g1-bounce 0.6s ease-in-out infinite; }
.g1-crop--celebrating { animation: g1-celebrate 800ms ease-out forwards; z-index: 1; position: relative; }
.g1-btn-accent { border: 2px solid var(--g1-accent, var(--color-primary)) !important; }
.g1-found-thumb { border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 5px; }
/* THE COLLECTION TRAY (levels 3-5). CAREGIVER-facing only: it renders in
   'searching', which is the grown-up's screen, never in the child's two
   zero-text phases. What has arrived is shown as a row that fills up
   rather than as "3 of 5", because a numeral is reading, not counting;
   the digits in the caption below it are for the adult, who is the only
   person reading this half of the screen.
   An empty slot is a dashed outline on the bare surface and a filled one
   is a lit tile (--color-tile, per DESIGN-TOKENS §1.4, since a drawn
   object belongs on a lit tile even on a dark ground), ringed in child's own
   favourite colour via the same --g1-accent every other accent here reads.
   No --color-reward / --color-companion: filling a slot is progress the
   caregiver is tracking, not the child's reward beat. */
.g1-tray {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px 12px;
  min-height: 56px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--surface-wash);
}
.g1-tray-slot {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  padding: 3px;
  background: transparent;
  border: 2px dashed var(--color-border-strong);
  opacity: 0.45;
  transition: opacity 200ms ease;
}
.g1-tray-slot--here {
  background: var(--color-tile);
  border: 2px solid var(--g1-accent, var(--color-primary));
  opacity: 1;
}
.g1-tray-caption { font-size: 0.75rem; color: var(--color-ink-muted); margin: 6px 0 0; }
/* One side of the room, as a capture button. Two lines: the direction,
   then what that side currently holds. Caregiver chrome, so it sits on
   the same 96px block the other capture-scale actions in this file use
   rather than on --touch-min. */
.g1-wall-shot {
  min-width: 96px;
  min-height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.g1-wall-shot--taken { border: 1px solid var(--color-border) !important; }
.g1-wall-shot-name { font-size: 0.95rem; font-weight: var(--weight-caregiver-strong); }
.g1-wall-shot-state { font-size: 0.72rem; color: var(--color-ink-muted); }
/* §4.3: "cap the grid on phones, never shrink the target" — below the
   tablet breakpoint the confirmation grid becomes a horizontally
   scrolling carousel (~2.5 crops visible) instead of wrapping into a
   shrunk grid. flex-shrink:0 on each crop is what actually enforces the
   88pt floor never shrinking; overflow-x:auto is what makes 6 crops fit
   without wrapping. */
@media (max-width: 600px) {
  .g1-grid { flex-wrap: nowrap !important; overflow-x: auto; justify-content: flex-start !important; padding: 0 8px; }
  .g1-crop { flex-shrink: 0; }
}
@media (prefers-reduced-motion: reduce) {
${reducedMotionRules('')}
}
`;

/**
 * The room photo with every recognised object marked in place — the
 * "here's what we found, and where" view (§8.0's caregiver side; text and
 * the real photo are both fine here, this never renders in the child's two
 * phases).
 *
 * Positions are percentages of the scene's own dimensions rather than
 * pixels, because the <img> is width-constrained by its container and will
 * render at some other size than `scene.width`. Every bbox is in the
 * scene's pixel space (see VisionScene's doc), so dividing by that is what
 * keeps a marker on its object at any display size.
 */
/**
 * Where each badge sits, in percent of the scene.
 *
 * Objects in a real room cluster (a shelf of toys, a pile on the floor), so
 * placing every badge dead-centre on its box stacks them into an unreadable
 * heap. Each badge starts at its object's centre and, if that spot is
 * already taken, tries a short ring of nearby offsets until one is free.
 * Deterministic (fixed candidate order, no randomness), so the same photo
 * always lays out the same way — a badge that jumped around between renders
 * would be worse than the overlap.
 */
const BADGE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, -11], [0, 11], [-11, 0], [11, 0],
  [-9, -9], [9, -9], [-9, 9], [9, 9], [0, -21], [0, 21],
];

function placeBadges(crops: TaggedCrop[], scene: VisionScene) {
  const taken: Array<{ x: number; y: number }> = [];
  const clashes = (x: number, y: number) =>
    taken.some((t) => Math.abs(t.x - x) < 9 && Math.abs(t.y - y) < 10);

  return crops.map((crop) => {
    const cx = ((crop.bbox.x + crop.bbox.width / 2) / scene.width) * 100;
    const cy = ((crop.bbox.y + crop.bbox.height / 2) / scene.height) * 100;
    const spot =
      BADGE_OFFSETS.map(([dx, dy]) => ({
        x: Math.min(94, Math.max(6, cx + dx)),
        y: Math.min(93, Math.max(7, cy + dy)),
      })).find((p) => !clashes(p.x, p.y)) ?? { x: cx, y: cy };
    taken.push(spot);
    return { crop, ...spot };
  });
}

/**
 * The key to the map: every drawing, labelled.
 *
 * The labels live HERE and never on the photo itself — text burned over a
 * room picture is unreadable at this size and would cover the very objects
 * it names. This is also what rescues the case where two objects share one
 * drawing (two soft toys, two cups): the colour word plus the object's own
 * name separates them, where the artwork alone cannot.
 *
 * Caregiver-facing only. Never rendered during 'confirming'/'celebrating',
 * which are the child's zero-text phases (§7.7, §13).
 */
function ObjectLegend({ crops }: { crops: TaggedCrop[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
      {crops.map((crop) => {
        const tint = swatchColour(crop.colour);
        // "red" + "red cup" would read as "red red cup" -- only prepend the
        // colour when the name doesn't already carry it.
        const label = crop.name.toLowerCase().includes(crop.colour.toLowerCase())
          ? crop.name
          : `${crop.colour} ${crop.name}`;
        return (
          <div
            key={crop.id}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 84 }}
          >
            <div style={{ position: 'relative', width: 72, height: 72 }}>
              <div
                className="g1-found-thumb"
                style={{
                  width: 72,
                  height: 72,
                  border: `3px solid ${tint}`,
                  boxShadow: '0 0 0 1px rgba(33, 31, 46, 0.16)',
                  backgroundColor: 'var(--color-tile)',
                  background: `color-mix(in srgb, ${tint} 16%, var(--color-tile))`,
                }}
              >
                <ObjectIcon name={crop.name} category={crop.category} />
              </div>
              {/* The actual photo cutout, as a small corner badge -- CAREGIVER-
                  facing only (this component never renders in the child's two
                  phases), so the blur/offset concern that keeps the crop OFF
                  the child's tile (see CropButton's header) doesn't apply
                  here: a caregiver reading the text label alongside it can
                  make sense of an imperfect crop in a way a pre-literate
                  child can't. This is what actually answers "which real
                  cushion is THIS one" once de-duplication (dedupeCropsByIcon)
                  means only one of several similar objects becomes a
                  selectable target -- the icon says "a cushion", this says
                  exactly which. Omitted for crops with no real photo (the
                  generic fallback set has none). */}
              {crop.image && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    border: '2px solid var(--color-tile-border)',
                    boxShadow: '0 1px 4px rgba(33,31,46,0.35)',
                    backgroundImage: `url(${crop.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              )}
            </div>
            <span style={{ fontSize: '0.7rem', opacity: 0.85, textAlign: 'center', lineHeight: 1.3 }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RoomMap({ scene, crops }: { scene: VisionScene; crops: TaggedCrop[] }) {
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  const badges = placeBadges(crops, scene);
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(33,31,46,0.14)',
        lineHeight: 0,
      }}
    >
      <img src={scene.dataUrl} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
      {badges.map(({ crop, x, y }) => (
        <div key={crop.id}>
          {/* The box the model actually returned. Kept — it is the
              difference between "the app says it found a cup" and "the app
              can show you which cup" — but drawn as a thin translucent
              outline rather than a heavy white frame, so a dozen of them
              read as annotation instead of scaffolding. */}
          <div
            style={{
              position: 'absolute',
              left: pct(crop.bbox.x, scene.width),
              top: pct(crop.bbox.y, scene.height),
              width: pct(crop.bbox.width, scene.width),
              height: pct(crop.bbox.height, scene.height),
              border: '1.5px solid rgba(255,255,255,0.75)',
              borderRadius: 8,
              boxShadow: '0 0 0 1px rgba(33,31,46,0.22)',
            }}
          />
          <div
            title={crop.name}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              width: 34,
              height: 34,
              padding: 4,
              borderRadius: '50%',
              background: 'var(--color-tile)',
              boxShadow: '0 1px 5px rgba(33,31,46,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ObjectIcon name={crop.name} category={crop.category} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Game1({ profile, onChildFacingChange }: Game1Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [confirmGrid, setConfirmGrid] = useState<TaggedCrop[]>([]);
  const [promptTier, setPromptTier] = useState<PromptTier>(0);
  const [deadCropIds, setDeadCropIds] = useState<Set<string>>(new Set());
  const [captureNotice, setCaptureNotice] = useState<'blur-failed' | null>(null);
  /** The redacted room photo the crops came from, kept for the end-of-session
   * RoomMap. In React state only — never written to StoragePort (§14: this
   * is a real picture of a family's home). Dropped when the screen unmounts. */
  const [scene, setScene] = useState<VisionScene | undefined>(undefined);
  /** Why we're playing with GENERIC_FALLBACK_CROPS instead of the child's own
   * things. §11 forbids showing an ERROR here, and this isn't one — without
   * it the app silently substitutes objects that aren't in the room and the
   * caregiver is left wondering why it keeps asking for a cup they don't own. */
  const [fallbackReason, setFallbackReason] = useState<
    'no-objects' | 'no-photo' | 'failed' | null
  >(null);
  const [slowCapture, setSlowCapture] = useState(false);
  const [level, setLevel] = useState<Game1Level>(1);
  const [companionHuntActive, setCompanionHuntActive] = useState(false);
  /** F.007's authored skill for the CURRENT trial (§7.5) — resolved from
   * the lookup table when the trial starts, so the skill logged at the end
   * of the trial is the one the child was actually asked to do, not
   * whatever the target happens to be by then. Its skillId replaces the
   * ad-hoc `find-${category}` string this file used to invent; its steps
   * are shown to the caregiver during 'searching' (never to the child). */
  const [activeSkill, setActiveSkill] = useState<SkillTemplate | null>(null);

  // ---- the room as three walls (games/game1/walls.ts) ----
  // One photo became three: left, ahead, right, each tagged to the wall it
  // was shot from, so the caregiver can point ("it's on the shelf behind
  // you") instead of only describing. `placed` is the joined room, with
  // crop ids namespaced per wall so two blue cups on two walls cannot
  // collide (see placeCrops).
  const [captures, setCaptures] = useState<WallCapture[]>([]);
  const [placed, setPlaced] = useState<PlacedCrop[]>([]);
  const [activeWall, setActiveWall] = useState<WallIndex | null>(null);

  // ---- what this round is asking for (games/game1/quests.ts) ----
  // A fetch quest holds one object; a collect/combine quest holds several
  // and the child makes one trip to the shelf per member. Levels 1-2 and
  // the Companion hunt stay single-object and never read this.
  const [quest, setQuest] = useState<Quest | null>(null);
  const [broughtIds, setBroughtIds] = useState<Set<string>>(new Set());

  // §8.1 "Profile tuning": derived once from the four response-profile
  // dimensions, never a condition (ARCHITECTURE-RULES.md §5.2). Recomputed
  // only if the profile object itself changes, not per trial.
  const tuning = applyProfileTuning(profile);

  // The onboarding "quick preferences" favourite colour (already the source
  // of §8.1's reward-frame colour, see rewardFrameColour) doubles as the
  // whole game's personalised accent — set as a CSS custom property on the
  // outer wrapper below so every button/pulse/ring in this file can read it
  // via var(--g1-accent, var(--color-primary)) without per-element plumbing.
  // null (no favourite colour given) means no property is set at all, so
  // CSS's own fallback quietly takes over — same "real value or nothing,
  // never a meaningless default" rule rewardFrameColour already follows.
  const accentColour = rewardFrameColour(profile);
  const accentStyle = accentColour
    ? ({ '--g1-accent': accentColour } as CSSProperties)
    : undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [lastLoggedTier, setLastLoggedTier] = useState<SupportTier | null>(null);
  const [fadingSuggestion, setFadingSuggestion] = useState<FadingSuggestion | null>(null);
  const [sessionEndResult, setSessionEndResult] = useState<SessionEndResult | null>(null);

  // Mirrors of the three above. The celebration -> next-object hop runs
  // inside a setTimeout, and a timeout callback closes over the state from
  // the render that scheduled it -- so reading `quest` or `broughtIds`
  // there would see the values from before the object arrived, and a
  // collection would either repeat one object forever or end a trip early.
  const questRef = useRef<Quest | null>(null);
  const broughtIdsRef = useRef<Set<string>>(new Set());
  /** Every object id ever brought this SESSION, across every round —
   * unlike broughtIdsRef, this is never reset by startQuest. This is what
   * "no time limit, ends when everything is found" is measured against:
   * the session ends the moment this set covers the whole room pool
   * (`crops`), and every round in between draws its target/quest only
   * from what's still missing, so the same object is never re-asked for
   * and the set is guaranteed to eventually cover the pool. */
  const foundIdsRef = useRef<Set<string>>(new Set());
  /** The crop pool the CURRENT round's quest was built from. Deliberately
   * the pool itself rather than `placed`: on the degraded path (§11) there
   * are no walls at all and the round runs on GENERIC_FALLBACK_CROPS, so
   * reading the joined room back here would hand the second trip of a
   * collection an empty pool and a one-tile confirmation grid. */
  const roundPoolRef = useRef<TaggedCrop[]>([]);
  /** Walks buildQuest's group list so consecutive rounds differ. */
  const questIndexRef = useRef<number>(0);

  const machineRef = useRef<InteractionMachine>(new InteractionMachine());
  const lastObjectNameRef = useRef<string | null>(null);
  const lastTargetIdRef = useRef<string | null>(null);
  // §8.1 lively/short-attention tuning: "movement break every 3 trials".
  // Counts trials resolved THIS session, not persisted — the cadence is a
  // per-session pacing device, not a fact worth remembering across
  // sessions the way the level itself is.
  const trialCountRef = useRef<number>(0);

  const handleEndSession = useCallback(
    async (reason: 'cap' | 'idle' | 'caregiver' | 'finished') => {
      if (!sessionId) return;
      setPhase('sessionEnded');
      const result = await endSessionNow(sessionId, reason, lastObjectNameRef.current);
      setSessionEndResult(result);
    },
    [sessionId],
  );

  useEffect(() => {
    onChildFacingChange?.(phase === 'confirming' || phase === 'celebrating');
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  useEffect(() => {
    foundIdsRef.current = new Set();
    void (async () => {
      const [session, number, savedLevel] = await Promise.all([
        startSession(profile.id, 'find-it'),
        getSessionNumber(profile.id),
        getGame1Level(profile.id),
      ]);
      setSessionId(session.id);
      setSessionNumber(number);
      setLevel(savedLevel);

      // §6.3 "Bookend: greets at start" — the goodbye half is
      // SessionCelebration's own spoken achievement line (see the
      // 'sessionEnded' render below), not a Game-1-specific line. With no
      // Companion set this renders through the same neutral 'your friend'
      // default engine/slots.ts already provides — no branching needed.
      if (hasCompanion(profile)) {
        void adapters.speechOut.say(
          renderLine('Hi! {companion} is ready to play!', slotValuesFromProfile(profile)),
        );
      }
    })();
    // Depends on the whole `profile` object, not just `profile.id` — the
    // greeting reads profile.context.companion, and `handleEndSession`
    // (the goodbye half of this same bookend) already depends on the full
    // `profile` object for the identical reason. This DOES mean the
    // effect (and therefore a fresh session + a repeated greeting) fires
    // again if the parent hands down a new `profile` object with the same
    // id — acceptable here since App.tsx currently only ever produces a
    // new profile reference on a genuine change, not on every render.
  }, [profile]);

  async function handleLevelChange(newLevel: Game1Level) {
    setLevel(newLevel);
    await setGame1Level(profile.id, newLevel);
  }

  // The single poller driving both F.009's idle detection and F.013's cap
  // check, exactly as in the engine's design (see interactionMachine.ts —
  // "a game screen polls tick() periodically"). Also mirrors the current
  // prompt tier into state so the confirming-phase UI can react to
  // time-based escalation (an idle child on the confirmation screen
  // escalates exactly like a wrong-tapping one), not just tap-based
  // escalation.
  useEffect(() => {
    if (!sessionId || sessionNumber === null || phase === 'sessionEnded') return;
    const interval = setInterval(() => {
      const now = Date.now();
      const tick = machineRef.current.tick(now);
      if (phase === 'searching' || phase === 'confirming') {
        setPromptTier(tick.tier);
      }
      if (tick.endSession) {
        void handleEndSession('idle');
      }
      // No time-based cap here on purpose: this game now runs until the
      // room pool is exhausted (see remainingPool/handleSupportTierReport),
      // not until a clock runs out. tick.endSession above is a different
      // thing entirely -- a child gone idle/disengaged -- and stays.
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, sessionNumber, phase, handleEndSession]);

  /**
   * Starts a new trial from the session's existing crop pool. `effectiveLevel`
   * defaults to the caregiver-set level, but the movement-break return path
   * (§7.7: "always to a task one level easier than the one that triggered
   * it") passes a one-lower override for exactly one trial without
   * persisting that as the child's new level.
   *
   * The pool is de-duplicated by icon (see dedupeCropsByIcon) before target
   * picking or grid building ever see it -- neither pickNextTarget nor
   * buildConfirmationGrid need to know this happened, they just always get
   * a pool where every candidate is visually distinct.
   *
   * `forcedTarget` is how a collecting round (levels 3-5) names the member
   * it still wants. Without it the child could be asked for the same red
   * ball twice while a red cup sits unfetched, and the collection would
   * never close. The forced object is put at the FRONT of the pool before
   * de-duplication, so it is the survivor of its own look-alike group
   * rather than the one dropped -- otherwise a quest could ask for an
   * object that is not in its own confirmation grid.
   */
  function startTrialWith(
    pool: TaggedCrop[],
    effectiveLevel: Game1Level = level,
    forcedTarget?: TaggedCrop,
  ) {
    const dedupedPool = dedupeCropsByIcon(
      forcedTarget ? [forcedTarget, ...pool.filter((c) => c.id !== forcedTarget.id)] : pool,
    );
    const picked = forcedTarget ?? pickNextTarget(dedupedPool, lastTargetIdRef.current);
    lastTargetIdRef.current = picked.id;
    setTarget(picked);
    setCompanionHuntActive(false);
    // F.007 (§7.5): the authored skill this trial teaches, resolved from
    // the real lookup table for the picked object. Purely additive to the
    // difficulty system below — this decides WHICH skill is practised and
    // logged; buildSearchPromptTemplate/targetDescriptionForLevel still
    // own HOW the search prompt is phrased, unchanged.
    setActiveSkill(retrievalSkillFor(getSkillTemplatesForCrop(picked)));
    const grid = buildConfirmationGrid(dedupedPool, picked, effectiveLevel);
    // §8.1: calm/sameness profiles keep the reward crop in the same
    // position every trial (no shuffle); other profiles get a shuffled
    // layout each trial. buildConfirmationGrid itself always stays
    // deterministic — the shuffle is this explicit, separate opt-in step.
    setConfirmGrid(tuning.fixedLayout ? grid : shuffleGrid(grid));
    setDeadCropIds(new Set());
    setPromptTier(0);
    setPhase('searching');
    machineRef.current.startTrial();

    // §6.3/§8.1 "Helper who needs help": every 3rd trial swaps the
    // standard "{companion} wants..." framing for the prosocial
    // "{companion} can't reach the {object}..." framing. Both are spoken
    // AND are what the caregiver's 'searching' screen renders (see the
    // JSX below) — §6.3's "never an instruction the caregiver can't see
    // on screen" requirement.
    const useHelperFraming = hasCompanion(profile) && shouldUseHelperFraming(trialCountRef.current + 1);
    const template = useHelperFraming
      ? HELPER_FRAMING_PROMPT_TEMPLATE
      : buildSearchPromptTemplate(effectiveLevel, picked, tuning);
    const line = renderLine(
      template,
      slotValuesFromProfile(profile, { 'object.name': picked.name }),
    );
    void adapters.speechOut.say(line);
  }

  /** §8.1 "Companion hunt": the child's own toy, not a room crop — the
   * highest-motivation target available. Caregiver-triggered (see the
   * 'searching' JSX's "Make this a {companion} hunt!" button) rather than
   * app-scheduled, since the app has no reliable way to know in advance
   * which trial will actually be a session's last one (cap/idle/caregiver
   * endings are all unpredictable) — §8.1 says "reserve for the final
   * trial", so letting the caregiver deliberately choose it as the last
   * one is the honest way to satisfy that. Ends the session immediately
   * after, which is what makes it actually "final" rather than a guess. */
  function startCompanionHuntTrial() {
    setCompanionHuntActive(true);
    setDeadCropIds(new Set());
    setPromptTier(0);
    setPhase('searching');
    machineRef.current.startTrial();
    // F.007 by object name rather than by crop: the Companion is the
    // child's own toy, not something the vision pass tagged, so there is
    // no TaggedCrop to hand the lookup. Its steps are what the caregiver
    // sees during the hunt; the LOGGED skillId deliberately stays
    // 'find-companion' (see handleSupportTierReport) — the hunt is its own
    // distinct, highest-motivation skill, not one more generic toy.
    setActiveSkill(
      retrievalSkillFor(
        getSkillTemplatesForObject(profile.context.companion?.name ?? 'toy animal', 'toy'),
      ),
    );
    void adapters.speechOut.say(
      renderLine(COMPANION_HUNT_PROMPT_TEMPLATE, slotValuesFromProfile(profile)),
    );
  }

  /** The companion-hunt equivalent of handleTap: there's only one real
   * object (their actual Companion toy) so, unlike a normal trial, there's
   * no discrimination grid to tap — the caregiver's "They brought it"
   * confirmation IS the resolution. Still logged as a real activity
   * (§7.6's support-tier report still applies) and still resolves through
   * F.009's machine so its tier/timing bookkeeping stays consistent with
   * every other trial. */
  function handleCompanionFound() {
    machineRef.current.recordAttempt(true);
    setPhase('celebrating');
    lastObjectNameRef.current = profile.context.companion?.name ?? null;
    void adapters.speechOut.say(
      renderLine('{companion}!', slotValuesFromProfile(profile)),
    );
    setTimeout(() => setPhase('reportingSupport'), tuning.fasterCelebration ? 400 : 800);
  }

  /** Recomputes the joined room from whatever walls have been shot. */
  function commitCaptures(next: WallCapture[]) {
    const nextPlaced = placeCrops(next);
    setCaptures(next);
    setPlaced(nextPlaced);
    setCrops(cropsOf(nextPlaced));
  }

  /** What's left to find this session: the room pool minus everything
   * already brought at least once. Every NEW round draws from this, never
   * from `crops` directly, so the same object is never asked for twice and
   * the session is guaranteed to run down to zero rather than looping
   * forever — this is the "no time limit, ends when everything is found"
   * mechanism itself, not a detail of it. */
  function remainingPool(): TaggedCrop[] {
    return crops.filter((c) => !foundIdsRef.current.has(c.id));
  }

  /**
   * Opens a round at the caregiver-set level.
   *
   * Levels 1-2 build a single-object 'fetch' quest, which behaves exactly
   * as this game always has; 3 builds a 'collect' and 4-5 a 'combine', and
   * those are the rounds the tray and questBrief() below are for.
   *
   * Falls back down the ladder when the room cannot support the level --
   * a room with no colour appearing twice cannot pose a counting task, and
   * §11's posture is to degrade quietly rather than show an error or ask
   * for objects the child does not own.
   */
  function startQuest(pool: TaggedCrop[], effectiveLevel: Game1Level = level) {
    let q = buildQuest(effectiveLevel, pool, questIndexRef.current);
    if (!q) q = buildQuest(1, pool, questIndexRef.current);
    questIndexRef.current += 1;
    roundPoolRef.current = pool;

    const fresh = new Set<string>();
    setQuest(q);
    questRef.current = q;
    setBroughtIds(fresh);
    broughtIdsRef.current = fresh;

    if (!q) {
      // Nothing recognised at all. startTrialWith still runs so the child
      // gets the generic fallback set rather than a dead screen.
      startTrialWith(pool, effectiveLevel);
      return;
    }
    startTrialWith(pool, effectiveLevel, q.members[0]);
  }

  /**
   * One object just arrived in the child's hands.
   *
   * For a fetch that ends the round. For a collection it ticks one member
   * off and sends them back for the next one. What the caregiver sees is
   * a record of trips that ended in an object arriving, never a number
   * shown to the child.
   */
  function advanceOrFinish(broughtCropId: string) {
    foundIdsRef.current = new Set(foundIdsRef.current).add(broughtCropId);

    const q = questRef.current;
    // §8.1 lively/short-attention tuning: "faster celebration".
    const delay = tuning.fasterCelebration ? 400 : 800;

    if (!q || q.kind === 'fetch') {
      setTimeout(() => setPhase('reportingSupport'), delay);
      return;
    }

    const next = new Set(broughtIdsRef.current);
    next.add(broughtCropId);
    broughtIdsRef.current = next;
    setBroughtIds(next);

    if (isQuestComplete(q, next)) {
      setTimeout(() => setPhase('reportingSupport'), delay);
      return;
    }

    const stillWanted = remainingFor(q, next)[0];
    setTimeout(() => {
      startTrialWith(roundPoolRef.current, level, stillWanted);
    }, delay);
  }

  async function handleCapturePress(wall: WallIndex) {
    setActiveWall(wall);
    setPhase('capturing');
    setCaptureNotice(null);
    setSlowCapture(false);

    const outcome = await captureRoomAndRecognize({
      onSlow: () => setSlowCapture(true),
    });

    if (outcome.kind === 'blur-failed') {
      // §11 / §4.4: hard stop, discard, offer retake. This is the
      // CAREGIVER's screen (they operate the camera), so plain text here
      // is fine — the zero-text rule is about the child's screen only.
      setCaptureNotice('blur-failed');
      setPhase('idle');
      return;
    }

    // §11: "capture-unavailable" (permission denied / cancelled) and
    // "no-objects-found" (nothing usable recognised, or the vision call
    // itself failed) both degrade the SAME way — quietly, to a generic
    // activity set, never an error shown. Only a real 'success' gets the
    // "found in your room" reveal below — showing it for the generic
    // fallback set would misrepresent placeholder crops as real detections.
    if (outcome.kind === 'success') {
      // One wall of the room, added to whatever has been shot already.
      // Re-shooting a wall REPLACES it rather than appending -- otherwise a
      // caregiver correcting a blurry photo would leave the old wall's
      // objects in the room, and the child would be sent to fetch things
      // that are no longer on screen.
      commitCaptures([
        ...captures.filter((c) => c.wall !== wall),
        { wall, crops: outcome.crops, scene: outcome.scene },
      ]);
      setScene(outcome.scene);
      setFallbackReason(null);
      setPhase('foundObjects');
      return;
    }

    // Still no error screen (§11) — but record WHICH quiet degradation this
    // was, so the caregiver screen can say what to do differently instead of
    // silently asking the child to fetch a cup that isn't in their house.
    setScene(undefined);
    setFallbackReason(
      outcome.kind === 'no-objects-found'
        ? 'no-objects'
        : outcome.kind === 'recognition-failed'
          ? 'failed'
          : 'no-photo',
    );
    setCrops(GENERIC_FALLBACK_CROPS);
    startQuest(GENERIC_FALLBACK_CROPS);
  }

  function handleTheyBroughtIt() {
    if (companionHuntActive) {
      handleCompanionFound();
      return;
    }
    setPhase('confirming');
    void adapters.speechOut.say('Show me, which one did you bring?');
  }

  function handleTap(crop: TaggedCrop) {
    const outcome = machineRef.current.recordAttempt(crop.id === target?.id);

    if (outcome.resolved) {
      setPhase('celebrating');
      setPromptTier(outcome.tier);
      lastObjectNameRef.current = crop.name;
      const line = renderLine(
        'Your {object.name}!',
        slotValuesFromProfile(profile, { 'object.name': crop.name }),
      );
      void adapters.speechOut.say(line);
      // On a collecting round this hop goes back out for the next object
      // instead of straight to the support report; on a plain fetch it is
      // the same faster/slower celebration timeout it always was.
      advanceOrFinish(crop.id);
      return;
    }

    // Wrong tap (§7.7): silence, fade to dead, nothing else reaches the
    // child. The escalating tier (fade at 1, target highlight at 2, only-
    // target-tappable at 3) is rendered via CSS classes in the JSX below,
    // driven by `promptTier`.
    setDeadCropIds((prev) => new Set(prev).add(crop.id));
    setPromptTier(outcome.tier);
    // Tier 1 ("Repeat"): audio repeats, slightly slower. No visual/verbal
    // acknowledgement of "wrong" beyond that — see §7.7's "never: red X,
    // buzzer... a wrong tap produces silence plus fade and nothing else."
    if (outcome.tier === 1 && target) {
      const template = buildSearchPromptTemplate(level, target, tuning);
      const line = renderLine(template, slotValuesFromProfile(profile));
      void adapters.speechOut.say(line, { rate: 0.85 });
    }
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId) return;
    if (!companionHuntActive && !target) return;
    // F.007 (§7.5): the authored skill this trial actually practised,
    // resolved from the real object -> skill -> steps table when the trial
    // started (startTrialWith). This is what gets logged, faded (F.011)
    // and generalization-tracked (F.019) — a meaningful, authored skill id
    // like 'find-cup' or 'find-generic-drinkware', not the ad-hoc
    // `find-${category}` string this file used to invent for itself. That
    // string survives only as an unreachable-in-practice fallback for a
    // trial whose skill never resolved.
    //
    // A collecting or combining round is a different skill from a single
    // fetch, and it logs as ONE event -- otherwise five trips to gather
    // the red things would be recorded as five separate "find a toy"
    // events and the caregiver dashboard would show a burst of activity
    // that never happened. Plain fetches (levels 1-2) still log F.007's
    // authored per-object skill, which is the more specific of the two.
    const skillId = companionHuntActive
      ? 'find-companion'
      : quest && quest.kind !== 'fetch'
        ? questSkillId(quest.kind)
        : (activeSkill?.skillId ?? `find-${target?.category}`);

    await logActivityOutcome({
      sessionId,
      skillId,
      context: 'living-room', // TODO(context selection is outside F.008 — see F.007/onboarding)
      supportTier: tier,
      onScreenTier: machineRef.current.currentTier,
    });
    setLastLoggedTier(tier);
    const suggestion = await getFadingSuggestion(profile.id, skillId, tier, profile.nickname ?? 'they');
    setFadingSuggestion(suggestion);

    if (companionHuntActive) {
      // §8.1: the Companion hunt is reserved for the session's FINAL
      // trial (see startCompanionHuntTrial's header for why that's
      // caregiver-triggered rather than app-guessed) — logging its
      // outcome is what actually ends the session, delivering
      // SessionCelebration's spoken achievement line immediately after.
      void handleEndSession('caregiver');
      return;
    }

    trialCountRef.current += 1;

    // No time limit and no fixed round count: the session runs until
    // every object in the room pool has been brought at least once. This
    // is the ordinary way the game ends now -- not a clock, not a trial
    // count -- and it is what puts a completed session, with its support
    // records, into the log the caregiver dashboard reads. Checked before
    // the movement break so a finished room never gets sent on a break
    // it doesn't need.
    const stillToFind = remainingPool();
    if (stillToFind.length === 0) {
      void handleEndSession('finished');
      return;
    }

    // §8.1 lively/short-attention tuning: "movement break every 3 trials".
    // §7.7's own engine-driven breaks (disengagement-triggered, capped at
    // 3/session via machineRef.current.takeMovementBreak()) are separate
    // and unaffected — this is Game 1 additionally OFFERING one on a fixed
    // cadence for profiles that benefit from predictable pacing.
    if (
      tuning.movementBreakEveryNTrials !== null &&
      trialCountRef.current % tuning.movementBreakEveryNTrials === 0 &&
      machineRef.current.takeMovementBreak()
    ) {
      const line = renderLine(
        '{movement} like a {fav_animal}!',
        slotValuesFromProfile(profile),
      );
      setPhase('movementBreak');
      void adapters.speechOut.say(line);
      return;
    }

    // §8.1: "one photo per session, not per trial" — the NEXT round reuses
    // the same crop set rather than re-prompting for a capture. Only the
    // pre-capture 'idle' screen (before crops exist) shows the capture
    // buttons; every round after the first flows straight back into
    // 'searching'.
    //
    // startQuest, not startTrialWith: this is a NEW ROUND, so it needs a
    // FRESH quest. Reusing the finished one leaves a completed collection
    // on screen -- the tray reading "4 of 4" and the brief still naming
    // last round's groups, while the object actually being asked for came
    // from somewhere else entirely. Built from `stillToFind`, not `crops`,
    // so an object already brought is never asked for again.
    startQuest(stillToFind);
  }

  /** §7.7: "Return: always to a task one level easier than the one that
   * triggered it." A one-round-only override — does NOT persist as the
   * child's new level (see startTrialWith's `effectiveLevel` param).
   *
   * A break ENDS the current round rather than resuming it. Dropping a
   * level mid-collection has no coherent meaning -- the collection was
   * built for the harder level and half of it is already in the child's
   * hands -- so the honest reading of "return to a task one level easier"
   * is a fresh, easier task. */
  function handleMovementBreakDone() {
    const easierLevel = Math.max(1, level - 1) as Game1Level;
    startQuest(remainingPool(), easierLevel);
  }

  if (phase === 'sessionEnded') {
    // No handoff line: it used to say "go find your X with your grown-up"
    // (childFacingHandoffLine), reasoned at the time to be meaningful here
    // specifically because Game 1's targets are real objects in the room,
    // unlike the other three games. In practice a session that ends with
    // no object yet found (or no Companion set) fell back to a generic
    // "your favourite thing" line that read exactly as oddly as the other
    // games' version did -- so Game 1 now matches them: straight to the
    // caregiver recap, no exceptions. The room map, session figures and
    // support tiers all live on the dashboard, where a caregiver can read
    // them without a child waiting on the screen.
    return sessionEndResult ? (
      <SessionCelebration session={sessionEndResult.session} track="find-it" />
    ) : (
      <div className="screen" />
    );
  }

  if (phase === 'idle') {
    return (
      <div className="screen" style={accentStyle}>
        <style>{GAME1_STYLES + PANORAMA_STYLES}</style>
        <h2>Find It In Your World</h2>
        {/* The session/cap/elapsed readout that used to sit here is gone.
            It was plumbing on a screen a child is usually looking at too,
            and every figure in it now lands on the caregiver dashboard
            instead, where it can be read without a child waiting. */}
        {captureNotice === 'blur-failed' && (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
            That photo couldn't be processed. Let's try again.
          </p>
        )}
        {lastLoggedTier && (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            Last logged support tier: {lastLoggedTier} (
            {SUPPORT_TIERS.find((t) => t.tier === lastLoggedTier)?.name})
          </p>
        )}
        {fadingSuggestion && (
          <p style={{ fontSize: '0.8rem', background: 'var(--color-info-soft)', padding: 8, borderRadius: 8 }}>
            {fadingSuggestion.message}
          </p>
        )}
        {/* F.012: caregiver-set difficulty level, persisted per child
            (game1Level.ts). Deliberately no auto-advancement — see that
            file's header for why. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Level:</span>
          {([1, 2, 3, 4, 5] as const).map((l) => (
            <button
              key={l}
              className={l === level ? 'g1-btn-accent' : undefined}
              style={{
                minWidth: 44,
                minHeight: 44,
                fontWeight: l === level ? 'bold' : 'normal',
                border: l === level ? undefined : '1px solid var(--color-border)',
              }}
              onClick={() => void handleLevelChange(l)}
            >
              {l}
            </button>
          ))}
        </div>
        {/* THREE WALLS, not one photo (games/game1/walls.ts). The
            caregiver stands in one spot and shoots left, ahead, right --
            only the part of the room they want the child moving around
            in. Any one wall is enough to start; three just gives more to
            turn towards. Re-tapping a side retakes it. */}
        <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', margin: '4px 0 0' }}>
          Photograph the sides of the room you want to use:
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {WALLS.map((wall) => {
            const shot = captures.find((c) => c.wall === wall);
            return (
              <button
                key={wall}
                type="button"
                className={
                  shot ? 'g1-wall-shot g1-wall-shot--taken' : 'g1-wall-shot g1-btn-accent'
                }
                onClick={() => void handleCapturePress(wall)}
              >
                <span className="g1-wall-shot-name">{WALL_SHORT[wall]}</span>
                <span className="g1-wall-shot-state">
                  {shot ? `${shot.crops.length} found, retake` : 'add photo'}
                </span>
              </button>
            );
          })}
        </div>
        {captures.length > 0 && (
          <button
            className="g1-btn-accent"
            style={{ minWidth: 88, minHeight: 88 }}
            disabled={!canStart(captures)}
            onClick={() => startQuest(cropsOf(placed))}
          >
            {canStart(captures) ? "Let's play!" : 'Nothing found yet, try another photo'}
          </button>
        )}
        <button type="button" className="quiet-action" onClick={() => void handleEndSession('caregiver')}>
          <span className="quiet-action-chip">End session</span>
        </button>
      </div>
    );
  }

  if (phase === 'capturing') {
    // §11: "Slow (>4s) → calm progress state showing the parent's own
    // photo, never a spinner over blank." We deliberately do NOT thread
    // the raw pre-redaction photo out of the pipeline module just to show
    // it here (see myWorldPipeline.ts's module doc on why the raw bitmap
    // never leaves it) — a calm, generic waiting state substitutes for it.
    // A real "show their own (already-redacted) photo while waiting" is a
    // reasonable enhancement but was not built for Tier 0; see PERSON-2's
    // final report.
    return (
      <div className="screen" style={accentStyle}>
        <style>{GAME1_STYLES + PANORAMA_STYLES}</style>
        <p style={{ fontSize: '1rem', opacity: 0.8 }}>
          {slowCapture ? "Still looking around the room..." : 'Looking around the room...'}
          {activeWall !== null && ` (${WALL_SHORT[activeWall].toLowerCase()})`}
        </p>
      </div>
    );
  }

  if (phase === 'foundObjects') {
    // CAREGIVER-facing (same audience as 'idle'/'capturing'/'searching' —
    // text is fine here, the zero-text rule is the CHILD's two phases
    // only). This is the actual proof-of-detection moment: every crop
    // shown here is a real cutout the vision call just returned from THIS
    // room's photo, with the name/colour/category it tagged — not a
    // fixture, not the generic fallback set (see handleCapturePress: this
    // phase is only reached on a real 'success' outcome).
    return (
      <div className="screen" style={accentStyle}>
        <style>{GAME1_STYLES + PANORAMA_STYLES}</style>
        <h2>Found in your room!</h2>
        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          {crops.length} object{crops.length === 1 ? '' : 's'} across {captures.length} side
          {captures.length === 1 ? '' : 's'} of the room:
        </p>
        {/* The side that was just shot, at full size with every box the
            model actually returned. Scoped to THAT wall's objects: the
            other walls' bboxes are in their own photos' pixel space, so
            drawing them over this one would put badges on nothing. */}
        {scene && activeWall !== null && (
          <RoomMap scene={scene} crops={cropsOf(onWall(placed, activeWall))} />
        )}
        {/* The joined room. Object NAMES stay in the legend underneath --
            nothing is captioned onto a photo, where it would cover the
            very objects it describes. Wall direction is carried by
            position: the left wall is the panel on the left. */}
        <RoomPanorama placed={placed} captures={captures} />
        <ObjectLegend crops={crops} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {WALLS.some((w) => !captures.some((c) => c.wall === w)) && (
            <button type="button" style={{ minHeight: 56 }} onClick={() => setPhase('idle')}>
              Add another side
            </button>
          )}
          <button
            className="g1-btn-accent"
            style={{ minWidth: 88, minHeight: 88 }}
            onClick={() => startQuest(cropsOf(placed))}
          >
            Let&rsquo;s play!
          </button>
        </div>
      </div>
    );
  }

  const suggestedTierInfo =
    SUPPORT_TIERS.find((t) => t.tier === DEFAULT_STARTING_SUPPORT_TIER) ?? SUPPORT_TIERS[0];

  // The object the current trial's F.007 steps are about — the picked crop
  // normally, the child's own Companion during a hunt.
  const skillStepObjectName = companionHuntActive
    ? (profile.context.companion?.name ?? '')
    : (target?.name ?? '');

  return (
    <div className="screen" style={accentStyle}>
      <style>{GAME1_STYLES + PANORAMA_STYLES}</style>

      {phase === 'searching' && (
        <>
          {companionHuntActive ? (
            <p>
              Caregiver view: help them find {profile.context.companion?.name ?? 'their Companion'}!
            </p>
          ) : (
            <>
              <p>
                Caregiver view: find {target && targetDescriptionForLevel(level, target)},{' '}
                {searchScopeLabelForLevel(level)}. (Level {level})
                {/* F.009's gesture tier, made usable: the app knows which
                    wall the object was photographed on, so it can tell the
                    caregiver which way to gesture. Omitted rather than
                    guessed when the object was never placed (the generic
                    fallback set has no walls). */}
                {target && directionFor(placed, target.id) && (
                  <>
                    {' '}
                    <strong>{directionFor(placed, target.id)}.</strong>
                  </>
                )}
              </p>
              {/* The whole round, stated once, so the caregiver knows what
                  they are steering towards before the first trip. */}
              {quest && quest.kind !== 'fetch' && (
                <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>{questBrief(quest)}</p>
              )}
              {/* WHAT ARRIVED IS SHOWN AS A TRAY, NOT AS A NUMERAL.
                  A pre-literate child cannot read "3 of 5" -- that is
                  reading, not counting. So what has arrived is shown as a
                  row that fills up. The digits in the caption are for the
                  grown-up, who is the only person reading this half of the
                  screen (§8.0). See .g1-tray in GAME1_STYLES. */}
              {quest && quest.kind !== 'fetch' && (
                <div>
                  <div className="g1-tray">
                    {quest.members.map((m) => {
                      const here = broughtIds.has(m.id);
                      return (
                        <div
                          key={m.id}
                          className={here ? 'g1-tray-slot g1-tray-slot--here' : 'g1-tray-slot'}
                          title={`${m.colour} ${m.name}`}
                        >
                          <ObjectIcon name={m.name} category={m.category} size={30} />
                        </div>
                      );
                    })}
                  </div>
                  <p className="g1-tray-caption">
                    {broughtIds.size} of {quest.members.length} brought so far
                  </p>
                </div>
              )}
              {/* Where everything is, so the caregiver can gesture towards
                  it instead of describing it. Skipped on the degraded
                  path, where there is no real room to show. */}
              {placed.length > 0 && (
                <RoomPanorama
                  placed={placed}
                  captures={captures}
                  wantedIds={target ? new Set([target.id]) : undefined}
                  doneIds={broughtIds}
                />
              )}
            </>
          )}
          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            Support tier {suggestedTierInfo.tier}, {suggestedTierInfo.name}:{' '}
            {suggestedTierInfo.instruction}
          </p>
          {/* F.007's authored steps for this trial's skill (§7.5), rendered
              through the same renderLine() pipeline as every other line so
              slots fill and the avoid-list filter still runs. CAREGIVER-
              facing only — this phase is the caregiver's screen, and these
              steps never reach the child's two zero-text phases, nor do
              they alter the spoken prompt (which stays F.012's
              level-appropriate phrasing, above). */}
          {activeSkill && (
            <div style={{ fontSize: '0.8rem', opacity: 0.75, lineHeight: 1.5 }}>
              <span style={{ opacity: 0.75 }}>Practising: {activeSkill.skillId}</span>
              <ol style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {activeSkill.steps.map((skillStep) => (
                  <li key={skillStep.promptTemplate}>
                    {renderLine(
                      skillStep.promptTemplate,
                      slotValuesFromProfile(profile, { 'object.name': skillStepObjectName }),
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {/* Guidance, not an error (§11): the game still runs, and the tone
              stays matter-of-fact. It just says out loud that these are
              stand-in objects, which is the one thing the caregiver cannot
              work out on their own. */}
          {fallbackReason && (
            <p
              style={{
                fontSize: '0.78rem',
                background: 'var(--color-accent-soft, #fff1e3)',
                padding: '8px 10px',
                borderRadius: 8,
                lineHeight: 1.45,
              }}
            >
              {fallbackReason === 'no-photo'
                ? 'No photo was chosen, so these are stand-in objects rather than things from your room.'
                : fallbackReason === 'failed'
                  ? "We couldn't read that photo just now. These are stand-in objects. The photo was probably fine; it's worth another go."
                  : 'Nothing in that photo was something your child could safely go and fetch, so these are stand-in objects.'}{' '}
              <button
                type="button"
                onClick={() => {
                  setFallbackReason(null);
                  setPhase('idle');
                }}
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  padding: '2px 8px',
                  fontSize: '0.78rem',
                  border: '1px solid rgba(33,31,46,0.25)',
                  borderRadius: 6,
                  background: 'transparent',
                  boxShadow: 'none',
                }}
              >
                Try another photo
              </button>
            </p>
          )}
          {fadingSuggestion && (
            <p style={{ fontSize: '0.75rem', background: 'var(--color-info-soft)', padding: 6, borderRadius: 6 }}>
              {fadingSuggestion.message}
            </p>
          )}
          {/* §8.1: Companion hunt reserved for the session's final trial —
              caregiver-triggered, see startCompanionHuntTrial's header for
              why. Hidden with no Companion set (§6.3 review checklist). */}
          {!companionHuntActive && hasCompanion(profile) && (
            <button
              style={{ minWidth: 88, minHeight: 88, fontSize: '0.8rem' }}
              onClick={startCompanionHuntTrial}
            >
              Make this a {profile.context.companion?.name} hunt!
            </button>
          )}
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={handleTheyBroughtIt}>
            They brought it
          </button>
        </>
      )}

      {phase === 'confirming' && (
        // CHILD-FACING. Zero text below this line — photos/swatches and
        // audio only. Escalation per §7.7: tier 1 fades the wrong crop and
        // makes it dead; tier 2 highlights the target and dims the rest;
        // tier 3 makes only the target tappable (bounce + disabled
        // distractors), so the child literally cannot fail from here.
        <div
          className="g1-grid"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
            // The `flex: 1` this used to have never actually worked: it
            // relies on the nearest flex-column ANCESTOR having spare
            // height to hand out, but .app (this screen's actual parent)
            // is a plain block, not a flex container -- only the welcome
            // screen's .app--welcome modifier gets that treatment. So
            // .screen itself was already only ever as tall as its own
            // content, meaning flex:1 on this grid had no extra space to
            // claim, and the tiles stayed pinned top-left regardless.
            // A direct minHeight sidesteps the whole ancestor chain --
            // this phase renders nothing else (no text, per §7.7), so it
            // can safely claim the rest of .app's own 100vh minus its
            // vertical padding. alignContent still centres the tiles
            // within whatever height that resolves to.
            minHeight: 'calc(100vh - 60px)',
            alignContent: 'center',
          }}
        >
          {confirmGrid.map((crop) => {
            const isTarget = crop.id === target?.id;
            return (
              <CropButton
                key={crop.id}
                crop={crop}
                dead={deadCropIds.has(crop.id)}
                dimmed={promptTier >= 2 && !isTarget}
                isTargetHighlighted={promptTier === 2 && isTarget}
                isTargetBouncing={promptTier >= 3 && isTarget}
                disabled={promptTier >= 3 && !isTarget}
                celebrating={false}
                onTap={() => handleTap(crop)}
              />
            );
          })}
        </div>
      )}

      {phase === 'celebrating' && (companionHuntActive || target) && (
        // CHILD-FACING. The object (or, for a Companion hunt, the
        // Companion's own photo) IS the reward (§7.7) — no confetti, no
        // stars, no text. §8.1 "Reward: their photo appears on success,
        // framed in {fav_colour}" — reward frame colour applies to both
        // paths. §6.3: the Companion is DELIGHTED here — this is its one
        // celebratory state; there is no corresponding "sad" render
        // anywhere in this file for a wrong tap (§7.7's wrong-tap handling
        // is silence + fade only, never a Companion reaction).
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 40,
            position: 'relative',
          }}
        >
          <div
            style={
              rewardFrameColour(profile)
                ? {
                    padding: 8,
                    borderRadius: 20,
                    border: `4px solid ${rewardFrameColour(profile)}`,
                  }
                : undefined
            }
          >
            {companionHuntActive ? (
              <div
                aria-label={profile.context.companion?.name}
                className="g1-crop g1-crop--celebrating"
                style={{
                  minWidth: 88,
                  minHeight: 88,
                  borderRadius: 16,
                  backgroundImage: `url(${profile.context.companion?.photo})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ) : (
              target && (
                <CropButton
                  crop={target}
                  dead={false}
                  dimmed={false}
                  isTargetHighlighted={false}
                  isTargetBouncing={false}
                  disabled
                  celebrating
                  onTap={() => {}}
                />
              )
            )}
          </div>
          {/* Small delighted Companion cameo on a normal (non-hunt)
              celebration — §8.0/§18's "profile-swap demo moment": this
              cameo, the audio greeting, the hunt button, and the helper
              framing are ALL driven by the same profile.context.companion
              read, so changing the Companion in settings changes every one
              of them with no branching code here. */}
          {!companionHuntActive && hasCompanion(profile) && (
            <div
              aria-label={profile.context.companion?.name}
              style={{
                position: 'absolute',
                bottom: -8,
                right: 'calc(50% - 70px)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '3px solid var(--color-tile-border)',
                boxShadow: '0 0 0 2px rgba(0,0,0,0.15)',
                backgroundImage: `url(${profile.context.companion?.photo})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}
        </div>
      )}

      {phase === 'reportingSupport' && (
        <>
          <p>How much support did they actually need?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUPPORT_TIERS.map((info) => (
              <button
                key={info.tier}
                style={{ minWidth: 88, minHeight: 88, textAlign: 'left' }}
                onClick={() => void handleSupportTierReport(info.tier)}
              >
                {info.tier}. {info.name}: {info.instruction}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'movementBreak' && (
        // §7.7 "Movement breaks": audio + a simple icon, no scoring, no
        // counting the child's actual movements. Caregiver taps to
        // continue when ready — no timer forcing the pace.
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 40 }}>
          <p style={{ fontSize: '2rem' }}>🤸</p>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={handleMovementBreakDone}>
            Ready to keep going
          </button>
        </div>
      )}
    </div>
  );
}
