// Game 3, Mode A — Shadow Match (F.021). §8.3.
//
// A thin layer on Person 1's engine, exactly like Game1.tsx: session
// lifecycle, the interaction state machine, support-tier logging and
// fading are all reused unchanged. This file owns only what §12.2 says a
// game may own: what skill it targets (visual discrimination — matching
// an object from progressively less information), what interaction shape
// it uses (silhouette-at-top, photos-below, tap to match — or, at Level 4,
// Game 1's own fetch-and-confirm shape), and how it renders a step.
//
// Reuses F.006's capture pipeline and F.008's game1Trial.ts target
// picker directly — "the cheapest second game because it reuses every
// crop and the whole engine" (F.021.md).

import { useEffect, useRef, useState, useCallback } from 'react';
import { adapters } from '../adapters/registry';
import { captureRoomAndRecognize } from '../adapters/pipeline/myWorldPipeline';
import { renderLine, slotValuesFromProfile } from '../engine/slots';
import { InteractionMachine, type PromptTier } from '../engine/interactionMachine';
import { startSession } from '../engine/profileStore';
import { logActivityOutcome } from '../engine/activityLogging';
import { getFadingSuggestion, type FadingSuggestion } from '../engine/fading';
import {
  describeSessionRecap,
  distinctSkillsThisSession,
  endSessionNow,
  getSessionNumber,
  hasCapBeenReached,
  sessionCapSeconds,
  type SessionEndResult,
} from '../engine/sessionLifecycle';
import { SUPPORT_TIERS, DEFAULT_STARTING_SUPPORT_TIER } from '../config/supportLadder';
import { GENERIC_FALLBACK_CROPS } from './genericFallbackCrops';
import { pickNextTarget } from './game1Trial';
import { getGame3Level, setGame3Level, type Game3Level } from './game3Level';
import {
  ALTERED_SAMPLE_FILTER,
  ALTERED_SAMPLE_TRANSFORM,
  buildLevel1Pool,
  buildShadowMatchOptions,
  levelDescription,
  requiresFetchingTheRealObject,
  sampleKindForLevel,
  type SampleKind,
} from './game3ShadowMatchLogic';
import { generateSilhouetteDataUrl } from './silhouetteCanvas';
import { ConceptArt } from './concepts/conceptArt';
import { buildConceptRound } from './concepts/conceptPool';
import type { ChildProfile, SupportTier, TaggedCrop } from '../types';

type Phase =
  | 'idle'
  | 'capturing'
  | 'presenting' // levels 1-3: sample + options, one tap resolves
  | 'searching' // level 4 only: child leaves to fetch the real object
  | 'confirming' // level 4 only: small grid, mirrors Game 1
  | 'celebrating'
  | 'reportingSupport'
  | 'sessionEnded';

interface Game3ShadowMatchProps {
  profile: ChildProfile;
  /** Same contract as Game1's onChildFacingChange: fires whenever the
   * screen crosses into or out of a CHILD-FACING phase, so the shell can
   * hide its own text chrome instead of leaving it visible during the
   * zero-text phases this file already enforces internally. */
  onChildFacingChange?: (isChildFacing: boolean) => void;
}

/* The glass fallback every surface in this file repeats. Written once as
 * a string so the four @supports blocks below cannot drift apart. */
const NO_BACKDROP_FILTER = 'not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))';

/**
 * Game 3's stylesheet. FIRST dark-mode pass on this file — it had never had
 * one, and still carried pre-light-mode literals (#eef, #ccc, #ddd, #557,
 * #fff, rgba(90,150,255,...)). Everything below now consumes App.css's
 * tokens; see src/design/DESIGN-TOKENS.md for why each one is what it is.
 *
 * The two audiences are split exactly the way §3.4/§4 asks:
 *
 *   CHILD  (presenting / confirming / celebrating — the zero-text phases)
 *          --space-child-gap rhythm, --glass-bg at the lighter fill,
 *          --glass-tint-child (Ember) wash, --radius-lg, one subject on
 *          screen. Ember is the only hue: --color-reward and
 *          --color-companion are deliberately absent from this file so
 *          those two keep meaning what they mean everywhere else.
 *
 *   CAREGIVER (idle / capturing / searching's lower half / support
 *          reporting / recap) --space-caregiver-gap rhythm, the
 *          --glass-bg-strong + --glass-tint-caregiver (Periwink) card
 *          that Setup and the dashboard already wear, --radius-md.
 *
 * One thing that is NOT a free choice: every tile that can hold a
 * silhouette keeps a LIGHT backing (--color-tile). ConceptArt draws a
 * silhouette with filter: brightness(0) — solid black — and
 * silhouetteCanvas.ts produces black-on-transparent PNGs. On a dark tile
 * both would be invisible. --color-tile is also what DESIGN-TOKENS §1.4
 * asks for here anyway ("an object under a lamp"), so the two agree.
 */
