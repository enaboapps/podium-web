'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getCachedAudio, setCachedAudio } from '@/lib/audioStore';

const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM';

type SpeakState = 'idle' | 'loading' | 'speaking' | 'spoken';

export default function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');

  const [index, setIndex] = useState(0);
  const [speakState, setSpeakState] = useState<SpeakState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio cache
  const audioUrls = useRef<Map<number, string>>(new Map());
  const [cacheLoaded, setCacheLoaded] = useState(0);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheFailed, setCacheFailed] = useState(false);
  // True once we know whether network fetching is needed — avoids flash on repeat visits
  const [cacheChecked, setCacheChecked] = useState(false);

  const apiKey = settings?.elevenLabsApiKey;
  const segments = talk?.segments ?? [];
  const current = segments[index];
  const isLast = index === segments.length - 1;
  const isLocked = speakState === 'loading' || speakState === 'speaking';

  // Pre-cache all segments into IndexedDB
  useEffect(() => {
    if (!apiKey || segments.length === 0) return;

    const controller = new AbortController();
    const { signal } = controller;

    async function prepare() {
      // Phase 1: read everything from IDB in parallel
      const idbResults = await Promise.all(
        segments.map(async (seg, i) => ({
          i,
          seg,
          key: `${id}:${seg.text}`,
          blob: await getCachedAudio(`${id}:${seg.text}`),
        }))
      );

      if (signal.aborted) return;

      const hits = idbResults.filter((r) => r.blob);
      const misses = idbResults.filter((r) => !r.blob);

      // Load cached blobs immediately
      hits.forEach(({ i, blob }) => {
        audioUrls.current.set(i, URL.createObjectURL(blob!));
      });

      // If everything was cached, we're done — no loading screen needed
      if (misses.length === 0) {
        setCacheLoaded(segments.length);
        setCacheReady(true);
        setCacheChecked(true);
        return;
      }

      // Some segments need network — show loading screen
      setCacheLoaded(hits.length);
      setCacheChecked(true);

      let completed = hits.length;
      await Promise.all(
        misses.map(async ({ i, key, seg }) => {
          try {
            const res = await fetch(TTS_URL, {
              method: 'POST',
              headers: { 'xi-api-key': apiKey!, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: seg.text,
                model_id: 'eleven_flash_v2_5',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
              }),
              signal,
            });
            if (!res.ok) throw new Error('TTS failed');
            const blob = await res.blob();
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
  }, [apiKey, id, segments.length]);

  function handleTap() {
    if (isLocked) return;
    if (speakState === 'spoken') {
      if (!isLast) doAdvanceAndSpeak();
      return;
    }
    doSpeak();
  }

  function doSpeak() {
    speakAt(index);
  }

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

  // Loading screen — only shown when network fetching is needed (cacheChecked but not ready)
  if (apiKey && cacheChecked && !cacheReady) {
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
            <button
              onClick={() => setCacheReady(true)}
              className="text-sm text-[var(--primary)]"
            >
              Continue anyway
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
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

      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--border)] mx-5">
        <div
          className="h-full bg-[var(--primary)] transition-all duration-300"
          style={{ width: `${((index + 1) / segments.length) * 100}%` }}
        />
      </div>

      {/* Main tap area */}
      <button
        onClick={handleTap}
        disabled={!apiKey || isLocked}
        className="flex-1 flex flex-col items-center justify-center px-8 py-12 w-full disabled:cursor-default active:opacity-80"
      >
        <p className="text-2xl leading-relaxed font-medium text-center text-[var(--foreground)]">
          {current.text}
        </p>

        <p className={`mt-8 text-xs transition-colors ${
          speakState === 'loading' ? 'text-[var(--muted)] animate-pulse' :
          speakState === 'speaking' ? 'text-[var(--primary)]' :
          speakState === 'spoken' ? 'text-[var(--muted)]' :
          'text-[var(--muted)]'
        }`}>
          {speakState === 'loading' && 'Loading…'}
          {speakState === 'speaking' && 'Speaking…'}
          {speakState === 'spoken' && (isLast ? 'Done' : 'Tap to advance')}
          {speakState === 'idle' && (apiKey ? 'Tap to speak' : 'Add ElevenLabs key in Settings')}
        </p>
      </button>

      {/* Nav — hidden while locked */}
      <div
        className={`flex items-center justify-between px-8 pb-10 transition-opacity duration-200 ${
          isLocked ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <button
          onClick={back}
          disabled={index === 0}
          className="w-12 h-12 flex items-center justify-center text-[var(--muted)] disabled:opacity-20 text-xl"
        >
          ←
        </button>

        {speakState === 'spoken' && isLast ? (
          <a href="/library" className="text-sm text-[var(--primary)] font-medium">
            Done
          </a>
        ) : (
          <div className="w-12" />
        )}

        <button
          onClick={() => speakState === 'spoken' ? doAdvance() : undefined}
          disabled={isLast || speakState !== 'spoken'}
          className="w-12 h-12 flex items-center justify-center text-[var(--muted)] disabled:opacity-20 text-xl"
        >
          →
        </button>
      </div>
    </div>
  );
}
