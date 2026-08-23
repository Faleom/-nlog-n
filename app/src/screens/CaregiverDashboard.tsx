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
// Visual system: DESIGN-TOKENS §4.2 -- caregiver glass, --glass-bg-strong
// at --radius-md with the Periwink tint, muted secondary text, and none of
// the reserved hues (§4.3 keeps Sunburst/Blush/Ember off this side, which
// is also why the track colours are a violet-cool family and nothing here
// can read as red/green judgement). The mockup asks for six sections where
// §4.2 suggests three to five cards; that is a knowing deviation, held in
// check by keeping every card a flat list rather than a dense panel.

import { useEffect, useState } from 'react';
import { getSessionsForChild, updateProfile } from '../engine/profileStore';
import { NON_DIAGNOSTIC_BANNER } from '../engine/caregiverDashboard';
import {
  SESSION_LENGTH_OPTIONS,
  longestFocusOn,
  recentSessions,
  secondsPlayedOn,
  skillProgress,
  timeByTrackOn,
  usualSessionMinutes,
  weekStrip,
  type SkillProgressRow,
  type TrackSlice,
} from '../engine/dashboardSummary';
import type { ChildProfile, SessionLog, SupportTier, TrackId } from '../types';

interface CaregiverDashboardProps {
  profile: ChildProfile;
  /** So App's copy of the profile stays in step when the session-length
   * preference is saved -- the games read it on their next launch. */
  onProfileChange?: (profile: ChildProfile) => void;
}

const RECENT_LIMIT = 5;

function Banner() {
  return <p className="dashboard-banner">{NON_DIAGNOSTIC_BANNER}</p>;
}

/** Whole minutes, or "<1" for a sitting that ended before the first
 * minute -- rounding that to "0" would report a real session as nothing. */
function minutes(seconds: number): string {
  if (seconds === 0) return '0';
  if (seconds < 60) return '<1';
  return String(Math.round(seconds / 60));
}

/** `YYYY-MM-DD` -> "Monday 24 August", built from the parts rather than
 * `new Date(iso)`: that parses a bare date string as UTC midnight, which
 * is the day before anywhere west of Greenwich. */
function spokenDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={open ? 'dashboard-chevron is-open' : 'dashboard-chevron'} aria-hidden="true">
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
        <path
          d="M4.25 2 L8.25 6 L4.25 10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Where an activity sits on F.010's five-tier ladder, drawn as five
 * steps with the tier filled up to. More filled = less help needed, which
 * is the direction the ladder itself runs. The tier's NAME is written out
 * beside it in every row, so nothing here is carried by the shape alone. */
function LadderMeter({ tier, tierName }: { tier: SupportTier; tierName: string }) {
  return (
    <span
      className="dashboard-ladder"
      role="img"
      aria-label={`${tierName}: step ${tier} of 5 on the support ladder`}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={step <= tier ? 'dashboard-ladder-step is-filled' : 'dashboard-ladder-step'}
        />
      ))}
    </span>
  );
}

function SkillRow({ skill }: { skill: SkillProgressRow }) {
  return (
    <li className="dashboard-skill-row">
      <span className={skill.mastered ? 'dashboard-mark is-complete' : 'dashboard-mark'} aria-hidden="true">
        {skill.mastered && <CheckMark />}
      </span>
      <span className="dashboard-skill-text">
        <span className="dashboard-skill-name">{skill.name}</span>
        <span className="dashboard-skill-meta">
          <LadderMeter tier={skill.tier} tierName={skill.tierName} />
          <span className="dashboard-skill-context">
            {skill.tierName} · {skill.contextsIndependent} of {skill.contextsSeen}{' '}
            {skill.contextsSeen === 1 ? 'place' : 'places'} alone ·{' '}
            {skill.recordCount} {skill.recordCount === 1 ? 'sitting' : 'sittings'} logged
          </span>
        </span>
      </span>
    </li>
  );
}

