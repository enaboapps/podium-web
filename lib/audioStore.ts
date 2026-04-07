import { get, set, keys, del, createStore } from 'idb-keyval';

// ─── Audio cache (default store) ─────────────────────────────────────────────

export async function getCachedAudio(key: string): Promise<Blob | undefined> {
  return get<Blob>(key);
}

export async function setCachedAudio(key: string, blob: Blob): Promise<void> {
  return set(key, blob);
}

export async function clearTalkAudio(talkId: string): Promise<void> {
  const allKeys = await keys<string>();
  // Keys are formatted as `${voiceKey}:${talkId}:...` — match by talkId between colons
  const talkKeys = allKeys.filter((k) => k.includes(`:${talkId}:`));
  await Promise.all(talkKeys.map((k) => del(k)));
}

// ─── Talk data cache (separate store for offline fallback) ───────────────────

const talkStore = createStore('podium-talks', 'talks');

export interface CachedTalk {
  _id: string;
  title: string;
  segments: Array<{ id: string; text: string; elements?: unknown[] }>;
  voiceKey: string; // `${provider}:${voiceId}` — used to reconstruct audio cache keys offline
}

export async function saveTalkData(id: string, talk: CachedTalk): Promise<void> {
  return set(id, talk, talkStore);
}

export async function getTalkData(id: string): Promise<CachedTalk | undefined> {
  return get<CachedTalk>(id, talkStore);
}
