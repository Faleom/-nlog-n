// Bundled cartoon artwork for recognised objects (Game 1).
//
// WHY NOT THE REAL CROP: TaggedCrop.image is a cutout taken from the room
// photo using the vision model's bbox — and types/index.ts already warns
// that bbox "may be approximate — vision models describe well and localise
// loosely." In practice that means crops arrive offset, half-cut, blurry or
// motion-smeared, which is exactly the wrong thing to hand a 3-5 year old
// who is being asked to recognise an object at a glance. Clean, high-
// contrast artwork reads instantly; a bad crop reads as nothing at all.
//
// WHY BUNDLED, NOT FETCHED: the app claims to run fully offline (STATUS.md
// "The API key" — everything except the two model calls costs nothing and
// needs no network). Fetching artwork per object would break that claim,
// add latency to every capture, and — worse for this audience — put
// unvetted third-party images in front of a preschooler. These are drawn
// here, ship in the bundle, and need no network at all.
//
// No <svg> wrapper in the map below — ObjectIcon supplies it, so every
// icon shares one viewBox and sizing rule and they cannot drift apart.
//
// The name -> artwork decision lives in objectIconLogic.ts (pure, no JSX,
// so it is testable in Node — see scripts/smoke-icons.ts). This file is
// only the drawings. ICONS is typed Record<IconKey, ReactElement>, so a key
// listed there with no drawing here fails `tsc` rather than silently
// rendering the generic star.
//
// Game 3 (shadow match) still uses the real crop image to build its
// silhouettes — that mechanic depends on the object's true outline, so
// this file deliberately does not touch it. TaggedCrop.image stays.

import type { ReactElement } from 'react';
import { iconKeyFor, type IconKey } from './objectIconLogic';

/** One shared palette so ~30 separately-drawn icons still read as a set.
 * Deliberately warm and saturated — this is the child's view, and these
 * need to be tellable apart at 88px by someone who cannot read. */
const P = {
  red: '#E8534A',
  orange: '#F59043',
  yellow: '#F5C542',
  green: '#5BBF6A',
  blue: '#4A9BE8',
  purple: '#9B72D0',
  pink: '#F080A8',
  brown: '#A9744F',
  cream: '#FBF3E7',
  grey: '#B8BCC4',
  ink: '#3A3A4A',
} as const;

// ---------------------------------------------------------------------------
// The artwork. Keys are canonical names — SYNONYMS below maps the many
// words a vision model might return onto these.
// ---------------------------------------------------------------------------

