'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { getCachedAudio, saveTalkData, setCachedAudio } from '@/lib/audioStore';
import { getTalkPreparedState, saveTalkPreparedState } from '@/lib/offlineStore';
import { buildSSML, SegmentElement } from '@/lib/ssml';
import { fetchTTSBlob, TTSConfig } from '@/lib/tts';
import OfflineTalkPage from './OfflineTalkPage';

type SpeakState = 'idle' | 'loading' | 'speaking' | 'spoken';

export default function OnlineTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useOnlineCurrentUser();
  const { library } = useOfflineBoot();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');

  const [index, setIndex] = useState(0);
  const [speakState, setSpeakState] = useState<SpeakState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrls = useRef<Map<number, string>>(new Map());
  const [cacheLoaded, setCacheLoaded] = useState(0);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheFailed, setCacheFailed] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [forceOfflineFallback, setForceOfflineFallback] = useState(false);

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure = provider === 'azure';
  const ttsReady = isAzure
    ? !!(settings?.azureSubscriptionKey && settings?.azureRegion)
    : !!settings?.elevenLabsApiKey;

  const ttsConfig: TTSConfig | null = useMemo(() => (
    settings
      ? isAzure
        ? settings.azureSubscriptionKey && settings.azureRegion
          ? { provider: 'azure', subscriptionKey: settings.azureSubscriptionKey, region: settings.azureRegion, voiceId: settings.voiceId }
          : null
        : settings.elevenLabsApiKey
          ? { provider: 'elevenlabs', apiKey: settings.elevenLabsApiKey, voiceId: settings.voiceId }
          : null
      : null
  ), [isAzure, settings]);

  const effectiveTalk = talk ?? undefined;
  const segments = useMemo(() => effectiveTalk?.segments ?? [], [effectiveTalk]);
  const voiceKey = `${provider}:${settings?.voiceId ?? 'default'}`;

  useEffect(() => {
    if (talk !== undefined) {
      setForceOfflineFallback(false);
      return;
    }

    if (!library) return;

    const timeout = setTimeout(() => {
      setForceOfflineFallback(true);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [library, talk]);

  useEffect(() => {
    if (!talk) return;

    const userId = clerkId;
    void saveTalkData(id, {
      _id: talk._id,
      title: talk.title,
      segments: talk.segments,
      voiceKey,
      updatedAt: Date.now(),
    });

    if (!userId) return;

    void (async () => {
      const existingStatus = await getTalkPreparedState(userId, id);
      await saveTalkPreparedState(userId, id, {
        talkId: id,
        hasDocument: true,
        hasAudio: existingStatus?.hasAudio ?? false,
        segmentCount: talk.segments.length,
        cachedAudioSegments: existingStatus?.cachedAudioSegments ?? 0,
        lastPreparedAt: existingStatus?.lastPreparedAt ?? null,
      });
    })();
  }, [clerkId, id, talk, voiceKey]);

  useEffect(() => {
    if (!ttsConfig || segments.length === 0 || !clerkId) return;

    const userId = clerkId;
    const activeTtsConfig = ttsConfig;
    const controller = new AbortController();
    const { signal } = controller;
    const currentAudioUrls = audioUrls.current;

    async function prepare() {
      const idbResults = await Promise.all(
        segments.map(async (segment, segmentIndex) => {
          const cacheKey = segment.elements
            ? `${voiceKey}:${id}:ssml:${JSON.stringify(segment.elements)}`
            : `${voiceKey}:${id}:${segment.text}`;
          return { segmentIndex, segment, cacheKey, blob: await getCachedAudio(cacheKey) };
        })
      );

      if (signal.aborted) return;

      const hits = idbResults.filter((result) => result.blob);
      const misses = idbResults.filter((result) => !result.blob);

      hits.forEach(({ segmentIndex, blob }) => {
        currentAudioUrls.set(segmentIndex, URL.createObjectURL(blob!));
      });

      if (misses.length === 0) {
        setCacheLoaded(segments.length);
        setCacheReady(true);
        setCacheChecked(true);
        await saveTalkPreparedState(userId, id, {
          talkId: id,
          hasDocument: true,
          hasAudio: true,
          segmentCount: segments.length,
          cachedAudioSegments: segments.length,
          lastPreparedAt: Date.now(),
        });
        return;
      }

      setCacheLoaded(hits.length);
      setCacheChecked(true);

      let completed = hits.length;
      let hadFailure = false;

      await Promise.all(
        misses.map(async ({ segmentIndex, cacheKey, segment }) => {
          try {
            const ttsText = isAzure && segment.elements
              ? buildSSML(segment.elements as SegmentElement[])
              : segment.text;
            const blob = await fetchTTSBlob(ttsText, activeTtsConfig);
            if (signal.aborted) return;
            await setCachedAudio(cacheKey, blob);
            audioUrls.current.set(segmentIndex, URL.createObjectURL(blob));
          } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            hadFailure = true;
            setCacheFailed(true);
          } finally {
            if (!signal.aborted) {
              completed++;
              setCacheLoaded(completed);
              if (completed === segments.length) setCacheReady(true);
            }
          }
        })
      );

      await saveTalkPreparedState(userId, id, {
        talkId: id,
        hasDocument: true,
        hasAudio: !hadFailure && currentAudioUrls.size === segments.length,
        segmentCount: segments.length,
        cachedAudioSegments: currentAudioUrls.size,
        lastPreparedAt: currentAudioUrls.size > 0 ? Date.now() : null,
      });
    }

    void prepare();

    return () => {
      controller.abort();
      currentAudioUrls.forEach((url) => URL.revokeObjectURL(url));
      currentAudioUrls.clear();
    };
  }, [clerkId, id, isAzure, segments, ttsConfig, voiceKey]);

  const current = segments[index];
  const isLast = index === segments.length - 1;
  const isLocked = speakState === 'loading' || speakState === 'speaking';

  function handleTap() {
    if (isLocked) return;
    if (speakState === 'spoken') {
      if (!isLast) doAdvanceAndSpeak();
      return;
    }
    doSpeak();
  }

  function doSpeak() {
    void speakAt(index);
  }

  function doAdvance() {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex((prev) => prev + 1);
  }

  function doAdvanceAndSpeak() {
    audioRef.current?.pause();
    audioRef.current = null;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    void speakAt(nextIndex);
  }

  async function speakAt(targetIndex: number) {
    const url = audioUrls.current.get(targetIndex);
    if (!url) {
      setSpeakState('idle');
      return;
    }

    setSpeakState('loading');
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setSpeakState('spoken');
    audio.onerror = () => setSpeakState('idle');

    try {
      setSpeakState('speaking');
      await audio.play();
    } catch {
      setSpeakState('idle');
    }
  }

  function back() {
    if (isLocked || index === 0) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex((prev) => prev - 1);
  }

  if (forceOfflineFallback && library) {
    return <OfflineTalkPage params={params} />;
  }

  if (effectiveTalk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">No segments in this talk.</p>
        <a href="/library" className="text-[var(--primary)] text-sm">Back to library</a>
      </div>
    );
  }

  if (ttsReady && cacheChecked && !cacheReady) {
    const progress = segments.length > 0 ? cacheLoaded / segments.length : 0;
    return (
      <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <a href="/library" className="text-sm text-[var(--muted)]">Back to library</a>
          <span className="text-xs text-[var(--muted)] truncate mx-4">{effectiveTalk.title}</span>
          <div className="w-12" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <p className="text-sm text-[var(--muted)]">Preparing audio...</p>
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-xs text-[var(--muted)] mt-2 text-center">
              {cacheLoaded} / {segments.length}
            </p>
          </div>
          {cacheFailed && (
            <button onClick={() => setCacheReady(true)} className="text-sm text-[var(--primary)]">
              Continue anyway
            </button>
          )}
        </div>
      </div>
    );
  }

  const noTTSMessage = isAzure ? 'Add Azure credentials in Settings' : 'Add ElevenLabs key in Settings';

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <a
          href="/library"
          className={`text-sm transition-colors ${isLocked ? 'pointer-events-none text-transparent' : 'text-[var(--muted)]'}`}
        >
          Back to library
        </a>
        <span className="text-xs text-[var(--muted)]">
          {index + 1} / {segments.length}
        </span>
        <a
          href={`/talk/${id}/edit`}
          className={`text-xs w-12 text-right transition-colors ${isLocked ? 'pointer-events-none text-transparent' : 'text-[var(--muted)]'}`}
        >
          Edit
        </a>
      </header>

      <div className="h-1 bg-[var(--border)]">
        <div
          className="h-full bg-[var(--primary)] rounded-r-full transition-all duration-300"
          style={{ width: `${((index + 1) / segments.length) * 100}%` }}
        />
      </div>

      <button
        onClick={handleTap}
        disabled={!ttsReady || isLocked}
        className="flex-1 flex flex-col items-center justify-center px-8 py-12 w-full disabled:cursor-default"
      >
        <div className={`px-6 py-8 rounded-3xl transition-all duration-500 ${
          speakState === 'speaking' ? 'ring-2 ring-[var(--primary)]/30 bg-[var(--surface)]' : ''
        }`}>
          <p className="text-3xl leading-snug font-semibold text-center text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
            {current.text}
          </p>
        </div>
        <p className={`mt-8 text-sm transition-colors ${
          speakState === 'loading' ? 'text-[var(--muted)] animate-pulse' :
          speakState === 'speaking' ? 'text-[var(--primary)]' :
          'text-[var(--muted)]'
        }`}>
          {speakState === 'loading' && 'Loading...'}
          {speakState === 'speaking' && 'Speaking...'}
          {speakState === 'spoken' && (isLast ? 'Done' : 'Tap to advance')}
          {speakState === 'idle' && (ttsReady ? 'Tap to speak' : noTTSMessage)}
        </p>
      </button>

      <div className={`flex items-center justify-between px-8 pb-10 transition-opacity duration-200 ${
        isLocked ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        <button
          onClick={back}
          disabled={index === 0}
          className="w-14 h-14 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] disabled:opacity-20 text-lg active:scale-95 transition-transform"
        >{'<-'}</button>
        {speakState === 'spoken' && isLast ? (
          <a href="/library" className="text-sm text-[var(--primary)] font-medium">Done</a>
        ) : (
          <div className="w-14" />
        )}
        <button
          onClick={() => speakState === 'spoken' ? doAdvance() : undefined}
          disabled={isLast || speakState !== 'spoken'}
          className="w-14 h-14 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] disabled:opacity-20 text-lg active:scale-95 transition-transform"
        >{'->'}</button>
      </div>
    </div>
  );
}
