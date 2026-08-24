// Game 1 levels 1-5 — what the child is asked to fetch. Pure logic, no
// React, no DOM, so every rule here is testable in Node
// (scripts/smoke-game1-quests.ts).
//
// THE CHILD PLAYS THE ROOM, NOT THE SCREEN
// ----------------------------------------
// This is the constraint every decision below answers to. The child walks
// to a shelf and picks up a real cup. The phone is the CAREGIVER's
// instrument: it says what to look for, it records what came back, and it
// shows the room so the caregiver can point. Nothing in this file may ever
// require the child to touch glass to make progress.
//
// So "counting" here is never counting pictures. It is fetching three real
// red things, one trip at a time, and what the caregiver sees is a record
// of trips that ended in an object arriving.
//
// THE LADDER
// ----------
//   1  fetch    one object, named plainly
//   2  fetch    one object, qualified by colour ("the RED cup")
//   3  collect  every object sharing ONE trait — the first counting level
//   4  combine  two traits, one collection ("the red ones and the blue ones")
//   5  combine  two traits, more of each
//
// Levels 1 and 2 are the game that already existed; 3 adds quantity, and
// 4-5 add across two groups. Nothing auto-advances — see game1Level.ts for
// why a caregiver sets this rather than the app inferring it.

import type { TaggedCrop } from '../../types';
import type { Game1Level } from '../game1Level';

/** The two axes a room's objects can be grouped by.
 *
 * Both come straight off TaggedCrop, which vision already fills in — no
 * second recognition pass, and no new prompt to keep byte-identical
 * between the browser adapter and the serverless one.
 *
 * Deliberately only two. Size and shape are NOT here: vision reports
 * bounding boxes in the photo's pixel space, so a mug close to the camera
 * measures larger than a beanbag across the room. Grouping by that would
 * teach the child something false. */
export type Dimension = 'colour' | 'kind';

export interface Rule {
  dimension: Dimension;
  /** A colour word, or a category word. Compared case-insensitively. */
  value: string;
}

export type QuestKind = 'fetch' | 'collect' | 'combine';

export interface Quest {
  kind: QuestKind;
  /** Empty for `fetch`, one for `collect`, two for `combine`. */
  rules: Rule[];
  /** Every object in the room that satisfies the quest. For `fetch` this
   * is exactly one. The caregiver's tray fills up to this length. */
  members: TaggedCrop[];
}

export function traitOf(crop: TaggedCrop, dimension: Dimension): string {
  return (dimension === 'colour' ? crop.colour : crop.category).trim().toLowerCase();
}

export function satisfies(crop: TaggedCrop, rule: Rule): boolean {
  return traitOf(crop, rule.dimension) === rule.value.trim().toLowerCase();
}

/** A quest member matches ANY of its rules — the rules are an OR, which is
 * what makes level 4-5 an ADDITION rather than an intersection.
 *
 * This is the whole arithmetic of the game and it is worth being explicit
 * about: "the red ones and the blue ones" in ordinary speech means every
 * red thing plus every blue thing, NOT the things that are somehow both.
 * An AND here would usually yield an empty set and would be teaching the
 * opposite of what §8.1's "combining groups" means. */
export function isMember(crop: TaggedCrop, rules: Rule[]): boolean {
  if (rules.length === 0) return false;
  return rules.some((r) => satisfies(crop, r));
}

export function questKindForLevel(level: Game1Level): QuestKind {
  if (level <= 2) return 'fetch';
  if (level === 3) return 'collect';
  return 'combine';
}

/** How many members a level wants, at most. Small on purpose.
 *
 * A three-year-old fetching six things makes six round trips, and F.013
 * caps a whole session at twelve minutes. Two or three trips is a round;
 * six is the entire session and the child never reaches the end. */
export function maxMembersForLevel(level: Game1Level): number {
  const byLevel: Record<Game1Level, number> = { 1: 1, 2: 1, 3: 3, 4: 4, 5: 5 };
  return byLevel[level];
}

/** Every group in the room with at least `min` members, largest first.
 *
 * Ties break on the trait word so the result is stable for a given room —
 * §5.2's sameness dimension means a child who replays a room should not
 * get a reshuffled task. */
export function groupsIn(
  crops: TaggedCrop[],
  dimension: Dimension,
  min: number,
): Array<{ rule: Rule; members: TaggedCrop[] }> {
  const buckets = new Map<string, TaggedCrop[]>();
  for (const c of crops) {
    const key = traitOf(c, dimension);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(c);
    else buckets.set(key, [c]);
  }
  return [...buckets.entries()]
    .filter(([, members]) => members.length >= min)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([value, members]) => ({ rule: { dimension, value }, members }));
}

