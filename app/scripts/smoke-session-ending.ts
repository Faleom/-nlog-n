// Real functional check for the end of a session: every game stops after a
// planned number of rounds, and says what the child just did.
// Run with: npm run smoke:session-ending
//
// Two halves, matching how this repo tests everything else: the wording
// rules run against the pure module, and the "does the game actually stop"
// rules are static checks over each game's source, since there is no DOM
// harness here.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import { describeAchievement, spokenAchievement } from '../src/games/sessionEndingLogic';
import { INTERACTION_CONFIG } from '../src/config/interaction';
import type { SessionLog, SupportTier, TrackId } from '../src/types';

function codeOnlyLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
}

function sessionWith(tiers: SupportTier[]): SessionLog {
  return {
    id: 's1',
    childId: 'c1',
    startedAt: new Date().toISOString(),
    durationSeconds: 300,
    activitiesRun: tiers.length,
    movementBreaks: 0,
    longestFocusStretchSeconds: 120,
    endedBy: 'finished',
    skillRecords: tiers.map((tier, i) => ({
      skillId: `skill-${i}`,
      context: 'living-room',
      supportTier: tier,
      onScreenTier: 0 as const,
      prompted: false,
      timestamp: new Date().toISOString(),
    })),
  };
}

async function main() {
  section('session ending — the line the child gets, per game');

  await test('each game names what was actually done, in its own words', () => {
    const five = sessionWith([5, 5, 5, 5, 5]);
    const expected: Record<TrackId, string> = {
      'find-it': '5 things found!',
      story: '5 stories put in order!',
      match: '5 pictures matched!',
      trace: '5 shapes traced and coloured!',
    };
    for (const [track, headline] of Object.entries(expected)) {
      assert.equal(describeAchievement(five, track as TrackId).headline, headline);
    }
  });

  await test('one round is singular, not "1 shapes"', () => {
    assert.equal(describeAchievement(sessionWith([5]), 'trace').headline, '1 shape traced and coloured!');
    assert.equal(describeAchievement(sessionWith([5]), 'find-it').headline, '1 thing found!');
  });

  await test('all-independent says so; a mix reports the real split', () => {
    assert.equal(describeAchievement(sessionWith([5, 5, 5]), 'match').detail, 'Every one on their own.');
    assert.equal(describeAchievement(sessionWith([5, 3, 5]), 'match').detail, '2 of 3 on their own.');
    assert.equal(describeAchievement(sessionWith([5]), 'match').detail, 'All on their own.');
  });

  await test('a session that needed help all the way through still gets its ending', () => {
    const helped = describeAchievement(sessionWith([1, 2, 3]), 'trace');
    assert.equal(helped.headline, '3 shapes traced and coloured!');
    // Named in the ladder's own words, with nothing that reads as a shortfall.
    assert.match(helped.detail ?? '', /^Together, with gesture help\.$/);
  });

  await test('nothing in the wording is a target, a total or a comparison', () => {
    const lines = [
      ...[0, 1, 3, 5].map((n) => spokenAchievement(sessionWith(Array(n).fill(5) as SupportTier[]), 'match')),
      ...[0, 1, 3, 5].map((n) => spokenAchievement(sessionWith(Array(n).fill(2) as SupportTier[]), 'find-it')),
    ];
    for (const line of lines) {
      assert.ok(
        !/\bscore\b|\bpoints?\b|\bstars?\b|\bgoal\b|\btarget\b|\brecord\b|\bbest\b|\blast time\b|\bmore than\b/i.test(
          line,
        ),
        line,
      );
    }
  });

  await test('a session with nothing logged says so plainly rather than inventing a figure', () => {
    const empty = describeAchievement(sessionWith([]), 'find-it');
    assert.equal(empty.headline, 'All done!');
    assert.equal(empty.detail, null);
  });

  section('session ending — every game stops on its own');

  const games = {
    'Game1.tsx': 'find-it',
    'Game2.tsx': 'story',
    Game3ShadowMatch: 'match',
    'TraceAndColour.tsx': 'trace',
  };

  function read(file: string): string {
    return readFileSync(new URL(`../src/games/${file}`, import.meta.url), 'utf8');
  }

  await test('all four games end their session and show the shared celebration', () => {
    for (const file of ['Game1.tsx', 'Game2.tsx', 'Game3ShadowMatch.tsx', 'TraceAndColour.tsx']) {
      const code = codeOnlyLines(read(file));
      assert.match(code, /<SessionCelebration/, file);
      assert.match(code, /'finished'/, `${file} never ends a session as finished`);
    }
  });

  await test('each game passes its own track, so the wording matches the game', () => {
    for (const [file, track] of Object.entries(games)) {
      const name = file.endsWith('.tsx') ? file : `${file}.tsx`;
      assert.match(read(name), new RegExp(`track="${track}"`), name);
    }
  });

  await test('the three round-based games stop at the shared round plan', () => {
    for (const file of ['Game1.tsx', 'Game3ShadowMatch.tsx']) {
      const code = codeOnlyLines(read(file));
      assert.match(code, /INTERACTION_CONFIG\.ROUNDS_PER_SESSION/, file);
    }
    // Trace and Colour reaches the same number through its own logic
    // module, which is where its round plan already lived.
    const trace = codeOnlyLines(read('TraceAndColour.tsx'));
    assert.match(trace, /isSessionFinished\(/);
  });

  await test('the round plan is one number, shared, not four copies', async () => {
    const { ROUNDS_PER_SESSION } = await import('../src/games/trace/traceLogic');
    assert.equal(ROUNDS_PER_SESSION, INTERACTION_CONFIG.ROUNDS_PER_SESSION);
    assert.equal(INTERACTION_CONFIG.ROUNDS_PER_SESSION, 5);
  });

  section('session ending — the caregiver plumbing is off the child’s screen');

  await test('no game prints the session number, cap or elapsed seconds any more', () => {
    for (const file of ['Game1.tsx', 'Game2.tsx', 'Game3ShadowMatch.tsx', 'TraceAndColour.tsx']) {
      const code = codeOnlyLines(read(file));
      assert.ok(!/cap \{|elapsed \{|elapsed \{elapsedSeconds\}/i.test(code), file);
      assert.ok(!/Session \{sessionNumber\}/.test(code), file);
    }
  });

  await test('no game still renders the old caregiver session recap', () => {
    for (const file of ['Game1.tsx', 'Game3ShadowMatch.tsx', 'TraceAndColour.tsx']) {
      const code = codeOnlyLines(read(file));
      assert.ok(!/describeSessionRecap|Session recap/.test(code), file);
    }
  });

  await test('the celebration respects reduced motion rather than shortening the animation', () => {
    const code = readFileSync(new URL('../src/games/SessionCelebration.tsx', import.meta.url), 'utf8');
    assert.match(code, /prefers-reduced-motion: reduce/);
    assert.match(code, /\.celebrate-piece \{ display: none; \}/);
  });

  await test('the celebration says the line out loud, not only on screen', () => {
    const code = readFileSync(new URL('../src/games/SessionCelebration.tsx', import.meta.url), 'utf8');
    assert.match(code, /adapters\.speechOut\.say/);
  });

  summarize();
}

void main();
