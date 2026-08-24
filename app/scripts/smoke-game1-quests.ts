// Game 1 levels 1-5: the quest builder and the three-wall room model.
//
// The rules under test are the ones a child feels directly: that a
// counting round is never secretly a fetch, that "red and blue" adds
// instead of intersecting, and that two walls holding the same blue cup
// stay two different objects.

import assert from 'node:assert/strict';
import { section, test, summarize } from './testHarness';
import type { TaggedCrop } from '../src/types';
import { GENERIC_FALLBACK_CROPS } from '../src/games/genericFallbackCrops';
import { iconKeyFor } from '../src/games/objectIconLogic';
import type { Game1Level } from '../src/games/game1Level';
import {
  buildQuest,
  groupsIn,
  isMember,
  satisfies,
  traitOf,
  acceptsCrop,
  remainingFor,
  isQuestComplete,
  questKindForLevel,
  maxMembersForLevel,
  questSkillId,
  questBrief,
  type Rule,
} from '../src/games/game1/quests';
import {
  placeCrops,
  canStart,
  cropsOf,
  onWall,
  wallOf,
  directionFor,
  isWallIndex,
  WALL_LABELS,
  type WallCapture,
} from '../src/games/game1/walls';

let n = 0;
function crop(over: Partial<TaggedCrop> = {}): TaggedCrop {
  n += 1;
  return {
    id: `c${n}`,
    name: 'cup',
    colour: 'red',
    category: 'drinkware',
    function: 'drink from',
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    image: '',
    ...over,
  };
}

/** A room with a real spread: 3 red, 2 blue, 1 yellow; 3 balls, 2 cups. */
function room(): TaggedCrop[] {
  return [
    crop({ id: 'r1', colour: 'red', category: 'toy', name: 'ball' }),
    crop({ id: 'r2', colour: 'red', category: 'drinkware', name: 'cup' }),
    crop({ id: 'r3', colour: 'red', category: 'toy', name: 'car' }),
    crop({ id: 'b1', colour: 'blue', category: 'toy', name: 'ball' }),
    crop({ id: 'b2', colour: 'blue', category: 'drinkware', name: 'cup' }),
    crop({ id: 'y1', colour: 'yellow', category: 'toy', name: 'ball' }),
  ];
}

