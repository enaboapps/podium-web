import { createStore, del, get, keys, set } from 'idb-keyval';
import { deleteTalkData, listTalkData } from '@/lib/audioStore';

const SCHEMA_VERSION = 2;

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

export interface OfflineTalkSummary {
  _id: string;
  title: string;
}

export interface OfflineSetSummary {
  _id: string;
  title: string;
  talkIds: string[];
}

export interface CachedLibrarySnapshot {
  userId: string;
  talks: OfflineTalkSummary[];
  sets: OfflineSetSummary[];
  talkStatusById: Record<string, CachedTalkStatus>;
  lastSyncedAt: number;
  schemaVersion: number;
  syncState: 'ready' | 'partial';
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
  syncState: 'ready' | 'partial';
}

export interface OfflineLibraryBundleInput {
  userId: string;
  talks: CachedLibrarySnapshot['talks'];
  sets: CachedLibrarySnapshot['sets'];
  talkStatusById: Record<string, CachedTalkStatus>;
}

type LegacyBootstrapRecord = Omit<OfflineBootstrapRecord, 'schemaVersion' | 'syncState'> & {
  schemaVersion?: number;
  syncState?: 'ready' | 'partial';
};

function bootstrapKey(userId: string) {
  return `bootstrap:${userId}`;
}

function statusKey(userId: string, talkId: string) {
  return `status:${userId}:${talkId}`;
}

function normaliseTalkStatus(talkId: string, status?: Partial<CachedTalkStatus>): CachedTalkStatus {
  return {
    talkId,
    hasDocument: status?.hasDocument ?? true,
    hasAudio: status?.hasAudio ?? false,
    segmentCount: status?.segmentCount ?? 0,
    cachedAudioSegments: status?.cachedAudioSegments ?? 0,
    lastPreparedAt: status?.lastPreparedAt ?? null,
  };
}

function normaliseBootstrap(record: LegacyBootstrapRecord | undefined): OfflineBootstrapRecord | undefined {
  if (!record) return undefined;

  return {
    schemaVersion: SCHEMA_VERSION,
    userId: record.userId,
    lastSyncedAt: record.lastSyncedAt,
    library: record.library,
    talks: record.talks,
    sets: record.sets,
    talkStatusById: Object.fromEntries(
      Object.entries(record.talkStatusById ?? {}).map(([talkId, status]) => [
        talkId,
        normaliseTalkStatus(talkId, status),
      ])
    ),
    syncState: record.syncState ?? 'ready',
  };
}

async function saveLastUserId(userId: string): Promise<void> {
  await set('lastUserId', userId, metaStore);
}

async function getAllTalkPreparedStates(
  userId: string,
  talkIds: string[]
): Promise<Record<string, CachedTalkStatus>> {
  const entries = await Promise.all(
    talkIds.map(async (talkId) => {
      const status = await get<CachedTalkStatus>(statusKey(userId, talkId), statusStore);
      return [talkId, status ? normaliseTalkStatus(talkId, status) : undefined] as const;
    })
  );

  return Object.fromEntries(entries.filter((entry): entry is [string, CachedTalkStatus] => !!entry[1]));
}

async function deleteTalkPreparedState(userId: string, talkId: string): Promise<void> {
  await del(statusKey(userId, talkId), statusStore);
}

export async function getLastUserId(): Promise<string | undefined> {
  return get<string>('lastUserId', metaStore);
}

export async function saveOfflineBootstrap(record: OfflineBootstrapRecord): Promise<void> {
  const normalised = normaliseBootstrap(record)!;
  await Promise.all([
    set(bootstrapKey(normalised.userId), normalised, bootstrapStore),
    saveLastUserId(normalised.userId),
  ]);
}

export async function getOfflineBootstrap(): Promise<OfflineBootstrapRecord | undefined> {
  const userId = await getLastUserId();
  if (!userId) return undefined;
  const record = await get<LegacyBootstrapRecord>(bootstrapKey(userId), bootstrapStore);
  return normaliseBootstrap(record);
}

export async function refreshOfflineBootstrap(): Promise<OfflineBootstrapRecord | undefined> {
  return getOfflineBootstrap();
}

export async function getCachedLibrarySnapshot(userId: string): Promise<CachedLibrarySnapshot | undefined> {
  const record = await get<LegacyBootstrapRecord>(bootstrapKey(userId), bootstrapStore);
  const normalised = normaliseBootstrap(record);
  if (!normalised) return undefined;

  return {
    userId: normalised.userId,
    talks: normalised.talks,
    sets: normalised.sets,
    talkStatusById: normalised.talkStatusById,
    lastSyncedAt: normalised.lastSyncedAt,
    schemaVersion: normalised.schemaVersion,
    syncState: normalised.syncState,
  };
}

