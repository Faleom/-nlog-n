// F.019 — Caregiver dashboard (minimal, Tier 2). Recap, focus-stretch
// trend, generalization list — using the REAL functions F.013 already
// built (describeSessionRecap, distinctSkillsThisSession) plus this
// file's own aggregation over getSessionsForChild's real SessionLogs.
//
// The non-diagnostic banner is rendered unconditionally, in every return
// path of this component (loading included) — not first-run only, no
// dismiss button, no "seen it" flag in storage. Phone layout: accordion,
// recap open by default (UI-STANDARDS.md).
//
// Visual pass (Phase 2): the data, the aggregation and the accordion
// behaviour below are untouched; only the markup wrapping them changed.
// This is a CAREGIVER screen, so per DESIGN-TOKENS §4.2 it is denser than
// a child screen: three glass cards on --glass-bg-strong at --radius-md,
// Periwink tint, tight caregiver rhythm, muted secondary text — and none
// of the reserved hues (Sunburst/Blush) or child-side tokens, which §4.3
// forbids here outright. Every accordion header is a real 88x88 target
// (UI-STANDARDS, no exceptions); the browser-default triangle markers are
// now an inline SVG chevron so the affordance does not depend on a glyph
// falling through to the system font stack.

import { useEffect, useState, type ReactNode } from 'react';
import { getSessionsForChild } from '../engine/profileStore';
import { describeSessionRecap, distinctSkillsThisSession } from '../engine/sessionLifecycle';
import {
  NON_DIAGNOSTIC_BANNER,
  getFocusStretchTrend,
  getGeneralizedSkills,
  mostRecentSession,
} from '../engine/caregiverDashboard';
import type { ChildProfile, SessionLog } from '../types';

interface CaregiverDashboardProps {
  profile: ChildProfile;
}

interface OpenSections {
  recap: boolean;
  trend: boolean;
  skills: boolean;
}

// Permanent, undismissable, on every return path. Styled as a quiet
// standing note rather than a warning: it is a statement of what this
// screen IS, not an interruption, so it gets the muted ink and a plain
// left rule instead of any of the saturated hues.
function Banner() {
  return <p className="dashboard-banner">{NON_DIAGNOSTIC_BANNER}</p>;
}

export function CaregiverDashboard({ profile }: CaregiverDashboardProps) {
  const [sessions, setSessions] = useState<SessionLog[] | null>(null);
  const [open, setOpen] = useState<OpenSections>({ recap: true, trend: false, skills: false });

  useEffect(() => {
    void getSessionsForChild(profile.id).then(setSessions);
  }, [profile.id]);

  if (!sessions) {
    return (
      <div className="screen dashboard">
        <Banner />
        <p className="dashboard-empty">Loading…</p>
      </div>
    );
  }

  const latest = mostRecentSession(sessions);
  const trend = getFocusStretchTrend(sessions);
  const generalized = getGeneralizedSkills(sessions);

  return (
    <div className="screen dashboard">
      <Banner />

      <Accordion
        title="Recap"
        open={open.recap}
        onToggle={() => setOpen((o) => ({ ...o, recap: !o.recap }))}
      >
        {latest ? (
          <>
            <p className="dashboard-recap-line">{describeSessionRecap(latest)}</p>
            <p className="dashboard-meta">
              <span className="dashboard-meta-label">Skills touched</span>
              <span className="dashboard-meta-value">
                {distinctSkillsThisSession(latest).join(', ') || 'none yet'}
              </span>
            </p>
          </>
        ) : (
          <p className="dashboard-empty">No sessions logged yet.</p>
        )}
      </Accordion>

      <Accordion
        title="Focus-stretch trend"
        open={open.trend}
        onToggle={() => setOpen((o) => ({ ...o, trend: !o.trend }))}
      >
        {trend.length === 0 ? (
          <p className="dashboard-empty">No sessions logged yet.</p>
        ) : (
          // Plain numbers in a plain list, deliberately: no arrows, no
          // colour, no comparison between rows. §7.9 — a shorter session
          // is a fact, and annotating it would turn a log into a
          // screening tool. The layout below only lines the figures up.
          <ul className="dashboard-list">
            {trend.map((point) => (
              <li key={point.sessionNumber} className="dashboard-trend-row">
                <span className="dashboard-trend-session">Session {point.sessionNumber}</span>
                <span className="dashboard-trend-figures">
                  <span className="dashboard-figure">
                    <span className="dashboard-figure-value">{point.focusStretchMinutes} min</span>
                    <span className="dashboard-figure-caption">longest focus stretch</span>
                  </span>
                  <span className="dashboard-figure">
                    <span className="dashboard-figure-value">{point.durationMinutes} min</span>
                    <span className="dashboard-figure-caption">session total</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Accordion>

      <Accordion
        title="Generalization"
        open={open.skills}
        onToggle={() => setOpen((o) => ({ ...o, skills: !o.skills }))}
      >
        {generalized.length === 0 ? (
          <p className="dashboard-empty">
            No skills have reached independent yet. That&rsquo;s expected early on.
          </p>
        ) : (
          <ul className="dashboard-list">
            {generalized.map((g) => (
              <li key={g.skillId} className="dashboard-skill-row">
                <span className="dashboard-skill-name">{g.skillId}</span>
                <span className="dashboard-figure-caption">Independent in</span>
                <span className="dashboard-context-chips">
                  {g.contexts.map((context) => (
                    <span key={context} className="dashboard-chip">
                      {context}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Accordion>
    </div>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="dashboard-card">
      <button
        type="button"
        className="dashboard-card-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="dashboard-card-title">{title}</span>
        <span
          className={open ? 'dashboard-chevron is-open' : 'dashboard-chevron'}
          aria-hidden="true"
        >
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
      </button>
      {open && <div className="dashboard-card-body">{children}</div>}
    </section>
  );
}
