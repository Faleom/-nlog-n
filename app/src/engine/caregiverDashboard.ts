// F.019 — Caregiver dashboard (minimal, Tier 2). Pure aggregation over
// REAL SessionLogs. See app-guide-v3-FINAL.md §7.9, §10, §13.
//
// No composite score, index, percentile or streak anywhere in this file —
// see the matching static check in scripts/smoke-f019.ts. §7.9's
// "shortening sessions is progress, not decline" is honoured here by NOT
// annotating the trend with any judgement at all — no up/down arrows, no
// colour coding, no "better than last time" comparison. Plain numbers,
// nothing interpreted (§10: interpreting a trend is how a log becomes a
// screening tool, which this must never be).

import type { SessionLog } from '../types';

/** §7.9's permanent banner. Rendered unconditionally by
 * CaregiverDashboard.tsx — not first-run only, no dismiss. */
export const NON_DIAGNOSTIC_BANNER = 'This is an activity log, not a clinical assessment.';

/** One row of the focus-stretch trend — session number (1-indexed,
 * chronological) and its longest sustained-attention stretch, in whole
 * minutes. The metric ADHD caregivers care about most (§7.9). */
export interface FocusStretchPoint {
  sessionNumber: number;
  startedAt: string;
  focusStretchMinutes: number;
  durationMinutes: number;
}

export function getFocusStretchTrend(sessions: SessionLog[]): FocusStretchPoint[] {
  const chronological = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return chronological.map((session, i) => ({
    sessionNumber: i + 1,
    startedAt: session.startedAt,
    focusStretchMinutes: Math.round(session.longestFocusStretchSeconds / 60),
    durationMinutes: Math.round(session.durationSeconds / 60),
  }));
}

/** Which skills reached independence (support tier 5), and in which
 * contexts — the generalization tracker (§7.9). Possible only because
 * content comes from the child's real environment; still just a plain
 * list, never a score. */
export interface GeneralizedSkill {
  skillId: string;
  contexts: string[];
}

export function getGeneralizedSkills(sessions: SessionLog[]): GeneralizedSkill[] {
  const bySkill = new Map<string, Set<string>>();
  for (const session of sessions) {
    for (const record of session.skillRecords) {
      if (record.supportTier !== 5) continue;
      const contexts = bySkill.get(record.skillId) ?? new Set<string>();
      contexts.add(record.context);
      bySkill.set(record.skillId, contexts);
    }
  }
  return [...bySkill.entries()]
    .map(([skillId, contexts]) => ({ skillId, contexts: [...contexts].sort() }))
    .sort((a, b) => a.skillId.localeCompare(b.skillId));
}

/** The session the "Recap" panel describes — the most recently STARTED
 * one, regardless of ordering in storage. */
export function mostRecentSession(sessions: SessionLog[]): SessionLog | undefined {
  if (sessions.length === 0) return undefined;
  return [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}
