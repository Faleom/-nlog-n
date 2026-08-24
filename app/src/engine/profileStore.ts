// The device store & profile model. F.001.
// "Everything the app remembers, on the device." See plan/features/F.001.md.
//
// This is the domain layer on top of StoragePort — it knows about
// ChildProfile, SessionLog, SkillRecord, QuestionCard. StoragePort itself
// stays a dumb key/value store; all the shape-specific logic lives here.
//
// Deliberately NOT here: a `condition` field anywhere, any score/grade/
// percentile field, any path that stores a room photo. The type system
// already prevents all three — see src/types/index.ts.

import { adapters } from '../adapters/registry';
import type { ChildProfile, QuestionCard, SessionLog, SkillRecord, TrackId } from '../types';

const PROFILES_KEY = 'profiles';
const ACTIVE_PROFILE_KEY = 'activeProfileId';
const SESSIONS_KEY = 'sessions';
const QUESTION_CARDS_KEY = 'questionCards';

type ProfilesMap = Record<string, ChildProfile>;
type SessionsMap = Record<string, SessionLog>;
type CardsMap = Record<string, QuestionCard>;

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export interface CreateProfileInput {
  /** The only required field, per §5.1 — everything else starts empty. */
  ageMonths: number;
  nickname?: string;
}

/**
 * Creates a profile with only age set — every other field starts empty,
 * never undefined-crashes downstream. Sets it as the active profile.
 */
export async function createProfile(input: CreateProfileInput): Promise<ChildProfile> {
  const profiles = (await adapters.storage.get<ProfilesMap>(PROFILES_KEY)) ?? {};
  const id = newId();
  const now = nowIso();
  const profile: ChildProfile = {
    id,
    ageMonths: input.ageMonths,
    nickname: input.nickname,
    responseProfile: {},
    context: {},
    createdAt: now,
    updatedAt: now,
  };
  profiles[id] = profile;
  await adapters.storage.set(PROFILES_KEY, profiles);
  await adapters.storage.set(ACTIVE_PROFILE_KEY, id);
  return profile;
}

export async function getProfile(id: string): Promise<ChildProfile | undefined> {
  const profiles = (await adapters.storage.get<ProfilesMap>(PROFILES_KEY)) ?? {};
  return profiles[id];
}

export async function getActiveProfile(): Promise<ChildProfile | undefined> {
  const activeId = await adapters.storage.get<string>(ACTIVE_PROFILE_KEY);
  if (!activeId) return undefined;
  return getProfile(activeId);
}

export async function setActiveProfile(id: string): Promise<void> {
  await adapters.storage.set(ACTIVE_PROFILE_KEY, id);
}

/**
 * Drops the "who is active on this device" pointer and nothing else.
 *
 * This is what the home hub's "Log out" button calls. There is no account
 * and no password anywhere in this app -- the active-profile id IS the
 * whole session -- so logging out is exactly this one delete. Note what it
 * deliberately does NOT touch: PROFILES_KEY, SESSIONS_KEY and
 * QUESTION_CARDS_KEY are all left intact, so the child's profile, history
 * and question cards survive. setActiveProfile(id) puts any of them back.
 */
export async function clearActiveProfile(): Promise<void> {
  await adapters.storage.delete(ACTIVE_PROFILE_KEY);
}

/**
 * Patches a profile. Nested objects (responseProfile, context and its
 * sub-layers) are merged field-by-field rather than replaced wholesale, so
 * a caller can set one favourite colour without clobbering everything else
 * already saved. Top-level scalars (ageMonths, nickname) and `declaration`
 * are overwritten outright.
 */
export async function updateProfile(
  id: string,
  patch: Partial<Omit<ChildProfile, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<ChildProfile> {
  const profiles = (await adapters.storage.get<ProfilesMap>(PROFILES_KEY)) ?? {};
  const existing = profiles[id];
  if (!existing) throw new Error(`No profile with id ${id}`);

  const updated: ChildProfile = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
    responseProfile: { ...existing.responseProfile, ...patch.responseProfile },
    context: {
      ...existing.context,
      ...patch.context,
      quickPreferences: {
        ...existing.context.quickPreferences,
        ...patch.context?.quickPreferences,
      },
      peopleAndRoutine: {
        ...existing.context.peopleAndRoutine,
        ...patch.context?.peopleAndRoutine,
      },
    },
  };
  profiles[id] = updated;
  await adapters.storage.set(PROFILES_KEY, profiles);
  return updated;
}

