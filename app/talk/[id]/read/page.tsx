'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function ReadAloudPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldAdvanceRef = useRef(false);

  const apiKey = settings?.elevenLabsApiKey;
  const segments = talk?.segments ?? [];
  const current = segments[index];

  // Scroll active segment into view
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [index]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  async function speakSegment(i: number) {
    if (!apiKey || !segments[i]) return;

    setLoading(true);
    setIndex(i);

    try {
      const response = await fetch(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
        {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: segments[i].text,
            model_id: 'eleven_flash_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (!response.ok) throw new Error('TTS failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      setLoading(false);
      setPlaying(true);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (shouldAdvanceRef.current && i + 1 < segments.length) {
          speakSegment(i + 1);
        } else {
          setPlaying(false);
          setLoading(false);
        }
      };

      audio.onerror = () => {
        setPlaying(false);
        setLoading(false);
      };

      await audio.play();
    } catch {
      setPlaying(false);
      setLoading(false);
    }
  }

  function handlePlayPause() {
    if (loading) return;

    if (playing) {
      shouldAdvanceRef.current = false;
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
    } else {
      shouldAdvanceRef.current = true;
      speakSegment(index);
    }
  }

  function handleSegmentTap(i: number) {
    shouldAdvanceRef.current = playing;
    audioRef.current?.pause();
    audioRef.current = null;
    speakSegment(i);
  }

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <a href={`/talk/${id}`} className="text-[var(--muted)] text-sm">← Back</a>
        <h1 className="text-base font-semibold truncate mx-4 flex-1 text-center">{talk?.title}</h1>
        <span className="text-xs text-[var(--muted)] w-12 text-right">
          {index + 1} / {segments.length}
        </span>
      </header>

      {/* No API key banner */}
      {!apiKey && (
        <div className="mx-4 mt-4 px-4 py-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">Add your ElevenLabs key to enable speech.</p>
          <a href="/settings" className="text-sm text-[var(--primary)] font-medium whitespace-nowrap">
            Settings →
          </a>
        </div>
      )}

      {/* Segments list */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-32">
        {segments.map((segment, i) => {
          const isActive = i === index;
          const isPast = i < index;

          return (
            <button
              key={segment.id}
              ref={isActive ? activeRef : null}
              onClick={() => handleSegmentTap(i)}
              disabled={!apiKey}
              className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                isActive && (playing || loading)
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                  : isActive
                  ? 'bg-[var(--surface)] border-[var(--primary)] text-[var(--foreground)]'
                  : isPast
                  ? 'bg-transparent border-transparent text-[var(--muted)] opacity-50'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]'
              } disabled:cursor-default`}
            >
              <p className="text-base leading-relaxed">{segment.text}</p>
            </button>
          );
        })}
      </main>

      {/* Play/pause bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--background)] border-t border-[var(--border)] px-6 py-5 pb-safe-bottom flex items-center justify-center gap-6">
        <button
          onClick={() => {
            if (index > 0) {
              shouldAdvanceRef.current = playing;
              audioRef.current?.pause();
              audioRef.current = null;
              speakSegment(index - 1);
            }
          }}
          disabled={index === 0 || !apiKey}
          className="w-10 h-10 flex items-center justify-center text-[var(--muted)] disabled:opacity-30"
        >
          ←
        </button>

        <button
          onClick={handlePlayPause}
          disabled={!apiKey || segments.length === 0}
          className="w-16 h-16 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-2xl disabled:opacity-40 active:scale-95 transition-transform"
        >
          {loading ? '…' : playing ? '▐▐' : '▶'}
        </button>

        <button
          onClick={() => {
            if (index < segments.length - 1) {
              shouldAdvanceRef.current = playing;
              audioRef.current?.pause();
              audioRef.current = null;
              speakSegment(index + 1);
            }
          }}
          disabled={index === segments.length - 1 || !apiKey}
          className="w-10 h-10 flex items-center justify-center text-[var(--muted)] disabled:opacity-30"
        >
          →
        </button>
      </div>
    </div>
  );
}
