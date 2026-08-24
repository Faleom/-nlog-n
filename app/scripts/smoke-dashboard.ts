// Real functional check for the rebuilt caregiver dashboard.
// Run with: npm run smoke:dashboard
//
// Same shape as smoke-f019.ts (which still guards the F.019 rules this
// screen inherited): populate REAL sessions through the real profileStore,
// then call the exact functions CaregiverDashboard.tsx renders against.
// No DOM harness exists in this repo, so the static checks at the bottom
// read the component source directly -- that is how every other
// "the UI must never say X" rule here is enforced.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import type { SessionLog } from '../src/types';

function codeOnlyLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
}

/** An ISO timestamp N days before `base`, at a fixed local hour so the
 * day-bucketing is tested in LOCAL time (what the caregiver sees) rather
 * than accidentally passing because everything sat at UTC noon. */
function daysAgo(base: Date, n: number, hour = 10): string {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  const store = await import('../src/engine/profileStore');
  const {
    weekStrip,
    secondsPlayedOn,
    topSkillOn,
    timeByTrackOn,
    recentSessions,
    skillProgress,
    usualSessionMinutes,
    SESSION_LENGTH_OPTIONS,
  } = await import('../src/engine/dashboardSummary');
  const { TRACKS, getTrack } = await import('../src/config/tracks');
  const { sessionCapMinutes } = await import('../src/config/interaction');

  const today = new Date();

  section('dashboard — a session records which track it belongs to');

  const profile = await store.createProfile({ ageMonths: 44, nickname: 'Maya' });

  await test('startSession stores the track it was started from', async () => {
    const s = await store.startSession(profile.id, 'find-it');
    const [saved] = (await store.getSessionsForChild(profile.id)).filter((x) => x.id === s.id);
    assert.equal(saved.track, 'find-it');
  });

  await test('every track id in TRACKS has a label and a colour token', () => {
    assert.ok(TRACKS.length >= 4);
    for (const track of TRACKS) {
      assert.ok(track.label.length > 0, track.id);
      assert.ok(track.colorVar.startsWith('--'), track.id);
      assert.equal(getTrack(track.id).label, track.label);
    }
  });

  // ---------------------------------------------------------------------
  // A second child with a hand-built history, so every figure below has a
  // known right answer.
  // ---------------------------------------------------------------------
  const child = await store.createProfile({ ageMonths: 50, nickname: 'Sam' });

  // The day-bucketing, share and skill functions are all pure over
  // SessionLog[], so the history below is built as real SessionLog values
  // rather than by driving the store and then rewriting its clock. That
  // keeps a "for tests only" timing setter out of profileStore entirely.
  // The store IS exercised for the three things only it can prove: the
  // track is persisted, mastery reflects newly written records, and the
  // session-length preference survives a reload.
  type Track = 'find-it' | 'story' | 'match' | 'trace';
  let n = 0;
  function session(opts: {
    track: Track;
    startedAt: string;
    durationSeconds: number;
    skills?: { skillId: string; context: string; supportTier: 1 | 2 | 3 | 4 | 5 }[];
  }): SessionLog {
    return {
      id: `s${(n += 1)}`,
      childId: child.id,
      startedAt: opts.startedAt,
      endedAt: opts.startedAt,
      durationSeconds: opts.durationSeconds,
      activitiesRun: opts.skills?.length ?? 0,
      movementBreaks: 0,
      skillRecords: (opts.skills ?? []).map((skill) => ({
        skillId: skill.skillId,
        context: skill.context,
        supportTier: skill.supportTier,
        onScreenTier: 0 as const,
        prompted: false,
        timestamp: opts.startedAt,
      })),
      endedBy: 'finished',
      track: opts.track,
    };
  }

  const sessions: SessionLog[] = [
    // Today: three sessions across two tracks.
    session({
      track: 'find-it',
      startedAt: daysAgo(today, 0, 9),
      durationSeconds: 8 * 60,
      skills: [
        { skillId: 'find-cup', context: 'kitchen', supportTier: 5 },
        { skillId: 'find-cup', context: 'bedroom', supportTier: 5 },
        { skillId: 'find-shoe', context: 'kitchen', supportTier: 3 },
      ],
    }),
    session({
      track: 'find-it',
      startedAt: daysAgo(today, 0, 11),
      durationSeconds: 4 * 60,
    }),
    session({
      track: 'match',
      startedAt: daysAgo(today, 0, 14),
      durationSeconds: 6 * 60,
      skills: [{ skillId: 'match-apple', context: 'living-room', supportTier: 4 }],
    }),
    // Three days ago: must never leak into a "today" figure.
    session({
      track: 'trace',
      startedAt: daysAgo(today, 3, 10),
      durationSeconds: 20 * 60,
    }),
  ];

  section('dashboard — this week strip');

  await test('a day is marked played only if a session log entry exists for that date', () => {
    const cells = weekStrip(sessions, today);
    assert.equal(cells.length, 7);
    const byIso = new Map(cells.map((c) => [c.iso, c]));
    const todayIso = cells[cells.length - 1].iso;
    assert.equal(byIso.get(todayIso)?.played, true);
    const threeAgo = cells[cells.length - 4];
    assert.equal(threeAgo.played, true, 'the session three days ago');
    const oneAgo = cells[cells.length - 2];
    assert.equal(oneAgo.played, false, 'yesterday had no session');
  });

  await test("today's cell is identifiable independent of whether it was played", () => {
    const withPlay = weekStrip(sessions, today);
    assert.equal(withPlay.filter((c) => c.isToday).length, 1);
    assert.equal(withPlay[withPlay.length - 1].isToday, true);

    const empty = weekStrip([], today);
    assert.equal(empty.filter((c) => c.isToday).length, 1);
    assert.equal(empty[empty.length - 1].isToday, true);
    assert.equal(empty[empty.length - 1].played, false);
  });

  await test('an unplayed day carries no failure flag of any kind — it is just not played', () => {
    const cells = weekStrip(sessions, today);
    for (const cell of cells) {
      assert.deepEqual(Object.keys(cell).sort(), ['isToday', 'iso', 'label', 'played']);
    }
  });

  section('dashboard — today figures');

  await test('"played today" sums across every session that day (and rounds once, at the end)', () => {
    assert.equal(secondsPlayedOn(sessions, today), (8 + 4 + 6) * 60);
  });

  await test('"top skill" picks the track with the most practice reps, not the most time', () => {
    // find-it logged 3 skill records today (across two sessions), match
    // logged 1 -- find-it wins on reps even though match's single session
    // ran nearly as long as find-it's two combined.
    const top = topSkillOn(sessions, today);
    assert.equal(top?.track, 'find-it');
    assert.equal(top?.recordCount, 3);
  });

  await test('yesterday, with no sessions, is zero rather than a carried-over figure', () => {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    assert.equal(secondsPlayedOn(sessions, yesterday), 0);
    assert.equal(topSkillOn(sessions, yesterday), null);
  });

  section('dashboard — time by track');

  await test('slices sum to 100% regardless of how many tracks have time logged', () => {
    for (const day of [today, new Date(daysAgo(today, 3))]) {
      const slices = timeByTrackOn(sessions, day);
      const total = slices.reduce((sum, s) => sum + s.sharePercent, 0);
      assert.equal(total, 100, `${slices.length} track(s)`);
    }
  });

  await test('one track with all the time gets exactly 100%, not 99 or 101', () => {
    const slices = timeByTrackOn(sessions, new Date(daysAgo(today, 3)));
    assert.equal(slices.length, 1);
    assert.equal(slices[0].sharePercent, 100);
  });

  await test('three uneven tracks still sum to exactly 100% (largest-remainder, no drift)', () => {
    const thirds = [1, 1, 1].map((_, i) => ({
      id: `x${i}`,
      childId: child.id,
      startedAt: daysAgo(today, 0, 8),
      durationSeconds: 100,
      activitiesRun: 0,
      movementBreaks: 0,
      skillRecords: [],
      endedBy: 'finished' as const,
      track: (['find-it', 'match', 'trace'] as const)[i],
    }));
    const slices = timeByTrackOn(thirds, today);
    assert.equal(slices.length, 3);
    assert.equal(
      slices.reduce((sum, s) => sum + s.sharePercent, 0),
      100,
    );
  });

  await test('a track with zero time today is absent entirely — no zero-width sliver to draw', () => {
    const slices = timeByTrackOn(sessions, today);
    assert.deepEqual(
      slices.map((s) => s.track).sort(),
      ['find-it', 'match'],
      'trace played three days ago, not today',
    );
    for (const slice of slices) {
      assert.ok(slice.seconds > 0);
      assert.ok(slice.sharePercent > 0);
    }
  });

  await test('slices are ordered longest-first and carry the track label and colour', () => {
    const slices = timeByTrackOn(sessions, today);
    assert.equal(slices[0].track, 'find-it');
    assert.equal(slices[0].seconds, 12 * 60);
    assert.equal(slices[0].label, getTrack('find-it').label);
    assert.equal(slices[0].colorVar, getTrack('find-it').colorVar);
  });

  await test('the subtitle names what was actually played, from the session’s own records', () => {
    const slices = timeByTrackOn(sessions, today);
    const match = slices.find((s) => s.track === 'match');
    assert.ok(match?.detail?.includes('apple'), match?.detail ?? 'no detail');
  });

  section('dashboard — skills');

  await test('one row per ACTIVITY capability, not one row per object touched', () => {
    const rows = skillProgress(sessions);
    // find-it logged find-cup and find-shoe; both are the same capability
    // meeting different objects, so they are one row, not two.
    assert.deepEqual(
      rows.map((r) => r.id).sort(),
      ['find-it', 'match'],
      'trace logged no skill records, so it has nothing to claim',
    );
    assert.equal(rows.find((r) => r.id === 'match')?.name, getTrack('match').skill);
    assert.equal(rows.find((r) => r.id === 'find-it')?.name, getTrack('find-it').skill);
    assert.equal(skillProgress([]).length, 0);
  });

  await test('no row names a raw skill id — the caregiver never sees "match apple"', () => {
    for (const row of skillProgress(sessions)) {
      assert.ok(!/-/.test(row.name), row.name);
      assert.ok(!/apple|cup|shoe/i.test(row.name), row.name);
    }
  });

  await test('an activity independent in every place it was tried reads as mastered', () => {
    const nowIndependent = [
      ...sessions,
      session({
        track: 'find-it',
        startedAt: daysAgo(today, 0, 15),
        durationSeconds: 60,
        skills: [{ skillId: 'find-shoe', context: 'kitchen', supportTier: 5 }],
      }),
    ];
    const row = skillProgress(nowIndependent).find((r) => r.id === 'find-it');
    assert.equal(row?.mastered, true);
    assert.equal(row?.contextsIndependent, 2);
    assert.equal(row?.contextsSeen, 2);
    assert.equal(row?.supportNote, null);
  });

  await test('a partly-mastered activity reports the support it still needs, in the ladder’s own words', () => {
    const row = skillProgress(sessions).find((r) => r.id === 'find-it');
    assert.equal(row?.mastered, false);
    assert.equal(row?.contextsIndependent, 1, 'independent in the bedroom, not the kitchen');
    assert.equal(row?.contextsSeen, 2);
    assert.match(row?.supportNote ?? '', /gesture/i);
  });

  await test('mastery reflects the records that exist — a new independent one changes the row', () => {
    const before = skillProgress(sessions).find((r) => r.id === 'match');
    assert.equal(before?.mastered, false);
    const withNewRecord = [
      ...sessions,
      session({
        track: 'match',
        startedAt: daysAgo(today, 0, 16),
        durationSeconds: 60,
        skills: [{ skillId: 'match-apple', context: 'living-room', supportTier: 5 }],
      }),
    ];
    const after = skillProgress(withNewRecord).find((r) => r.id === 'match');
    assert.equal(after?.mastered, true);
  });

  await test('a session logged before tracks existed is left out rather than guessed at', () => {
    const untracked = session({
      track: 'match',
      startedAt: daysAgo(today, 1, 10),
      durationSeconds: 5 * 60,
      skills: [{ skillId: 'legacy-skill', context: 'kitchen', supportTier: 5 }],
    });
    delete (untracked as { track?: unknown }).track;
    const rows = skillProgress([untracked]);
    assert.deepEqual(rows, []);
  });

  await test('rows come back most unaided first, so the strongest activity leads', () => {
    const rows = skillProgress(sessions);
    // match sits at Verbal (4), find-it at Gesture (3) because its kitchen
    // records still need a gesture.
    assert.deepEqual(
      rows.map((r) => r.id),
      ['match', 'find-it'],
    );
  });

  await test("each row reports its ladder step in the ladder's own words", () => {
    const rows = skillProgress(sessions);
    const findIt = rows.find((r) => r.id === 'find-it');
    const match = rows.find((r) => r.id === 'match');
    assert.equal(findIt?.tier, 3);
    assert.equal(findIt?.tierName, 'Gesture');
    assert.equal(match?.tier, 4);
    assert.equal(match?.tierName, 'Verbal');
  });

  await test('an activity is only as unaided as the place that still needs the most help', () => {
    const findIt = skillProgress(sessions).find((r) => r.id === 'find-it');
    // Independent in the bedroom, gesture in the kitchen -> the row reads
    // gesture, and still says 1 of 2 places alone rather than hiding it.
    assert.equal(findIt?.tier, 3);
    assert.equal(findIt?.contextsIndependent, 1);
    assert.equal(findIt?.contextsSeen, 2);
  });

  await test('a mastered activity sits at the top of the ladder with nothing left to note', () => {
    const nowIndependent = [
      ...sessions,
      session({
        track: 'find-it',
        startedAt: daysAgo(today, 0, 15),
        durationSeconds: 60,
        skills: [{ skillId: 'find-shoe', context: 'kitchen', supportTier: 5 }],
      }),
    ];
    const row = skillProgress(nowIndependent).find((r) => r.id === 'find-it');
    assert.equal(row?.tier, 5);
    assert.equal(row?.tierName, 'Independent');
    assert.equal(row?.supportNote, null);
    assert.equal(skillProgress(nowIndependent)[0].id, 'find-it', 'and it leads the list');
  });

  await test('how many sittings a row rests on is reported, not just its current tier', () => {
    const rows = skillProgress(sessions);
    assert.equal(rows.find((r) => r.id === 'find-it')?.recordCount, 3);
    assert.equal(rows.find((r) => r.id === 'match')?.recordCount, 1);
  });

  await test('a tier that moved DOWN is reported as plainly as one that moved up', () => {
    const steppedDown = [
      ...sessions,
      session({
        track: 'match',
        startedAt: daysAgo(today, 0, 17),
        durationSeconds: 60,
        skills: [{ skillId: 'match-apple', context: 'living-room', supportTier: 2 }],
      }),
    ];
    const row = skillProgress(steppedDown).find((r) => r.id === 'match');
    assert.equal(row?.tier, 2);
    assert.equal(row?.tierName, 'Partial physical');
    // No event, no flag, no separate shape for a step down -- the row says
    // where the child is now and nothing about the direction it came from.
    assert.deepEqual(Object.keys(row ?? {}).sort(), [
      'contextsIndependent',
      'contextsSeen',
      'id',
      'mastered',
      'name',
      'recordCount',
      'supportNote',
      'tier',
      'tierName',
    ]);
  });

  await test('the store round-trips a skill record into the same mastery answer', async () => {
    const live = await store.startSession(child.id, 'match');
    await store.appendSkillRecord(live.id, {
      skillId: 'store-round-trip',
      context: 'kitchen',
      supportTier: 5,
      onScreenTier: 0,
      prompted: false,
      timestamp: new Date().toISOString(),
    });
    const rows = skillProgress(await store.getSessionsForChild(child.id));
    const row = rows.find((r) => r.id === 'match');
    assert.equal(row?.mastered, true);
  });

  section('dashboard — recently played');

  await test('the most recent sessions come back newest-first, with track and time', () => {
    const recent = recentSessions(sessions, 3);
    assert.equal(recent.length, 3);
    assert.equal(recent[0].track, 'match');
    assert.equal(recent[0].minutes, 6);
    assert.equal(recent[0].label, getTrack('match').label);
    const times = recent.map((r) => r.startedAt);
    assert.deepEqual([...times].sort().reverse(), times);
  });

  section('dashboard — usual session length is a preference, not a goal');

  await test('the three offered lengths are the ones the picker renders', () => {
    assert.deepEqual([...SESSION_LENGTH_OPTIONS], [6, 12, 18]);
  });

  await test('a child with no preference set falls back to the existing first-session cap', () => {
    assert.equal(usualSessionMinutes(child), 12);
  });

  await test('the selection persists and is read back after a reload', async () => {
    await store.updateProfile(child.id, { usualSessionMinutes: 18 });
    const reloaded = await store.getProfile(child.id);
    assert.equal(usualSessionMinutes(reloaded!), 18);
  });

  await test('the preference only moves where the NEXT session starts — the fade still runs', () => {
    // Session 1 starts at the chosen length; every later session still
    // steps down by the existing decrement and still stops at the floor.
    assert.equal(sessionCapMinutes(1, 18), 18);
    assert.equal(sessionCapMinutes(2, 18), 17);
    assert.equal(sessionCapMinutes(20, 18), 6);
    assert.equal(sessionCapMinutes(1, 6), 6);
    assert.equal(sessionCapMinutes(3, 6), 6, 'never below the floor');
    // Unspecified behaves exactly as before this feature existed.
    assert.equal(sessionCapMinutes(1), 12);
    assert.equal(sessionCapMinutes(4), 9);
  });

  section('dashboard — the mechanics this screen must never grow back');

  const uiFiles = [
    '../src/screens/CaregiverDashboard.tsx',
    '../src/engine/dashboardSummary.ts',
    '../src/config/tracks.ts',
  ];

  await test('no streak, points, XP, badge or goal mechanic anywhere in the code', () => {
    for (const file of uiFiles) {
      const code = codeOnlyLines(readFileSync(new URL(file, import.meta.url), 'utf8'));
      assert.ok(
        !/\bstreaks?\b|\bpoints?\b|\bxp\b|\bbadges?\b|\bflame\b|\btrophy\b|\bdaily goal\b|\bgoals?\b/i.test(
          code,
        ),
        file,
      );
    }
  });

  await test('no score, percentile, rating or average-comparison language in the code', () => {
    for (const file of uiFiles) {
      const code = codeOnlyLines(readFileSync(new URL(file, import.meta.url), 'utf8'));
      assert.ok(
        !/\bscore\b|\bpercentile\b|\brating\b|\bgrade\b|composite|below average|above average/i.test(
          code,
        ),
        file,
      );
    }
  });

  await test('no judgement language about a quiet day', () => {
    for (const file of uiFiles) {
      const code = codeOnlyLines(readFileSync(new URL(file, import.meta.url), 'utf8'));
      assert.ok(
        !/\bmissed\b|\boops\b|\bfail(ed|ure)?\b|\bbroken\b|\bbetter\b|\bworse\b|\bdeclin/i.test(code),
        file,
      );
    }
  });

  await test('the non-diagnostic banner is still on every return path of the screen', () => {
    const source = readFileSync(
      new URL('../src/screens/CaregiverDashboard.tsx', import.meta.url),
      'utf8',
    );
    const bannerUsages = (source.match(/<Banner \/>/g) ?? []).length;
    assert.ok(bannerUsages >= 2, `found ${bannerUsages}`);
  });

  await test('every tappable control on the screen carries the 88px caregiver floor class', () => {
    const source = readFileSync(
      new URL('../src/screens/CaregiverDashboard.tsx', import.meta.url),
      'utf8',
    );
    const buttons = source.match(/<button[\s\S]*?>/g) ?? [];
    assert.ok(buttons.length > 0);
    for (const button of buttons) {
      assert.match(button, /className=/, button.slice(0, 80));
    }
    const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
    assert.match(css, /\.dashboard-length-option\s*\{[^}]*min-height:\s*88px/);
  });

  await test('nothing on this screen depends on a hover state to be usable', () => {
    const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
    const dashboardBlock = css.slice(
      css.indexOf('CAREGIVER DASHBOARD'),
      css.indexOf('.app--welcome'),
    );
    assert.ok(!/:hover/.test(dashboardBlock), 'a :hover rule appeared in the dashboard block');
  });

  summarize();
}

void main();
