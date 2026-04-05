'use client';

import { use, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const versions = useQuery(api.talks.getVersions, { talkId: id as Id<'talks'> });
  const restoreVersion = useMutation(api.talks.restoreVersion);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);

  async function handleRestore(versionId: Id<'talkVersions'>) {
    if (!clerkId) return;
    setRestoring(versionId);
    try {
      await restoreVersion({ talkId: id as Id<'talks'>, versionId, userId: clerkId });
      setRestored(versionId);
    } finally {
      setRestoring(null);
    }
  }

  function formatDate(timestamp: number) {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  }

  if (talk === undefined || versions === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <a href={`/talk/${id}/edit`} className="text-sm text-[var(--muted)]">← Edit</a>
        <span className="text-sm font-semibold">Version history</span>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {versions.length === 0 && (
          <p className="text-center text-[var(--muted)] py-12 text-sm">
            No versions yet. Versions are saved each time you edit.
          </p>
        )}

        {versions.map((v) => {
          const isExpanded = expandedId === v._id;
          const isRestoring = restoring === v._id;
          const isRestored = restored === v._id;

          return (
            <div
              key={v._id}
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden"
            >
              {/* Version header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : v._id)}
                className="w-full flex items-center justify-between px-4 py-4 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Version {v.version}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {formatDate(v._creationTime)} · {v.segments.length} segments
                    {v.segmentMode && ` · ${v.segmentMode}`}
                  </p>
                </div>
                <span className="text-[var(--muted)] text-xs">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded preview + restore */}
              {isExpanded && (
                <div className="border-t border-[var(--border)]">
                  {v.fullText ? (
                    <div className="px-4 py-3 max-h-48 overflow-y-auto">
                      <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                        {v.fullText}
                      </p>
                    </div>
                  ) : (
                    <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
                      {v.segments.map((s, i) => (
                        <p key={s.id} className="text-sm text-[var(--foreground)] leading-relaxed">
                          <span className="text-[var(--muted)] text-xs mr-2">{i + 1}</span>
                          {s.text}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="px-4 py-3 border-t border-[var(--border)]">
                    <button
                      onClick={() => handleRestore(v._id as Id<'talkVersions'>)}
                      disabled={isRestoring || isRestored}
                      className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 transition-opacity"
                    >
                      {isRestoring ? 'Restoring…' : isRestored ? 'Restored ✓' : 'Restore this version'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
