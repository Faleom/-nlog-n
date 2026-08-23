// Game 3's bundled stock content (product decision, see STATUS.md's Game 3
// session note). Deliberately DIFFERENT from Game 1/Game 2's "content is
// always the child's own captured room, never stock" principle
// (app-guide-v3-FINAL.md §1, §6.1, §7.3) — Game 3 was changed on purpose to
// run entirely on bundled illustrated assets instead of a room capture, so
// it never needs the camera at all. Say this plainly if it comes up: this
// game is the one deliberate exception to "no stock content" in the whole
// app, not an oversight.
//
// Assets are simple flat SVGs, hand-authored here and inlined as
// data: URIs — no external image files, no network fetch, no licensing
// question (nothing downloaded or scraped), fully offline. Two small,
// named sets stand in for "two rooms" so Chapter 1's generalization gate
// (§6 of TASK-game3-roadmap.md: pass every lesson AND show independence
// in 2 contexts) still means something without a real second capture.

import type { TaggedCrop } from '../../types';

function svgDataUri(inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect x="6" y="6" width="88" height="88" rx="20" fill="#ffffff"/>${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PLACEHOLDER_BBOX = { x: 0, y: 0, width: 100, height: 100 };

function stockCrop(overrides: Omit<TaggedCrop, 'bbox' | 'image'> & { icon: string }): TaggedCrop {
  const { icon, ...rest } = overrides;
  return { ...rest, bbox: PLACEHOLDER_BBOX, image: svgDataUri(icon) };
}

export const KITCHEN_STOCK_CROPS: TaggedCrop[] = [
  stockCrop({
    id: 'stock-cup',
    name: 'cup',
    colour: 'red',
    category: 'drinkware',
    function: 'drink from',
    icon:
      '<rect x="28" y="35" width="34" height="40" rx="6" fill="#e0483f"/>' +
      '<rect x="28" y="35" width="34" height="9" rx="4" fill="#c73b32"/>' +
      '<path d="M62 44h9a10 10 0 0 1 0 20h-9" fill="none" stroke="#e0483f" stroke-width="6"/>',
  }),
  stockCrop({
    id: 'stock-apple',
    name: 'apple',
    colour: 'red',
    category: 'food',
    function: 'eat',
    icon:
      '<circle cx="50" cy="58" r="26" fill="#d1483f"/>' +
      '<rect x="47" y="24" width="6" height="14" rx="3" fill="#6b4a2f"/>' +
      '<path d="M53 28c6-8 16-6 16 2-8 2-13 0-16-2z" fill="#4c9a4c"/>',
  }),
  stockCrop({
    id: 'stock-banana',
    name: 'banana',
    colour: 'yellow',
    category: 'food',
    function: 'eat',
    icon:
      '<path d="M25 68c10 10 40 10 50-5 3-4-2-8-6-5-10 10-32 10-40 2-3-3-8 3-4 8z" fill="#f0c419"/>' +
      '<path d="M70 58c4-2 8-6 8-10" stroke="#c79a12" stroke-width="4" fill="none" stroke-linecap="round"/>',
  }),
  stockCrop({
    id: 'stock-bowl',
    name: 'bowl',
    colour: 'blue',
    category: 'drinkware',
    function: 'eat from',
    icon:
      '<path d="M25 50h50a25 15 0 0 1-50 0z" fill="#3d7fd1"/>' +
      '<rect x="20" y="46" width="60" height="8" rx="4" fill="#2f66ab"/>',
  }),
  stockCrop({
    id: 'stock-spoon',
    name: 'spoon',
    colour: 'grey',
    category: 'utensil',
    function: 'eat with',
    icon:
      '<ellipse cx="45" cy="35" rx="14" ry="18" fill="#9aa0a6"/>' +
      '<rect x="42" y="50" width="8" height="30" rx="4" fill="#9aa0a6"/>',
  }),
  stockCrop({
    id: 'stock-plate',
    name: 'plate',
    colour: 'orange',
    category: 'drinkware',
    function: 'eat from',
    icon:
      '<circle cx="50" cy="55" r="28" fill="#f2f2f2" stroke="#e8a33d" stroke-width="4"/>' +
      '<circle cx="50" cy="55" r="16" fill="none" stroke="#e8a33d" stroke-width="2"/>',
  }),
];

export const BEDROOM_STOCK_CROPS: TaggedCrop[] = [
  stockCrop({
    id: 'stock-teddy',
    name: 'teddy',
    colour: 'brown',
    category: 'toy',
    function: 'cuddle',
    icon:
      '<circle cx="35" cy="30" r="9" fill="#8a5a3c"/>' +
      '<circle cx="65" cy="30" r="9" fill="#8a5a3c"/>' +
      '<circle cx="50" cy="52" r="24" fill="#a9754f"/>' +
      '<circle cx="42" cy="47" r="4" fill="#3a2a1e"/>' +
      '<circle cx="58" cy="47" r="4" fill="#3a2a1e"/>' +
      '<ellipse cx="50" cy="58" rx="7" ry="5" fill="#6b4a30"/>',
  }),
  stockCrop({
    id: 'stock-book',
    name: 'book',
    colour: 'blue',
    category: 'toy',
    function: 'read',
    icon:
      '<rect x="22" y="25" width="56" height="42" rx="4" fill="#3d63c9"/>' +
      '<rect x="48" y="25" width="4" height="42" fill="#2a4a9c"/>' +
      '<rect x="28" y="33" width="18" height="4" fill="#ffffff"/>' +
      '<rect x="28" y="41" width="18" height="4" fill="#ffffff"/>',
  }),
  stockCrop({
    id: 'stock-ball',
    name: 'ball',
    colour: 'orange',
    category: 'toy',
    function: 'play with',
    icon:
      '<circle cx="50" cy="50" r="28" fill="#f27f2c"/>' +
      '<path d="M22 50a28 28 0 0 1 56 0" stroke="#c9631a" stroke-width="4" fill="none"/>' +
      '<path d="M50 22v56" stroke="#c9631a" stroke-width="4"/>',
  }),
  stockCrop({
    id: 'stock-shoe',
    name: 'shoe',
    colour: 'purple',
    category: 'clothing',
    function: 'wear',
    icon:
      '<path d="M20 65h20l10-10h20a10 10 0 0 1 10 10v5H20z" fill="#7c4fc2"/>' +
      '<rect x="18" y="65" width="64" height="8" rx="4" fill="#5d3a99"/>',
  }),
  stockCrop({
    id: 'stock-blanket',
    name: 'blanket',
    colour: 'pink',
    category: 'comfort',
    function: 'snuggle with',
    icon:
      '<rect x="18" y="30" width="64" height="44" rx="6" fill="#e8789e"/>' +
      '<rect x="18" y="30" width="64" height="10" fill="#d55f87"/>',
  }),
  stockCrop({
    id: 'stock-pillow',
    name: 'pillow',
    colour: 'yellow',
    category: 'comfort',
    function: 'rest on',
    icon: '<rect x="20" y="30" width="60" height="42" rx="18" fill="#f2d34c"/>',
  }),
];

/** The fixed, ordered list of stock "rooms" Chapter 1 walks through — index
 * 0 is always the first context, index 1 the generalization re-test. */
export const STOCK_CONTEXTS: { label: string; crops: TaggedCrop[] }[] = [
  { label: 'Kitchen', crops: KITCHEN_STOCK_CROPS },
  { label: 'Bedroom', crops: BEDROOM_STOCK_CROPS },
];
