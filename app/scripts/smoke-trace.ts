// Real functional check for Trace and Colour (games/trace/).
// Run with: npm run smoke:trace
//
// Imports the PURE halves only. The component needs a browser (pointer
// events, getPointAtLength); what is checked here is everything that
// decides whether a round is fair: the coverage maths, the completion
// threshold, and the palette invariant that makes the 10% colour hint
// matchable at all.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { section, summarize, test } from './testHarness';
import { PALETTE, TRACE_OBJECTS, realColourOf } from '../src/games/trace/tracePaths';
import {
  COMPLETE_AT,
  CRAYON_WIDTH,
  ROUNDS_PER_SESSION,
  TOUCH_RADIUS,
  fixedBag,
  isSessionFinished,
  isTraceComplete,
  objectFromBag,
  shuffledBag,
  traceProgress,
  traceSkillId,
  visitNearby,
  type TracePoint,
} from '../src/games/trace/traceLogic';

/** Reads a source file for a static string/regex check, normalising CRLF
 * to LF first. Git on Windows can check this repo out with CRLF line
 * endings (see TraceAndColour.tsx); a raw readFileSync then breaks any
 * assertion here that searches for a literal '\n' -- the file is fine,
 * only the search was line-ending-sensitive. Every static check in this
 * suite reads through this rather than readFileSync directly, so none of
 * them can fail on a Windows checkout for a reason that has nothing to do
 * with the app. */
function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Points evenly round a circle — a stand-in outline with known geometry,
 * so coverage can be asserted exactly rather than approximately. */
function ring(n: number, cx = 120, cy = 120, r = 80): TracePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

