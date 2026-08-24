// The caregiver dashboard's aggregation layer. Pure functions over the
// SessionLogs the store already keeps -- there is no dashboard-only store,
// and nothing here writes anything.
//
// WHAT THIS DELIBERATELY DOES NOT DO
// ----------------------------------
// It counts, buckets by day and sums. It never compares one day to
// another, never carries a total forward, never says a figure is high or
// low, and has no notion of a day the child "should" have played. The
// reasoning is the TOBY Playpad finding this product is built on: families
// in early intervention stop using apps like this within three months, and
// the ones who stop are the ones whose weeks are hardest -- hospital
// appointments, bad nights, an exhausted caregiver. Any mechanic that
// resets to zero and announces it punishes exactly those families. So a
// quiet day here produces an empty square and nothing else: no counter to
// break, no language about it, no arithmetic that treats it as a gap.
//
// The one interpretive thing it does is name the support a skill still
// needs, and it does that in SUPPORT_TIERS' own words rather than
// inventing a second vocabulary for the same ladder.

import { INTERACTION_CONFIG } from '../config/interaction';
import { getSupportTierInfo } from '../config/supportLadder';
import { getTrack } from '../config/tracks';
import type { ChildProfile, SessionLog, SupportTier, TrackId } from '../types';

// ---------------------------------------------------------------------------
// Days, in the caregiver's own timezone
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` for a Date, in LOCAL time. Not toISOString().slice(0,10),
 * which is UTC: a 9pm session in Melbourne would land on tomorrow. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sessionsOn(sessions: SessionLog[], day: Date): SessionLog[] {
  const key = localDayKey(day);
  return sessions.filter((s) => localDayKey(new Date(s.startedAt)) === key);
}

// ---------------------------------------------------------------------------
// This week
// ---------------------------------------------------------------------------

export interface WeekCell {
  /** Local `YYYY-MM-DD`. */
  iso: string;
  /** Two-letter weekday, e.g. "Tu". */
  label: string;
  played: boolean;
  isToday: boolean;
}

/**
 * Seven cells, oldest first, ending on today.
 *
 * A rolling window rather than a calendar week, for one reason: on a
 * calendar week the days after today are empty squares that have not
 * happened yet, and an empty square is indistinguishable from a day
 * nothing was played. Ending on today means every empty cell is a real
 * quiet day, and today is always the last one -- the only cell whose
 * position a caregiver has to find at a glance.
 */
export function weekStrip(sessions: SessionLog[], today: Date): WeekCell[] {
  const playedKeys = new Set(sessions.map((s) => localDayKey(new Date(s.startedAt))));
  const todayKey = localDayKey(today);
  const cells: WeekCell[] = [];
  for (let back = 6; back >= 0; back -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - back);
    const iso = localDayKey(day);
    cells.push({
      iso,
      label: day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      played: playedKeys.has(iso),
      isToday: iso === todayKey,
    });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Today's two figures
// ---------------------------------------------------------------------------

/** Total time played on `day`, in seconds. Summed in seconds and rounded
 * once by the caller -- rounding each session first loses a minute across
 * three short sittings. */
export function secondsPlayedOn(sessions: SessionLog[], day: Date): number {
  return sessionsOn(sessions, day).reduce((sum, s) => sum + s.durationSeconds, 0);
}

/** The longest single sustained stretch on `day`, in seconds -- the max,
 * never the sum. Two ten-minute sittings are not a twenty-minute focus. */
export function longestFocusOn(sessions: SessionLog[], day: Date): number {
  return sessionsOn(sessions, day).reduce(
    (max, s) => Math.max(max, s.longestFocusStretchSeconds),
    0,
  );
}

// ---------------------------------------------------------------------------
// Time by track
// ---------------------------------------------------------------------------

export interface TrackSlice {
  track: TrackId;
  label: string;
  colorVar: string;
  seconds: number;
  /** Whole-number share of the day's time. Shares always total exactly 100. */
  sharePercent: number;
  /** What was actually played, from the sessions' own skill records. */
  detail: string | null;
  sessionCount: number;
}

/**
 * The day's time split by track, longest first.
 *
 * Tracks with no time today are absent from the result rather than present
 * at zero: a zero-length segment still draws its own border and reads as a
 * hairline of something in the bar.
 *
 * Shares are whole numbers that total exactly 100, by largest remainder --
 * the segments are laid out from these numbers, so anything that drifted
 * would leave a visible gap at the end of the bar.
 */
export function timeByTrackOn(sessions: SessionLog[], day: Date): TrackSlice[] {
  const today = sessionsOn(sessions, day).filter((s) => s.track && s.durationSeconds > 0);
  const total = today.reduce((sum, s) => sum + s.durationSeconds, 0);
  if (total === 0) return [];

  const byTrack = new Map<TrackId, SessionLog[]>();
  for (const session of today) {
    const track = session.track as TrackId;
    byTrack.set(track, [...(byTrack.get(track) ?? []), session]);
  }

  const rows = [...byTrack.entries()]
    .map(([track, trackSessions]) => {
      const seconds = trackSessions.reduce((sum, s) => sum + s.durationSeconds, 0);
      const info = getTrack(track);
      return {
        track,
        label: info.label,
        colorVar: info.colorVar,
        seconds,
        exactShare: (seconds / total) * 100,
        detail: describePlayed(trackSessions),
        sessionCount: trackSessions.length,
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));

  return withWholeShares(rows);
}

/** Largest-remainder apportionment: floor everything, then hand the
 * leftover units to the biggest fractional parts. Totals exactly 100. */
function withWholeShares(
  rows: (Omit<TrackSlice, 'sharePercent'> & { exactShare: number })[],
): TrackSlice[] {
  const floors = rows.map((r) => Math.floor(r.exactShare));
  let remainder = 100 - floors.reduce((sum, f) => sum + f, 0);
  const order = rows
    .map((r, i) => ({ i, frac: r.exactShare - Math.floor(r.exactShare) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return rows.map(({ exactShare: _exactShare, ...rest }, i) => ({
    ...rest,
    sharePercent: floors[i],
  }));
}

/** The distinct skills a set of sessions touched, as one readable line.
 * Reads the real records; returns null when a session logged none, so the
 * caller can leave the subtitle out rather than print a placeholder. */
function describePlayed(sessions: SessionLog[]): string | null {
  const skills: string[] = [];
  for (const session of sessions) {
    for (const record of session.skillRecords) {
      const name = humanizeSkillId(record.skillId);
      if (!skills.includes(name)) skills.push(name);
    }
  }
  if (skills.length === 0) return null;
  if (skills.length <= 3) return skills.join(', ');
  return `${skills.slice(0, 3).join(', ')} +${skills.length - 3} more`;
}

/** Skill ids are kebab-case internals ("find-red-cup"). Nothing in the
 * data model carries a caregiver-facing name for them, so this is a
 * presentation-only unkebab -- not a lookup table pretending to be one. */
export function humanizeSkillId(skillId: string): string {
  return skillId.replace(/-/g, ' ');
}

// ---------------------------------------------------------------------------
// Recently played
// ---------------------------------------------------------------------------

export interface RecentSession {
  id: string;
  track: TrackId | null;
  label: string;
  detail: string | null;
  minutes: number;
  seconds: number;
  startedAt: string;
}

/** The last `limit` sessions, newest first. */
export function recentSessions(sessions: SessionLog[], limit: number): RecentSession[] {
  return [...sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
    .map((session) => ({
      id: session.id,
      track: session.track ?? null,
      label: session.track ? getTrack(session.track).label : 'Activity',
      detail: describePlayed([session]),
      minutes: Math.round(session.durationSeconds / 60),
      seconds: session.durationSeconds,
      startedAt: session.startedAt,
    }));
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export interface SkillProgressRow {
  /** The track whose capability this row describes. */
  id: TrackId;
  /** The capability, in caregiver words -- from config/tracks.ts. */
  name: string;
  /** How many contexts this capability has been practised in at all. */
  contextsSeen: number;
  /** How many of those it has reached tier 5 (independent) in. */
  contextsIndependent: number;
  mastered: boolean;
  /** Where this activity sits on F.010's five-tier ladder right now: the
   * LOWEST tier across the contexts it has been played in, because an
   * activity is only as unaided as the place that still needs the most
   * help. 1 = full physical, 5 = independent. */
  tier: SupportTier;
  /** The ladder's own name for that tier -- "Gesture", "Independent". */
  tierName: string;
  /** How many support records this activity has, across every session.
   * Shown so a single sitting is never mistaken for a settled answer. */
  recordCount: number;
  /** The support still needed, in the ladder's own words -- null once
   * every context is independent. */
  supportNote: string | null;
}

/**
 * What the child can do, one row per activity.
 *
 * Grouped by the ACTIVITY's capability, not by raw skill id. A skill id is
 * per-object ("match-apple", "match-banana", "find-red-cup"), and a list
 * of those reads as a dozen separate skills when it is really one skill
 * meeting a second object -- which is the whole thing this app is trying
 * to build. "Classifying objects by what they are" is the claim the
 * records actually support.
 *
 * "Mastered" means the latest record in every context the activity has
 * been played in sits at tier 5 (independent), which is the same
 * definition F.011's fading logic works to. It is not a threshold chosen
 * for this screen.
 *
 * Sessions logged before sessions recorded their track carry no activity
 * to group under, so their records are left out rather than guessed at.
 *
 * Rows come back most-unaided first. That ordering is the only claim this
 * function makes: it says where each activity sits on the ladder today,
 * in the ladder's own words. It does not rank the child, name a strength
 * or a shortfall, compare one activity's tier against another's as if
 * that meant something, or read a direction into how a tier moved.
 */
export function skillProgress(sessions: SessionLog[]): SkillProgressRow[] {
  const contexts = new Map<TrackId, Map<string, SupportTier>>();
  const records = new Map<TrackId, number>();
  const chronological = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const session of chronological) {
    if (!session.track) continue;
    for (const record of session.skillRecords) {
      const perContext = contexts.get(session.track) ?? new Map<string, SupportTier>();
      // Latest record for a context wins: the ladder moves both ways, and
      // the current answer is the one the caregiver is asking for.
      perContext.set(record.context, record.supportTier);
      contexts.set(session.track, perContext);
      records.set(session.track, (records.get(session.track) ?? 0) + 1);
    }
  }

  return [...contexts.entries()]
    .map(([track, perContext]) => {
      const tiers = [...perContext.values()];
      const independent = tiers.filter((t) => t === 5).length;
      const mastered = independent === tiers.length && tiers.length > 0;
      const lowest = tiers.reduce((min, t) => (t < min ? t : min), 5 as SupportTier);
      const info = getSupportTierInfo(lowest);
      return {
        id: track,
        name: getTrack(track).skill,
        contextsSeen: tiers.length,
        contextsIndependent: independent,
        mastered,
        tier: lowest,
        tierName: info.name,
        recordCount: records.get(track) ?? 0,
        supportNote: mastered ? null : `${info.name.toLowerCase()} support`,
      };
    })
    .sort((a, b) => {
      // Most unaided first. Same tier, most contexts first -- an activity
      // done alone in two places has been shown in more of the child's
      // world than one done alone in a single room.
      if (a.tier !== b.tier) return b.tier - a.tier;
      if (a.contextsIndependent !== b.contextsIndependent) {
        return b.contextsIndependent - a.contextsIndependent;
      }
      return a.name.localeCompare(b.name);
    });
}

// ---------------------------------------------------------------------------
// Usual session length
// ---------------------------------------------------------------------------

/** The three lengths the picker offers. The middle one is the config
 * default, so an untouched picker shows what the app already does. */
export const SESSION_LENGTH_OPTIONS: readonly number[] = [
  INTERACTION_CONFIG.SESSION_CAP_FLOOR_MINUTES,
  INTERACTION_CONFIG.SESSION_CAP_FIRST_MINUTES,
  INTERACTION_CONFIG.SESSION_CAP_FIRST_MINUTES +
    (INTERACTION_CONFIG.SESSION_CAP_FIRST_MINUTES - INTERACTION_CONFIG.SESSION_CAP_FLOOR_MINUTES),
] as const;

/** Where this child's next first session starts. Falls back to the config
 * default, so a profile saved before the preference existed is unchanged. */
export function usualSessionMinutes(profile: ChildProfile): number {
  return profile.usualSessionMinutes ?? INTERACTION_CONFIG.SESSION_CAP_FIRST_MINUTES;
}

// ---------------------------------------------------------------------------
// Full-history calendar ("This week"'s View more)
// ---------------------------------------------------------------------------

/** Every distinct local day a session was played, earliest first. */
function playedDayKeys(sessions: SessionLog[]): string[] {
  const keys = new Set(sessions.map((s) => localDayKey(new Date(s.startedAt))));
  return [...keys].sort();
}

/** How many distinct days a session was EVER logged, across all history --
 * a plain count, not a streak: it never resets, is never compared against
 * a target, and does not care whether those days were consecutive. */
export function totalDaysPracticed(sessions: SessionLog[]): number {
  return playedDayKeys(sessions).length;
}

/** The local calendar month (year + 0-indexed month) of the very first
 * ever session, or null with no history yet -- the month the calendar
 * view should refuse to page back past. */
export function firstPlayedMonth(sessions: SessionLog[]): { year: number; month: number } | null {
  const keys = playedDayKeys(sessions);
  if (keys.length === 0) return null;
  const [y, m] = keys[0].split('-').map(Number);
  return { year: y, month: m - 1 };
}

export interface CalendarDay {
  /** Local `YYYY-MM-DD`. */
  iso: string;
  dayOfMonth: number;
  /** False for the padding days from the adjacent month that fill out the
   * grid's leading/trailing weeks -- rendered dimmed, never tappable, and
   * never marked played regardless of that day's real history (paging to
   * the month it actually belongs to is where it counts). */
  inMonth: boolean;
  played: boolean;
  isToday: boolean;
}

/**
 * One calendar month as whole weeks (always a multiple of 7), Sunday-
 * first, padded with the adjacent months' dates so every row is a
 * complete week -- the same shape a wall calendar takes, which is the
 * whole point of a "view more" next to the rolling 7-day strip above it.
 */
export function monthGrid(
  sessions: SessionLog[],
  year: number,
  month: number,
  today: Date,
): CalendarDay[] {
  const playedKeys = new Set(playedDayKeys(sessions));
  const todayKey = localDayKey(today);

  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - firstOfMonth.getDay());

  const lastOfMonth = new Date(year, month + 1, 0);
  const end = new Date(lastOfMonth);
  end.setDate(end.getDate() + (6 - lastOfMonth.getDay()));

  const days: CalendarDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = localDayKey(cursor);
    const inMonth = cursor.getMonth() === month && cursor.getFullYear() === year;
    days.push({
      iso,
      dayOfMonth: cursor.getDate(),
      inMonth,
      played: inMonth && playedKeys.has(iso),
      isToday: iso === todayKey,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Sunday-first two-letter weekday labels for the calendar's column
 * header -- fixed columns, unlike weekStrip's rolling seven, so these
 * can't be read off any real week and are computed from a known-Sunday
 * reference date instead (4 Jan 2024 was a Sunday). Same two-letter,
 * locale-aware shape as weekStrip's own labels. */
export function calendarWeekdayLabels(): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
  );
}
