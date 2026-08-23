// Game 2 — Toy Story Sequencing (F.022 redesign). §8.2.
//
// Loop: a live model call invents a short story from whatever real objects
// were in the child's room photo (engine/game2Story.ts owns that call, the
// caching, and the deterministic never-fails fallback) -> the story is
// modelled in full, in order (once, or twice for sameness-helps profiles)
// -> "do it with the real Companion" off-screen, which is where the
// learning actually happens (§8.2) -> the whole story is shown at once as
// a vertical path of sentence+placeholder pairs, with every step's photo
// shuffled into a pool below -- the child drags (or taps to pick up, then
// taps a placeholder) each photo into its spot, in any order, and hits a
// checkmark to check them all together -> save as a printable visual
// schedule. Support tier + fading + session lifecycle log through the same
// F.010/F.011/F.013 engine as Game 1.
//
// 'blanks' is a DELIBERATE, EXPLICIT exception to this app's usual "zero
// text once the phone is in the child's hands" split (the split Game1.tsx
// and every other phase in this file still follow) -- the sentences stay
// on screen during placement, by direct request, after that split was
// explained. The story is still narrated in full, in audio, the moment
// this phase opens (proceedToBlanks) -- the text is additive to that, not
// a replacement for it. A wrong placement is still silent per §7.7 (no
// sound, no colour flash, no mark) -- Submit just returns anything wrong
// to the pool for another try.

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { adapters } from '../adapters/registry';
import { captureRoomAndRecognize, type CaptureStage } from '../adapters/pipeline/myWorldPipeline';
import {
  generateGame2Story,
  renderStorySentence,
  resolveStoryStepObject,
  type DetectedObjectForStory,
} from '../engine/game2Story';
import { modelPlaybackCount, actItOutLine, formatVisualSchedule } from '../engine/routineSequencing';
import { logActivityOutcome } from '../engine/activityLogging';
import { startSession, endSession } from '../engine/profileStore';
import { SUPPORT_TIERS } from '../config/supportLadder';
import { GENERIC_FALLBACK_CROPS } from './genericFallbackCrops';
import { createTemplateStory } from '../adapters/story/templateStory';
import { isColourAvoided, containsAvoidedContent } from '../engine/avoidFilter';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';
import type { GeneratedStoryTemplate } from '../adapters/ports';

type Phase = 'idle' | 'capturing' | 'modelling' | 'actItOut' | 'blanks' | 'complete' | 'reportingSupport';

