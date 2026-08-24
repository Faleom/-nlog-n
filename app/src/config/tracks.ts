// The six activity tracks, named once.
//
// Before this file the four game names existed as string literals in
// App.tsx's GameChrome eyebrows and again in the home grid's tiles. The
// dashboard needs the same names a third and fourth time (the time-by-track
// list, and "recently played"), and a colour per track that has to match
// between a bar segment and the dot beside its row. Four copies of a name
// that must agree is how a rename goes half-finished, so they live here.
//
// COLOUR CHOICE, AND WHY IT IS ALL VIOLET-COOL
// -------------------------------------------
// DESIGN-TOKENS §4.2/§4.3 rule the reserved hues (Sunburst, Blush) and
// Ember off caregiver screens outright. That leaves the Periwink family,
// so these six are pitched across it -- a violet, a lilac, a soft blue,
// a teal, a cyan and a plum -- rather than being the obvious
// red/amber/green/blue set a chart usually reaches for. Two things fall
// out of that, both wanted: nothing here can read as a red/green
// judgement about the child, and the six still separate by LIGHTNESS as
// well as hue, so they survive being seen by a colour-blind caregiver.
//
// Every one of them measures at least 4:1 against the dashboard card's
// composited surface, clearing WCAG 1.4.11's 3:1 floor for a graphic that
// carries meaning. The bar is never the only carrier anyway: each segment
// is restated as a labelled row underneath it.

import type { TrackId } from '../types';

export interface TrackInfo {
  id: TrackId;
  /** The name shown to the caregiver. Must match the game's own eyebrow. */
  label: string;
  /** CSS custom property holding this track's colour, defined in App.css. */
  colorVar: string;
  /** The capability this track trains, in caregiver words. The dashboard's
   * skills list is grouped by this rather than by raw skill id: "match
   * apple" and "match banana" are the same skill generalizing to a second
   * object, and listing them as two lines says the opposite. */
  skill: string;
}

export const TRACKS: readonly TrackInfo[] = [
  {
    id: 'find-it',
    label: 'Find It In Your World',
    colorVar: '--track-find-it',
    skill: 'Finding a named object in the room',
  },
  {
    id: 'story',
    label: 'Toy Story Sequencing',
    colorVar: '--track-story',
    skill: 'Putting everyday steps in order',
  },
  {
    id: 'match',
    label: 'Match the Picture',
    colorVar: '--track-match',
    skill: 'Classifying objects by what they are',
  },
  {
    id: 'trace',
    label: 'Trace and Colour',
    colorVar: '--track-trace',
    skill: 'Tracing a shape and staying inside it',
  },
  {
    id: 'block-stack',
    label: 'Block-stack match',
    colorVar: '--track-block-stack',
    skill: 'Building a tower to match a model, one block at a time',
  },
  {
    id: 'sort-by-rule',
    label: 'Sort by rule',
    colorVar: '--track-sort-by-rule',
    skill: 'Sorting objects into groups by a shared rule',
  },
] as const;

/** Order used wherever tracks are listed with no data to sort by. */
export const TRACK_ORDER: readonly TrackId[] = TRACKS.map((t) => t.id);

export function getTrack(id: TrackId): TrackInfo {
  const info = TRACKS.find((t) => t.id === id);
  if (!info) throw new Error(`Unknown track: ${id}`);
  return info;
}