async function main() {
  // -------------------------------------------------------------------
  section('the ladder: 1-2 fetch, 3 counts, 4-5 add');

  await test('each level maps to the kind the brief asked for', () => {
    assert.equal(questKindForLevel(1), 'fetch');
    assert.equal(questKindForLevel(2), 'fetch');
    assert.equal(questKindForLevel(3), 'collect');
    assert.equal(questKindForLevel(4), 'combine');
    assert.equal(questKindForLevel(5), 'combine');
  });

  await test('a fetch quest is exactly one object — never a collection of one', () => {
    for (const level of [1, 2] as Game1Level[]) {
      const q = buildQuest(level, room());
      assert.ok(q);
      assert.equal(q.kind, 'fetch');
      assert.equal(q.members.length, 1);
      assert.equal(q.rules.length, 0, 'a fetch has no classification rule');
    }
  });

  await test('collection size never exceeds the level cap', () => {
    for (const level of [1, 2, 3, 4, 5] as Game1Level[]) {
      const q = buildQuest(level, room());
      assert.ok(q);
      assert.ok(
        q.members.length <= maxMembersForLevel(level),
        `level ${level} produced ${q.members.length} members, cap is ${maxMembersForLevel(level)}`,
      );
    }
  });

  await test('caps stay small enough to finish inside a session', () => {
    // F.013 caps a session at 12 minutes and each member is a round trip
    // to a shelf. Six would eat the whole cap on one round.
    for (const level of [1, 2, 3, 4, 5] as Game1Level[]) {
      assert.ok(maxMembersForLevel(level) <= 5, `level ${level} asks for too many trips`);
    }
  });

  // -------------------------------------------------------------------
  section('a counting round is never secretly a fetch');

  await test('level 3 always asks for two or more objects', () => {
    const q = buildQuest(3, room());
    assert.ok(q);
    assert.equal(q.kind, 'collect');
    assert.ok(q.members.length >= 2, 'a one-object "collection" teaches nothing about quantity');
  });

  await test('every member of a collect quest really shares the trait', () => {
    const q = buildQuest(3, room());
    assert.ok(q);
    const rule = q.rules[0];
    for (const m of q.members) {
      assert.ok(satisfies(m, rule), `${m.id} does not satisfy ${rule.dimension}=${rule.value}`);
    }
  });

  await test('a room with no repeated trait cannot pose a counting task', () => {
    const singles = [
      crop({ id: 's1', colour: 'red', category: 'toy' }),
      crop({ id: 's2', colour: 'blue', category: 'drinkware' }),
      crop({ id: 's3', colour: 'green', category: 'textile' }),
    ];
    assert.equal(buildQuest(3, singles), null, 'must decline rather than invent a group');
  });

  await test('an empty room yields no quest at any level', () => {
    for (const level of [1, 2, 3, 4, 5] as Game1Level[]) {
      assert.equal(buildQuest(level, []), null);
    }
  });

  // -------------------------------------------------------------------
  section('levels 4-5 ADD two groups — they never intersect them');

  await test('a combine quest holds two rules on the same dimension', () => {
    const q = buildQuest(4, room());
    assert.ok(q);
    assert.equal(q.kind, 'combine');
    assert.equal(q.rules.length, 2);
    assert.equal(
      q.rules[0].dimension,
      q.rules[1].dimension,
      'mixing colour with category asks the child to hold two kinds of rule at once',
    );
    assert.notEqual(q.rules[0].value, q.rules[1].value, 'the two groups must differ');
  });

  await test('membership is an OR: red-or-blue, not red-and-blue', () => {
    const rules: Rule[] = [
      { dimension: 'colour', value: 'red' },
      { dimension: 'colour', value: 'blue' },
    ];
    // An AND on one dimension is always empty, which is the bug this guards.
    const redOnly = crop({ colour: 'red' });
    const blueOnly = crop({ colour: 'blue' });
    const neither = crop({ colour: 'green' });
    assert.ok(isMember(redOnly, rules), 'a red thing belongs in "red and blue"');
    assert.ok(isMember(blueOnly, rules), 'a blue thing belongs in "red and blue"');
    assert.ok(!isMember(neither, rules));
  });

  await test('the combined total really is both groups added, not one of them', () => {
    const q = buildQuest(5, room());
    assert.ok(q);
    assert.equal(q.kind, 'combine');
    const [a, b] = q.rules;
    const fromA = q.members.filter((m) => satisfies(m, a)).length;
    const fromB = q.members.filter((m) => satisfies(m, b)).length;
    assert.ok(fromA >= 1 && fromB >= 1, 'both groups must contribute at least one object');
    assert.equal(fromA + fromB, q.members.length, 'every member came from one of the two groups');
  });

  await test('no rules at all matches nothing — an empty OR is not "everything"', () => {
    assert.ok(!isMember(crop({}), []));
  });

  await test('a room with only one group falls back to counting, never to nothing', () => {
    const oneGroup = [
      crop({ id: 'g1', colour: 'red', category: 'toy', name: 'ball' }),
      crop({ id: 'g2', colour: 'red', category: 'drinkware', name: 'cup' }),
      crop({ id: 'g3', colour: 'green', category: 'textile', name: 'blanket' }),
    ];
    const q = buildQuest(4, oneGroup);
    assert.ok(q, 'must degrade rather than return null');
    assert.equal(q.kind, 'collect', 'a smaller real task beats a correct-sized fake one');
  });

  // -------------------------------------------------------------------
  section('consecutive rounds ask for different things');

  await test('walking the index changes the group asked for', () => {
    const a = buildQuest(3, room(), 0);
    const b = buildQuest(3, room(), 1);
    assert.ok(a && b);
    assert.notEqual(
      a.rules[0].value,
      b.rules[0].value,
      'two rounds in a row must not ask for the same colour',
    );
  });

  await test('the same room and index always gives the same quest (§5.2 sameness)', () => {
    const a = buildQuest(4, room(), 2);
    const b = buildQuest(4, room(), 2);
    assert.ok(a && b);
    assert.deepEqual(
      a.members.map((m) => m.id),
      b.members.map((m) => m.id),
    );
    assert.deepEqual(a.rules, b.rules);
  });

  // -------------------------------------------------------------------
  section('grouping and trait reading');

  await test('groups are ordered largest first, with a stable tiebreak', () => {
    const g = groupsIn(room(), 'colour', 2);
    assert.equal(g[0].rule.value, 'red', '3 reds should lead');
    assert.equal(g[0].members.length, 3);
    for (let i = 1; i < g.length; i++) {
      assert.ok(g[i - 1].members.length >= g[i].members.length, 'not sorted by size');
    }
  });

  await test('groups below the minimum are excluded entirely', () => {
    const g = groupsIn(room(), 'colour', 2);
    assert.ok(!g.some((x) => x.rule.value === 'yellow'), 'the lone yellow is not a group');
  });

  await test('trait matching ignores case and stray whitespace', () => {
    const c = crop({ colour: '  RED  ' });
    assert.equal(traitOf(c, 'colour'), 'red');
    assert.ok(satisfies(c, { dimension: 'colour', value: 'Red' }));
  });

  await test('objects with a blank trait are never grouped', () => {
    const g = groupsIn([crop({ colour: '' }), crop({ colour: '  ' })], 'colour', 1);
    assert.equal(g.length, 0, 'an empty colour is not a group of two');
  });

  // -------------------------------------------------------------------
  section('the tray: what has arrived, and what is still missing');

  await test('only an object that is part of the quest counts', () => {
    const q = buildQuest(3, room());
    assert.ok(q);
    assert.ok(acceptsCrop(q, q.members[0]));
    const outsider = crop({ id: 'not-in-room', colour: 'purple' });
    assert.ok(!acceptsCrop(q, outsider), 'an unrelated object must not fill the tray');
  });

  await test('remaining shrinks as objects arrive, and completion is exact', () => {
    const q = buildQuest(3, room());
    assert.ok(q);
    const brought = new Set<string>();
    for (let i = 0; i < q.members.length; i++) {
      assert.equal(remainingFor(q, brought).length, q.members.length - i);
      assert.ok(!isQuestComplete(q, brought), 'completed early');
      brought.add(q.members[i].id);
    }
    assert.equal(remainingFor(q, brought).length, 0);
    assert.ok(isQuestComplete(q, brought));
  });

  await test('bringing the same object twice does not complete a collection', () => {
    const q = buildQuest(3, room());
    assert.ok(q);
    const brought = new Set<string>([q.members[0].id, q.members[0].id]);
    assert.ok(!isQuestComplete(q, brought), 'a Set must not let one object count twice');
    assert.equal(remainingFor(q, brought).length, q.members.length - 1);
  });

  // -------------------------------------------------------------------
  section('logging names the task, never the outcome (§13)');

  await test('no skill id contains a verdict word', () => {
    for (const kind of ['fetch', 'collect', 'combine'] as const) {
      const id = questSkillId(kind);
      assert.doesNotMatch(id, /pass|fail|correct|wrong|score|good|bad/i, id);
      assert.ok(id.length > 0);
    }
  });

  await test('the three quest kinds log as three distinct skills', () => {
    const ids = (['fetch', 'collect', 'combine'] as const).map(questSkillId);
    assert.equal(new Set(ids).size, 3);
  });

  await test('the caregiver brief states the real total, and never leaks a JS value', () => {
    for (const level of [1, 2, 3, 4, 5] as Game1Level[]) {
      const q = buildQuest(level, room());
      assert.ok(q);
      const brief = questBrief(q);
      assert.ok(brief.length > 0);
      assert.doesNotMatch(brief, /undefined|null|NaN|\[object/, `level ${level}: ${brief}`);
    }
    const collect = buildQuest(3, room());
    assert.ok(collect);
    assert.match(questBrief(collect), new RegExp(String(collect.members.length)));
  });


  await test('the brief reads like speech, for both dimensions and both numbers', () => {
    // These are read ALOUD to a child by a caregiver who should not have to
    // silently repair the grammar first. Two things vary: a colour needs a
    // noun after it ("red thing") while a category already is one ("toy"),
    // and "every" takes the singular where "the" takes the plural. Getting
    // only the first right trades "every toy thing" for "every toys".
    const collectColour = questBrief({
      kind: 'collect',
      rules: [{ dimension: 'colour', value: 'red' }],
      members: [crop({}), crop({})],
    });
    assert.equal(collectColour, 'Ask them to bring every red thing — 2 in this room.');

    const collectKind = questBrief({
      kind: 'collect',
      rules: [{ dimension: 'kind', value: 'toy' }],
      members: [crop({}), crop({})],
    });
    assert.equal(collectKind, 'Ask them to bring every toy — 2 in this room.');

    const combined = questBrief({
      kind: 'combine',
      rules: [
        { dimension: 'kind', value: 'toy' },
        { dimension: 'colour', value: 'red' },
      ],
      members: [crop({}), crop({}), crop({})],
    });
    assert.equal(combined, 'Ask them to bring the toys and the red things — 3 altogether.');

    const fetch = questBrief({
      kind: 'fetch',
      rules: [],
      members: [crop({ colour: 'blue', name: 'cup' })],
    });
    assert.equal(fetch, 'Ask them to bring the blue cup.');
  });


  // -------------------------------------------------------------------
  section('the degraded path can still show every level');

  await test('the generic fallback set supports a real quest at all five levels', () => {
    // §11 sends a denied-camera or failed-recognition session to this set.
    // If it cannot support levels 4-5, a caregiver who picks level 5 gets
    // silently demoted with nothing on screen saying why -- so the set is
    // required to carry two groups, not merely to avoid crashing.
    for (const level of [1, 2, 3, 4, 5] as Game1Level[]) {
      const q = buildQuest(level, GENERIC_FALLBACK_CROPS);
      assert.ok(q, `level ${level} produced no quest from the fallback set`);
      assert.ok(q.members.length >= 1);
    }
  });

  await test('the fallback set really can pose an ADDING round, not just a collection', () => {
    const q = buildQuest(4, GENERIC_FALLBACK_CROPS);
    assert.ok(q);
    assert.equal(q.kind, 'combine', 'the fallback set has no second group to add across');
    assert.equal(q.rules.length, 2);
  });

  await test('every fallback object has artwork, so none renders as a blank tile', () => {
    for (const c of GENERIC_FALLBACK_CROPS) {
      assert.notEqual(
        iconKeyFor(c.name, c.category),
        'generic',
        `"${c.name}" has no bundled artwork and would render as the placeholder`,
      );
    }
  });

  // -------------------------------------------------------------------
  section('three walls joined into one room');

  const captures: WallCapture[] = [
    {
      wall: 0,
      crops: [crop({ id: 'x1', colour: 'red', name: 'ball' })],
      scene: { dataUrl: 'd', width: 200, height: 100 },
    },
    {
      wall: 1,
      crops: [crop({ id: 'x1', colour: 'blue', name: 'cup' })],
      scene: { dataUrl: 'd', width: 200, height: 100 },
    },
    { wall: 2, crops: [crop({ id: 'x2', colour: 'green', name: 'book' })] },
  ];

  await test('the same crop id on two walls stays two different objects', () => {
    const placed = placeCrops(captures);
    const ids = placed.map((p) => p.crop.id);
    assert.equal(new Set(ids).size, ids.length, 'wall 0 and wall 1 both had a crop called x1');
  });

  await test('a duplicated id cannot make one arriving object fill two slots', () => {
    // The real failure this prevents: two walls of one bedroom each hold a
    // blue cup, the vision adapter numbers crops per call, and the tray
    // keys off id — so an un-namespaced id would tick both cups at once.
    const placed = placeCrops(captures);
    const all = cropsOf(placed);
    const q = { kind: 'collect' as const, rules: [], members: all };
    const brought = new Set<string>([all[0].id]);
    assert.equal(remainingFor(q, brought).length, all.length - 1, 'one arrival, one slot');
  });

  await test('bbox centres become fractions inset from the wall edges', () => {
    const placed = placeCrops([
      {
        wall: 1,
        crops: [crop({ id: 'edge', bbox: { x: 0, y: 0, width: 0, height: 0 } })],
        scene: { dataUrl: 'd', width: 200, height: 100 },
      },
    ]);
    assert.ok(placed[0].x >= 0.08 && placed[0].x <= 0.92, `x escaped the wall: ${placed[0].x}`);
    assert.ok(placed[0].y >= 0.12 && placed[0].y <= 0.88, `y escaped the wall: ${placed[0].y}`);
  });

  await test('a capture with no scene still places its objects, centred', () => {
    const placed = placeCrops([captures[2]]);
    assert.equal(placed.length, 1);
    assert.equal(placed[0].x, 0.5);
    assert.equal(placed[0].y, 0.5);
  });

  await test('a zero-sized or nonsense scene never yields NaN coordinates', () => {
    const placed = placeCrops([
      {
        wall: 0,
        crops: [crop({ bbox: { x: 5, y: 5, width: 2, height: 2 } })],
        scene: { dataUrl: 'd', width: 0, height: 0 },
      },
    ]);
    assert.ok(Number.isFinite(placed[0].x) && Number.isFinite(placed[0].y));
  });

  await test('objects report the wall they were photographed on', () => {
    const placed = placeCrops(captures);
    assert.equal(onWall(placed, 0).length, 1);
    assert.equal(onWall(placed, 1).length, 1);
    assert.equal(onWall(placed, 2).length, 1);
    assert.equal(wallOf(placed, 'w2-x2'), 2);
    assert.equal(wallOf(placed, 'nope'), null);
  });

  await test('the caregiver gets a real direction, or none at all', () => {
    const placed = placeCrops(captures);
    assert.equal(directionFor(placed, 'w0-x1'), WALL_LABELS[0]);
    assert.equal(directionFor(placed, 'missing'), null, 'must omit rather than point the wrong way');
  });

  await test('one usable wall is enough to start', () => {
    assert.ok(canStart([captures[0]]), 'a caregiver with one good photo must still be able to play');
    assert.ok(!canStart([]));
    assert.ok(!canStart([{ wall: 0, crops: [] }]), 'a wall with nothing found is not a start');
  });

  await test('only 0, 1 and 2 are walls', () => {
    assert.ok(isWallIndex(0) && isWallIndex(1) && isWallIndex(2));
    assert.ok(!isWallIndex(3));
    assert.ok(!isWallIndex(-1));
  });

  // -------------------------------------------------------------------
  section('quests built from a real three-wall room');

  await test('a quest can span walls, so the child has to turn around', () => {
    const wide: WallCapture[] = [
      { wall: 0, crops: [crop({ id: 'a', colour: 'red', name: 'ball' })] },
      { wall: 1, crops: [crop({ id: 'b', colour: 'red', name: 'cup' })] },
      { wall: 2, crops: [crop({ id: 'c', colour: 'red', name: 'car' })] },
    ];
    const placed = placeCrops(wide);
    const q = buildQuest(3, cropsOf(placed));
    assert.ok(q);
    const walls = new Set(q.members.map((m) => wallOf(placed, m.id)));
    assert.ok(walls.size > 1, 'a collection confined to one wall never makes the child turn');
  });

  summarize();
}

void main();
