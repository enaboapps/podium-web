'use client';

import { use, useEffect, useRef, useState } from 'react';
import { OfflineBanner } from '@/components/offline/OfflineBanner';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { getCachedAudio, getTalkData, type CachedTalk } from '@/lib/audioStore';

type SpeakState = 'idle' | 'loading' | 'speaking' | 'spoken';

export default function OfflineTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { library, lastSyncedAt } = useOfflineBoot();
  const [talk, setTalk] = useState<CachedTalk | null | undefined>(undefined);
  const [loadedAudioCount, setLoadedAudioCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [speakState, setSpeakState] = useState<SpeakState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrls = useRef<Map<number, string>>(new Map());

  const status = library?.talkStatusById[id];

  useEffect(() => {
    let cancelled = false;

    async function loadTalk() {
      const cachedTalk = await getTalkData(id);
      if (cancelled) return;
      setTalk(cachedTalk ?? null);
    }

    void loadTalk();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!talk?.voiceKey || talk.segments.length === 0) return;

    const cachedTalk = talk;
    let cancelled = false;
    const currentAudioUrls = audioUrls.current;

    async function loadAudio() {
      const results = await Promise.all(
        cachedTalk.segments.map(async (segment, segmentIndex) => {
          const cacheKey = segment.elements
            ? `${cachedTalk.voiceKey}:${id}:ssml:${JSON.stringify(segment.elements)}`
            : `${cachedTalk.voiceKey}:${id}:${segment.text}`;
          const blob = await getCachedAudio(cacheKey);
          return { segmentIndex, blob };
        })
      );

      if (cancelled) return;

      results.forEach(({ segmentIndex, blob }) => {
        if (!blob) return;
        currentAudioUrls.set(segmentIndex, URL.createObjectURL(blob));
      });

      setLoadedAudioCount(currentAudioUrls.size);
    }

    void loadAudio();

    return () => {
      cancelled = true;
      currentAudioUrls.forEach((url) => URL.revokeObjectURL(url));
      currentAudioUrls.clear();
    };
  }, [id, status?.hasAudio, talk]);

  const segments = talk?.segments ?? [];
  const audioReady = !!status?.hasAudio && !!talk?.voiceKey && loadedAudioCount === segments.length && segments.length > 0;
  const current = segments[index];
  const isLast = index === segments.length - 1;
  const isLocked = speakState === 'loading' || speakState === 'speaking';

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

  function handleTap() {
    if (isLocked || !audioReady) return;
    if (speakState === 'spoken') {
      if (!isLast) {
        const nextIndex = index + 1;
        setIndex(nextIndex);
        void speakAt(nextIndex);
      }
      return;
    }

    void speakAt(index);
  }

  function back() {
    if (isLocked || index === 0) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex((prev) => prev - 1);
  }

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading cached talk...</p>
      </div>
    );
  }

  if (talk === null) {
    return (
      <OfflineUnavailable
        title="Talk unavailable offline"
        message="This talk was not prepared on this device before going offline."
      />
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <a href="/library" className="text-sm text-[var(--muted)]">Back to library</a>
        <span className="text-xs text-[var(--muted)]">
          {segments.length === 0 ? 0 : index + 1} / {segments.length}
        </span>
        <span className="w-20 text-right text-xs text-[var(--muted)]">Offline</span>
      </header>

      <div className="px-5 pb-4">
        <OfflineBanner lastSyncedAt={lastSyncedAt} />
      </div>

      {!audioReady && (
        <div className="mx-5 mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-sm text-[var(--foreground)]">This talk was not fully prepared for offline playback.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {status?.hasAudio
              ? 'The script is available, but cached speech audio is incomplete.'
              : 'The script is available, but cached speech audio has not been prepared for offline use.'}
          </p>
        </div>
      )}

      {segments.length === 0 ? (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--background)]">
          <p className="text-[var(--muted)] text-sm">No segments in this talk.</p>
          <a href="/library" className="text-[var(--primary)] text-sm">Back to library</a>
        </div>
      ) : (
        <>
          <div className="h-1 bg-[var(--border)]">
            <div
              className="h-full bg-[var(--primary)] rounded-r-full transition-all duration-300"
              style={{ width: `${((index + 1) / segments.length) * 100}%` }}
            />
          </div>

          <button
            onClick={handleTap}
            disabled={!audioReady || isLocked}
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
              {speakState === 'idle' && (audioReady ? 'Tap to speak' : 'Speech unavailable offline')}
            </p>
          </button>

          {/* Next segment preview */}
          <div className="flex items-baseline gap-2 px-6 py-2 min-h-[2rem]">
            {!isLast && (
              <>
                <span className="text-xs text-[var(--muted)] shrink-0">Next</span>
                <span className="text-sm text-[var(--muted)]/70 truncate">{segments[index + 1]?.text}</span>
              </>
            )}
          </div>

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
              onClick={() => {
                if (isLocked || isLast) return;
                audioRef.current?.pause();
                audioRef.current = null;
                setSpeakState('idle');
                setIndex((prev) => prev + 1);
              }}
              disabled={isLocked || isLast}
              className="w-14 h-14 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] disabled:opacity-20 text-lg active:scale-95 transition-transform"
            >{'->'}</button>
          </div>
        </>
      )}
    </div>
  );
}
