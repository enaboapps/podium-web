import { clearTalkAudio, saveTalkData } from '@/lib/audioStore';
import { saveTalkPreparedState } from '@/lib/offlineStore';

interface ReplaceCachedTalkDocumentArgs {
  talkId: string;
  title: string;
  segments: Array<{ id: string; text: string; elements?: unknown[] }>;
  voiceKey?: string;
}

interface MarkTalkDocumentOnlyArgs {
  userId: string;
  talkId: string;
  segmentCount: number;
}

interface InvalidateTalkOfflineStateArgs extends ReplaceCachedTalkDocumentArgs {
  userId: string;
}

export async function replaceCachedTalkDocument({
  talkId,
  title,
  segments,
  voiceKey,
}: ReplaceCachedTalkDocumentArgs): Promise<void> {
  await saveTalkData(talkId, {
    _id: talkId,
    title,
    segments,
    voiceKey,
    updatedAt: Date.now(),
  });
}

export async function markTalkDocumentOnly({
  userId,
  talkId,
  segmentCount,
}: MarkTalkDocumentOnlyArgs): Promise<void> {
  await saveTalkPreparedState(userId, talkId, {
    talkId,
    hasDocument: true,
    hasAudio: false,
    segmentCount,
    cachedAudioSegments: 0,
    lastPreparedAt: null,
  });
}

export async function invalidateTalkOfflineState({
  userId,
  talkId,
  title,
  segments,
  voiceKey,
}: InvalidateTalkOfflineStateArgs): Promise<void> {
  await replaceCachedTalkDocument({ talkId, title, segments, voiceKey });
  await clearTalkAudio(talkId);
  await markTalkDocumentOnly({ userId, talkId, segmentCount: segments.length });
}