/**
 * Builds the quest for a level from whatever the room actually contains.
 *
 * `index` walks through the available groups so consecutive rounds in one
 * session ask for different things, rather than the same colour four times.
 *
 * Returns null when the room cannot support the level — a room with no
 * colour appearing twice cannot pose a counting task, and inventing one
 * would mean asking for objects that are not there. The caller drops to a
 * lower level rather than showing an error (§11).
 */
export function buildQuest(
  level: Game1Level,
  crops: TaggedCrop[],
  index = 0,
): Quest | null {
  if (crops.length === 0) return null;
  const kind = questKindForLevel(level);
  const cap = maxMembersForLevel(level);

  if (kind === 'fetch') {
    const target = crops[index % crops.length];
    return { kind, rules: [], members: [target] };
  }

  // Counting and adding both need groups of two or more. A group of one is
  // a fetch wearing a counting costume: the child brings the single red
  // thing and the "collection" is already complete, which teaches nothing
  // about quantity.
  const byColour = groupsIn(crops, 'colour', 2);
  const byKind = groupsIn(crops, 'kind', 2);

  if (kind === 'collect') {
    // Prefer whichever dimension actually has a group. Colour first: it is
    // the more perceptually obvious of the two for this age, and it is the
    // one the level-2 prompt has already been naming out loud.
    const pool = byColour.length > 0 ? byColour : byKind;
    if (pool.length === 0) return null;
    const picked = pool[index % pool.length];
    return { kind, rules: [picked.rule], members: picked.members.slice(0, cap) };
  }

  // combine — two groups on the SAME dimension, so the two emblems differ
  // in exactly one way. Mixing dimensions ("the red ones and the cups")
  // asks the child to hold two kinds of rule at once, which is a different
  // and much harder skill than adding two groups.
  const pool = byColour.length >= 2 ? byColour : byKind;
  if (pool.length < 2) {
    // Not enough groups to add across. Fall back to counting rather than
    // returning nothing — a smaller task in the child's real room beats a
    // correct-sized task about objects they do not own.
    return buildQuest(3, crops, index);
  }
  const a = pool[index % pool.length];
  const b = pool[(index + 1) % pool.length];
  const members = [...a.members, ...b.members].slice(0, cap);
  return { kind, rules: [a.rule, b.rule], members };
}

/** Whether an arriving object counts towards the quest. */
export function acceptsCrop(quest: Quest, crop: TaggedCrop): boolean {
  return quest.members.some((m) => m.id === crop.id);
}

/** What is still missing. Drives the caregiver's tray, never shown as a
 * numeral to the child. */
export function remainingFor(quest: Quest, broughtIds: ReadonlySet<string>): TaggedCrop[] {
  return quest.members.filter((m) => !broughtIds.has(m.id));
}

export function isQuestComplete(quest: Quest, broughtIds: ReadonlySet<string>): boolean {
  return remainingFor(quest, broughtIds).length === 0;
}

/** The skill logged for a finished quest. Named for the TASK, never for
 * how well the child did it — this app records how much support was
 * needed, not a result (§13). */
export function questSkillId(kind: QuestKind): string {
  if (kind === 'fetch') return 'retrieve-named-object';
  return kind === 'collect' ? 'collect-by-one-trait' : 'combine-two-traits';
}

/** Caregiver-facing sentence describing the quest.
 *
 * CAREGIVER-facing, so words are fine here — this is the text on the
 * grown-up's half of the screen (§8.0). The child gets the spoken prompt
 * and the emblems; they never read this. */
export function questBrief(quest: Quest): string {
  if (quest.kind === 'fetch') {
    const t = quest.members[0];
    return t ? `Ask them to bring the ${t.colour} ${t.name}.` : 'Ask them to bring one thing.';
  }
  const n = quest.members.length;
  const [a, b] = quest.rules;
  if (quest.kind === 'collect') {
    return `Ask them to bring every ${groupPhrase(a, false)} — ${n} in this room.`;
  }
  return `Ask them to bring the ${groupPhrase(a, true)} and the ${groupPhrase(b, true)} — ${n} altogether.`;
}

/** Names a group the way a person would actually say it.
 *
 * Two things vary and both matter, because this sentence is read aloud to
 * a child by a caregiver who should not have to mentally repair it:
 *
 *   dimension — a colour needs a noun after it, since "every red" is not
 *     a phrase; a category already IS the noun, so "every toy thing" reads
 *     as a mistake.
 *   number    — "every" takes the singular and "the" takes the plural, so
 *     the same group is "every toy" in one sentence and "the toys" in the
 *     other. Fixing the dimension without fixing this just trades "every
 *     toy thing" for "every toys". */
function groupPhrase(rule: Rule | undefined, plural: boolean): string {
  if (!rule) return plural ? 'things' : 'thing';
  const noun = rule.dimension === 'colour' ? `${rule.value} thing` : rule.value;
  return plural ? `${noun}s` : noun;
}
