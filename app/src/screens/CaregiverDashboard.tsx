// F.019 — Caregiver dashboard (minimal, Tier 2). Recap, focus-stretch
// trend, generalization list — using the REAL functions F.013 already
// built (describeSessionRecap, distinctSkillsThisSession) plus this
// file's own aggregation over getSessionsForChild's real SessionLogs.
//
// The non-diagnostic banner is rendered unconditionally, in every return
// path of this component (loading included) — not first-run only, no
// dismiss button, no "seen it" flag in storage. Phone layout: accordion,
// recap open by default (UI-STANDARDS.md).

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

function Banner() {
  return (
    <p style={{ fontSize: '0.8rem', opacity: 0.75, borderTop: '1px solid #ccc', paddingTop: 8 }}>
      {NON_DIAGNOSTIC_BANNER}
    </p>
  );
}

export function CaregiverDashboard({ profile }: CaregiverDashboardProps) {
  const [sessions, setSessions] = useState<SessionLog[] | null>(null);
  const [open, setOpen] = useState<OpenSections>({ recap: true, trend: false, skills: false });

  useEffect(() => {
    void getSessionsForChild(profile.id).then(setSessions);
  }, [profile.id]);

  if (!sessions) {
    return (
      <div className="screen">
        <Banner />
        <p>Loading…</p>
      </div>
    );
  }

  const latest = mostRecentSession(sessions);
  const trend = getFocusStretchTrend(sessions);
  const generalized = getGeneralizedSkills(sessions);

  return (
    <div className="screen">
      <Banner />

      <Accordion
        title="Recap"
        open={open.recap}
        onToggle={() => setOpen((o) => ({ ...o, recap: !o.recap }))}
      >
        {latest ? (
          <>
            <p>{describeSessionRecap(latest)}</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
              Skills touched: {distinctSkillsThisSession(latest).join(', ') || 'none yet'}
            </p>
          </>
        ) : (
          <p>No sessions logged yet.</p>
        )}
      </Accordion>

      <Accordion
        title="Focus-stretch trend"
        open={open.trend}
        onToggle={() => setOpen((o) => ({ ...o, trend: !o.trend }))}
      >
        {trend.length === 0 ? (
          <p>No sessions logged yet.</p>
        ) : (
          <ul>
            {trend.map((point) => (
              <li key={point.sessionNumber}>
                Session {point.sessionNumber}: longest focus stretch {point.focusStretchMinutes} min
                ({point.durationMinutes} min total)
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
          <p>No skills have reached independent yet — that&rsquo;s expected early on.</p>
        ) : (
          <ul>
            {generalized.map((g) => (
              <li key={g.skillId}>
                {g.skillId} — independent in {g.contexts.join(', ')}
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
    <div>
      <button onClick={onToggle} style={{ width: '100%', textAlign: 'left' }}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div style={{ padding: 8 }}>{children}</div>}
    </div>
  );
}
