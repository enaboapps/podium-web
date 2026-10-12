import { getCachedAudio, setCachedAudio } from '@/lib/audioStore';
import { DeliverySegment, getLoudnessOffsetDb, getSegmentAudioIdentity } from '@/lib/delivery';
import { fetchSegmentBlob, TTSConfig } from '@/lib/tts';

export function getSegmentAudioCacheKey(voiceKey: string, talkId: string, segment: DeliverySegment) {
  return `${voiceKey}:${talkId}:${getSegmentAudioIdentity(segment)}`;
}

/** A segment's cached speech, if it has been prepared for this voice. */
export function getCachedSegmentAudio(voiceKey: string, talkId: string, segment: DeliverySegment) {
  return getCachedAudio(getSegmentAudioCacheKey(voiceKey, talkId, segment), getLoudnessOffsetDb(segment));
}

const inFlight = new Map<string, Promise<Blob>>();

/**
 * Synthesize a segment's speech and cache it for this voice. Concurrent calls
 * for the same segment (e.g. an MP3 export while the talk page prepares
 * speech) share one request.
 */
export function generateSegmentAudio(
  voiceKey: string,
  talkId: string,
  segment: DeliverySegment,
  config: TTSConfig,
): Promise<Blob> {
  const key = getSegmentAudioCacheKey(voiceKey, talkId, segment);
  let request = inFlight.get(key);
  if (!request) {
    request = fetchSegmentBlob(segment, config)
      .then(async (blob) => {
        await setCachedAudio(key, blob);
        return blob;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
  }
  return request;
}

/**
 * A segment's speech from the cache, generating it if it's missing and a TTS
 * config is given. Undefined if it isn't cached and can't be generated.
 */
export async function ensureSegmentAudio(
  voiceKey: string,
  talkId: string,
  segment: DeliverySegment,
  config: TTSConfig | null,
): Promise<Blob | undefined> {
  const cached = await getCachedSegmentAudio(voiceKey, talkId, segment);
  if (cached || !config) return cached;
  return generateSegmentAudio(voiceKey, talkId, segment, config);
}