const GAME3_STYLES = `
/* ---- Child stage ---------------------------------------------------
   One subject at a time, generously spaced. §4.1: the whitespace is
   load-bearing, not decoration. */
.g3-child-screen { gap: var(--space-child-gap); }
.g3-stage { display: flex; flex-direction: column; align-items: center; gap: var(--space-child-gap); padding: 4px 0 8px; }

/* ---- The sample: the thing being matched ---------------------------
   The one element on the child's screen that is genuinely this game's
   signature, so it borrows the Room Frame's construction (§5): a glass
   mat with a concentric inner radius, the picture set INTO it rather
   than laid on top, and the picture's own colour blooming out behind to
   light the ground. Ember rim, because on the child's side this is the
   thing being pointed at. Radii are the frame's proportions at tile
   scale: 22 outer, 10 of mat, 12 inner. */
.g3-sample {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 176, 103, 0.42);
  background:
    linear-gradient(var(--glass-tint-child), var(--glass-tint-child)),
    var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  transition: opacity 220ms ease;
}
@supports ${NO_BACKDROP_FILTER} {
  .g3-sample { background: var(--color-accent-soft); }
}
/* Silhouette generation is async (silhouetteCanvas.ts). Dimming the mat
   is the whole "we are still working" cue — no spinner, nothing that
   reads as a progress indicator in the child's view (§4.1). */
.g3-sample--loading { opacity: 0.45; }
.g3-sample-bloom {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: var(--radius-lg);
  background-size: cover;
  background-position: center;
  transform: scale(var(--frame-bloom-scale));
  filter: blur(var(--frame-bloom-blur)) saturate(var(--frame-bloom-saturate));
  opacity: 0.42;
  pointer-events: none;
}
.g3-sample-inner {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
}
/* The inset hairline is what makes the picture sit IN the mat instead of
   reading as a sticker stuck on the glass (§5's photo-depth row). */
.g3-sample-inner--photo {
  background-color: var(--color-tile);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(0, 0, 0, 0.4);
}
.g3-sample-inner--art {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: var(--color-tile);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}
/* Level 4's cue sits alone above the caregiver's half of that screen. */
.g3-cue { display: flex; justify-content: center; padding: 4px 0 6px; }

/* ---- Option tiles --------------------------------------------------
   Two shapes, one material. A room crop is a photograph and fills its
   tile; a concept drawing is line art and needs the lit tile plus real
   padding, because conceptArt.tsx draws size INTO the 240x240 box on
   purpose (a small apple is small) and cropping that away would destroy
   the very difference the child is being asked to see. */
.g3-grid { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }
.g3-crop {
  position: relative;
  padding: 0;
  border-radius: var(--radius-lg);
  background-size: cover;
  background-position: center;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: opacity 200ms ease, transform 160ms var(--ease-out);
  opacity: 1;
}
.g3-crop--photo {
  min-width: 88px;
  min-height: 88px;
  background-color: var(--color-tile);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), inset 0 0 0 1px rgba(0, 0, 0, 0.35);
}
.g3-crop--art {
  width: 104px;
  height: 104px;
  min-width: 88px;
  min-height: 88px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-tile);
  border: 2px solid var(--color-tile-border);
  box-shadow: var(--glass-shadow);
}
.g3-crop--dead { opacity: 0.4; }
.g3-crop--dimmed { opacity: 0.6; }
.g3-crop--highlighted { animation: g3-pulse 1.2s ease-in-out infinite; }
.g3-crop--bouncing { animation: g3-bounce 0.6s ease-in-out infinite; }
.g3-crop--celebrating { animation: g3-celebrate 800ms ease-out forwards; position: relative; z-index: 1; }

/* Escalation cues, in Ember. Was rgba(90,150,255,0.6) — a raw blue that
   belonged to no palette this app has ever had. color-mix is the same
   trick Game1 uses so one accent value produces the ring's faded edge. */
@keyframes g3-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 55%, transparent); }
  50% { box-shadow: 0 0 0 10px transparent; }
}
@keyframes g3-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes g3-celebrate { 0% { transform: scale(1); } 100% { transform: scale(1.6); } }
@keyframes g3-dissolve { 0% { opacity: 1; } 100% { opacity: 0; } }

/* §4.3's phone pattern needs a "show me more" affordance that is still
   zero text. Same warm glass as the sample mat so it reads as part of
   the child's surface rather than as chrome; the glyph carries Ember at
   10.24:1 on the ground. */
.g3-more {
  min-width: 88px;
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 176, 103, 0.42);
  background:
    linear-gradient(var(--glass-tint-child), var(--glass-tint-child)),
    var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}
@supports ${NO_BACKDROP_FILTER} {
  .g3-more { background: var(--color-accent-soft); }
}
.g3-more-glyph { font-size: 1.75rem; line-height: 1; color: var(--color-accent); }

/* ---- The reveal ----------------------------------------------------
   §8.3's "the silhouette dissolves into the real photo". Both layers now
   wear the same lit tile the options do, so the cross-fade happens
   between two identical surfaces instead of between two different ones.
   The halo is Ember at very low alpha — warmth, not a reward graphic:
   Sunburst and Blush stay reserved for the moments that own them. */
.g3-celebrate-stage { display: flex; justify-content: center; padding-top: var(--space-child-gap); }
.g3-reveal {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-lg);
  box-shadow: 0 0 34px rgba(255, 176, 103, 0.18), var(--glass-shadow);
}
.g3-layer { position: absolute; inset: 0; border-radius: var(--radius-lg); }
.g3-layer--photo {
  background-size: cover;
  background-position: center;
  background-color: var(--color-tile);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
}
.g3-layer--art {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 9px;
  background: var(--color-tile);
}
.g3-dissolve-top { animation: g3-dissolve 900ms ease-in forwards; }

/* ---- Caregiver surfaces --------------------------------------------
   §4.2: three to five carded groups at --space-caregiver-gap, on the
   same Periwink-washed strong glass .dashboard-card and .home-edit-grid
   already use, so the caregiver half of this game belongs to the same
   family as Setup and the dashboard rather than looking like a fourth
   invented surface. No Ember anywhere below this line. */
.g3-screen { gap: var(--space-caregiver-gap); }
.g3-meta {
  margin: 0;
  padding: 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
/* Was an inline background: #eef. Same shape as .dashboard-banner: a
   standing note with one Periwink rule down its leading edge. */
.g3-note {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-info-soft);
  color: var(--color-ink-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}
/* Was color: #a33 on the bare ground — illegible on Nightshade. Coral
   ink on Danger Ash, 8.08:1. Still not a filled red block: a photo that
   would not process is a retry, not a failure. */
.g3-note--alert {
  border-color: var(--color-danger);
  border-left-color: var(--color-danger);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.g3-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background:
    linear-gradient(var(--glass-tint-caregiver), var(--glass-tint-caregiver)),
    var(--glass-bg-strong);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}
@supports ${NO_BACKDROP_FILTER} {
  .g3-card { background: var(--color-surface); border-color: var(--color-border-strong); }
}
.g3-card-label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.g3-card-body { margin: 0; font-size: 0.88rem; line-height: 1.5; color: var(--color-ink); }
.g3-card-hint { margin: 0; font-size: 0.8rem; line-height: 1.45; color: var(--color-ink-muted); }

/* The level ladder. Four unlabelled numbers floating on the ground read
   as debug controls; as a segmented row inside the card that also holds
   levelDescription(), they read as one setting with its own caption. */
.g3-levels { display: flex; gap: 8px; }
.g3-level {
  flex: 1 1 0;
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  padding: 0;
  font-size: 0.95rem;
  font-weight: var(--weight-caregiver-strong);
  color: var(--color-ink-muted);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}
/* Filled Periwink with dark ink, the polarity DESIGN-TOKENS §1.2 spells
   out (5.5:1); the old selected state was a 2px #557 rim on nothing. */
.g3-level--on {
  color: var(--color-primary-ink);
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.g3-actions { display: flex; flex-direction: column; gap: 10px; }
/* The 88px floors these two carried inline are kept exactly as they
   were — this pass is visual only and does not touch a tap target. */
.g3-play { min-width: 88px; min-height: 88px; font-weight: var(--weight-caregiver-strong); }

/* The hit-slop "End session" button now uses the shared .quiet-action /
   .quiet-action-chip pair in App.css (promoted from a copy that used to
   live here) so every game's version of this button can't drift out of
   sync with the others again. */

/* Support-tier reporting: five near-identical long labels. As five
   separate glass slabs they were an undifferentiated wall; as flush rows
   cut into one panel (the .home-edit-grid shape) the numeral becomes the
   scannable thing and the instruction drops to muted secondary text.
   Each row still clears the 88px floor. */
.g3-tiers {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background:
    linear-gradient(var(--glass-tint-caregiver), var(--glass-tint-caregiver)),
    var(--glass-bg-strong);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  overflow: hidden;
}
@supports ${NO_BACKDROP_FILTER} {
  .g3-tiers { background: var(--color-surface); border-color: var(--color-border-strong); }
}
.g3-tier {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 88px;
  min-height: 88px;
  padding: 12px 16px;
  text-align: left;
  color: var(--color-ink);
  background: transparent;
  border: none;
  border-radius: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}
.g3-tier + .g3-tier { border-top: 1px solid var(--color-border); }
/* No scale on press: shrinking a full-width row detaches it from the
   panel it is cut into. A wash instead — same value .dashboard-card-toggle
   and .home-edit-button use. */
.g3-tier:active { transform: none; background: rgba(255, 255, 255, 0.06); }
.g3-tier-num {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  /* §3.5: Periwink as a mark on --glass-bg-strong steps up to Bright. */
  color: var(--color-primary-bright);
  background: var(--color-primary-soft);
}
.g3-tier-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.g3-tier-name { font-size: 0.95rem; font-weight: var(--weight-caregiver-strong); }
.g3-tier-hint {
  font-size: 0.8rem;
  font-weight: var(--weight-caregiver-body);
  line-height: 1.4;
  color: var(--color-ink-muted);
}

/* ---- Waiting -------------------------------------------------------
   Was one unstyled sentence on an empty ground. A calm panel with three
   slowly breathing marks instead: §11 asks for a calm progress state
   rather than a spinner over blank, and this is deliberately slow and
   low-contrast — nothing fast, nothing flashing. */
.g3-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 30px 20px;
  text-align: center;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(var(--glass-tint-caregiver), var(--glass-tint-caregiver)),
    var(--glass-bg-strong);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}
@supports ${NO_BACKDROP_FILTER} {
  .g3-waiting { background: var(--color-surface); border-color: var(--color-border-strong); }
}
.g3-waiting-line { margin: 0; font-size: 0.95rem; color: var(--color-ink-muted); }
.g3-dots { display: flex; gap: 8px; }
.g3-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-primary);
  opacity: 0.3;
  animation: g3-breathe 1600ms ease-in-out infinite;
}
.g3-dot:nth-child(2) { animation-delay: 220ms; }
.g3-dot:nth-child(3) { animation-delay: 440ms; }
@keyframes g3-breathe { 0%, 100% { opacity: 0.22; } 50% { opacity: 0.85; } }

/* Every animated cue in this file becomes an instant state change, the
   cue itself kept. The dissolve lands on its finished frame, so the
   reveal still happens — it just does not fade. */
@media (prefers-reduced-motion: reduce) {
  .g3-crop--highlighted { animation: none; box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent) 55%, transparent); }
  .g3-crop--bouncing { animation: none; transform: translateY(-8px); box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent) 55%, transparent); }
  .g3-crop--celebrating { animation: none; transform: scale(1.2); }
  .g3-dissolve-top { animation: none; opacity: 0; }
  .g3-dot { animation: none; opacity: 0.5; }
  .g3-sample, .g3-crop { transition: none; }
}
`;

