// The caregiver dashboard. Rebuilt from the approved mockup; the data all
// comes from SessionLogs the store was already keeping (see
// engine/dashboardSummary.ts, which does every calculation on this screen).
//
// WHAT THIS SCREEN REFUSES TO BE
// ------------------------------
// The research this product is built on (TOBY Playpad RCT) found families
// in early intervention stop within about three months, and that the weeks
// they stop in are the hard ones: appointments, bad nights, a caregiver
// with nothing left. A counter that resets to zero and announces it lands
// hardest on exactly those families, so this screen has no counter to
// break, no daily target to miss, and nothing to collect. An empty day in
// the week strip is an empty square and nothing else -- no colour, no
// copy, no arithmetic that treats it as a gap. smoke-dashboard.ts greps
// this file for the mechanics that would grow that back.
//
// The non-diagnostic banner (§7.9) is rendered on every return path,
// loading included -- not first-run only, no dismiss.
//
// Visual system: Toki, the light palette the rest of the app is being
// moved onto (mockup screen 08). White cards on the shared home shell's
// blue-tinted ground, #e6f0fa rims, rgba(23,86,140,x) shadows, one blue
// accent family (#1e93ee / #0b6fbf) and the #21374e / #5c7691 / #7e95ad
// ink hierarchy. The reserved hues stay off this side, which is also why
// the track colours are a violet-cool family and nothing here can read as
// a red/green judgement. The mockup asks for six sections where the
// caregiver surface guidance suggests three to five cards; that is a
// knowing deviation, held in check by keeping every card a flat list
// rather than a dense panel.
//
// This screen renders INSIDE App.tsx's <main className="toki-home-main">,
// so it draws no ground, no wordmark and no tab bar of its own -- the
// shell already carries all three, plus the "Caregiver Dashboard" title
// and its one-line subtitle.

import { useEffect, useState, type ReactNode } from 'react';
import { getSessionsForChild, updateProfile } from '../engine/profileStore';
import { NON_DIAGNOSTIC_BANNER } from '../engine/caregiverDashboard';
import {
  SESSION_LENGTH_OPTIONS,
  calendarWeekdayLabels,
  firstPlayedMonth,
  localDayKey,
  monthGrid,
  recentlyPlayedGames,
  secondsPlayedOn,
  skillProgress,
  timeByTrackOn,
  topSkillOn,
  totalDaysPracticed,
  usualSessionMinutes,
  weekStrip,
  type CalendarDay,
  type SkillProgressRow,
  type TrackSlice,
} from '../engine/dashboardSummary';
import type { ChildProfile, SessionLog, SupportTier, TrackId } from '../types';

interface CaregiverDashboardProps {
  profile: ChildProfile;
  /** So App's copy of the profile stays in step when the session-length
   * preference is saved -- the games read it on their next launch. */
  onProfileChange?: (profile: ChildProfile) => void;
  /** "View" on a Recently played row launches straight into that game --
   * the same screen its own Play-tab tile opens, just reached from here
   * instead. App.tsx owns the actual screen routing, this just names
   * which track was asked for. */
  onPlayTrack: (track: TrackId) => void;
}

/** A stack of at most 3: play a fourth distinct game and the
 * least-recently-touched of the previous three falls off (see
 * recentlyPlayedGames's own header for why this reads as a stack, not a
 * session log). */
const RECENT_GAMES_LIMIT = 3;

/** The exact painted-scene motif each track's own Play-tab tile already
 * draws (App.tsx's home-play-grid) -- same paths, just cropped small, so
 * a Recently-played row shows the real game art rather than a second,
 * lower-fidelity icon language. Drawn in `currentColor`, which the row
 * sets to the track's own colour so the same legend the day-detail
 * bar/dot use still ties a game to its hue. The plate underneath is the
 * shared Toki icon tint rather than the track colour: on a white card a
 * fully saturated plate fights the row it sits in, and the artwork
 * already tells the games apart on its own. */