interface Game2Props {
  profile: ChildProfile;
  /** Same contract as Game1/Game3: fires whenever the screen crosses into
   * or out of the CHILD-facing 'blanks' phase, so the shell can hide its
   * own text chrome instead of leaving it visible during the zero-text
   * phase this file enforces internally. */
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

/** One step of the generated story, resolved down to what the screen
 * actually needs: the real cropped photo it refers to, and its sentence
 * already rendered through renderStorySentence (slot tokens filled). */
interface ResolvedStep {
  crop: TaggedCrop;
  sentence: string;
}

/** Loose common-colour-word → CSS colour mapping for the swatch fallback
 * shown when a crop has no `image`. Duplicated from Game1.tsx rather than
 * shared -- each game owns how it renders a step (§12.2), and this is six
 * lines, not a module. */
function swatchColour(colour: string): string {
  const known = new Set([
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'grey', 'gray', 'gold', 'silver', 'teal', 'cyan',
  ]);
  return known.has(colour.toLowerCase()) ? colour.toLowerCase() : '#ccc';
}

/** Shared crop-tile visual (photo if we have one, otherwise a colour
 * swatch) -- used for both the pool tiles and the filled-slot contents.
 * Zero text (§7.7): aria-label carries the name for assistive tech only,
 * nothing visible. */
function cropTileStyle(crop: TaggedCrop): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: swatchColour(crop.colour),
    backgroundImage: crop.image ? `url(${crop.image})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/** Same background as cropTileStyle, but WITHOUT the 100%-of-parent
 * width/height -- for elements that aren't sitting inside an already
 * fixed-size 88x88 parent. Using cropTileStyle's width/height:100% on the
 * drag ghost (position:fixed, no sized ancestor) resolved against the
 * whole viewport instead -- the "fills the entire screen" bug. */
function cropTileBackground(crop: TaggedCrop): CSSProperties {
  return {
    backgroundColor: swatchColour(crop.colour),
    backgroundImage: crop.image ? `url(${crop.image})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/** A single placeholder slot in the story sequence. Empty = a soft dashed
 * outline (an invitation, not an error state -- never red, never an "X").
 * Filled = the placed crop's photo, tappable to send it back to the pool
 * in case of a mis-drop, before Submit is pressed. */
function StorySlot({
  crop,
  onTapFilled,
  onTapEmpty,
  isDropTarget,
  slotRef,
}: {
  crop: TaggedCrop | null;
  onTapFilled: () => void;
  onTapEmpty: () => void;
  isDropTarget: boolean;
  slotRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={slotRef}
      role="button"
      aria-label={crop ? crop.name : undefined}
      onClick={crop ? onTapFilled : onTapEmpty}
      className={['g2-slot', isDropTarget && 'g2-slot--target'].filter(Boolean).join(' ')}
      style={{
        width: 88,
        height: 88,
        borderRadius: 18,
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      {crop && <div aria-hidden="true" style={cropTileStyle(crop)} />}
    </div>
  );
}

/** One tile in the pool below the story -- press-and-drag it onto a slot,
 * or tap it to pick it up and then tap a slot to place it (§8.2's own
 * rule: drag works if attempted but is never required -- fine-motor
 * differences make sustained-contact dragging genuinely hard for some of
 * this app's children, so a full drag gesture can never be the only way
 * to play). `picked` is the tap-to-place equivalent of "currently being
 * dragged" -- a soft lift, never a score or a mark. */
function PoolTile({
  crop,
  picked,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTap,
}: {
  crop: TaggedCrop;
  picked: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      className={['g2-crop', picked && 'g2-crop--picked'].filter(Boolean).join(' ')}
      aria-label={crop.name}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onTap}
      style={{
        width: 88,
        height: 88,
        border: 'none',
        padding: 0,
        touchAction: 'none',
      }}
    >
      <div aria-hidden="true" style={cropTileStyle(crop)} />
    </button>
  );
}

/** Plain checkmark, no visible text -- the same "icon-only child-facing
 * affordance" pattern Game3ShadowMatch.tsx already uses for its "+"
 * control. aria-label carries the meaning for assistive tech; the glyph
 * itself is decoration, not language, so it doesn't reopen the zero-text
 * rule this phase otherwise enforces. */
function SubmitCheckButton({ onTap, ready }: { onTap: () => void; ready: boolean }) {
  return (
    <button
      type="button"
      aria-label="Submit"
      disabled={!ready}
      onClick={onTap}
      className="g2-submit"
      style={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        fontSize: '2rem',
        lineHeight: 1,
      }}
    >
      ✓
    </button>
  );
}

/** Caregiver-facing choice on the idle screen -- how many objects (and so
 * how many steps) the story should have. Matches the [2, 4] range every
 * layer downstream (the prompt, both generators, validation) already
 * enforces -- this is just exposing that existing range as a choice
 * instead of leaving it to the generator's own discretion. */
const STEP_COUNT_OPTIONS = [2, 3, 4] as const;

/** Caregiver-facing choice on the idle screen -- not every child relates
 * to a third-person "friend" character; some just play by themselves. */
const PERSPECTIVE_OPTIONS: { value: 'companion' | 'child'; label: string }[] = [
  { value: 'companion', label: 'Their companion' },
  { value: 'child', label: 'Just them' },
];

/** The real sequence the 'capturing' phase's progress bar tracks --
 * myWorldPipeline.ts's own CaptureStage order, plus 'writing' for the
 * story-generation call this file makes once capture succeeds (a separate
 * network call the shared pipeline doesn't know about). */
const STAGE_ORDER: (CaptureStage | 'writing')[] = [
  'capturing',
  'checking-faces',
  'blurring',
  'looking-at-objects',
  'writing',
];

const STAGE_LABELS: Record<CaptureStage | 'writing', string> = {
  capturing: 'Getting your photo…',
  'checking-faces': 'Checking for faces…',
  blurring: 'Keeping everyone private…',
  'looking-at-objects': 'Looking around the room…',
  writing: 'Writing the story…',
};

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

const GAME2_STYLES = `
.g2-crop { transition: opacity 200ms ease, transform 160ms cubic-bezier(0.23, 1, 0.32, 1); opacity: 1; }
.g2-crop--picked { transform: scale(1.06) translateY(-4px); box-shadow: var(--shadow-md); }
.g2-slot {
  border: 2px dashed var(--color-border);
  background: var(--color-surface-sunken);
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
}
.g2-slot--target { border-color: var(--color-primary); background: var(--color-primary-soft); transform: scale(1.04); }
.g2-submit { background: var(--color-primary); color: var(--color-primary-ink); border: none; box-shadow: var(--shadow-md); }
.g2-submit:disabled { background: var(--color-surface-sunken); color: var(--color-ink-muted); box-shadow: none; opacity: 0.6; }
.g2-drag-ghost { position: fixed; z-index: 1000; pointer-events: none; width: 88px; height: 88px; opacity: 0.92; transform: translate(-50%, -50%) scale(1.08); box-shadow: var(--shadow-md); border-radius: 16px; }

/* Story presentation -- a numbered vertical stepper (badge + dashed rail
   connecting each step) with each sentence/photo pair held in its own
   card, replacing the old plain-text-over-a-grey-line layout. Shared by
   both 'modelling' (caregiver-facing, photo + sentence + a per-line
   replay) and 'blanks' (child-facing, sentence + placeholder slot -- see
   this file's header for why text is allowed on screen there). */
.g2-story { display: flex; flex-direction: column; gap: 10px; }
.g2-step { display: flex; align-items: stretch; gap: 12px; }
.g2-step-rail { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 30px; }
.g2-step-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-ink-muted);
  background: var(--color-surface-sunken);
  border: 1.5px solid var(--color-border);
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms var(--ease-out);
}
.g2-step-badge--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-primary-ink);
  transform: scale(1.1);
  box-shadow: var(--shadow-sm);
}
.g2-connector {
  width: 2px;
  flex: 1;
  min-height: 22px;
  margin-top: 3px;
  border-radius: 999px;
  background: repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 4px, transparent 4px, transparent 9px);
}
.g2-step-card {
  flex: 1;
  display: flex;
  /* flex-start, not center: the sentence wraps to a different number of
     lines per step, so centering against the whole (variable-height) text
     block made the photo and speak button drift to a different vertical
     position on every card -- inconsistent across the list, which reads
     as "off" even though each card is individually balanced. Top-aligning
     keeps the photo/button pinned to the same spot on every card
     regardless of how long that step's sentence is. */
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, opacity 200ms ease;
}
.g2-step-card--active { border-color: var(--color-primary); background: var(--color-primary-soft); box-shadow: var(--shadow-md); }
.g2-step-card--blanks { flex-direction: column; align-items: stretch; gap: 8px; }
/* The speak button's actual hit target is a full 88px box (touch-target
   rule) but its visible glyph is a small circle centered inside that box
   -- top-aligning the 88px box on the card would leave the glyph sitting
   noticeably below the text's first line. Pull the glyph up to sit level
   with the first line instead; the invisible hit area stays 88px, this
   only shifts where the visible circle sits within it. */
/* The speak button's glyph is centered inside a full 88px hit target
   (touch-target rule), so top-aligning that whole box would leave the
   visible glyph sitting well below the 64px photo. Pull it up by roughly
   half the difference (88-64)/2 = 12px so the visible glyph lines up with
   the photo's own vertical center -- the two icon-like elements in the
   row -- rather than guessing at text-line alignment, which depends on
   font metrics I can't verify without a real render. */
.g2-speak-btn { margin-top: -12px; }
.g2-step-photo { width: 64px; height: 64px; flex-shrink: 0; border-radius: var(--radius-sm); background-size: cover; background-position: center; }
.g2-step-text { flex: 1; min-width: 0; margin: 0; font-size: 0.95rem; line-height: 1.45; color: var(--color-ink); }
.g2-step-text-row { display: flex; align-items: center; gap: 6px; }
/* Ghost icon button -- same "invisible 88x88 target, small visible glyph"
   pattern .header-back already uses, so the per-line speak control meets
   the 88x88 minimum without visually dominating a one-line sentence. */
.g2-speak-btn {
  width: 88px;
  height: 88px;
  min-width: 88px;
  min-height: 88px;
  flex-shrink: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.g2-speak-btn:active { transform: none; box-shadow: none; }
.g2-speak-btn-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  font-size: 1.05rem;
  background: var(--color-primary-soft);
  transition: transform 160ms var(--ease-out), background-color 160ms ease;
}
.g2-speak-btn:active .g2-speak-btn-glyph { transform: scale(0.9); background: var(--color-primary-soft); }
.g2-speak-btn:disabled .g2-speak-btn-glyph { opacity: 0.5; }
.g2-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
}
`;

/** Ensures at least `min` usable crops before calling generateGame2Story --
 * the structural fix for the old file's dead-end-on-bad-photo bug (see
 * this file's header). Pads with GENERIC_FALLBACK_CROPS entries not
 * already present, in order, until the minimum is met. */
function padCropsToMinimum(crops: TaggedCrop[], min: number): TaggedCrop[] {
  if (crops.length >= min) return crops;
  const padded = [...crops];
  for (const fallback of GENERIC_FALLBACK_CROPS) {
    if (padded.length >= min) break;
    if (padded.some((c) => c.id === fallback.id)) continue;
    padded.push(fallback);
  }
  return padded;
}

/** §6.2/§6.4's Layer 4 hard exclusion, applied to OBJECT SELECTION rather
 * than just the rendered string. `avoidFilter.ts`'s own text filter
 * (installAvoidFilter, wired app-wide) is a defensive backstop -- it swaps
 * a whole sentence for one fixed neutral line if avoided content ever
 * reaches render, which reads as broken mid-story (a jarring, out-of-place
 * line sitting between two real sentences). The actual fix is upstream:
 * never offer an avoided object as a candidate in the first place, so
 * neither the real generator nor the template fallback can ever reference
 * it, and the photo shown never depicts an avoided colour either -- the
 * text filter alone never protected the IMAGE, only the string. */
function isCropAvoided(crop: TaggedCrop, avoidList: ChildProfile['context']['avoidList']): boolean {
  if (isColourAvoided(crop.colour, avoidList)) return true;
  return containsAvoidedContent(`${crop.name} ${crop.category} ${crop.function}`, avoidList);
}

function filterAvoidedCrops(crops: TaggedCrop[], avoidList: ChildProfile['context']['avoidList']): TaggedCrop[] {
  return crops.filter((c) => !isCropAvoided(c, avoidList));
}

/** UTF-8-safe base64 encode -- `btoa` alone throws on non-Latin1 text, and
 * object names come from a vision model, so this is not a hypothetical. */
function toBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/** generateGame2Story wants a `photoDataUrl` purely as a stable per-photo
 * cache key (see game2Story.ts's header on the "sameness helps" caching
 * contract) -- but F.006's pipeline never exposes the actual room photo to
 * game code (myWorldPipeline.ts's whole point is that the photo is
 * discarded, nothing downstream holds a reference). So this builds a
 * synthetic stand-in: a deterministic identity derived from the objects
 * THIS photo actually produced (same photo -> same crops -> same key),
 * wrapped as a fake data URL so hashPhotoDataUrl's base64-decode still
 * works on it. */
function buildPhotoIdentity(crops: TaggedCrop[]): string {
  const identity = crops
    .map((c) => `${c.name}|${c.colour}|${c.category}`)
    .sort()
    .join(';');
  return `data:text/plain;base64,${toBase64(identity)}`;
}

export function Game2({ profile, onChildFacingChange }: Game2Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [slowCapture, setSlowCapture] = useState(false);
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [resolvedSteps, setResolvedSteps] = useState<ResolvedStep[]>([]);
  const [modelPlaybacksLeft, setModelPlaybacksLeft] = useState(0);
  const [modelStepIndex, setModelStepIndex] = useState<number | null>(null);
  const [isPlayingModel, setIsPlayingModel] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<string[] | null>(null);
  // The blank-filling board: one crop id (or null while empty) per story
  // step, index-aligned with resolvedSteps -- and the pool of crop ids not
  // yet placed anywhere. Replaces the old one-blank-at-a-time
  // SequencingMachine flow: every slot is visible and fillable at once,
  // in any order, checked together on Submit.
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [poolIds, setPoolIds] = useState<string[]>([]);
  // Tap-to-place equivalent of "currently being dragged" -- §8.2's own
  // rule that drag must never be the only way to play. Also doubles as
  // the drag ghost's source id while a real pointer-drag is in progress.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ cropId: string; x: number; y: number } | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  // Whether any Submit attempt this round found a wrong placement --
  // stands in for the old lockedToCorrect signal when reporting the
  // default support tier (§4's "needed real help" proxy for a batch
  // interaction, where there's no single "second wrong" moment anymore).
  const [hadWrongSubmit, setHadWrongSubmit] = useState(false);
  const [stepCount, setStepCount] = useState<number>(3);
  // Who the story is about -- 'companion' (default) uses this app's usual
  // {companion} character, which falls back to a generic "your friend"
  // phrase if the caregiver never set a real Companion; 'child' addresses
  // the child directly ("You climb into...") for a child who doesn't
  // relate to a friend/companion framing at all.
  const [perspective, setPerspective] = useState<'companion' | 'child'>('companion');
  // Real pipeline progress, not a fake timer -- fed by myWorldPipeline's
  // onStage callback plus one local 'writing' stage this file adds for
  // the story-generation call itself, which the shared pipeline doesn't
  // know about.
  const [captureStage, setCaptureStage] = useState<CaptureStage | 'writing' | null>(null);

  const slotElsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }, [profile.id]);

  useEffect(() => {
    onChildFacingChange?.(phase === 'blanks');
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  async function startRound() {
    setPhase('capturing');
    setSlowCapture(false);
    setCaptureStage(null);

    // Routed through the F.006 pipeline, never the raw adapters directly --
    // see myWorldPipeline.ts's header and scripts/smoke-f006.ts's static
    // check, which fixed exactly this shortcut when it was first written
    // directly against adapters.vision.
    const outcome = await captureRoomAndRecognize({
      onSlow: () => setSlowCapture(true),
      onStage: setCaptureStage,
    });

    if (outcome.kind === 'capture-unavailable' && outcome.cancelled) {
      // They closed the picker without choosing a photo -- a deliberate
      // "not right now", not a technical failure. Every OTHER
      // capture-unavailable case still degrades to generic content and
      // keeps going (§11), but proceeding here would spend a real
      // generation call and show a story built entirely from placeholder
      // objects the person never asked to see. Just go back to idle;
      // "Start a story" is still one tap away.
      setCaptureStage(null);
      setPhase('idle');
      return;
    }

    // §6.2/§6.4 Layer 4 hard exclusion, applied BEFORE anything downstream
    // ever sees these objects -- not as a post-hoc text swap. An avoided
    // colour or term must never be offered as a candidate, so it can
    // never end up as an object the story references OR a photo the
    // child sees. See isCropAvoided's own comment for why the text-only
    // filter (avoidFilter.ts, still installed app-wide as a defensive
    // backstop) isn't sufficient on its own for a multi-step story.
    const avoidList = profile.context.avoidList;
    const rawCrops = outcome.kind === 'success' ? outcome.crops : [];
    const baseCrops = filterAvoidedCrops(rawCrops, avoidList);
    // §11: capture-unavailable (non-cancel) / blur-failed / no-objects-found
    // all degrade the same way here -- padded up to a usable minimum
    // rather than shown as an error, so the flow always reaches a valid
    // game. Padded to the caregiver's chosen stepCount (not a hardcoded
    // 2), so there are always enough real crops for exactly the story
    // length they picked.
    const padded = filterAvoidedCrops(padCropsToMinimum(baseCrops, stepCount), avoidList);
    setCrops(padded);
    setCaptureStage('writing');

    const objects: DetectedObjectForStory[] = padded.map((c) => ({
      name: c.name,
      colour: c.colour,
      category: c.category,
      function: c.function,
    }));

    let story: GeneratedStoryTemplate;
    if (baseCrops.length === 0) {
      // Vision/capture genuinely found nothing real this time -- go
      // straight to the never-fails template generator and skip caching
      // entirely, rather than routing through generateGame2Story. Caching
      // this would be a real trap: padCropsToMinimum always produces the
      // exact same generic pair in the exact same order, so a story
      // generated from purely-placeholder objects would legitimately
      // succeed and get cached as a "real" result -- then every FUTURE
      // vision failure would silently replay that same old generic story
      // forever, instead of ever giving real detection another try. A
      // vision failure is meant to be transient; it should never get
      // "sameness helps" permanence the way a genuinely personalised
      // story does.
      story = await createTemplateStory().generateStory({
        objects,
        childAgeMonths: profile.ageMonths,
        sameness: profile.responseProfile.sameness,
        stepCount,
        avoidedColour: avoidList?.avoidedColour,
        avoidedTerms: avoidList?.avoidedTerms,
        perspective,
      });
    } else {
      story = await generateGame2Story(
        buildPhotoIdentity(padded),
        objects,
        profile.ageMonths,
        profile.responseProfile.sameness,
        stepCount,
        { colour: avoidList?.avoidedColour, terms: avoidList?.avoidedTerms },
        perspective,
      );
    }

    const usedIds = new Set<string>();
    const resolved: ResolvedStep[] = story.steps.map((step) => {
      let crop = resolveStoryStepObject(step, padded);
      if (!crop || usedIds.has(crop.id)) {
        // Defensive only -- the generator validates every objectRef
        // against the real object list, so this should be unreachable.
        // Fall back to an unused generic swatch rather than crashing.
        crop = GENERIC_FALLBACK_CROPS.find((f) => !usedIds.has(f.id)) ?? GENERIC_FALLBACK_CROPS[0];
      }
      usedIds.add(crop.id);
      return { crop, sentence: renderStorySentence(step, profile) };
    });
    setResolvedSteps(resolved);
    setModelPlaybacksLeft(modelPlaybackCount(profile.responseProfile.sameness));
    setModelStepIndex(null);
    setPhase('modelling');
  }

  /** One full playthrough of the story, step by step -- each step's audio
   * plus its correct cropped photo shown (§4 point 1). `say` resolves when
   * speech finishes (SpeechOutPort's contract), so steps play in order. */
  async function playModelOnce() {
    if (isPlayingModel || resolvedSteps.length === 0) return;
    setIsPlayingModel(true);
    for (let i = 0; i < resolvedSteps.length; i += 1) {
      setModelStepIndex(i);
      await adapters.speechOut.say(resolvedSteps[i].sentence);
    }
    setModelStepIndex(null);
    setIsPlayingModel(false);
    setModelPlaybacksLeft((n) => {
      const remaining = n - 1;
      if (remaining <= 0) {
        setTimeout(() => setPhase('actItOut'), 300);
      }
      return remaining;
    });
  }

  function proceedToBlanks() {
    setSlots(resolvedSteps.map(() => null));
    setPoolIds(shuffled(resolvedSteps.map((rs) => rs.crop.id)));
    setPickedId(null);
    setDrag(null);
    setDropTargetIndex(null);
    setHadWrongSubmit(false);
    setPhase('blanks');
    // The story is narrated once, in full, as this phase opens -- audio
    // only, per §8.0's "the audio is the child's". Zero on-screen text
    // for the rest of this phase; the child places by photo, not by
    // reading, matching the app-wide split every other game uses.
    void (async () => {
      for (const rs of resolvedSteps) {
        await adapters.speechOut.say(rs.sentence);
      }
    })();
  }

  function cropById(id: string): TaggedCrop | null {
    return crops.find((c) => c.id === id) ?? resolvedSteps.find((rs) => rs.crop.id === id)?.crop ?? null;
  }

  /** Places `cropId` into `slotIndex`, removing it from the pool -- shared
   * by both the drag-drop path and the tap-to-place path so they can never
   * drift into different behaviour. */
  function placeInSlot(cropId: string, slotIndex: number) {
    setSlots((prev) => {
      if (prev[slotIndex] !== null) return prev; // occupied -- no-op, not a swap
      const next = [...prev];
      next[slotIndex] = cropId;
      return next;
    });
    setPoolIds((prev) => prev.filter((id) => id !== cropId));
  }

  function returnToPool(cropId: string) {
    setSlots((prev) => prev.map((id) => (id === cropId ? null : id)));
    setPoolIds((prev) => (prev.includes(cropId) ? prev : [...prev, cropId]));
  }

  /** Pointer-drag start on a pool tile. Uses pointer capture rather than a
   * document-level listener -- move/up keep firing on this same element
   * regardless of where the pointer physically travels, which is what
   * makes cleanup trivial (no addEventListener/removeEventListener pair
   * to manage). §8.2: drag is offered, never required -- see handleTap
   * below for the equivalent tap-to-place path. */
  function handlePointerDown(cropId: string, e: ReactPointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ cropId, x: e.clientX, y: e.clientY });
    setPickedId(null);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    setDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    const target = slotElsRef.current.findIndex((el, i) => {
      if (!el || slots[i] !== null) return false;
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    setDropTargetIndex(target === -1 ? null : target);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const target = dropTargetIndex;
    setDropTargetIndex(null);
    // `drag` is read directly from this render's closure, not through a
    // setState updater -- placeInSlot has its own setState calls, and an
    // updater function must stay pure (React can invoke it more than
    // once, e.g. under StrictMode), so it's the wrong place to trigger a
    // side effect like this.
    if (drag && target !== null) {
      placeInSlot(drag.cropId, target);
    }
    setDrag(null);
    // A tap with no real movement never set a drop target, so it lands
    // here with target === null and does nothing -- the separate onClick
    // handler (handlePoolTap) is what turns that same tap into a pick.
  }

  function handlePoolTap(cropId: string) {
    // Only fires for a genuine tap (no drag distance) -- see PoolTile's
    // onClick, which React fires after pointerup when the gesture didn't
    // move enough to count as a drag in the browser's own judgment.
    setPickedId((prev) => (prev === cropId ? null : cropId));
  }

  function handleSlotTapEmpty(slotIndex: number) {
    if (pickedId) {
      placeInSlot(pickedId, slotIndex);
      setPickedId(null);
    }
  }

  function handleSlotTapFilled(slotIndex: number) {
    const id = slots[slotIndex];
    if (id) returnToPool(id);
  }

  function handleSubmit() {
    const wrongIndices = slots
      .map((id, i) => (id !== null && id !== resolvedSteps[i].crop.id ? i : -1))
      .filter((i) => i !== -1);
    if (wrongIndices.length === 0) {
      void finishStory();
      return;
    }
    // §7.7: silence, springs back, nothing marked -- the wrong ones just
    // return to the pool for another try. No red flash, no shake, no
    // count of how many were wrong shown anywhere.
    setHadWrongSubmit(true);
    const returned = wrongIndices.map((i) => slots[i] as string);
    setSlots((prev) => prev.map((id, i) => (wrongIndices.includes(i) ? null : id)));
    setPoolIds((prev) => shuffled([...prev, ...returned]));
  }

  async function finishStory() {
    setPhase('complete');
    const renderedLines = resolvedSteps.map((rs) => rs.sentence);
    // `formatVisualSchedule` renders the title itself (slot tokens intact
    // here, same as any other unrendered template) -- `renderedLines` are
    // already-rendered per-step sentences, which it just prepends the
    // title to.
    const lines = formatVisualSchedule(profile, "{child}'s story time!", renderedLines);
    setSchedule(lines);
    void adapters.speechOut.say(lines.join('. '));
    // No auto-advance -- this used to jump to reportingSupport on its own
    // after 600ms, which read as instant/abrupt. The caregiver now taps
    // "Continue" (below, in the 'complete' phase render) whenever they're
    // actually ready, same pattern as every other caregiver-paced moment
    // in this app.
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId) return;
    await logActivityOutcome({
      sessionId,
      skillId: 'sequence-story',
      context: 'living-room',
      supportTier: tier,
      onScreenTier: hadWrongSubmit ? 3 : 0,
    });
    await endSession(sessionId, 'caregiver');
    setPhase('idle');
    setSessionId(null);
    void startSession(profile.id).then((s) => setSessionId(s.id));
  }

  if (phase === 'idle') {
    return (
      <div className="screen">
        <h2>Story Time</h2>
        <p style={{ color: 'var(--color-ink-muted)' }}>
          A photo of the room, turned into a short story your child acts out and then fills in.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Objects in the story:</span>
          {STEP_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              style={{
                minWidth: 44,
                minHeight: 44,
                fontWeight: n === stepCount ? 'bold' : 'normal',
                border: n === stepCount ? '2px solid var(--color-primary)' : undefined,
              }}
              onClick={() => setStepCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Who's the story about:</span>
          {PERSPECTIVE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              style={{
                minHeight: 44,
                fontWeight: opt.value === perspective ? 'bold' : 'normal',
                border: opt.value === perspective ? '2px solid var(--color-primary)' : undefined,
              }}
              onClick={() => setPerspective(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button className="button-primary" style={{ minWidth: 88, minHeight: 88 }} onClick={() => void startRound()}>
          Start a story
        </button>
      </div>
    );
  }

  if (phase === 'capturing') {
    // §11: "Slow (>4s) → calm progress state, never a spinner over blank."
    // Real progress, not a fake timer -- STAGE_ORDER mirrors the actual
    // sequence captureRoomAndRecognize's onStage fires, plus 'writing' for
    // the story-generation call this file makes afterward. A stage this
    // run happens to skip (e.g. face detection failing fast) just means
    // the bar jumps straight past it when the next real onStage fires --
    // still honest, since it reflects what's actually happening rather
    // than a fixed animation running on its own clock.
    const stageIndex = captureStage ? STAGE_ORDER.indexOf(captureStage) : 0;
    const fillPercent = ((Math.max(stageIndex, 0) + 1) / STAGE_ORDER.length) * 100;
    return (
      <div className="screen">
        <p style={{ fontSize: '1rem', opacity: 0.8, marginBottom: 12 }}>
          {captureStage ? STAGE_LABELS[captureStage] : 'Getting started…'}
          {slowCapture ? ' (taking a little longer than usual)' : ''}
        </p>
        <div className="header-progress" role="progressbar" aria-valuenow={fillPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="header-progress-fill" style={{ width: `${fillPercent}%` }} />
        </div>
      </div>
    );
  }

  if (phase === 'modelling') {
    return (
      <div className="screen">
        <style>{GAME2_STYLES}</style>
        <h2>Your story</h2>
        <p style={{ color: 'var(--color-ink-muted)' }}>
          {modelPlaybacksLeft} playback{modelPlaybacksLeft === 1 ? '' : 's'} left
        </p>
        <div className="g2-story">
          {resolvedSteps.map((rs, i) => {
            const isActive = modelStepIndex === i;
            const isDimmed = modelStepIndex !== null && !isActive;
            return (
              <div className="g2-step" key={i}>
                <div className="g2-step-rail">
                  <span
                    className={['g2-step-badge', isActive && 'g2-step-badge--active'].filter(Boolean).join(' ')}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  {i < resolvedSteps.length - 1 && <div className="g2-connector" aria-hidden="true" />}
                </div>
                {/* §4 point 1: "play the story in full... with audio and the
                    correct cropped photo shown for each step" -- this was
                    missing entirely before; only the sentence rendered. */}
                <div
                  className={['g2-step-card', isActive && 'g2-step-card--active'].filter(Boolean).join(' ')}
                  style={{ opacity: isDimmed ? 0.55 : 1 }}
                >
                  <div
                    aria-hidden="true"
                    className="g2-step-photo"
                    style={{
                      backgroundColor: swatchColour(rs.crop.colour),
                      backgroundImage: rs.crop.image ? `url(${rs.crop.image})` : undefined,
                    }}
                  />
                  <p className="g2-step-text">{rs.sentence}</p>
                  {/* Replay just this one line on demand -- separate from
                      the full-story ▶ Play below. Disabled mid-playthrough
                      so a tap here can't overlap/queue behind that loop's
                      own sequential `say` calls. */}
                  <button
                    type="button"
                    className="g2-speak-btn"
                    aria-label={`Play this line: ${rs.sentence}`}
                    disabled={isPlayingModel}
                    onClick={() => void adapters.speechOut.say(rs.sentence)}
                  >
                    <span className="g2-speak-btn-glyph" aria-hidden="true">🔊</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button
          className="button-primary"
          style={{ minWidth: 88, minHeight: 88 }}
          disabled={isPlayingModel}
          onClick={() => void playModelOnce()}
        >
          ▶ Play
        </button>
      </div>
    );
  }

  if (phase === 'actItOut') {
    return (
      <div className="screen">
        <p>{actItOutLine(profile)}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
          Off-screen — this is where the learning happens.
        </p>
        <button className="button-primary" style={{ minWidth: 88, minHeight: 88 }} onClick={proceedToBlanks}>
          They did it — now fill it in
        </button>
      </div>
    );
  }

  if (phase === 'blanks') {
    // Deliberate, explicit exception to this app's usual "zero text once
    // the phone is in the child's hands" split (see this file's header):
    // requested directly, after that split was explained. The narration
    // still plays in audio too, same as before -- this just also shows
    // the words a caregiver reading alongside can follow.
    const allFilled = slots.length > 0 && slots.every((id) => id !== null);
    const draggedCrop = drag ? cropById(drag.cropId) : null;
    return (
      <div className="screen">
        <style>{GAME2_STYLES}</style>

        {/* The story's shape: a numbered step per sentence+placeholder
            pair, each in its own card, connected by a dashed rail down
            the page -- the badge supplies the "step 1 of N" sense the
            generated sentences no longer spell out in words. */}
        <div className="g2-story" style={{ paddingTop: 8 }}>
          {resolvedSteps.map((rs, i) => (
            <div className="g2-step" key={i}>
              <div className="g2-step-rail">
                <span className="g2-step-badge" aria-hidden="true">{i + 1}</span>
                {i < resolvedSteps.length - 1 && <div className="g2-connector" aria-hidden="true" />}
              </div>
              <div className="g2-step-card g2-step-card--blanks">
                <div className="g2-step-text-row">
                  <p className="g2-step-text">{rs.sentence}</p>
                  {/* Replay just this one line -- the full story is
                      already narrated in full, in audio, the moment this
                      phase opens (proceedToBlanks); this is for hearing
                      or re-hearing one line on demand. */}
                  <button
                    type="button"
                    className="g2-speak-btn"
                    aria-label={`Play this line: ${rs.sentence}`}
                    onClick={() => void adapters.speechOut.say(rs.sentence)}
                  >
                    <span className="g2-speak-btn-glyph" aria-hidden="true">🔊</span>
                  </button>
                </div>
                <StorySlot
                  crop={slots[i] ? cropById(slots[i] as string) : null}
                  isDropTarget={dropTargetIndex === i}
                  onTapFilled={() => handleSlotTapFilled(i)}
                  onTapEmpty={() => handleSlotTapEmpty(i)}
                  slotRef={(el) => {
                    slotElsRef.current[i] = el;
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* The pool -- drag a tile onto a placeholder above, or tap one to
            pick it up and then tap a placeholder (§8.2: drag is offered,
            never required). */}
        <div className="g2-pool" style={{ marginTop: 24 }}>
          {poolIds.map((id) => {
            const crop = cropById(id);
            if (!crop) return null;
            return (
              <PoolTile
                key={id}
                crop={crop}
                picked={pickedId === id}
                onPointerDown={(e) => handlePointerDown(id, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onTap={() => handlePoolTap(id)}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
          <SubmitCheckButton onTap={handleSubmit} ready={allFilled} />
        </div>

        {/* Drag ghost -- follows the pointer while a real drag (not a tap)
            is in progress. Pointer-move/up are wired on the pool tile
            itself via pointer capture, so this only needs to render. */}
        {draggedCrop && drag && (
          <div
            aria-hidden="true"
            className="g2-drag-ghost"
            style={{ left: drag.x, top: drag.y, ...cropTileBackground(draggedCrop) }}
          />
        )}
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="screen">
        <div id="printable-schedule">
          <h2>🎉 That's your story!</h2>
          {schedule && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem' }}>
              {schedule.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </div>
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => window.print()}>
          Print this schedule
        </button>
        <button className="button-primary" style={{ minWidth: 88, minHeight: 88 }} onClick={() => setPhase('reportingSupport')}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <p>How much support did they actually need?</p>
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
