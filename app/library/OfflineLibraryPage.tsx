'use client';

import { useEffect, useMemo, useState } from 'react';
import { OfflineBanner } from '@/components/offline/OfflineBanner';
import { OfflineStatusBadge } from '@/components/offline/OfflineStatusBadge';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { listTalkData } from '@/lib/audioStore';

type Tab = 'talks' | 'sets';

export default function OfflineLibraryPage() {
  const { library, lastSyncedAt, syncState } = useOfflineBoot();
  const [tab, setTab] = useState<Tab>('talks');
  const [cachedTalkIds, setCachedTalkIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadCachedTalks() {
      const talks = await listTalkData();
      if (cancelled) return;
      setCachedTalkIds(new Set(talks.map((talk) => talk._id)));
    }

    void loadCachedTalks();

    return () => {
      cancelled = true;
    };
  }, []);

  const partialDetail = useMemo(() => (
    syncState === 'partial'
      ? 'Recovered cached talks from this device. Some set or readiness metadata may be incomplete.'
      : undefined
  ), [syncState]);

  if (!library) {
    return (
      <OfflineUnavailable
        title="Offline library unavailable"
        message="Podium needs one successful online sync on this device before the library can be used offline."
      />
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Podium</h1>
        <span className="text-sm text-[var(--muted)]">Offline</span>
      </header>

      <div className="px-4 pt-4">
        <OfflineBanner lastSyncedAt={lastSyncedAt} detail={partialDetail} />
      </div>

      <div className="mt-4 flex border-y border-[var(--border)]">
        {(['talks', 'sets'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                : 'text-[var(--muted)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {tab === 'talks' && (
          <>
            {library.talks.length === 0 && (
              <p className="text-center text-[var(--muted)] py-12 text-sm">No synced talks are available on this device.</p>
            )}
            {library.talks.map((talk) => {
              const status = library.talkStatusById[talk._id];
              const canOpen = status?.hasDocument || cachedTalkIds.has(talk._id);

              return (
                <div key={talk._id} className="flex items-center justify-between bg-[var(--surface)] rounded-xl px-4 py-4 gap-3">
                  <div className="min-w-0 flex-1">
                    {canOpen ? (
                      <a href={`/talk/${talk._id}`} className="block truncate font-medium text-[var(--foreground)]">
                        {talk.title}
                      </a>
                    ) : (
                      <span className="block truncate font-medium text-[var(--muted)]">{talk.title}</span>
                    )}
                    <div className="mt-2">
                      <OfflineStatusBadge
                        status={status}
                        documentAvailable={cachedTalkIds.has(talk._id)}
                      />
                    </div>
                  </div>
                  {!canOpen && (
                    <span className="text-xs text-[var(--muted)]">Unavailable</span>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === 'sets' && (
          <>
            {library.sets.length === 0 && (
              <p className="text-center text-[var(--muted)] py-12 text-sm">No synced sets are available on this device.</p>
            )}
            {library.sets.map((set) => (
              <div key={set._id} className="bg-[var(--surface)] rounded-xl px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--foreground)]">{set.title}</span>
                  <span className="text-xs text-[var(--muted)]">Offline only</span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {set.talkIds.length} {set.talkIds.length === 1 ? 'talk' : 'talks'}
                </p>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
