import { get, set, keys, del } from 'idb-keyval';

export async function getCachedAudio(key: string): Promise<Blob | undefined> {
  return get<Blob>(key);
}

export async function setCachedAudio(key: string, blob: Blob): Promise<void> {
  return set(key, blob);
}

export async function clearTalkAudio(talkId: string): Promise<void> {
  const allKeys = await keys<string>();
  const talkKeys = allKeys.filter((k) => k.startsWith(`${talkId}:`));
  await Promise.all(talkKeys.map((k) => del(k)));
}