async function main() {
  // -------------------------------------------------------------------------
  section('Trace and Colour — the five colours');
  // -------------------------------------------------------------------------

  await test('there are exactly five colours to choose from', () => {
    assert.equal(PALETTE.length, 5);
  });

  await test('every colour is distinct, by name and by value', () => {
    assert.equal(new Set(PALETTE.map((c) => c.name)).size, 5);
    assert.equal(new Set(PALETTE.map((c) => c.hex)).size, 5);
  });

  await test("every shape's real colour is ON the palette", () => {
    // The 10% ghost shows the object's real colour. If that colour is not
    // among the five swatches, the hint points at something the child
    // cannot pick — the shape would be quietly unmatchable while looking
    // perfectly normal.
    const orphans = TRACE_OBJECTS
      .filter((o) => !PALETTE.some((c) => c.name === o.colour))
      .map((o) => `${o.key} wants ${o.colour}`);
    assert.deepEqual(orphans, [], `shapes whose colour is not pickable: ${orphans.join(', ')}`);
  });

  await test('realColourOf resolves to a real hex for every shape', () => {
    for (const o of TRACE_OBJECTS) {
      assert.match(realColourOf(o), /^#[0-9A-Fa-f]{6}$/, `${o.key} has no hex`);
    }
  });

  // -------------------------------------------------------------------------
  section('Trace and Colour — the shapes');
  // -------------------------------------------------------------------------

  await test('every shape is a SINGLE closed path', () => {
    // Tracing follows one continuous outline. Two subpaths would mean a
    // stretch of "outline" the finger can never reach in one motion, so a
    // shape could never be completed.
    const bad: string[] = [];
    for (const o of TRACE_OBJECTS) {
      const moves = (o.d.match(/[Mm]/g) ?? []).length;
      if (moves !== 1) bad.push(`${o.key}: ${moves} subpaths`);
      if (!/[Zz]\s*$/.test(o.d.trim())) bad.push(`${o.key}: not closed`);
    }
    assert.deepEqual(bad, [], bad.join(' | '));
  });

  await test('every shape id and name is unique', () => {
    assert.equal(new Set(TRACE_OBJECTS.map((o) => o.key)).size, TRACE_OBJECTS.length);
  });

  await test('a shuffled bag contains every shape exactly once', () => {
    // A bag, not a die roll: rolling each round can hand a child the apple
    // three times running while the leaf never appears.
    const bag = shuffledBag(seeded(1));
    assert.equal(bag.length, TRACE_OBJECTS.length);
    assert.deepEqual(
      bag.map((o) => o.key).sort(),
      TRACE_OBJECTS.map((o) => o.key).sort(),
      'the bag lost or duplicated a shape',
    );
  });

  await test('the bag actually shuffles', () => {
    const a = shuffledBag(seeded(1)).map((o) => o.key);
    const b = shuffledBag(seeded(99)).map((o) => o.key);
    const fixed = fixedBag().map((o) => o.key);
    assert.notDeepEqual(a, b, 'two different seeds produced the same order');
    assert.ok(a.join() !== fixed.join() || b.join() !== fixed.join(), 'nothing was shuffled at all');
  });

  await test('a refilled bag does not repeat the shape the last one ended on', () => {
    // The one place a bag can still produce a back-to-back repeat.
    for (let seed = 1; seed <= 40; seed++) {
      const previousLast = TRACE_OBJECTS[seed % TRACE_OBJECTS.length].key;
      const next = shuffledBag(seeded(seed), previousLast);
      assert.notEqual(next[0].key, previousLast, `seed ${seed} opened on a repeat`);
    }
  });

  await test('the fixed bag is the unshuffled order, for children who need sameness', () => {
    // §5.2's `sameness` dimension. A randomiser applied to everyone would
    // take away an accommodation some children depend on.
    assert.deepEqual(fixedBag().map((o) => o.key), TRACE_OBJECTS.map((o) => o.key));
    assert.deepEqual(fixedBag().map((o) => o.key), fixedBag().map((o) => o.key));
  });

  await test('the screen honours the sameness profile instead of always shuffling', () => {
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(/applyProfileTuning\(profile\)\.fixedLayout/.test(src),
      'the screen should read the sameness tuning');
    assert.ok(/wantsSameness \? fixedBag\(\) : shuffledBag\(\)/.test(src),
      'sameness profiles must get the fixed order');
  });

  await test('rounds walk whatever bag they are given, and wrap', () => {
    const bag = fixedBag();
    assert.equal(objectFromBag(bag, 0).key, bag[0].key);
    assert.equal(objectFromBag(bag, bag.length).key, bag[0].key);
    assert.notEqual(objectFromBag(bag, 1).key, objectFromBag(bag, 0).key);
  });

  await test('a session runs a fixed number of shapes, not until the clock stops it', () => {
    assert.equal(isSessionFinished(0), false);
    assert.equal(isSessionFinished(ROUNDS_PER_SESSION - 1), false);
    assert.equal(isSessionFinished(ROUNDS_PER_SESSION), true);
    assert.equal(isSessionFinished(ROUNDS_PER_SESSION + 1), true);
  });

  await test('a session never repeats a shape, and never has to refill the bag', () => {
    // Fewer planned rounds than there are shapes, so every session is five
    // different pictures drawn from one bag.
    assert.ok(ROUNDS_PER_SESSION < TRACE_OBJECTS.length,
      'with this many rounds a session would repeat a shape');
    const bag = shuffledBag(seeded(7));
    const played = Array.from({ length: ROUNDS_PER_SESSION }, (_, i) => objectFromBag(bag, i).key);
    assert.equal(new Set(played).size, ROUNDS_PER_SESSION, `a shape repeated: ${played.join(', ')}`);
  });

  await test('finishing the shapes ends the session as FINISHED, not as "time ran out"', () => {
    // The recap shows this to a parent. "We ran out of time" and "your
    // child worked through everything" are not the same sentence.
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(/isSessionFinished\(roundRef\.current\)/.test(src), 'the round limit is not checked');
    assert.ok(/handleEndSession\('finished'\)/.test(src), 'finishing should end the session as finished');
  });

  await test('the child is never shown how many rounds are left', () => {
    // A running total on the child's screen is exactly the score §13 rules
    // out, and would turn a finished picture into a tally.
    const src = readSource('../src/games/TraceAndColour.tsx');
    // Everything below the child-facing marker must not mention the plan.
    const childFacing = src.slice(src.indexOf('// CHILD-FACING from here down'));
    assert.ok(!/ROUNDS_PER_SESSION|roundRef/.test(childFacing),
      'the round plan leaks into the child-facing screens');
  });

  await test('this game can end on idle, not only on the cap', () => {
    // F.013 gives a session three endings: cap, 90s idle, caregiver. Games
    // 1 and 3 get idle free from InteractionMachine; this one has none, so
    // without an explicit check a child who wandered off mid-picture left
    // the session running until the cap.
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(/SESSION_END_IDLE_MS/.test(src), 'no idle ending is implemented');
    assert.ok(/handleEndSession\('idle'\)/.test(src), 'idle never actually ends the session');
    assert.ok(/lastActivityRef\.current = Date\.now\(\)/.test(src), 'nothing records activity');
  });

  await test('the logged skill is derived from the SHAPE alone, never the colour', () => {
    // This game assesses tracing only; a child who traced well and then
    // coloured an apple blue has succeeded completely.
    //
    // A naive "the id must not contain a colour word" check does not work
    // here and shouldn't: one of the shapes IS an orange, and the palette
    // has a colour called orange. The invariant that actually matters is
    // that the id is a pure function of the shape — traceSkillId takes no
    // colour argument, and the id is exactly the shape's own key.
    for (const o of TRACE_OBJECTS) {
      assert.equal(traceSkillId(o), `trace-${o.key}`);
    }
    assert.equal(traceSkillId.length, 1, 'traceSkillId should take only the shape');
  });

  await test('the screen logs that id, rather than assembling one at the call site', () => {
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.match(src, /skillId:\s*traceSkillId\(/, 'the screen should log traceSkillId(object)');
    assert.ok(
      !/skillId:\s*[`'"]/.test(src),
      'the screen builds a skill id inline, which could let a colour in',
    );
  });

  // -------------------------------------------------------------------------
  section('Trace and Colour — coverage maths');
  // -------------------------------------------------------------------------

  await test('a finger far from the outline marks nothing', () => {
    const pts = ring(40);
    assert.equal(visitNearby(pts, new Set(), 0, 0).size, 0);
  });

  await test('a finger ON the outline marks that point', () => {
    const pts = ring(40);
    const hit = visitNearby(pts, new Set(), pts[7].x, pts[7].y);
    assert.ok(hit.has(7));
  });

  await test('visitNearby never mutates the set it is given', () => {
    const pts = ring(40);
    const before = new Set<number>([1]);
    const after = visitNearby(pts, before, pts[7].x, pts[7].y);
    assert.equal(before.size, 1, 'the original set was modified');
    assert.ok(after.size > 1);
  });

  await test('the touch radius is generous enough for an unsteady finger', () => {
    // A tolerance tuned to adult precision would lock out the children this
    // app exists for. Assert the slack is real, in a 240-unit box.
    const pts = ring(40);
    const near = { x: pts[0].x + TOUCH_RADIUS * 0.8, y: pts[0].y };
    assert.ok(visitNearby(pts, new Set(), near.x, near.y).has(0), 'a near miss should still count');
  });

  await test('a point beyond the radius does NOT count', () => {
    const pts = ring(40);
    const far = { x: pts[0].x + TOUCH_RADIUS * 2.5, y: pts[0].y };
    assert.ok(!visitNearby(pts, new Set(), far.x, far.y).has(0));
  });

  await test('progress is a fraction, and never exceeds 1', () => {
    assert.equal(traceProgress(new Set(), 40), 0);
    assert.equal(traceProgress(new Set([0, 1]), 40), 0.05);
    assert.equal(traceProgress(new Set(Array.from({ length: 60 }, (_, i) => i)), 40), 1);
  });

  await test('progress on an empty outline is 0, not NaN', () => {
    assert.equal(traceProgress(new Set(), 0), 0);
    assert.equal(isTraceComplete(new Set(), 0), false);
  });

  // -------------------------------------------------------------------------
  section('Trace and Colour — completion gates the colouring');
  // -------------------------------------------------------------------------

  await test('a partly-traced shape is NOT complete', () => {
    const total = 100;
    const half = new Set(Array.from({ length: 50 }, (_, i) => i));
    assert.equal(isTraceComplete(half, total), false);
  });

  await test('going all the way round completes it', () => {
    const total = 100;
    const all = new Set(Array.from({ length: total }, (_, i) => i));
    assert.equal(isTraceComplete(all, total), true);
  });

  await test('completion does not demand perfection', () => {
    // A child who misses a few checkpoints has still been round the shape.
    // Requiring 100% would make the round unfinishable for the wobbliest
    // hands — which are the ones practising this.
    const total = 100;
    const nearly = new Set(Array.from({ length: 90 }, (_, i) => i));
    assert.ok(COMPLETE_AT < 1, 'the threshold must leave room for wobble');
    assert.equal(isTraceComplete(nearly, total), true);
  });

  await test('the threshold still requires most of the shape', () => {
    // ...but not so lenient that a scribble in one corner counts.
    const total = 100;
    const corner = new Set(Array.from({ length: 60 }, (_, i) => i));
    assert.ok(COMPLETE_AT > 0.75, 'the threshold must mean "went round it"');
    assert.equal(isTraceComplete(corner, total), false);
  });

  // -------------------------------------------------------------------------
  section('Trace and Colour — no colour is wrong (static check)');
  // -------------------------------------------------------------------------

  await test('finishing a picture never inspects WHICH colours were used', () => {
    // The whole point: any colour finishes the round. A comparison against
    // the object's real colour on the way out would quietly turn expression
    // into a test.
    const src = readSource('../src/games/TraceAndColour.tsx');
    const finish = src.slice(src.indexOf('function finishRound'), src.indexOf('async function handleSupportTierReport'));
    assert.ok(!/===\s*ghost|ghost\s*===|realColourOf\(/.test(finish),
      'finishRound compares what was drawn against the real colour');
    assert.ok(!/correct|wrong|incorrect/i.test(finish),
      'finishRound talks about right and wrong answers');
  });

  // -------------------------------------------------------------------------
  section('Trace and Colour — colouring is drawn, not filled');
  // -------------------------------------------------------------------------

  await test('a tap does not fill the shape — the child has to colour it', () => {
    // The revision that produced this: picking a swatch used to flood the
    // whole shape in one tap. Selecting a crayon must only pick the colour;
    // the picture appears from the strokes the child actually draws.
    const src = readSource('../src/games/TraceAndColour.tsx');
    // Asserted on what the handler DOES, not how it is formatted — an
    // exact-syntax regex here broke the moment the handler grew a second
    // statement, while the behaviour was still correct.
    const swatch = src.slice(src.indexOf('className="t4-swatch"'), src.indexOf('/>', src.indexOf('className="t4-swatch"')));
    assert.ok(/setCrayon\(/.test(swatch), 'tapping a swatch should choose the crayon');
    assert.ok(!/setStrokes|finishRound|setPhase/.test(swatch),
      'tapping a swatch must not draw, fill or end the round');
    assert.ok(!/setChosenColour|chosenColour/.test(src),
      'a whole-shape fill colour still exists');
    assert.ok(/<polyline/.test(src), 'crayon strokes should be drawn as polylines');
  });

  await test('a failed pointer capture cannot lose the stroke', () => {
    // setPointerCapture throws NotFoundError when the pointer is already
    // gone — a real race on touch hardware. Caught live: an uncaught throw
    // abandoned the rest of the handler and the child's stroke never
    // existed. Capture is an enhancement; it must be attempted only AFTER
    // the drawing state is committed, and never allowed to escape.
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(/try\s*\{[^}]*setPointerCapture/.test(src.replace(/\n/g, ' ')),
      'setPointerCapture must be wrapped in try/catch');
    const down = src.slice(src.indexOf('function handlePointerDown'), src.indexOf('function handlePointerMove'));
    assert.ok(down.indexOf('setStrokes') < down.indexOf('tryCapture(e);\n    }'),
      'the stroke must be committed before capture is attempted');
  });

  await test('crayon strokes are clipped to the shape', () => {
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(/clipPath=\{`url\(#\$\{clipId\}\)`\}/.test(src), 'strokes are not clipped');
    // A hardcoded clip id would collide if the screen rendered twice and
    // the crayon would spill out of the wrong shape.
    assert.ok(/useId\(\)/.test(src), 'the clip id must be unique per instance');
  });

  await test('NOTHING measures how much has been coloured', () => {
    // The revision that produced this: the round used to end itself once
    // enough of the inside was covered, and it kept snatching the picture
    // away mid-scribble. A child is finished when they say so.
    const logic = readSource('../src/games/trace/traceLogic.ts');
    assert.ok(!/isColourComplete|COLOUR_COMPLETE_AT/.test(logic),
      'a colouring completion rule still exists');

    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(!/isPointInFill|fillPoints|setPainted/.test(src),
      'the screen still tracks colour coverage');
  });

  await test('the round ends only when the child presses done', () => {
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(/onClick=\{finishRound\}/.test(src), 'there must be a done button');
    // finishRound must not be reachable from a timer or a coverage check.
    assert.ok(!/setTimeout\(\(\) => finishRound/.test(src),
      'finishRound is still being called automatically');
    // ...and it stays wordless, because this is the child's screen.
    const button = src.slice(src.indexOf('aria-label="Finished colouring"'), src.indexOf('</button>', src.indexOf('aria-label="Finished colouring"')));
    assert.ok(!/>\s*Done\s*</i.test(button), 'the done button must not use a written word');
  });

  await test('there is no progress bar left anywhere', () => {
    const src = readSource('../src/games/TraceAndColour.tsx');
    assert.ok(!/width:\s*`\$\{Math\.round\(/.test(src), 'a progress bar is still being rendered');
  });

  await test('a reference picture sits beside the colouring space', () => {
    const src = readSource('../src/games/TraceAndColour.tsx');
    const ref = src.slice(src.indexOf("phase === 'colouring' && object"), src.indexOf('<svg\n          ref={svgRef}'));
    assert.ok(/<path d=\{object\.d\}/.test(ref), 'the reference should draw the shape');
    assert.ok(/fill=\{ghost\}/.test(ref), 'the reference should be in the real colour');
  });

  await test('the crayon is wide enough to fill a shape quickly', () => {
    // A narrow tip turns filling into scrubbing. This one covers ground.
    assert.ok(CRAYON_WIDTH >= 30, 'the crayon should be broad');
    const pts: TracePoint[] = [{ x: 100, y: 100 }, { x: 200, y: 100 }];
    const under = visitNearby(pts, new Set(), 100, 100, CRAYON_WIDTH / 2);
    assert.ok(under.has(0));
    assert.ok(!under.has(1), 'but it should not paint the whole canvas at once');
  });

  summarize();
}

void main();
