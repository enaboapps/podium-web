'use client';

import { use } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTTS } from '@/hooks/useTTS';

export default function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');

  const apiKey = settings?.elevenLabsApiKey;
  const { speak, state, activeId } = useTTS(apiKey);

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    );
  }

  if (talk === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Talk not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <a href="/library" className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm">
          ← Library
        </a>
        <h1 className="text-base font-semibold truncate mx-4 flex-1 text-center">{talk.title}</h1>
        <div className="w-12" />
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

      {/* Segments */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {talk.segments.length === 0 && (
          <p className="text-center text-[var(--muted)] py-12 text-sm">
            This talk has no segments yet.
          </p>
        )}

        {talk.segments.map((segment) => {
          const isActive = activeId === segment.id;
          const isLoading = isActive && state === 'loading';
          const isPlaying = isActive && state === 'playing';

          return (
            <button
              key={segment.id}
              onClick={() => speak(segment.text, segment.id)}
              disabled={!apiKey}
              className={`w-full text-left px-5 py-5 rounded-2xl border transition-all active:scale-[0.98] ${
                isPlaying
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                  : isLoading
                  ? 'bg-[var(--surface)] border-[var(--primary)] text-[var(--foreground)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]'
              } disabled:opacity-50 disabled:cursor-default`}
            >
              <p className="text-base leading-relaxed">{segment.text}</p>
              {isLoading && (
                <p className="text-xs mt-2 opacity-60">Speaking...</p>
              )}
            </button>
          );
        })}
      </main>
    </div>
  );
}