export function CaregiverDashboard({ profile, onProfileChange }: CaregiverDashboardProps) {
  const [sessions, setSessions] = useState<SessionLog[] | null>(null);
  const [lengthChoice, setLengthChoice] = useState(usualSessionMinutes(profile));
  const [openTrack, setOpenTrack] = useState<TrackId | null>(null);

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
    <header className="dashboard-head">
      <div className="dashboard-head-text">
        <span className="dashboard-head-label">Activity log</span>
        <h2 className="dashboard-head-name">{nickname}</h2>
      </div>
      {companion ? (
        <img
          className="dashboard-avatar"
          src={companion.photo}
          alt={`${companion.name}, ${nickname}'s companion`}
        />
      ) : (
        <span className="dashboard-avatar dashboard-avatar--empty" aria-hidden="true">
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
    </header>
  );

  if (!sessions) {
    return (
      <div className="screen dashboard">
        <Banner />
        {header}
        <p className="dashboard-empty">Loading…</p>
      </div>
    );
  }

  const today = new Date();
  const week = weekStrip(sessions, today);
  const playedTodaySeconds = secondsPlayedOn(sessions, today);
  const focusTodaySeconds = longestFocusOn(sessions, today);
  const slices = timeByTrackOn(sessions, today);
  const skills = skillProgress(sessions);
  // Two groups, not a ranked list: what is being done alone, and what
  // still has a hand on it. Both are facts from the ladder; neither is a
  // verdict on the child, and the order inside each is the ladder's.
  const unaided = skills.filter((skill) => skill.mastered);
  const withSupport = skills.filter((skill) => !skill.mastered);
  const recent = recentSessions(sessions, RECENT_LIMIT);

  return (
    <div className="screen dashboard">
      <Banner />
      {header}

      {/* ---- This week ------------------------------------------------- */}
      <section className="dashboard-card">
        <h3 className="dashboard-card-title">This week</h3>
        <ul className="dashboard-week">
          {week.map((cell) => (
            <li key={cell.iso} className="dashboard-week-cell">
              <span className="dashboard-week-label" aria-hidden="true">
                {cell.label}
              </span>
              <span
                className={[
                  'dashboard-week-box',
                  cell.played ? 'is-played' : '',
                  cell.isToday ? 'is-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="img"
                aria-label={`${spokenDate(cell.iso)}${cell.isToday ? ', today' : ''}: ${
                  cell.played ? 'a session happened' : 'no session'
                }`}
                {...(cell.isToday ? { 'aria-current': 'date' as const } : {})}
              >
                {cell.played && <CheckMark />}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Usual session length -------------------------------------- */}
      <section className="dashboard-card">
        <h3 className="dashboard-card-title" id="dashboard-length-title">
          Usual session length
        </h3>
        <p className="dashboard-caption">
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

      {/* ---- Today's two figures --------------------------------------- */}
      <div className="dashboard-metrics">
        <div className="dashboard-card dashboard-metric">
          <span className="dashboard-metric-label">Played today</span>
          <span className="dashboard-metric-value">
            {minutes(playedTodaySeconds)}
            <span className="dashboard-metric-unit">min</span>
          </span>
        </div>
        <div className="dashboard-card dashboard-metric">
          <span className="dashboard-metric-label">Longest focus</span>
          <span className="dashboard-metric-value">
            {minutes(focusTodaySeconds)}
            <span className="dashboard-metric-unit">min</span>
          </span>
        </div>
      </div>

      {/* ---- Time by track, today -------------------------------------- */}
      <section className="dashboard-card">
        <h3 className="dashboard-card-title">Time by track, today</h3>
        {slices.length === 0 ? (
          <p className="dashboard-empty">Nothing played yet today.</p>
        ) : (
          <>
            <div
              className="dashboard-bar"
              role="img"
              aria-label={slices
                .map((s) => `${s.label}, ${minutes(s.seconds)} minutes, ${s.sharePercent}%`)
                .join('. ')}
            >
              {slices.map((slice) => (
                <span
                  key={slice.track}
                  className="dashboard-bar-segment"
                  style={{
                    flexGrow: slice.sharePercent,
                    background: `var(${slice.colorVar})`,
                  }}
                />
              ))}
            </div>
            <ul className="dashboard-list">
              {slices.map((slice) => (
                <TrackRow
                  key={slice.track}
                  slice={slice}
                  open={openTrack === slice.track}
                  onToggle={() =>
                    setOpenTrack((current) => (current === slice.track ? null : slice.track))
                  }
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---- Skills and support ---------------------------------------- */}
      <section className="dashboard-card">
        <h3 className="dashboard-card-title">Skills and support</h3>
        <p className="dashboard-caption">
          Where each activity sits on the support ladder right now, from the tier you pick
          after a sitting. Most unaided first.
        </p>
        {skills.length === 0 ? (
          <p className="dashboard-empty">
            Nothing logged yet. Activities appear here once {nickname} has played one.
          </p>
        ) : (
          <>
            {unaided.length > 0 && (
              <>
                <p className="dashboard-group-label">On their own</p>
                <ul className="dashboard-list">
                  {unaided.map((skill) => (
                    <SkillRow key={skill.id} skill={skill} />
                  ))}
                </ul>
              </>
            )}
            {withSupport.length > 0 && (
              <>
                <p className="dashboard-group-label">With a hand, for now</p>
                <ul className="dashboard-list">
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
      <section className="dashboard-card">
        <h3 className="dashboard-card-title">Recently played</h3>
        {recent.length === 0 ? (
          <p className="dashboard-empty">Nothing logged yet.</p>
        ) : (
          <ul className="dashboard-list">
            {recent.map((entry) => (
              <li key={entry.id} className="dashboard-recent-row">
                <span className="dashboard-recent-text">
                  <span className="dashboard-recent-name">{entry.label}</span>
                  {entry.detail && (
                    <span className="dashboard-recent-detail">{entry.detail}</span>
                  )}
                </span>
                <span className="dashboard-figure-value">{minutes(entry.seconds)} min</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One track's row under the bar. The chevron is real: it opens the
 * sitting-by-sitting breakdown behind that segment, which is the only
 * place the "three sittings, not one" detail exists. A chevron that
 * navigated nowhere would be a lie about what the row does. */
function TrackRow({
  slice,
  open,
  onToggle,
}: {
  slice: TrackSlice;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="dashboard-track-row">
      <button type="button" className="dashboard-track-toggle" aria-expanded={open} onClick={onToggle}>
        <span
          className="dashboard-dot"
          style={{ background: `var(${slice.colorVar})` }}
          aria-hidden="true"
        />
        <span className="dashboard-track-text">
          <span className="dashboard-track-name">{slice.label}</span>
          {slice.detail && <span className="dashboard-track-detail">{slice.detail}</span>}
        </span>
        <span className="dashboard-figure-value">{minutes(slice.seconds)} min</span>
        <Chevron open={open} />
      </button>
      {open && (
        <p className="dashboard-track-expanded">
          {slice.sessionCount === 1
            ? 'One sitting today.'
            : `${slice.sessionCount} sittings today.`}{' '}
          {slice.sharePercent}% of today&rsquo;s time.
        </p>
      )}
    </li>
  );
}