// ---------------------------------------------------------------------------
// Sessions & skill records (§7.6, §7.7, §7.9)
// ---------------------------------------------------------------------------

export async function startSession(childId: string, track?: TrackId): Promise<SessionLog> {
  const sessions = (await adapters.storage.get<SessionsMap>(SESSIONS_KEY)) ?? {};
  const id = newId();
  const session: SessionLog = {
    id,
    childId,
    startedAt: nowIso(),
    durationSeconds: 0,
    activitiesRun: 0,
    movementBreaks: 0,
    skillRecords: [],
    endedBy: 'caregiver', // placeholder; endSession() sets the real value
    // Which activity this is. Recorded at the start, not the end, so a
    // session that is never ended cleanly still knows what it was.
    ...(track ? { track } : {}),
  };
  sessions[id] = session;
  await adapters.storage.set(SESSIONS_KEY, sessions);
  return session;
}

export async function appendSkillRecord(
  sessionId: string,
  record: SkillRecord,
): Promise<SessionLog> {
  const sessions = (await adapters.storage.get<SessionsMap>(SESSIONS_KEY)) ?? {};
  const session = sessions[sessionId];
  if (!session) throw new Error(`No session with id ${sessionId}`);
  session.skillRecords.push(record);
  session.activitiesRun += 1;
  sessions[sessionId] = session;
  await adapters.storage.set(SESSIONS_KEY, sessions);
  return session;
}

export async function recordMovementBreak(sessionId: string): Promise<SessionLog> {
  const sessions = (await adapters.storage.get<SessionsMap>(SESSIONS_KEY)) ?? {};
  const session = sessions[sessionId];
  if (!session) throw new Error(`No session with id ${sessionId}`);
  session.movementBreaks += 1;
  sessions[sessionId] = session;
  await adapters.storage.set(SESSIONS_KEY, sessions);
  return session;
}

export async function endSession(
  sessionId: string,
  endedBy: SessionLog['endedBy'],
): Promise<SessionLog> {
  const sessions = (await adapters.storage.get<SessionsMap>(SESSIONS_KEY)) ?? {};
  const session = sessions[sessionId];
  if (!session) throw new Error(`No session with id ${sessionId}`);
  const endedAt = nowIso();
  session.endedAt = endedAt;
  session.durationSeconds = Math.round(
    (new Date(endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
  );
  session.endedBy = endedBy;
  sessions[sessionId] = session;
  await adapters.storage.set(SESSIONS_KEY, sessions);
  return session;
}

export async function getSessionsForChild(childId: string): Promise<SessionLog[]> {
  const sessions = (await adapters.storage.get<SessionsMap>(SESSIONS_KEY)) ?? {};
  return Object.values(sessions)
    .filter((s) => s.childId === childId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/**
 * Support-level history for one skill, optionally scoped to one context.
 * F.010/F.011 (support ladder, fading) read through this rather than
 * querying raw session logs themselves.
 */
export async function getSkillHistory(
  childId: string,
  skillId: string,
  context?: string,
): Promise<SkillRecord[]> {
  const sessions = await getSessionsForChild(childId);
  return sessions
    .flatMap((s) => s.skillRecords)
    .filter((r) => r.skillId === skillId && (context === undefined || r.context === context))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ---------------------------------------------------------------------------
// Branch 2 question cards (§9)
// ---------------------------------------------------------------------------

export async function saveQuestionCard(card: QuestionCard): Promise<void> {
  const cards = (await adapters.storage.get<CardsMap>(QUESTION_CARDS_KEY)) ?? {};
  cards[card.id] = card;
  await adapters.storage.set(QUESTION_CARDS_KEY, cards);
}

export async function getQuestionCards(): Promise<QuestionCard[]> {
  const cards = (await adapters.storage.get<CardsMap>(QUESTION_CARDS_KEY)) ?? {};
  return Object.values(cards).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteQuestionCard(id: string): Promise<void> {
  const cards = (await adapters.storage.get<CardsMap>(QUESTION_CARDS_KEY)) ?? {};
  delete cards[id];
  await adapters.storage.set(QUESTION_CARDS_KEY, cards);
}
