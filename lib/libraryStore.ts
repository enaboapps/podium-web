import { createStore, get, set } from 'idb-keyval';
import type { Doc } from '@/convex/_generated/dataModel';

const libraryStore = createStore('podium-library', 'snapshots');
const metaStore = createStore('podium-library-meta', 'meta');

export interface CachedLibrarySnapshot {
  userId: string;
  talks: Array<Pick<Doc<'talks'>, '_id' | 'title'>>;
  sets: Array<Pick<Doc<'talkSets'>, '_id' | 'title' | 'talkIds'>>;
  savedAt: number;
}

export async function saveLibrarySnapshot(
  userId: string,
  talks: CachedLibrarySnapshot['talks'],
  sets: CachedLibrarySnapshot['sets']
): Promise<void> {
  await Promise.all([
    set(`snapshot:${userId}`, { userId, talks, sets, savedAt: Date.now() } satisfies CachedLibrarySnapshot, libraryStore),
    set('lastUserId', userId, metaStore),
  ]);
}

export async function getLibrarySnapshot(userId: string): Promise<CachedLibrarySnapshot | undefined> {
  return get<CachedLibrarySnapshot>(`snapshot:${userId}`, libraryStore);
}

export async function getLastLibraryUserId(): Promise<string | undefined> {
  return get<string>('lastUserId', metaStore);
}
