import { createStore, del, get, keys, set } from 'idb-keyval';
import { DeliverySegment, getSegmentAudioIdentity } from '@/lib/delivery';
import { isNormalisedAudio, normaliseSpeechBlob } from '@/lib/loudness';

export type CachedSegment = DeliverySegment & { id: string };

/** Cached speech, normalised for loudness. Audio cached before normalisation is converted once and saved back. */
export async function getCachedAudio(key: string): Promise<Blob | undefined> {
  const blob = await get<Blob>(key);
  if (!blob || isNormalisedAudio(blob)) return blob;
  const normalised = await normaliseSpeechBlob(blob);
  if (isNormalisedAudio(normalised)) await set(key, normalised);
  return normalised;
}

export async function setCachedAudio(key: string, blob: Blob): Promise<void> {
  return set(key, blob);
}

export async function clearTalkAudio(talkId: string): Promise<void> {
  const allKeys = await keys<string>();
  const talkKeys = allKeys.filter((key) => key.includes(`:${talkId}:`));
  await Promise.all(talkKeys.map((key) => del(key)));
}

export async function clearStaleSegmentAudio(
  talkId: string,
  newSegments: DeliverySegment[]
): Promise<void> {
  const allKeys = await keys<string>();
  const marker = `:${talkId}:`;
  const talkKeys = allKeys.filter((key) => key.includes(marker));

  const validSuffixes = new Set(newSegments.map(getSegmentAudioIdentity));

  const staleKeys = talkKeys.filter((key) => {
    const idx = key.indexOf(marker);
    const suffix = key.slice(idx + marker.length);
    return !validSuffixes.has(suffix);
  });

  await Promise.all(staleKeys.map((key) => del(key)));
}

const talkStore = createStore('podium-talks', 'talks');

export interface CachedTalk {
  _id: string;
  title: string;
  segments: CachedSegment[];
  voiceKey?: string;
  updatedAt: number;
}

export async function saveTalkData(id: string, talk: CachedTalk): Promise<void> {
  const existing = await get<CachedTalk>(id, talkStore);
  return set(id, {
    ...existing,
    ...talk,
    voiceKey: talk.voiceKey ?? existing?.voiceKey,
  }, talkStore);
}

export async function getTalkData(id: string): Promise<CachedTalk | undefined> {
  return get<CachedTalk>(id, talkStore);
}

export async function saveTalkDocuments(talks: CachedTalk[]): Promise<void> {
  await Promise.all(talks.map((talk) => saveTalkData(talk._id, talk)));
}

export async function listTalkData(): Promise<CachedTalk[]> {
  const talkKeys = await keys<string>(talkStore);
  const talks = await Promise.all(talkKeys.map((key) => get<CachedTalk>(key, talkStore)));
  return talks.filter((talk): talk is CachedTalk => !!talk);
}

export async function deleteTalkData(id: string): Promise<void> {
  await del(id, talkStore);
}