export async function saveOfflineLibraryBundle({
  userId,
  talks,
  sets,
  talkStatusById,
}: OfflineLibraryBundleInput): Promise<OfflineBootstrapRecord> {
  const normalisedStatuses = Object.fromEntries(
    talks.map((talk) => [talk._id, normaliseTalkStatus(talk._id, talkStatusById[talk._id])])
  );

  await Promise.all([
    ...Object.entries(normalisedStatuses).map(([talkId, status]) => set(statusKey(userId, talkId), status, statusStore)),
    saveLastUserId(userId),
  ]);

  const record: OfflineBootstrapRecord = {
    schemaVersion: SCHEMA_VERSION,
    userId,
    lastSyncedAt: Date.now(),
    library: {
      talkCount: talks.length,
      setCount: sets.length,
    },
    talks,
    sets,
    talkStatusById: normalisedStatuses,
    syncState: 'ready',
  };

  await saveOfflineBootstrap(record);
  return record;
}

export async function pruneOfflineLibraryData(userId: string, liveTalkIds: string[]): Promise<void> {
  const liveTalkIdSet = new Set(liveTalkIds);
  const prefixedStatusKeys = await keys<string>(statusStore);

  await Promise.all(
    prefixedStatusKeys
      .filter((key) => key.startsWith(`status:${userId}:`))
      .map(async (key) => {
        const talkId = key.slice(`status:${userId}:`.length);
        if (liveTalkIdSet.has(talkId)) return;
        await deleteTalkPreparedState(userId, talkId);
      })
  );

  const cachedTalks = await listTalkData();
  await Promise.all(
    cachedTalks
      .filter((talk) => !liveTalkIdSet.has(talk._id))
      .map(async (talk) => {
        await deleteTalkData(talk._id);
        await clearTalkAudio(talk._id);
      })
  );
}

export async function rebuildOfflineBootstrapFromCachedTalks(
  userId?: string
): Promise<OfflineBootstrapRecord | undefined> {
  const resolvedUserId = userId ?? await getLastUserId();
  if (!resolvedUserId) return undefined;

  const cachedTalks = await listTalkData();
  if (cachedTalks.length === 0) return undefined;

  const existingStatuses = await getAllTalkPreparedStates(
    resolvedUserId,
    cachedTalks.map((talk) => talk._id)
  );

  const talkStatusById = Object.fromEntries(
    cachedTalks.map((talk) => [
      talk._id,
      normaliseTalkStatus(talk._id, existingStatuses[talk._id] ?? {
        hasDocument: true,
        hasAudio: false,
        segmentCount: talk.segments.length,
        cachedAudioSegments: 0,
        lastPreparedAt: null,
      }),
    ])
  );

  const lastSyncedAt = cachedTalks.reduce((latest, talk) => {
    const statusPreparedAt = talkStatusById[talk._id]?.lastPreparedAt ?? 0;
    return Math.max(latest, talk.updatedAt, statusPreparedAt);
  }, 0) || Date.now();

  return {
    schemaVersion: SCHEMA_VERSION,
    userId: resolvedUserId,
    lastSyncedAt,
    library: {
      talkCount: cachedTalks.length,
      setCount: 0,
    },
    talks: cachedTalks.map((talk) => ({ _id: talk._id, title: talk.title })),
    sets: [],
    talkStatusById,
    syncState: 'partial',
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

  await saveOfflineLibraryBundle({
    userId,
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
  const normalisedState = normaliseTalkStatus(talkId, state);
  await set(statusKey(userId, talkId), normalisedState, statusStore);

  const currentBootstrap = normaliseBootstrap(
    await get<LegacyBootstrapRecord>(bootstrapKey(userId), bootstrapStore)
  );

  if (!currentBootstrap) {
    await saveLastUserId(userId);
    return;
  }

  await saveOfflineBootstrap({
    ...currentBootstrap,
    lastSyncedAt: Date.now(),
    talkStatusById: {
      ...currentBootstrap.talkStatusById,
      [talkId]: normalisedState,
    },
  });
}

export async function getTalkPreparedState(
  userId: string,
  talkId: string
): Promise<CachedTalkStatus | undefined> {
  const status = await get<CachedTalkStatus>(statusKey(userId, talkId), statusStore);
  return status ? normaliseTalkStatus(talkId, status) : undefined;
}

async function clearTalkAudio(talkId: string): Promise<void> {
  const audioKeys = await keys<string>();
  const talkKeys = audioKeys.filter((key) => key.includes(`:${talkId}:`));
  await Promise.all(talkKeys.map((key) => del(key)));
}