/** §4.3's own table: "Grid → Sequential reveal" is the PHONE pattern
 * assigned specifically to "Game 3 options" (its "Defaults" line spells
 * this out by game) — a DIFFERENT pattern from Game 1's "Grid → Carousel"
 * for its confirmation grid. Reusing Game1's horizontal-scroll carousel
 * here (an earlier version of this file did, via the same CSS trick) would
 * satisfy neither: same layout pattern on both games' phones,
 * contradicting the guide's own per-game table. This is genuinely
 * interactive (which 2 options are visible, advancing on "show me more"),
 * so it needs JS state, not just a CSS breakpoint. */
const PHONE_REVEAL_BATCH = 2;
const PHONE_BREAKPOINT_QUERY = '(max-width: 600px)';

/** §8.3 Level 2: simulates "different angle or lighting" over the SAME
 * crop image via CSS transform + filter — see game3ShadowMatchLogic.ts's
 * ALTERED_SAMPLE_FILTER/TRANSFORM header for why there's no second real
 * photo to show instead. Returns plain inline-style values; identity
 * (no-op) for every other sample kind. */
function sampleVisualStyle(kind: SampleKind): { filter?: string; transform?: string } {
  if (kind === 'altered') {
    return { filter: ALTERED_SAMPLE_FILTER, transform: ALTERED_SAMPLE_TRANSFORM };
  }
  return {};
}

