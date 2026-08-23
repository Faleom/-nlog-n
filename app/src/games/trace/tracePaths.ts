// Trace-and-colour: the shapes, and the five colours.
//
// WHY THESE ARE NOT THE conceptArt.tsx DRAWINGS
// ---------------------------------------------
// Those drawings are 5-13 separate shapes each — an apple is a body, a
// stem, a leaf, a shade wedge and a highlight. There is no single outline
// in them to follow, and a finger cannot trace "a highlight". Tracing needs
// exactly ONE closed path per object, so these are authored separately:
// simpler, smoother, no interior detail, and closed so the start and end
// meet.
//
// That constraint also decides WHICH objects can appear here. Fruit and
// balls have one continuous outline and qualify; the dog and the teddy are
// piles of overlapping circles with no traceable boundary, so they sit this
// game out rather than getting a fake outline that doesn't match how they
// are drawn everywhere else in the app.

/** The five colours a child chooses from (condition: exactly five).
 *
 * FIXED — the same five, in the same order, on every object. It would be
 * easy to vary them per object to make the "right" one less obvious, but
 * that trades away predictability for a difficulty that does not matter
 * here: no answer is wrong (see TRACE_OBJECTS.colour), so there is nothing
 * to make harder. A child who benefits from sameness (§5.2) gets the same
 * palette in the same places every single time.
 *
 * Every object's own colour must be one of these — asserted by
 * scripts/smoke-trace.ts, since an object whose real colour is missing
 * would show a 10% ghost the palette cannot match.
 */
export const PALETTE: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'red', hex: '#D0342C' },
  { name: 'orange', hex: '#EE8B2B' },
  { name: 'yellow', hex: '#EFC93F' },
  { name: 'green', hex: '#5BA84E' },
  { name: 'blue', hex: '#3F86D0' },
];

export interface TraceObject {
  key: string;
  /** The word a young child would use. Caregiver-facing only. */
  name: string;
  /** ONE closed outline, in a 240x240 box. No interior detail. */
  d: string;
  /** The object's real colour — shown as the 10% ghost after tracing, and
   * always present in PALETTE. It is a HINT, never a gate: whichever colour
   * the child taps is the one the shape fills with. */
  colour: string;
}

export const TRACE_OBJECTS: TraceObject[] = [
  {
    key: 'apple',
    name: 'apple',
    colour: 'red',
    d: 'M120,64 C104,38 62,38 48,72 C32,110 44,176 84,202 C100,213 112,205 120,205 C128,205 140,213 156,202 C196,176 208,110 192,72 C178,38 136,38 120,64 Z',
  },
  {
    key: 'orange',
    name: 'orange',
    colour: 'orange',
    d: 'M120,44 C162,44 196,78 196,120 C196,162 162,196 120,196 C78,196 44,162 44,120 C44,78 78,44 120,44 Z',
  },
  {
    key: 'banana',
    name: 'banana',
    colour: 'yellow',
    d: 'M46,66 C42,128 82,190 158,196 C188,198 204,184 200,172 C196,160 178,158 158,156 C104,150 76,112 70,64 C68,50 58,44 50,48 C44,51 46,58 46,66 Z',
  },
  {
    key: 'carrot',
    name: 'carrot',
    colour: 'orange',
    d: 'M92,62 C92,54 148,54 148,62 L128,196 C126,210 114,210 112,196 Z',
  },
  {
    key: 'strawberry',
    name: 'strawberry',
    colour: 'red',
    d: 'M120,206 C94,186 62,150 62,116 C62,88 88,70 120,70 C152,70 178,88 178,116 C178,150 146,186 120,206 Z',
  },
  {
    key: 'tomato',
    name: 'tomato',
    colour: 'red',
    d: 'M120,58 C170,58 202,92 202,128 C202,168 166,196 120,196 C74,196 38,168 38,128 C38,92 70,58 120,58 Z',
  },
  {
    key: 'ball',
    name: 'ball',
    colour: 'blue',
    d: 'M120,42 C163,42 198,77 198,120 C198,163 163,198 120,198 C77,198 42,163 42,120 C42,77 77,42 120,42 Z',
  },
  {
    key: 'leaf',
    name: 'leaf',
    colour: 'green',
    d: 'M120,196 C60,180 40,110 72,58 C132,44 196,84 192,140 C190,174 158,200 120,196 Z',
  },
];

/** The palette entry for an object's own colour. Never null in practice —
 * the smoke suite asserts every object's colour exists in PALETTE. */
export function realColourOf(object: TraceObject): string {
  return PALETTE.find((c) => c.name === object.colour)?.hex ?? PALETTE[0].hex;
}
