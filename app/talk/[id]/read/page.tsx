'use client';

import { use, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const [index, setIndex] = useState(0);

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    );
  }

  if (talk === null || talk.segments.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] flex-col gap-4">
        <p className="text-[var(--muted)] text-sm">Nothing to read.</p>
        <a href={`/talk/${id}`} className="text-[var(--primary)] text-sm">← Back</a>
      </div>
    );
  }

  const segments = talk.segments;
  const current = segments[index];
  const isFirst = index === 0;
  const isLast = index === segments.length - 1;

  function advance() {
    if (!isLast) setIndex((i) => i + 1);
  }

  function back() {
    if (!isFirst) setIndex((i) => i - 1);
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)] select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <a
          href={`/talk/${id}`}
          className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]"
        >
          ✕
        </a>
        <span className="text-xs text-[var(--muted)]">
          {index + 1} / {segments.length}
        </span>
        <div className="w-6" />
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--border)] mx-5">
        <div
          className="h-full bg-[var(--primary)] transition-all duration-300"
          style={{ width: `${((index + 1) / segments.length) * 100}%` }}
        />
      </div>

      {/* Card — tap right half to advance, left half to go back */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="relative w-full max-w-lg flex items-center justify-center">
          {/* Back zone */}
          <div
            className="absolute left-0 top-0 h-full w-1/3 z-10 cursor-pointer"
            onClick={back}
          />
          {/* Advance zone */}
          <div
            className="absolute right-0 top-0 h-full w-2/3 z-10 cursor-pointer"
            onClick={advance}
          />

          <p className="text-2xl leading-relaxed font-medium text-center text-[var(--foreground)]">
            {current.text}
          </p>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="flex justify-between items-center px-8 pb-8 text-xs text-[var(--muted)]">
        <span className={isFirst ? 'invisible' : ''}>← Back</span>
        {isLast ? (
          <a href={`/talk/${id}`} className="text-[var(--primary)] font-medium">
            Done
          </a>
        ) : (
          <span>Tap to advance →</span>
        )}
      </div>
    </div>
  );
}