function OptionButton({
  crop,
  onTap,
  dead,
  dimmed,
  highlighted,
  bouncing,
  disabled,
  celebrating,
}: {
  crop: TaggedCrop;
  onTap: () => void;
  dead: boolean;
  dimmed: boolean;
  highlighted: boolean;
  bouncing: boolean;
  disabled: boolean;
  celebrating: boolean;
}) {
  // Two tile shapes, both fully described in GAME3_STYLES rather than as
  // inline literals: a room crop fills its tile with the photograph, a
  // concept drawing sits padded on the lit tile so conceptArt.tsx's
  // drawn-in size differences survive. The only thing still inline is the
  // one genuinely dynamic value, the crop's own image URL.
  const classNames = [
    'g3-crop',
    crop.conceptVariantId ? 'g3-crop--art' : 'g3-crop--photo',
    dead && 'g3-crop--dead',
    dimmed && !dead && 'g3-crop--dimmed',
    highlighted && 'g3-crop--highlighted',
    bouncing && 'g3-crop--bouncing',
    celebrating && 'g3-crop--celebrating',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classNames}
      aria-label={crop.name}
      disabled={dead || disabled}
      onClick={onTap}
      style={
        crop.conceptVariantId
          ? undefined
          : { backgroundImage: crop.image ? `url(${crop.image})` : undefined }
      }
    >
      {crop.conceptVariantId && <ConceptArt variantId={crop.conceptVariantId} />}
    </button>
  );
}

/**
 * The sample the child matches TO. One component for both sources, so the
 * three places that show a sample cannot drift apart.
 *
 * For a concept crop the silhouette is drawn by ConceptArt itself — exact,
 * because the shape is known. For a photo crop it is still the canvas
 * luminance threshold (silhouetteCanvas.ts), already baked into `image` by
 * the caller.
 */
function SampleTile({
  image,
  conceptVariantId,
  kind,
  loading,
  size = 120,
}: {
  image: string;
  conceptVariantId?: string;
  kind: SampleKind;
  loading: boolean;
  size?: number;
}) {
  const isShadow = kind === 'silhouette' || kind === 'silhouette-fetch';
  // The Room Frame's bloom (DESIGN-TOKENS §5), at tile scale: a blurred
  // copy of the picture behind the mat, so the child's own object lights
  // the ground it sits on. Not drawn for a silhouette (a blurred black
  // smear lights nothing) and not for library artwork, which is line art
  // on a lit tile and has no ambient colour to throw.
  const showBloom = !conceptVariantId && !isShadow && Boolean(image);
  return (
    <div
      aria-hidden
      className={loading ? 'g3-sample g3-sample--loading' : 'g3-sample'}
      style={{ width: size, height: size }}
    >
      {showBloom && (
        <div className="g3-sample-bloom" style={{ backgroundImage: `url(${image})` }} />
      )}
      {conceptVariantId ? (
        <div
          className="g3-sample-inner g3-sample-inner--art"
          // Only the ALTERED level's transform applies; a concept
          // silhouette is handled inside ConceptArt, not by a CSS filter.
          style={kind === 'altered' ? sampleVisualStyle(kind) : undefined}
        >
          <ConceptArt variantId={conceptVariantId} silhouette={isShadow} />
        </div>
      ) : (
        <div
          className="g3-sample-inner g3-sample-inner--photo"
          style={{
            backgroundImage: image ? `url(${image})` : undefined,
            ...sampleVisualStyle(kind),
          }}
        />
      )}
    </div>
  );
}

