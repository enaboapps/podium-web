import { createStore, get, set } from 'idb-keyval';
import type { Doc } from '@/convex/_generated/dataModel';

const SCHEMA_VERSION = 1;

const bootstrapStore = createStore('podium-offline-bootstrap', 'records');
const statusStore = createStore('podium-offline-status', 'talk-status');
const metaStore = createStore('podium-offline-meta', 'meta');

export interface CachedTalkStatus {
  talkId: string;
  hasDocument: boolean;
  hasAudio: boolean;
  segmentCount: number;
  cachedAudioSegments: number;
  lastPreparedAt: number | null;
}

export interface CachedLibrarySnapshot {
  userId: string;
  talks: Array<Pick<Doc<'talks'>, '_id' | 'title'>>;
  sets: Array<Pick<Doc<'talkSets'>, '_id' | 'title' | 'talkIds'>>;
  talkStatusById: Record<string, CachedTalkStatus>;
  lastSyncedAt: number;
  schemaVersion: number;
}

export interface OfflineBootstrapRecord {
  schemaVersion: number;
  userId: string;
  lastSyncedAt: number;
  library: {
    talkCount: number;
    setCount: number;
  };
  talks: CachedLibrarySnapshot['talks'];
  sets: CachedLibrarySnapshot['sets'];
  talkStatusById: Record<string, CachedTalkStatus>;
}

function bootstrapKey(userId: string) {
  return `bootstrap:${userId}`;
}

function statusKey(userId: string, talkId: string) {
  return `status:${userId}:${talkId}`;
}

async function getAllTalkPreparedStates(
  userId: string,
  talkIds: string[]
): Promise<Record<string, CachedTalkStatus>> {
  const entries = await Promise.all(
    talkIds.map(async (talkId) => {
      const status = await get<CachedTalkStatus>(statusKey(userId, talkId), statusStore);
      return [talkId, status] as const;
    })
  );

  return Object.fromEntries(entries.filter((entry): entry is [string, CachedTalkStatus] => !!entry[1]));
}

async function saveLastUserId(userId: string): Promise<void> {
  await set('lastUserId', userId, metaStore);
}

export async function getLastUserId(): Promise<string | undefined> {
  return get<string>('lastUserId', metaStore);
}

export async function saveOfflineBootstrap(record: OfflineBootstrapRecord): Promise<void> {
  await Promise.all([
    set(bootstrapKey(record.userId), record, bootstrapStore),
    saveLastUserId(record.userId),
  ]);
}

export async function getOfflineBootstrap(): Promise<OfflineBootstrapRecord | undefined> {
  const userId = await getLastUserId();
  if (!userId) return undefined;
  return get<OfflineBootstrapRecord>(bootstrapKey(userId), bootstrapStore);
}

export async function getCachedLibrarySnapshot(userId: string): Promise<CachedLibrarySnapshot | undefined> {
  const record = await get<OfflineBootstrapRecord>(bootstrapKey(userId), bootstrapStore);
  if (!record) return undefined;

  return {
    userId: record.userId,
    talks: record.talks,
    sets: record.sets,
    talkStatusById: record.talkStatusById,
    lastSyncedAt: record.lastSyncedAt,
    schemaVersion: record.schemaVersion,
  };
}

export async function saveLibrarySnapshot(
  userId: string,
  talks: CachedLibrarySnapshot['talks'],
  sets: CachedLibrarySnapshot['sets'],
  talkStatusById?: Record<string, CachedTalkStatus>
): Promise<void> {
  const resolvedStatuses = talkStatusById ?? await getAllTalkPreparedStates(
    userId,
    Array.from(new Set(talks.map((talk) => talk._id)))
  );

  await saveOfflineBootstrap({
    schemaVersion: SCHEMA_VERSION,
    userId,
    lastSyncedAt: Date.now(),
    library: {
      talkCount: talks.length,
      setCount: sets.length,
    },
    talks,
    sets,
    talkStatusById: resolvedStatuses,
  });
}

export async function saveTalkPreparedState(
  userId: string,
  talkId: string,
  state: CachedTalkStatus
): Promise<void> {
  await set(statusKey(userId, talkId), state, statusStore);

  const currentBootstrap = await get<OfflineBootstrapRecord>(bootstrapKey(userId), bootstrapStore);
  if (!currentBootstrap) {
    await saveLastUserId(userId);
    return;
  }

  await saveOfflineBootstrap({
    ...currentBootstrap,
    talkStatusById: {
      ...currentBootstrap.talkStatusById,
      [talkId]: state,
    },
  });
}

export async function getTalkPreparedState(
  userId: string,
  talkId: string
): Promise<CachedTalkStatus | undefined> {
  return get<CachedTalkStatus>(statusKey(userId, talkId), statusStore);
}