const TRACK_THUMBNAIL: Record<TrackId, ReactNode> = {
  'find-it': (
    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M0 62 H160" stroke="currentColor" strokeOpacity="0.24" strokeWidth="2" />
      <path d="M0 78 L160 62" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
      <rect x="10" y="44" width="14" height="18" rx="3" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2" />
      <circle cx="40" cy="53" r="9" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2" />
      <path d="M58 62 L68 42 L78 62 Z" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="116" cy="32" r="20" stroke="currentColor" strokeOpacity="0.62" strokeWidth="3.5" />
      <path d="M130 46 L144 60" stroke="currentColor" strokeOpacity="0.62" strokeWidth="6" strokeLinecap="round" />
    </svg>
  ),
  story: (
    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
      <rect x="14" y="54" width="38" height="30" rx="8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.42" strokeWidth="2" />
      <rect x="58" y="54" width="38" height="30" rx="8" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <rect x="36" y="20" width="38" height="30" rx="8" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
      <path d="M126 38 L138 62 L114 62 Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.34" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  match: (
    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <mask id="dashboard-recent-crescent">
          <rect width="160" height="88" fill="white" />
          <circle cx="112" cy="20" r="17" fill="black" />
        </mask>
      </defs>
      <circle cx="126" cy="28" r="20" fill="currentColor" fillOpacity="0.62" mask="url(#dashboard-recent-crescent)" />
      <path d="M0 70 H160" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <rect x="58" y="42" width="26" height="28" rx="6" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  ),
  trace: (
    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
      <path
        d="M46 66 C30 66 22 52 22 40 C22 24 36 14 52 14 C68 14 82 24 84 40 C86 54 76 66 60 66 Z"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeDasharray="1 7"
        strokeLinecap="round"
      />
      <path
        d="M96 60 C108 44 124 34 140 32"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  ),
  'block-stack': (
    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M0 78 H160" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
      <rect x="34" y="58" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" />
      <rect x="34" y="36" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.26" stroke="currentColor" strokeOpacity="0.46" strokeWidth="2" />
      <rect x="34" y="14" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.32" stroke="currentColor" strokeOpacity="0.52" strokeWidth="2" />
      <rect x="100" y="58" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" />
      <rect x="100" y="36" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.26" stroke="currentColor" strokeOpacity="0.46" strokeWidth="2" />
    </svg>
  ),
  'sort-by-rule': (
    <svg viewBox="0 0 160 88" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M10 52 L34 52 L30 78 L10 78 Z" stroke="currentColor" strokeOpacity="0.42" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="22" cy="45" r="8" fill="currentColor" fillOpacity="0.3" />
      <path d="M126 52 L150 52 L146 78 L126 78 Z" stroke="currentColor" strokeOpacity="0.42" strokeWidth="2" strokeLinejoin="round" />
      <rect x="130" y="38" width="14" height="14" rx="3" fill="currentColor" fillOpacity="0.3" />
      <path d="M70 26 L82 48 L58 48 Z" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="98" cy="38" r="9" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  ),
};

function Banner() {
  return (
    <div className="toki-banner">
      <p>{NON_DIAGNOSTIC_BANNER}</p>
    </div>
  );
}

/** Whole minutes, or "<1" for a sitting that ended before the first
 * minute -- rounding that to "0" would report a real session as nothing. */
function minutes(seconds: number): string {
  if (seconds === 0) return '0';
  if (seconds < 60) return '<1';
  return String(Math.round(seconds / 60));
}

/** `YYYY-MM-DD` -> a local Date at midnight. Not `new Date(iso)`, which
 * parses a bare date string as UTC midnight -- a day early anywhere west
 * of Greenwich, and exactly the bug this app's other day-math already
 * works around (see engine/caregiverDashboard.ts's own localDayKey). */
function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** `YYYY-MM-DD` -> "Monday 24 August". */
function spokenDate(iso: string): string {
  return dateFromIso(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** The same "tap for a summary" label built once, shared by the week
 * strip's cells and the calendar's -- two grids, one day-detail panel. */
function dayCellAriaLabel(iso: string, isToday: boolean, played: boolean): string {
  return `${spokenDate(iso)}${isToday ? ', today' : ''}: ${
    played ? 'a session happened' : 'no session'
  }. Tap for a summary.`;
}

function CheckMark() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M3 7.4 L5.8 10 L11 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
      <path
        d="M2 2 L10 10 M10 2 L2 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A chevron pointed either way for month paging. */
function CalendarNavIcon({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M7.75 2 L3.75 6 L7.75 10' : 'M4.25 2 L8.25 6 L4.25 10'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One cell of the month calendar. A padding day (the adjacent month's
 * dates that fill out the grid's leading/trailing weeks) is not a button
 * at all -- there is nothing to tap it open to, it exists only so every
 * row is a complete week. */
function CalendarDayCell({
  day,
  selected,
  onSelect,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!day.inMonth) {
    return (
      <span className="toki-cal-cell toki-cal-cell--pad" aria-hidden="true">
        {day.dayOfMonth}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={[
        'toki-cal-cell',
        day.played ? 'is-played' : '',
        day.isToday ? 'is-today' : '',
        selected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selected}
      aria-label={dayCellAriaLabel(day.iso, day.isToday, day.played)}
      {...(day.isToday ? { 'aria-current': 'date' as const } : {})}
      onClick={onSelect}
    >
      {day.dayOfMonth}
    </button>
  );
}

/** A read-only track row for the day-detail panel. Nothing here expands:
 * the day is already the drill-down, so a second layer of disclosure
 * underneath it would be disclosure for its own sake -- which is why this
 * is a plain list row and not a button. */
function DayTrackRow({ slice, isTopPlayed }: { slice: TrackSlice; isTopPlayed: boolean }) {
  return (
    <li className="toki-list-row">
      <span
        className="toki-ddot"
        style={{ background: `var(${slice.colorVar})` }}
        aria-hidden="true"
      />
      <span className="toki-list-text">
        <span className="toki-list-title">
          {slice.label}
          {isTopPlayed && <span className="toki-tag">Most played</span>}
        </span>
        {slice.detail && <span className="toki-list-detail">{slice.detail}</span>}
      </span>
      <span className="toki-list-meta">{minutes(slice.seconds)} min</span>
    </li>
  );
}

/** Where an activity sits on F.010's five-tier ladder, drawn as the
 * mockup's thin meter filled to the tier. More filled = less help needed,
 * which is the direction the ladder itself runs. One hue at two weights:
 * a second colour here would invite reading the low end as a warning. The
 * tier's NAME is written out beside it in every row, so nothing here is
 * carried by the bar alone. */
function LadderMeter({ tier, tierName }: { tier: SupportTier; tierName: string }) {
  return (
    <span
      className="toki-ladder-meter"
      role="img"
      aria-label={`${tierName}: step ${tier} of 5 on the support ladder`}
    >
      <span className="toki-ladder-meter-fill" style={{ width: `${(tier / 5) * 100}%` }} />
    </span>
  );
}

function SkillRow({ skill }: { skill: SkillProgressRow }) {
  return (
    <li className="toki-skill-row">
      <span
        className={
          skill.mastered ? 'toki-status-mark toki-status-mark--complete' : 'toki-status-mark'
        }
        aria-hidden="true"
      >
        {skill.mastered && <CheckMark />}
      </span>
      <span className="toki-skill-text">
        <span className="toki-skill-name">{skill.name}</span>
        <span className="toki-skill-meter-row">
          <LadderMeter tier={skill.tier} tierName={skill.tierName} />
          <span className="toki-skill-detail">
            {skill.tierName} · {skill.contextsIndependent} of {skill.contextsSeen}{' '}
            {skill.contextsSeen === 1 ? 'place' : 'places'} alone ·{' '}
            {skill.recordCount} {skill.recordCount === 1 ? 'sitting' : 'sittings'} logged
          </span>
        </span>
      </span>
    </li>
  );
}

export function CaregiverDashboard({ profile, onProfileChange, onPlayTrack }: CaregiverDashboardProps) {
  const [sessions, setSessions] = useState<SessionLog[] | null>(null);
  const [lengthChoice, setLengthChoice] = useState(usualSessionMinutes(profile));
  // Which day of the week strip is expanded below it, if any. Defaults to
  // today, so the panel a caregiver most wants (what just happened) is
  // already open on arrival -- no click needed. Tapping the same day
  // again (or its close button) collapses it; tapping any day (including
  // today's, once closed) reopens it, exactly like clicking it the first
  // time.
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(() => localDayKey(new Date()));
  // "View more"'s full-history calendar -- collapsed by default, since a
  // brand-new tab opening straight onto a whole month grid would bury the
  // rolling week strip that answers "how's this week" at a glance.
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  function shiftViewedMonth(delta: number) {
    setViewedMonth(({ year, month }) => {
      const total = year * 12 + month + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
    });
  }

  useEffect(() => {
    void getSessionsForChild(profile.id).then(setSessions);
  }, [profile.id]);

  // The picker is optimistic: the selected state moves on touch and the
  // write follows. A caregiver tapping this is answering a question about
  // their own household, not submitting a form -- there is nothing here
  // that can be rejected, and a spinner on a preference would be noise.
  function chooseLength(chosen: number) {
    const previous = lengthChoice;
    setLengthChoice(chosen);
    void updateProfile(profile.id, { usualSessionMinutes: chosen })
      .then((next) => {
        onProfileChange?.(next);
      })
      .catch(() => {
        // The write is the only record of this; if it did not land, the
        // selected pill must not keep claiming otherwise.
        setLengthChoice(previous);
      });
  }

  const nickname = profile.nickname ?? 'Your child';
  const companion = profile.context.companion;

  const header = (
    <header className="toki-dhead">
      {companion ? (
        <img
          className="toki-dhead-avatar"
          src={companion.photo}
          alt={`${companion.name}, ${nickname}'s companion`}
        />
      ) : (
        <span className="toki-dhead-avatar toki-dhead-avatar--empty" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M4.5 20c1.6-3.4 4.3-5.1 7.5-5.1s5.9 1.7 7.5 5.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
      <div className="toki-dhead-text">
        <span className="toki-dhead-label">Activity log</span>
        <h2 className="toki-dhead-name">{nickname}</h2>
      </div>
    </header>
  );

  if (!sessions) {
    return (
      <div className="screen dashboard">
        <Banner />
        {header}
        <p className="toki-dempty">Loading…</p>
      </div>
    );
  }

  const today = new Date();
  const week = weekStrip(sessions, today);
  const skills = skillProgress(sessions);
  // Two groups, not a ranked list: what is being done alone, and what
  // still has a hand on it. Both are facts from the ladder; neither is a
  // verdict on the child, and the order inside each is the ladder's.
  const unaided = skills.filter((skill) => skill.mastered);
  const withSupport = skills.filter((skill) => !skill.mastered);
  const recentGames = recentlyPlayedGames(sessions, RECENT_GAMES_LIMIT);

  // The day-detail panel's own figures -- same functions the "today"
  // figures above use, just handed whichever date is selected instead of
  // always today. Undefined/empty when nothing is selected, so this work
  // only happens on the day a caregiver actually asks for it.
  const selectedDate = selectedDayIso ? dateFromIso(selectedDayIso) : null;
  const selectedDaySeconds = selectedDate ? secondsPlayedOn(sessions, selectedDate) : 0;
  const selectedDaySlices = selectedDate ? timeByTrackOn(sessions, selectedDate) : [];
  const selectedDayTopSkill = selectedDate ? topSkillOn(sessions, selectedDate) : null;

  // The calendar itself, and the paging limits around it: never past the
  // current month (there is nothing to show there yet), never before the
  // month of the very first session (there is nothing to show there
  // either). No history at all means no "View more" to offer -- there
  // would be nothing behind it but empty months.
  const daysPracticed = totalDaysPracticed(sessions);
  const firstMonth = firstPlayedMonth(sessions);
  const currentMonthKey = today.getFullYear() * 12 + today.getMonth();
  const viewedMonthKey = viewedMonth.year * 12 + viewedMonth.month;
  const canGoNextMonth = viewedMonthKey < currentMonthKey;
  const canGoPrevMonth = firstMonth
    ? viewedMonthKey > firstMonth.year * 12 + firstMonth.month
    : false;
  const calendarDays = showCalendar
    ? monthGrid(sessions, viewedMonth.year, viewedMonth.month, today)
    : [];
  const calendarMonthLabel = new Date(viewedMonth.year, viewedMonth.month, 1).toLocaleDateString(
    undefined,
    { month: 'long', year: 'numeric' },
  );

  return (
    <div className="screen dashboard">
      <Banner />
      {header}

      {/* ---- This week ------------------------------------------------- */}
      <section className="toki-dcard">
        <h3 className="toki-dcard-title">This week</h3>
        <ul className="toki-week-grid">
          {week.map((cell) => {
            const isSelected = selectedDayIso === cell.iso;
            return (
              <li
                key={cell.iso}
                className={
                  cell.isToday ? 'toki-week-day toki-week-day--today' : 'toki-week-day'
                }
              >
                <span className="toki-week-day-label" aria-hidden="true">
                  {cell.label}
                </span>
                <button
                  type="button"
                  className={[
                    'toki-week-cell',
                    cell.played ? 'toki-week-cell--played' : '',
                    isSelected ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={isSelected}
                  aria-label={dayCellAriaLabel(cell.iso, cell.isToday, cell.played)}
                  {...(cell.isToday ? { 'aria-current': 'date' as const } : {})}
                  onClick={() =>
                    setSelectedDayIso((current) => (current === cell.iso ? null : cell.iso))
                  }
                >
                  {cell.played && <CheckMark />}
                </button>
              </li>
            );
          })}
        </ul>
        {daysPracticed > 0 && (
          <button
            type="button"
            className="toki-dlink"
            aria-expanded={showCalendar}
            onClick={() => setShowCalendar((open) => !open)}
          >
            {showCalendar ? 'Hide calendar' : 'View more'}
          </button>
        )}
      </section>

      {/* ---- Full-history calendar ("View more") -----------------------
          Same played/not-played fact the week strip shows, over every
          month there is history for instead of just the last seven days.
          Paging is capped at both ends: never past the current month, and
          never before the month of the very first-ever session. */}
      {showCalendar && (
        <section className="toki-dcard">
          <p className="toki-dfigure">
            <span className="toki-dfigure-value">{daysPracticed}</span>{' '}
            {daysPracticed === 1 ? 'day' : 'days'} learned
          </p>
          <div className="toki-cal-head">
            <button
              type="button"
              className="toki-cal-nav"
              disabled={!canGoPrevMonth}
              onClick={() => shiftViewedMonth(-1)}
              aria-label="Previous month"
            >
              <CalendarNavIcon direction="prev" />
            </button>
            <h3 className="toki-dcard-title toki-cal-month">
              {calendarMonthLabel}
            </h3>
            <button
              type="button"
              className="toki-cal-nav"
              disabled={!canGoNextMonth}
              onClick={() => shiftViewedMonth(1)}
              aria-label="Next month"
            >
              <CalendarNavIcon direction="next" />
            </button>
          </div>
          <div className="toki-cal-grid">
            {calendarWeekdayLabels().map((label, i) => (
              <span key={i} className="toki-cal-weekday" aria-hidden="true">
                {label}
              </span>
            ))}
            {calendarDays.map((day) => (
              <CalendarDayCell
                key={day.iso}
                day={day}
                selected={selectedDayIso === day.iso}
                onSelect={() =>
                  setSelectedDayIso((current) => (current === day.iso ? null : day.iso))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- Day detail -------------------------------------------------
          Defaults OPEN on today (see selectedDayIso's initial state
          above) -- this IS "played today", not a duplicate of it, which
          is why there is no separate standalone figure for that any
          more. Same day-math as "Time by track, today" below, just aimed
          at whichever day was tapped -- in the week strip or the
          calendar -- instead of always today. A quiet day gets the same
          neutral "nothing played" line the other empty states on this
          screen use -- no arithmetic, no colour, that treats it as a gap
          (see this file's own header comment). */}
      {selectedDayIso && (
        <section className="toki-dcard toki-dday">
          <div className="toki-dday-head">
            <h3 className="toki-dcard-title">{spokenDate(selectedDayIso)}</h3>
            <button
              type="button"
              className="toki-dday-close"
              onClick={() => setSelectedDayIso(null)}
              aria-label="Close this day's summary"
            >
              <CloseIcon />
            </button>
          </div>

          {selectedDaySeconds === 0 ? (
            <p className="toki-dempty">Nothing played this day.</p>
          ) : (
            <>
              <div className="toki-dmetric">
                <span className="toki-dmetric-label">Played</span>
                <span className="toki-dmetric-value">
                  {minutes(selectedDaySeconds)}
                  <span className="toki-dmetric-unit">min</span>
                </span>
              </div>

              {selectedDayTopSkill && (
                <p className="toki-dcaption">
                  Most trained: {selectedDayTopSkill.skillName} ({selectedDayTopSkill.recordCount}
                  {selectedDayTopSkill.recordCount === 1 ? ' rep' : ' reps'} today)
                </p>
              )}

              {selectedDaySlices.length > 0 && (
                <>
                  <div
                    className="toki-dbar"
                    role="img"
                    aria-label={selectedDaySlices
                      .map((s) => `${s.label}, ${minutes(s.seconds)} minutes, ${s.sharePercent}%`)
                      .join('. ')}
                  >
                    {selectedDaySlices.map((slice) => (
                      <span
                        key={slice.track}
                        className="toki-dbar-seg"
                        style={{
                          flexGrow: slice.sharePercent,
                          background: `var(${slice.colorVar})`,
                        }}
                      />
                    ))}
                  </div>
                  <ul className="toki-dlist">
                    {selectedDaySlices.map((slice, i) => (
                      <DayTrackRow
                        key={slice.track}
                        slice={slice}
                        isTopPlayed={i === 0 && selectedDaySlices.length > 1}
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* ---- Usual session length -------------------------------------- */}
      <section className="toki-dcard">
        <h3 className="toki-dcard-title" id="dashboard-length-title">
          Usual session length
        </h3>
        <p className="toki-dcaption">
          Not a target to reach. It only sets where the next session&rsquo;s timer starts —
          sittings shorten on their own from there, session by session.
        </p>
        <div
          className="dashboard-length-row"
          role="group"
          aria-labelledby="dashboard-length-title"
        >
          {SESSION_LENGTH_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={
                option === lengthChoice
                  ? 'dashboard-length-option is-selected'
                  : 'dashboard-length-option'
              }
              aria-pressed={option === lengthChoice}
              onClick={() => chooseLength(option)}
            >
              <span className="dashboard-length-value">{option}</span>
              <span className="dashboard-length-unit">min</span>
            </button>
          ))}
        </div>
      </section>

      {/* ---- Skills and support ---------------------------------------- */}
      <section className="toki-dcard">
        <h3 className="toki-dcard-title">Skills and support</h3>
        <p className="toki-dcaption">
          Where each activity sits on the support ladder right now, from the tier you pick
          after a sitting. Most unaided first.
        </p>
        {skills.length === 0 ? (
          <p className="toki-dempty">
            Nothing logged yet. Activities appear here once {nickname} has played one.
          </p>
        ) : (
          <>
            {unaided.length > 0 && (
              <>
                <p className="toki-dgroup-label">On their own</p>
                <ul className="toki-dlist">
                  {unaided.map((skill) => (
                    <SkillRow key={skill.id} skill={skill} />
                  ))}
                </ul>
              </>
            )}
            {withSupport.length > 0 && (
              <>
                <p className="toki-dgroup-label">With a hand, for now</p>
                <ul className="toki-dlist">
                  {withSupport.map((skill) => (
                    <SkillRow key={skill.id} skill={skill} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {/* ---- Recently played ------------------------------------------- */}
      <section className="toki-dcard">
        <h3 className="toki-dcard-title">Recently played</h3>
        {recentGames.length === 0 ? (
          <p className="toki-dempty">
            Nothing logged yet. Games appear here once {nickname} has played one.
          </p>
        ) : (
          <ul className="toki-dlist">
            {recentGames.map((game) => (
              <li key={game.track} className="toki-list-row">
                <span
                  className="toki-list-icon toki-drecent-icon"
                  style={{ color: `var(${game.colorVar})` }}
                  aria-hidden="true"
                >
                  {TRACK_THUMBNAIL[game.track]}
                </span>
                <span className="toki-list-title">{game.label}</span>
                <button
                  type="button"
                  className="toki-drecent-view"
                  onClick={() => onPlayTrack(game.track)}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