export function Game3ShadowMatch({ profile, onChildFacingChange }: Game3ShadowMatchProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [level, setLevel] = useState<Game3Level>(1);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [sampleImage, setSampleImage] = useState<string>('');
  /** Set instead of `sampleImage` when the round came from the bundled
   * concept library — the artwork is vector JSX, not a data URL. */
  const [sampleConceptId, setSampleConceptId] = useState<string | null>(null);
  /** Which concept round we're on. Walks concepts first, then samples, so
   * the child doesn't get five apples in a row (see buildConceptRound). */
  const conceptRoundRef = useRef(0);
  const [sampleLoading, setSampleLoading] = useState(false);
  // §8.3 Level 2: "same object, different angle or lighting" — the sample
  // IMAGE itself never changes (see game3ShadowMatchLogic.ts's
  // ALTERED_SAMPLE_FILTER/TRANSFORM header for why there's no second photo
  // to show), but the sample KIND drives whether that simulated-angle
  // style is applied when rendering it below.
  const [sampleKind, setSampleKind] = useState<SampleKind>('identical');
  const [options, setOptions] = useState<TaggedCrop[]>([]);
  // §4.3 phone pattern for Game 3: "Grid → Sequential reveal ... 2 at a
  // time, 'show me more' between." isPhoneViewport mirrors the SAME
  // 600px breakpoint Game1.tsx's CSS media query uses, kept in sync via
  // matchMedia below since this needs to drive JS (how many options are
  // sliced into view), not just a stylesheet rule.
  const [isPhoneViewport, setIsPhoneViewport] = useState(false);
  const [revealedCount, setRevealedCount] = useState(PHONE_REVEAL_BATCH);
  const [promptTier, setPromptTier] = useState<PromptTier>(0);
  const [deadIds, setDeadIds] = useState<Set<string>>(new Set());
  const [captureNotice, setCaptureNotice] = useState<'blur-failed' | null>(null);
  const [slowCapture, setSlowCapture] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [lastLoggedTier, setLastLoggedTier] = useState<SupportTier | null>(null);
  const [fadingSuggestion, setFadingSuggestion] = useState<FadingSuggestion | null>(null);
  const [sessionEndResult, setSessionEndResult] = useState<SessionEndResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const machineRef = useRef<InteractionMachine>(new InteractionMachine());
  const sessionStartedAtRef = useRef<number>(0);
  const lastObjectNameRef = useRef<string | null>(null);
  const lastTargetIdRef = useRef<string | null>(null);

  const handleEndSession = useCallback(
    async (reason: 'cap' | 'idle' | 'caregiver') => {
      if (!sessionId) return;
      setPhase('sessionEnded');
      const result = await endSessionNow(sessionId, reason, lastObjectNameRef.current);
      setSessionEndResult(result);
    },
    [sessionId],
  );

  useEffect(() => {
    onChildFacingChange?.(
      phase === 'presenting' || phase === 'confirming' || phase === 'celebrating',
    );
    return () => onChildFacingChange?.(false);
  }, [phase, onChildFacingChange]);

  useEffect(() => {
    void (async () => {
      const [session, number, savedLevel] = await Promise.all([
        startSession(profile.id),
        getSessionNumber(profile.id),
        getGame3Level(profile.id),
      ]);
      setSessionId(session.id);
      setSessionNumber(number);
      setLevel(savedLevel);
      sessionStartedAtRef.current = Date.now();
    })();
  }, [profile.id]);

  useEffect(() => {
    if (!sessionId || sessionNumber === null || phase === 'sessionEnded') return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - sessionStartedAtRef.current) / 1000));
      const tick = machineRef.current.tick(now);
      if (phase === 'presenting' || phase === 'searching' || phase === 'confirming') {
        setPromptTier(tick.tier);
      }
      if (tick.endSession) {
        void handleEndSession('idle');
        return;
      }
      const elapsed = Math.floor((now - sessionStartedAtRef.current) / 1000);
      if (hasCapBeenReached(sessionNumber, elapsed)) {
        void handleEndSession('cap');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, sessionNumber, phase, handleEndSession]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(PHONE_BREAKPOINT_QUERY);
    const sync = () => setIsPhoneViewport(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  /** Sets a fresh options grid AND resets the phone sequential-reveal
   * window back to the first PHONE_REVEAL_BATCH — otherwise a later trial
   * with fewer options, or a phone rotated mid-session (locked out by
   * §4.3, but defensive anyway), could leave a stale revealedCount. */
  function setOptionsForNewTrial(next: TaggedCrop[]) {
    setOptions(next);
    setRevealedCount(PHONE_REVEAL_BATCH);
  }

  function revealMoreOptions() {
    setRevealedCount((count) => Math.min(options.length, count + PHONE_REVEAL_BATCH));
  }

  async function handleLevelChange(newLevel: Game3Level) {
    setLevel(newLevel);
    await setGame3Level(profile.id, newLevel);
  }

  /** Picks this trial's target + pool, per §8.3/F.021's Level 1 rule:
   * "The Companion's silhouette is the Level 1 sample every session." */
  function pickTargetAndPool(pool: TaggedCrop[], effectiveLevel: Game3Level): { target: TaggedCrop; pool: TaggedCrop[] } {
    if (effectiveLevel === 1) {
      const level1 = buildLevel1Pool(profile, pool);
      if (level1) return level1;
      // No Companion set — §6.3's "neutral guide still works" applies:
      // fall through to a normal room-crop target instead of a broken
      // Companion-less Level 1.
    }
    const picked = pickNextTarget(pool, lastTargetIdRef.current);
    return { target: picked, pool };
  }

  /**
   * A round from the bundled concept library — no photo, no camera, no API.
   *
   * Deliberately NOT routed through startTrialWith: that function's whole
   * job is picking one crop out of a room pool and deriving a sample from
   * it, whereas a concept round arrives with its sample and its answer
   * already chosen (and chosen adversarially — see conceptLibrary's
   * buildTrial). Everything after the setup is identical, because both
   * paths hand off to the same InteractionMachine.
   */
  function startConceptRound(effectiveLevel: Game3Level = level) {
    const kind = sampleKindForLevel(effectiveLevel);
    // A silhouette sample asks a SHAPE question, and its answer has to be
    // the very drawing the outline came from — see buildShapeTrial. A
    // full-colour sample asks the generalization question, whose answer must
    // be a different member of the concept. Same screen, opposite rules.
    const shapeMatch = kind === 'silhouette' || kind === 'silhouette-fetch';

    const round = buildConceptRound(conceptRoundRef.current, { shapeMatch });
    if (!round) return;
    conceptRoundRef.current += 1;

    lastTargetIdRef.current = round.target.id;
    setTarget(round.target);
    setCrops(round.options);
    setDeadIds(new Set());
    setPromptTier(0);
    machineRef.current.startTrial();

    setSampleKind(kind);
    setSampleLoading(false);
    setSampleImage('');
    setSampleConceptId(round.sample.conceptVariantId ?? null);

    // Level 4 normally sends the child off to fetch the real object. A
    // library picture is not in their room, so that cannot be asked
    // honestly here — the shape question stays on screen instead.
    setOptionsForNewTrial(round.options);
    setPhase('presenting');

    void adapters.speechOut.say(
      renderLine(
        shapeMatch ? 'Which one has this shape?' : 'Which one is the same kind of thing?',
        slotValuesFromProfile(profile),
        profile.context,
      ),
    );
  }

  async function startTrialWith(pool: TaggedCrop[], effectiveLevel: Game3Level = level) {
    const { target: picked, pool: trialPool } = pickTargetAndPool(pool, effectiveLevel);
    lastTargetIdRef.current = picked.id;
    setTarget(picked);
    setDeadIds(new Set());
    setPromptTier(0);
    machineRef.current.startTrial();

    const kind = sampleKindForLevel(effectiveLevel);
    setSampleKind(kind);
    setSampleLoading(kind === 'silhouette' || kind === 'silhouette-fetch');
    setSampleImage(picked.image);
    setSampleConceptId(null);

    if (kind === 'silhouette' || kind === 'silhouette-fetch') {
      try {
        const silhouette = await generateSilhouetteDataUrl(picked.image);
        setSampleImage(silhouette);
      } catch {
        // Silhouette generation is a browser-only Canvas operation and can
        // fail (e.g. a malformed/empty crop image) — fail soft to the
        // identical photo rather than a broken game. Not the §11 "hard
        // stop" cases (those are about faces/privacy); this is cosmetic.
        setSampleImage(picked.image);
      } finally {
        setSampleLoading(false);
      }
    }

    if (requiresFetchingTheRealObject(effectiveLevel)) {
      setPhase('searching');
      void adapters.speechOut.say(
        renderLine('Can you find what {companion} is showing you?', slotValuesFromProfile(profile), profile.context),
      );
      return;
    }

    setOptionsForNewTrial(buildShadowMatchOptions(trialPool, picked));
    setPhase('presenting');
    void adapters.speechOut.say(
      renderLine('Which one matches?', slotValuesFromProfile(profile), profile.context),
    );
  }

  async function handleCapturePress() {
    setPhase('capturing');
    setCaptureNotice(null);
    setSlowCapture(false);
    const outcome = await captureRoomAndRecognize({ onSlow: () => setSlowCapture(true) });

    if (outcome.kind === 'blur-failed') {
      setCaptureNotice('blur-failed');
      setPhase('idle');
      return;
    }
    const nextCrops = outcome.kind === 'success' ? outcome.crops : GENERIC_FALLBACK_CROPS;
    setCrops(nextCrops);
    void startTrialWith(nextCrops);
  }

  function resolveTrial() {
    setPhase('celebrating');
    lastObjectNameRef.current = target?.name ?? null;
    void adapters.speechOut.say(
      renderLine('Your {object.name}!', slotValuesFromProfile(profile, { 'object.name': target?.name ?? '' }), profile.context),
    );
    setTimeout(() => setPhase('reportingSupport'), 800);
  }

  function handleOptionTap(crop: TaggedCrop) {
    const outcome = machineRef.current.recordAttempt(crop.id === target?.id);
    if (outcome.resolved) {
      resolveTrial();
      return;
    }
    setDeadIds((prev) => new Set(prev).add(crop.id));
    setPromptTier(outcome.tier);
  }

  function handleTheyBroughtIt() {
    // Level 4 hands into Game 1's own shape: a small confirmation grid,
    // built the same way (target + a couple of distractors) as levels
    // 1-3's options grid — the point is it's the SAME interaction, not a
    // new one.
    setOptionsForNewTrial(buildShadowMatchOptions(crops, target ?? crops[0]));
    setPhase('confirming');
    void adapters.speechOut.say('Show me — which one did you bring?');
  }

  async function handleSupportTierReport(tier: SupportTier) {
    if (!sessionId || !target) return;
    const skillId = `shadow-match-${target.category || 'companion'}`;
    await logActivityOutcome({
      sessionId,
      skillId,
      context: 'living-room',
      supportTier: tier,
      onScreenTier: machineRef.current.currentTier,
    });
    setLastLoggedTier(tier);
    const suggestion = await getFadingSuggestion(profile.id, skillId, tier, profile.nickname ?? 'they');
    setFadingSuggestion(suggestion);
    // Stay in whichever source this session started in. Switching a child
    // mid-session from library pictures to their room photo (or back) is
    // exactly the kind of unannounced change §5.2's `sameness` dimension
    // exists to avoid.
    if (sampleConceptId) startConceptRound();
    else void startTrialWith(crops);
  }

  if (phase === 'sessionEnded') {
    return (
      <div className="screen g3-screen">
        <style>{GAME3_STYLES}</style>
        {/* Straight to the recap -- no child-facing "go find X with your
            grown-up" handoff line here. That line (childFacingHandoffLine)
            is built around Game 1's premise: a REAL object photographed in
            the child's own room, which they can meaningfully be sent off
            to go find. Match the Picture has no equivalent -- its targets
            are illustrated concepts or silhouettes, not something in the
            room -- so the line either fell back to a generic "favourite
            thing" filler or named a picture that was never physically
            there, neither of which means anything to send a child off to
            find. Game 1 keeps this line; it's real there. */}
        {sessionEndResult && (
          <>
            <h3>Session recap</h3>
            <div className="g3-card">
              <p className="g3-card-body">{describeSessionRecap(sessionEndResult.session)}</p>
              <p className="g3-card-hint">
                Objects recognised: {distinctSkillsThisSession(sessionEndResult.session).join(', ') || 'none'}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === 'idle') {
    const capSeconds = sessionNumber ? sessionCapSeconds(sessionNumber) : null;
    return (
      <div className="screen g3-screen">
        <style>{GAME3_STYLES}</style>
        <h2>Match the Picture</h2>
        {sessionNumber && capSeconds && (
          <p className="g3-meta">
            Session {sessionNumber} — cap {Math.round(capSeconds / 60)}min, elapsed {elapsedSeconds}s
          </p>
        )}
        {captureNotice === 'blur-failed' && (
          <p className="g3-note g3-note--alert">That photo couldn't be processed — let's try again.</p>
        )}
        {lastLoggedTier && (
          <p className="g3-meta">
            Last logged support tier: {lastLoggedTier} ({SUPPORT_TIERS.find((t) => t.tier === lastLoggedTier)?.name})
          </p>
        )}
        {fadingSuggestion && <p className="g3-note">{fadingSuggestion.message}</p>}
        {/* The ladder and its caption are ONE setting, so they live in one
            card. Loose on the ground the four numbers read as debug
            controls, and nothing told a caregiver that the shape game is
            level 3 — levelDescription() is the answer and belongs here. */}
        <div className="g3-card">
          <p className="g3-card-label">Level</p>
          <div className="g3-levels">
            {([1, 2, 3, 4] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={l === level ? 'g3-level g3-level--on' : 'g3-level'}
                onClick={() => void handleLevelChange(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="g3-card-hint">{levelDescription(level)}</p>
        </div>
        {/* The picture-pack round is listed FIRST and framed as the normal
            way in: it needs no photo, no camera and no network, so it
            always works — including on a device with no camera, with the
            camera declined (§4.4: "camera is an enhancement, not a gate"),
            or with the API unreachable. The room-photo path below is the
            same game played with the child's own things. It is also the
            only .button-primary on the screen, which is what says that
            without needing a word of explanation. */}
        <div className="g3-actions">
          <button
            type="button"
            className="button-primary g3-play"
            onClick={() => startConceptRound()}
          >
            Play with pictures
          </button>
          <p className="g3-card-hint">
            Matching everyday things — apples, dogs, balls — across the many ways each one can look.
            No photo needed.
          </p>
          <button type="button" className="g3-play" onClick={() => void handleCapturePress()}>
            Play with a photo of your room
          </button>
        </div>
        <button type="button" className="quiet-action" onClick={() => void handleEndSession('caregiver')}>
          <span className="quiet-action-chip">End session</span>
        </button>
      </div>
    );
  }

  if (phase === 'capturing') {
    return (
      <div className="screen g3-screen">
        <style>{GAME3_STYLES}</style>
        <div className="g3-waiting">
          <span className="g3-dots" aria-hidden>
            <span className="g3-dot" />
            <span className="g3-dot" />
            <span className="g3-dot" />
          </span>
          <p className="g3-waiting-line">
            {slowCapture ? 'Still looking around the room...' : 'Looking around the room...'}
          </p>
        </div>
      </div>
    );
  }

  const suggestedTierInfo = SUPPORT_TIERS.find((t) => t.tier === DEFAULT_STARTING_SUPPORT_TIER) ?? SUPPORT_TIERS[0];

  /** Shared by the 'presenting' (levels 1-3) and 'confirming' (level 4)
   * screens — both are the same tap-to-match interaction shape over
   * `options`, just with a different target. §4.3: on a phone, Game 3's
   * assigned pattern is "Grid → Sequential reveal ... 2 at a time, 'show
   * me more' between" — NOT the horizontal-scroll carousel Game 1 uses for
   * ITS confirmation grid (a different row of the same table). On a
   * tablet-width viewport every option renders at once, same as before. */
  function renderOptionsGrid() {
    const visible = isPhoneViewport ? options.slice(0, revealedCount) : options;
    const hasMore = isPhoneViewport && revealedCount < options.length;
    return (
      <div className="g3-grid">
        {visible.map((crop) => {
          const isTarget = crop.id === target?.id;
          return (
            <OptionButton
              key={crop.id}
              crop={crop}
              dead={deadIds.has(crop.id)}
              dimmed={promptTier >= 2 && !isTarget}
              highlighted={promptTier === 2 && isTarget}
              bouncing={promptTier >= 3 && isTarget}
              disabled={promptTier >= 3 && !isTarget}
              celebrating={false}
              onTap={() => handleOptionTap(crop)}
            />
          );
        })}
        {hasMore && (
          // CHILD-FACING affordance, zero text (§7.7/§13) — a plain "+"
          // glyph, not a word to read (same spirit as Game1.tsx's plain
          // movement-break emoji). Reveals the next PHONE_REVEAL_BATCH
          // options rather than all remaining at once, keeping "2 at a
          // time" true even with a 3rd/4th option queued.
          <button
            type="button"
            className="g3-more"
            aria-label="Show more options"
            onClick={revealMoreOptions}
          >
            <span aria-hidden className="g3-more-glyph">+</span>
          </button>
        )}
      </div>
    );
  }

  // Presentation only — the audience split this screen already makes.
  // Deliberately NOT wired into onChildFacingChange (which owns the same
  // three phases above and stays the single source of that truth); this
  // just picks the child's 28px rhythm over the caregiver's 14px.
  const childFacingPhase =
    phase === 'presenting' || phase === 'confirming' || phase === 'celebrating';

  return (
    <div className={childFacingPhase ? 'screen g3-child-screen' : 'screen g3-screen'}>
      <style>{GAME3_STYLES}</style>

      {phase === 'presenting' && (
        // CHILD-FACING (Levels 1-3): sample at top, real photos below,
        // zero text — the sample image itself communicates the prompt.
        <div className="g3-stage">
          <SampleTile
            image={sampleImage}
            conceptVariantId={sampleConceptId ?? undefined}
            kind={sampleKind}
            loading={sampleLoading}
            size={140}
          />
          {renderOptionsGrid()}
        </div>
      )}

      {phase === 'searching' && (
        <>
          {/* CHILD-FACING cue: the silhouette itself, zero text — this IS
              "the answer not on screen", the shape is the only clue the
              child gets for what to go fetch. That is the entire purpose
              of Level 4 (§8.3). The text/instructions below are the
              separate CAREGIVER-facing half of this same screen. */}
          <div className="g3-cue">
            <SampleTile
              image={sampleImage}
              conceptVariantId={sampleConceptId ?? undefined}
              kind={sampleKind}
              loading={sampleLoading}
              size={140}
            />
          </div>
          {/* The caregiver's half of the screen, carded and cool so it is
              visibly a different audience from the warm cue above it. */}
          <div className="g3-card">
            <p className="g3-card-label">Caregiver view — Level 4</p>
            <p className="g3-card-body">
              The silhouette only, no options on screen. Support them fetching the real object.
            </p>
            <p className="g3-card-hint">
              Support tier {suggestedTierInfo.tier} — {suggestedTierInfo.name}: {suggestedTierInfo.instruction}
            </p>
          </div>
          <button type="button" className="g3-play" onClick={handleTheyBroughtIt}>
            They brought it
          </button>
        </>
      )}

      {phase === 'confirming' && renderOptionsGrid()}

      {phase === 'celebrating' && target && (
        // CHILD-FACING. §8.3: "Reward: the silhouette dissolves into the
        // real photo of their object." Real cross-fade, not a swap: the
        // sample (silhouette at L3/4, the shown photo at L1/2) sits on top
        // of the target's real photo and fades its own opacity to 0 via
        // CSS (.g3-dissolve-top), revealing the photo underneath. At L1/2
        // the sample and the real photo are visually close (or identical),
        // so the dissolve is subtle there and dramatic at L3/4 — exactly
        // where the guide's language is aimed.
        <div className="g3-celebrate-stage">
          <div className="g3-reveal g3-crop--celebrating">
            {/* Underneath: the real thing. */}
            {target.conceptVariantId ? (
              <div aria-label={target.name} className="g3-layer g3-layer--art">
                <ConceptArt variantId={target.conceptVariantId} />
              </div>
            ) : (
              <div
                aria-label={target.name}
                className="g3-layer g3-layer--photo"
                style={{ backgroundImage: target.image ? `url(${target.image})` : undefined }}
              />
            )}
            {/* On top: the sample, fading away to reveal it. Both layers
                wear the same lit tile now, so the cross-fade happens
                between two identical surfaces rather than between a white
                card and a grey one. */}
            {sampleConceptId ? (
              <div aria-hidden className="g3-layer g3-layer--art g3-dissolve-top">
                <ConceptArt
                  variantId={sampleConceptId}
                  silhouette={sampleKind === 'silhouette' || sampleKind === 'silhouette-fetch'}
                />
              </div>
            ) : (
              sampleImage && (
                <div
                  aria-hidden
                  className="g3-layer g3-layer--photo g3-dissolve-top"
                  style={{
                    backgroundImage: `url(${sampleImage})`,
                    ...sampleVisualStyle(sampleKind),
                  }}
                />
              )
            )}
          </div>
        </div>
      )}

      {phase === 'reportingSupport' && (
        <>
          <h3>How much support did they actually need?</h3>
          {/* Five near-identical long labels. As five separate buttons
              they were an undifferentiated wall; as rows cut into one
              caregiver panel the numeral becomes the scannable thing and
              the instruction drops to secondary text. Same five choices,
              same 88px targets. */}
          <div className="g3-tiers">
            {SUPPORT_TIERS.map((info) => (
              <button
                key={info.tier}
                type="button"
                className="g3-tier"
                onClick={() => void handleSupportTierReport(info.tier)}
              >
                <span className="g3-tier-num">{info.tier}</span>
                <span className="g3-tier-text">
                  <span className="g3-tier-name">{info.name}</span>
                  <span className="g3-tier-hint">{info.instruction}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
