// What a finished session says to the child, in words, per game.
//
// Pure — no React, no JSX — so the wording rules are testable in Node the
// same way objectIconLogic.ts and traceLogic.ts are. The drawing half is
// SessionCelebration.tsx.
//
// THE RULE THIS DELIBERATELY DEPARTS FROM
// ---------------------------------------
// app-guide-v3-FINAL.md §7.7/§13 says "no points, stars, confetti", and
// smoke-f008/smoke-f021 assert it. That rule is aimed at a RUNNING TOTAL
// carried through play: a score climbing in the corner, stars banking up,
// a child rewarded for volume rather than for the thing they just did.
// This is the opposite end of the session -- the activity is over, nothing
// accumulates past it, and the next session starts from nothing again.
// A finished activity ending in silence and a caregiver diagnostics panel
// was the actual behaviour before this file, and it told the child the
// thing they had just worked through did not conclude.
//
// This is a knowing, on-the-record product override, the same kind as
// --touch-min's 88px -> 44px change. What stays forbidden, and is still
// asserted: no score, no stars, no running total, no comparison with a
// past session, nothing that survives the session it belongs to.
//
// The count that IS said out loud ("5 shapes") is a description of what
// just happened, not a target that was met -- there was never a number to
// reach, and a session that ends early says whatever number it reached
// with the same wording and the same celebration.

import { getSupportTierInfo } from '../config/supportLadder';
import type { SessionLog, TrackId } from '../types';

export interface Achievement {
  /** The line the child hears and sees. Short, concrete, no number that
   * reads as a target. */
  headline: string;
  /** The quieter line under it, for the adult in the room. Null when
   * nothing was logged, rather than a filler sentence. */
  detail: string | null;
}

/** Plural-safe "1 shape" / "3 shapes". */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const NOUNS: Record<TrackId, { one: string; many: string; verb: string }> = {
  'find-it': { one: 'thing', many: 'things', verb: 'found' },
  story: { one: 'story', many: 'stories', verb: 'put in order' },
  match: { one: 'picture', many: 'pictures', verb: 'matched' },
  trace: { one: 'shape', many: 'shapes', verb: 'traced and coloured' },
};

/**
 * The celebration line for a finished session.
 *
 * Both halves come from the session's own records: how many rounds
 * resolved, and how many of those the caregiver marked independent on
 * F.010's ladder. Nothing is inferred, and a session with no records says
 * so plainly instead of inventing an achievement.
 */
export function describeAchievement(session: SessionLog, track: TrackId): Achievement {
  const rounds = session.skillRecords.length;
  const noun = NOUNS[track];

  if (rounds === 0) {
    return { headline: 'All done!', detail: null };
  }

  const headline = `${count(rounds, noun.one, noun.many)} ${noun.verb}!`;
  const independent = session.skillRecords.filter((r) => r.supportTier === 5).length;

  if (independent === rounds) {
    return {
      headline,
      detail: rounds === 1 ? 'All on their own.' : 'Every one on their own.',
    };
  }
  if (independent > 0) {
    return { headline, detail: `${independent} of ${rounds} on their own.` };
  }

  // None independent: name the help that was given, in the ladder's own
  // words, with no suggestion that needing it was a shortfall.
  const tiers = session.skillRecords.map((r) => r.supportTier);
  const highest = tiers.reduce((max, t) => (t > max ? t : max), 1 as (typeof tiers)[number]);
  return {
    headline,
    detail: `Together, with ${getSupportTierInfo(highest).name.toLowerCase()} help.`,
  };
}

/** What the Companion says out loud when the session finishes. Speech, not
 * text on screen -- the child hears this whether or not they read. */
export function spokenAchievement(session: SessionLog, track: TrackId): string {
  const { headline, detail } = describeAchievement(session, track);
  return detail ? `${headline} ${detail}` : headline;
}
