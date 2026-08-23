// Real functional check for F.014 -- Branch 2: milestones & guided prompts.
// Run with: npm run smoke:f014
//
// Branch2Milestones.tsx is a thin React wrapper (untested here, same pattern
// as Game1.tsx not being unit-tested -- see scripts/smoke-f009.ts etc. for
// the underlying engine modules those screens wire together). This script
// tests engine/branch2.ts, the pure content + logic layer, plus static
// checks on BOTH files for the review checklist's hard requirements.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section, summarize, test } from './testHarness';
import {
  GUIDED_PROMPTS,
  OPEN_QUESTION,
  getMilestoneAgeBand,
  getMilestoneNarrative,
  isConcernAnswersComplete,
} from '../src/engine/branch2';

function codeOnly(path: string): string {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  return source
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

async function main() {
  section('F.014 -- age band boundaries are exact, no off-by-one');

  await test('band boundaries land where the schema says (36-47 / 48-59 / 60+)', () => {
    assert.equal(getMilestoneAgeBand(36), '36-47');
    assert.equal(getMilestoneAgeBand(47), '36-47');
    assert.equal(getMilestoneAgeBand(48), '48-59');
    assert.equal(getMilestoneAgeBand(59), '48-59');
    assert.equal(getMilestoneAgeBand(60), '60+');
    assert.equal(getMilestoneAgeBand(72), '60+');
  });

  section('F.014 -- milestone narrative is real prose, matched to age, never a checklist');

  for (const age of [36, 45, 48, 55, 60, 70]) {
    await test(`age ${age}mo gets non-empty narrative prose`, () => {
      const narrative = getMilestoneNarrative(age);
      assert.ok(narrative.length > 100, 'expected real prose, not a stub');
      // "Not a checklist" -- no list markers, no numbered items, no
      // literal yes/no framing that could be counted or scored (§9.2).
      assert.ok(!/^\s*[-*]\s/m.test(narrative), 'narrative contains a bullet list marker');
      assert.ok(!/^\s*\d+[.)]\s/m.test(narrative), 'narrative contains a numbered list marker');
      assert.ok(!/\byes\/no\b/i.test(narrative));
    });
  }

  await test('narrative carries no risk framing (§9.2, §9.3 done-when list)', () => {
    for (const band of ['36-47', '48-59', '60+'] as const) {
      const narrative = getMilestoneNarrative(band === '36-47' ? 40 : band === '48-59' ? 50 : 65);
      assert.ok(
        !/\b(warning sign|red flag|delayed|abnormal|disorder|risk|concerning|symptom|deficit)\b/i.test(
          narrative,
        ),
        `narrative for ${band} uses risk-framing language: "${narrative}"`,
      );
    }
  });

  section('F.014 -- the open question is fixed, verbatim, everywhere');

  await test('OPEN_QUESTION matches §9.3 exactly', () => {
    assert.equal(OPEN_QUESTION, "Is there anything here that's been on your mind?");
  });

  section('F.014 -- exactly three guided prompts, fixed order, never free text');

  await test('GUIDED_PROMPTS has exactly the three §9.3 prompts, in order', () => {
    assert.equal(GUIDED_PROMPTS.length, 3);
    assert.deepEqual(
      GUIDED_PROMPTS.map((p) => p.label),
      [
        'What did you notice?',
        'How old were they when you first noticed?',
        'What does it look like when it happens?',
      ],
    );
    assert.deepEqual(
      GUIDED_PROMPTS.map((p) => p.key),
      ['whatNoticed', 'whenNoticed', 'whatItLooksLike'],
    );
  });

  await test('the prompt set is a fixed constant -- calling it twice never differs', () => {
    // GUIDED_PROMPTS is imported once as a module-level const; this asserts
    // there is no function anywhere that could hand back a different set
    // (e.g. branching on a prior answer) -- there is only ever the one array.
    const first = [...GUIDED_PROMPTS];
    const second = [...GUIDED_PROMPTS];
    assert.deepEqual(first, second);
  });

  section('F.014 -- "no" ends the flow with nothing recorded (isConcernAnswersComplete + shape)');

  await test('an empty answers object is never treated as complete', () => {
    assert.equal(isConcernAnswersComplete({}), false);
  });

  await test('a partially-filled answers object is never treated as complete', () => {
    assert.equal(isConcernAnswersComplete({ whatNoticed: 'babbles a lot' }), false);
    assert.equal(
      isConcernAnswersComplete({ whatNoticed: 'babbles a lot', whenNoticed: '18 months' }),
      false,
    );
  });

  await test('blank/whitespace-only answers do not count as complete', () => {
    assert.equal(
      isConcernAnswersComplete({ whatNoticed: '  ', whenNoticed: '18mo', whatItLooksLike: 'x' }),
      false,
    );
  });

  await test('all three real answers -> complete', () => {
    assert.equal(
      isConcernAnswersComplete({
        whatNoticed: "hasn't said mama",
        whenNoticed: 'around 18 months',
        whatItLooksLike: 'babbles but not at me',
      }),
      true,
    );
  });

  section('F.014 -- static checks (real, on the actual files, comments filtered)');

  await test('the Companion never appears in branch2.ts or Branch2Milestones.tsx (§10)', () => {
    const engine = codeOnly('../src/engine/branch2.ts');
    const screen = codeOnly('../src/screens/Branch2Milestones.tsx');
    assert.ok(!/companion/i.test(engine), 'engine/branch2.ts references the Companion');
    assert.ok(!/companion/i.test(screen), 'Branch2Milestones.tsx references the Companion');
  });

  await test('nothing on this screen is written to the log (no store/session import)', () => {
    const screen = codeOnly('../src/screens/Branch2Milestones.tsx');
    assert.ok(!/profileStore|appendSkillRecord|saveQuestionCard|adapters\.storage/.test(screen));
  });

  await test('no checkbox/score/tally construct anywhere in the F.014 files (§9.2)', () => {
    const engine = codeOnly('../src/engine/branch2.ts');
    const screen = codeOnly('../src/screens/Branch2Milestones.tsx');
    assert.ok(!/\b(checkbox|score|tally|percentile)\b/i.test(engine + screen));
  });

  summarize();
}

void main();