const ICONS: Record<IconKey, ReactElement> = {
  ball: (
    <>
      <circle cx="32" cy="32" r="23" fill={P.red} />
      <path d="M9 32h46" stroke={P.cream} strokeWidth="5" />
      <ellipse cx="32" cy="32" rx="9" ry="23" fill="none" stroke={P.cream} strokeWidth="5" />
    </>
  ),
  teddy: (
    <>
      <circle cx="17" cy="17" r="9" fill={P.brown} />
      <circle cx="47" cy="17" r="9" fill={P.brown} />
      <circle cx="32" cy="35" r="21" fill={P.brown} />
      <ellipse cx="32" cy="41" rx="10" ry="8" fill={P.cream} />
      <circle cx="24" cy="30" r="3" fill={P.ink} />
      <circle cx="40" cy="30" r="3" fill={P.ink} />
      <circle cx="32" cy="38" r="3.5" fill={P.ink} />
    </>
  ),
  doll: (
    <>
      <circle cx="32" cy="17" r="12" fill={P.cream} stroke={P.grey} strokeWidth="2" />
      <path d="M20 15a12 12 0 0 1 24 0c0-8-24-8-24 0z" fill={P.brown} />
      <circle cx="27" cy="17" r="2.5" fill={P.ink} />
      <circle cx="37" cy="17" r="2.5" fill={P.ink} />
      <path d="M32 29c-9 0-14 6-15 14l-2 13h34l-2-13c-1-8-6-14-15-14z" fill={P.pink} />
    </>
  ),
  book: (
    <>
      <path d="M32 18c-6-5-14-6-22-5v34c8-1 16 0 22 5 6-5 14-6 22-5V13c-8-1-16 0-22 5z" fill={P.blue} />
      <path d="M32 18v34" stroke={P.cream} strokeWidth="3" />
    </>
  ),
  cup: (
    <>
      <path d="M14 20h30v22a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" fill={P.red} />
      <path d="M44 26h4a7 7 0 0 1 0 14h-4" fill="none" stroke={P.red} strokeWidth="5" />
      <rect x="14" y="20" width="30" height="6" fill={P.cream} />
    </>
  ),
  bottle: (
    <>
      <rect x="27" y="6" width="10" height="10" rx="2" fill={P.grey} />
      <path d="M25 16h14c0 6 6 8 6 16v20a6 6 0 0 1-6 6H25a6 6 0 0 1-6-6V32c0-8 6-10 6-16z" fill={P.blue} />
      <rect x="19" y="34" width="26" height="9" fill={P.cream} opacity=".75" />
    </>
  ),
  plate: (
    // Stroked, unlike most icons here: the plate is almost entirely cream,
    // and CropButton's tile goes white when the object's own colour is
    // "white" — an unstroked cream plate on a white tile is invisible.
    <>
      <circle cx="32" cy="32" r="24" fill={P.cream} stroke={P.grey} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="15" fill="none" stroke={P.grey} strokeWidth="3" />
    </>
  ),
  bowl: (
    <>
      <path d="M8 30h48c0 14-11 24-24 24S8 44 8 30z" fill={P.green} />
      <rect x="6" y="26" width="52" height="7" rx="3.5" fill={P.cream} />
    </>
  ),
  spoon: (
    <>
      <ellipse cx="32" cy="18" rx="11" ry="14" fill={P.grey} />
      <rect x="28" y="30" width="8" height="28" rx="4" fill={P.grey} />
    </>
  ),
  apple: (
    <>
      <path d="M32 18c-4-4-12-4-16 2-5 7-3 20 3 28 3 4 7 6 10 4 2-1 4-1 6 0 3 2 7 0 10-4 6-8 8-21 3-28-4-6-12-6-16-2z" fill={P.red} />
      <rect x="30" y="7" width="4" height="11" rx="2" fill={P.brown} />
      <path d="M34 11c4-4 9-4 10-1s-4 7-10 5z" fill={P.green} />
    </>
  ),
  banana: (
    <>
      <path d="M14 16c2 20 14 32 32 34 5 1 8-1 8-4s-3-4-7-5c-12-3-20-12-23-24-1-4-3-5-6-4s-4 2-4 3z" fill={P.yellow} />
      <path d="M46 50c5 1 8-1 8-4s-3-4-7-5z" fill={P.brown} />
    </>
  ),
  blocks: (
    <>
      <rect x="7" y="34" width="22" height="22" rx="3" fill={P.red} />
      <rect x="35" y="34" width="22" height="22" rx="3" fill={P.blue} />
      <rect x="21" y="9" width="22" height="22" rx="3" fill={P.yellow} />
    </>
  ),
  car: (
    <>
      <path d="M7 41v-6c0-3 2-5 5-5h5l7-9c1-2 3-3 5-3h13c3 0 5 2 6 4l4 8h4c3 0 5 2 5 5v6z" fill={P.red} />
      <path d="M28 21h11l3 9H28z" fill={P.cream} />
      <circle cx="19" cy="45" r="8" fill={P.ink} />
      <circle cx="45" cy="45" r="8" fill={P.ink} />
      <circle cx="19" cy="45" r="3.5" fill={P.grey} />
      <circle cx="45" cy="45" r="3.5" fill={P.grey} />
    </>
  ),
  train: (
    <>
      <rect x="7" y="30" width="26" height="18" rx="3" fill={P.blue} />
      <rect x="37" y="21" width="20" height="27" rx="3" fill={P.red} />
      <rect x="13" y="17" width="10" height="13" rx="2" fill={P.grey} />
      <circle cx="16" cy="52" r="5" fill={P.ink} />
      <circle cx="30" cy="52" r="5" fill={P.ink} />
      <circle cx="47" cy="52" r="5" fill={P.ink} />
    </>
  ),
  duck: (
    <>
      <ellipse cx="29" cy="43" rx="22" ry="13" fill={P.yellow} />
      <circle cx="42" cy="24" r="13" fill={P.yellow} />
      <path d="M53 22h9l-4 6h-6z" fill={P.orange} />
      <circle cx="45" cy="21" r="2.5" fill={P.ink} />
    </>
  ),
  balloon: (
    <>
      <ellipse cx="32" cy="24" rx="17" ry="20" fill={P.pink} />
      <path d="M32 43l-4 7h8z" fill={P.pink} />
      <path d="M32 50c0 6 6 6 6 12" fill="none" stroke={P.grey} strokeWidth="3" />
    </>
  ),
  drum: (
    <>
      <rect x="10" y="24" width="44" height="24" rx="4" fill={P.red} />
      <ellipse cx="32" cy="24" rx="22" ry="8" fill={P.cream} />
      <path d="M12 29l40 15M52 29L12 44" stroke={P.yellow} strokeWidth="3" />
    </>
  ),
  shoe: (
    <>
      <path d="M7 42c0-6 2-14 6-16 4-2 6 2 10 4 6 3 14 2 20 6 6 4 13 4 13 8v3H9a2 2 0 0 1-2-2z" fill={P.blue} />
      <path d="M7 45h49v4a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" fill={P.ink} />
    </>
  ),
  sock: (
    <>
      <path d="M22 8h16v22c0 6 14 10 14 20a12 12 0 0 1-24 0c0-8-6-10-6-18z" fill={P.pink} />
      <rect x="22" y="8" width="16" height="7" fill={P.cream} />
    </>
  ),
  hat: (
    <>
      <path d="M13 37c0-12 8-21 19-21s19 9 19 21z" fill={P.green} />
      <path d="M51 37h6a4 4 0 0 1 0 8H13a4 4 0 0 1 0-8z" fill={P.green} />
      <path d="M13 37h38v3H13z" fill={P.ink} opacity=".18" />
    </>
  ),
  shirt: (
    <>
      <path d="M23 10l9 6 9-6 13 8-6 11-5-3v28H21V26l-5 3-6-11z" fill={P.blue} />
    </>
  ),
  bag: (
    <>
      <path d="M14 24h36v28a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill={P.orange} />
      <path d="M22 24v-6a10 10 0 0 1 20 0v6" fill="none" stroke={P.brown} strokeWidth="4" />
      <rect x="24" y="35" width="16" height="12" rx="3" fill={P.cream} />
    </>
  ),
  pillow: (
    <>
      <rect x="6" y="18" width="52" height="30" rx="11" fill={P.blue} />
      <rect x="15" y="25" width="34" height="16" rx="6" fill="none" stroke={P.cream} strokeWidth="2.5" />
    </>
  ),
  blanket: (
    <>
      <path d="M8 15h48v29c0 6-4 10-10 10H18c-6 0-10-4-10-10z" fill={P.purple} />
      <path d="M8 26h48M8 37h48" stroke={P.cream} strokeWidth="3" />
    </>
  ),
  towel: (
    <>
      <rect x="13" y="9" width="38" height="46" rx="5" fill={P.green} />
      <path d="M13 21h38M13 43h38" stroke={P.cream} strokeWidth="3" />
      <path d="M32 21v22" stroke={P.cream} strokeWidth="3" />
    </>
  ),
  toothbrush: (
    <>
      <rect x="26" y="5" width="12" height="5" rx="2.5" fill={P.cream} />
      <rect x="28" y="9" width="8" height="12" rx="2" fill={P.cream} />
      <rect x="28" y="19" width="8" height="40" rx="4" fill={P.blue} />
    </>
  ),
  brush: (
    <>
      <ellipse cx="32" cy="22" rx="13" ry="17" fill={P.purple} />
      <circle cx="26" cy="17" r="2" fill={P.cream} />
      <circle cx="38" cy="17" r="2" fill={P.cream} />
      <circle cx="32" cy="26" r="2" fill={P.cream} />
      <rect x="28" y="38" width="8" height="21" rx="4" fill={P.purple} />
    </>
  ),
  box: (
    <>
      <path d="M10 24h44v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill={P.brown} />
      <path d="M8 13h48v12H8z" fill={P.orange} />
      <rect x="28" y="13" width="8" height="43" fill={P.cream} opacity=".65" />
    </>
  ),
  basket: (
    <>
      <path d="M10 26h44l-4 26a5 5 0 0 1-5 4H19a5 5 0 0 1-5-4z" fill={P.brown} />
      <path d="M20 26a12 12 0 0 1 24 0" fill="none" stroke={P.brown} strokeWidth="4" />
      <path d="M24 32l3 20M40 32l-3 20" stroke={P.cream} strokeWidth="2.5" opacity=".7" />
    </>
  ),
  bucket: (
    <>
      <path d="M12 22h40l-4 30a5 5 0 0 1-5 4H21a5 5 0 0 1-5-4z" fill={P.blue} />
      <path d="M18 22a14 14 0 0 1 28 0" fill="none" stroke={P.grey} strokeWidth="4" />
    </>
  ),
  clock: (
    <>
      <circle cx="32" cy="34" r="22" fill={P.cream} />
      <circle cx="32" cy="34" r="22" fill="none" stroke={P.red} strokeWidth="4" />
      <path d="M32 21v13l9 6" fill="none" stroke={P.ink} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  umbrella: (
    <>
      <path d="M5 33a27 27 0 0 1 54 0z" fill={P.red} />
      <path d="M32 33v17a6 6 0 0 1-12 0" fill="none" stroke={P.brown} strokeWidth="4" />
    </>
  ),
  crayon: (
    <>
      <path d="M32 4l9 11H23z" fill={P.cream} />
      <path d="M23 15h18v33H23z" fill={P.purple} />
      <rect x="23" y="48" width="18" height="11" rx="2" fill={P.purple} opacity=".65" />
    </>
  ),
  pencil: (
    <>
      <rect x="21" y="6" width="22" height="7" rx="2" fill={P.pink} />
      <path d="M21 13h22v31H21z" fill={P.yellow} />
      <path d="M21 44h22L32 59z" fill={P.cream} />
      <path d="M28 53h8l-4 6z" fill={P.ink} />
    </>
  ),
  cushion: (
    <>
      <rect x="9" y="9" width="46" height="46" rx="12" fill={P.orange} />
      <rect x="18" y="18" width="28" height="28" rx="8" fill="none" stroke={P.cream} strokeWidth="2.5" />
    </>
  ),
  /** The `toy` CATEGORY falls back here, not to `ball` — see
   * objectIconLogic.ts. Stacking rings read as "a toy" generically without
   * claiming to be any specific object the child would then hunt for. */
  toy: (
    <>
      <rect x="29" y="8" width="6" height="38" rx="3" fill={P.brown} />
      <ellipse cx="32" cy="50" rx="24" ry="8" fill={P.blue} />
      <ellipse cx="32" cy="40" rx="19" ry="7" fill={P.green} />
      <ellipse cx="32" cy="31" rx="14" ry="6" fill={P.yellow} />
      <ellipse cx="32" cy="23" rx="10" ry="5" fill={P.red} />
    </>
  ),
  tent: (
    <>
      <path d="M32 7L58 55H6z" fill={P.cream} stroke={P.grey} strokeWidth="2" />
      <path d="M32 7l9 48H23z" fill={P.red} />
      <path d="M32 33a7 7 0 0 1 6 22h-12a7 7 0 0 1 6-22z" fill={P.ink} opacity=".55" />
    </>
  ),
  rug: (
    <>
      <ellipse cx="32" cy="34" rx="27" ry="17" fill={P.green} />
      <ellipse cx="32" cy="34" rx="18" ry="11" fill="none" stroke={P.cream} strokeWidth="3" />
      <ellipse cx="32" cy="34" rx="8" ry="5" fill={P.yellow} />
    </>
  ),
  hoop: (
    <>
      <circle cx="32" cy="32" r="23" fill="none" stroke={P.orange} strokeWidth="8" />
      <path d="M32 9a23 23 0 0 1 16 7" fill="none" stroke={P.yellow} strokeWidth="8" />
      <path d="M16 48a23 23 0 0 0 16 7" fill="none" stroke={P.yellow} strokeWidth="8" />
    </>
  ),
  puzzle: (
    <>
      <path d="M10 12h17a5 5 0 1 1 10 0h17v17a5 5 0 1 0 0 10v15H37a5 5 0 1 0-10 0H10z" fill={P.purple} />
      <circle cx="24" cy="26" r="3.5" fill={P.cream} />
      <circle cx="40" cy="40" r="3.5" fill={P.cream} />
    </>
  ),
  /** Last-resort artwork. Never a question mark or an error glyph — a child
   * sees this and it must still read as "a thing to go find", not as the app
   * having failed. */
  generic: (
    <>
      <path d="M32 7l7.5 15.5L56 25l-12 11.5L47 53l-15-8.5L17 53l3-16.5L8 25l16.5-2.5z" fill={P.yellow} />
    </>
  ),
};

/**
 * The artwork for one object, sized to fill its container.
 *
 * `aria-hidden` because every caller already labels the control itself
 * (CropButton puts the object's real name on the button's aria-label) —
 * without this the name would be announced twice by a screen reader.
 */
export function ObjectIcon({
  name,
  category,
  size = '100%',
}: {
  name: string;
  category?: string;
  /** Defaults to filling the parent — so every caller MUST give the parent a
   * definite size (an explicit width/height, not just min-width). A '%' size
   * against a content-sized parent is circular and the tile balloons. */
  size?: number | string;
}) {
  const key = iconKeyFor(name, category);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {ICONS[key]}
    </svg>
  );
}
