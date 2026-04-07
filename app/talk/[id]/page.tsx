'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getCachedAudio, setCachedAudio } from '@/lib/audioStore';
import { buildSSML, SegmentElement } from '@/lib/ssml';
import { fetchTTSBlob, TTSConfig } from '@/lib/tts';

type SpeakState = 'idle' | 'loading' | 'speaking' | 'spoken';

export default function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

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

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure = provider === 'azure';
  const ttsReady = isAzure
    ? !!(settings?.azureSubscriptionKey && settings?.azureRegion)
    : !!settings?.elevenLabsApiKey;

  const ttsConfig: TTSConfig | null = settings
    ? isAzure
      ? settings.azureSubscriptionKey && settings.azureRegion
        ? { provider: 'azure', subscriptionKey: settings.azureSubscriptionKey, region: settings.azureRegion, voiceId: settings.voiceId }
        : null
      : settings.elevenLabsApiKey
        ? { provider: 'elevenlabs', apiKey: settings.elevenLabsApiKey, voiceId: settings.voiceId }
        : null
    : null;

  const segments = talk?.segments ?? [];
  const current = segments[index];
  const isLast = index === segments.length - 1;
  const isLocked = speakState === 'loading' || speakState === 'speaking';

  useEffect(() => {
    if (!ttsConfig || segments.length === 0) return;

    const controller = new AbortController();
    const { signal } = controller;

    async function prepare() {
      const idbResults = await Promise.all(
        segments.map(async (seg, i) => {
          const cacheKey = seg.elements
            ? `${id}:ssml:${JSON.stringify(seg.elements)}`
            : `${id}:${seg.text}`;
          return { i, seg, key: cacheKey, blob: await getCachedAudio(cacheKey) };
        })
      );

      if (signal.aborted) return;

      const hits = idbResults.filter((r) => r.blob);
      const misses = idbResults.filter((r) => !r.blob);

      hits.forEach(({ i, blob }) => {
        audioUrls.current.set(i, URL.createObjectURL(blob!));
      });

      if (misses.length === 0) {
        setCacheLoaded(segments.length);
        setCacheReady(true);
        setCacheChecked(true);
        return;
      }

      setCacheLoaded(hits.length);
      setCacheChecked(true);

      let completed = hits.length;
      await Promise.all(
        misses.map(async ({ i, key, seg }) => {
          try {
            const ttsText = isAzure && seg.elements
              ? buildSSML(seg.elements as SegmentElement[])
              : seg.text;
            const blob = await fetchTTSBlob(ttsText, ttsConfig!);
            if (signal.aborted) return;
            await setCachedAudio(key, blob);
            audioUrls.current.set(i, URL.createObjectURL(blob));
          } catch (err) {
            if ((err as Error).name === 'AbortError') return;
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
    }

    prepare();

    return () => {
      controller.abort();
      audioUrls.current.forEach((url) => URL.revokeObjectURL(url));
      audioUrls.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsReady, id, segments.length]);

  function handleTap() {
    if (isLocked) return;
    if (speakState === 'spoken') {
      if (!isLast) doAdvanceAndSpeak();
      return;
    }
    doSpeak();
  }

  function doSpeak() { speakAt(index); }

  function doAdvance() {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex((i) => i + 1);
  }

  function doAdvanceAndSpeak() {
    audioRef.current?.pause();
    audioRef.current = null;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    speakAt(nextIndex);
  }

  async function speakAt(i: number) {
    const url = audioUrls.current.get(i);
    if (!url) { setSpeakState('idle'); return; }
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
    setIndex((i) => i - 1);
  }

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading…</p>
      </div>
    );
  }

  if (talk === null || segments.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">No segments in this talk.</p>
        <a href="/library" className="text-[var(--primary)] text-sm">← Library</a>
      </div>
    );
  }

  if (ttsReady && cacheChecked && !cacheReady) {
    const progress = segments.length > 0 ? cacheLoaded / segments.length : 0;
    return (
      <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <a href="/library" className="text-sm text-[var(--muted)]">← Library</a>
          <span className="text-xs text-[var(--muted)] truncate mx-4">{talk.title}</span>
          <div className="w-12" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <p className="text-sm text-[var(--muted)]">Preparing audio…</p>
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
          ← Library
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
          {speakState === 'loading' && 'Loading…'}
          {speakState === 'speaking' && 'Speaking…'}
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
        >←</button>
        {speakState === 'spoken' && isLast ? (
          <a href="/library" className="text-sm text-[var(--primary)] font-medium">Done</a>
        ) : (
          <div className="w-14" />
        )}
        <button
          onClick={() => speakState === 'spoken' ? doAdvance() : undefined}
          disabled={isLast || speakState !== 'spoken'}
          className="w-14 h-14 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] disabled:opacity-20 text-lg active:scale-95 transition-transform"
        >→</button>
      </div>
    </div>
  );
}
