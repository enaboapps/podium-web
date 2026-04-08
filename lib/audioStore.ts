import { createStore, del, get, keys, set } from 'idb-keyval';

export async function getCachedAudio(key: string): Promise<Blob | undefined> {
  return get<Blob>(key);
}

export async function setCachedAudio(key: string, blob: Blob): Promise<void> {
  return set(key, blob);
}

export async function clearTalkAudio(talkId: string): Promise<void> {
  const allKeys = await keys<string>();
  const talkKeys = allKeys.filter((key) => key.includes(`:${talkId}:`));
  await Promise.all(talkKeys.map((key) => del(key)));
}

const talkStore = createStore('podium-talks', 'talks');

export interface CachedTalk {
  _id: string;
  title: string;
  segments: Array<{ id: string; text: string; elements?: unknown[] }>;
  voiceKey?: string;
}

export async function saveTalkData(id: string, talk: CachedTalk): Promise<void> {
  return set(id, talk, talkStore);
}

export async function getTalkData(id: string): Promise<CachedTalk | undefined> {
  return get<CachedTalk>(id, talkStore);
}
