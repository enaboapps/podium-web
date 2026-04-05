'use client';

import { use, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function SetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const set = useQuery(api.talkSets.get, { id: id as Id<'talkSets'> });
  const allTalks = useQuery(api.talks.list, clerkId ? { userId: clerkId } : 'skip');
  const addTalk = useMutation(api.talkSets.addTalk);
  const removeTalk = useMutation(api.talkSets.removeTalk);

  const [showPicker, setShowPicker] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  if (set === undefined || allTalks === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading…</p>
      </div>
    );
  }

  if (set === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Set not found.</p>
        <a href="/library" className="text-[var(--primary)] text-sm">← Library</a>
      </div>
    );
  }

  const talksInSet = allTalks.filter((t) => set.talkIds.includes(t._id));
  const talksNotInSet = allTalks.filter((t) => !set.talkIds.includes(t._id));

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <a href="/library" className="text-sm text-[var(--muted)]">← Library</a>
        <span className="text-sm font-semibold truncate mx-4">{set.title}</span>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {talksInSet.length === 0 && (
          <p className="text-center text-[var(--muted)] py-12 text-sm">
            No talks in this set yet.
          </p>
        )}

        {talksInSet.map((talk) => (
          <div key={talk._id} className="flex items-center justify-between bg-[var(--surface)] rounded-xl px-4 py-4 gap-3">
            <a href={`/talk/${talk._id}`} className="flex-1 font-medium text-[var(--foreground)] truncate">
              {talk.title}
            </a>
            {confirmRemoveId === talk._id ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { clerkId && removeTalk({ id: id as Id<'talkSets'>, userId: clerkId, talkId: talk._id }); setConfirmRemoveId(null); }}
                  className="text-red-400 text-xs px-2 py-1 rounded transition-colors"
                >
                  Remove
                </button>
                <button onClick={() => setConfirmRemoveId(null)} className="text-[var(--muted)] text-xs px-2 py-1">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemoveId(talk._id)}
                className="text-[var(--muted)] hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </main>

      {/* Add talks FAB */}
      {talksNotInSet.length > 0 && (
        <div className="fixed bottom-6 right-5">
          <button
            onClick={() => setShowPicker(true)}
            className="w-14 h-14 rounded-full bg-[var(--primary)] text-white text-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            +
          </button>
        </div>
      )}

      {/* Talk picker sheet */}
      {showPicker && (
        <>
          <div className="fixed inset-0 z-30 bg-black/60" onClick={() => setShowPicker(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)] rounded-t-2xl max-h-[70dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border)] shrink-0">
              <button onClick={() => setShowPicker(false)} className="text-[var(--muted)] text-sm">Done</button>
              <span className="text-sm font-semibold">Add talks</span>
              <div className="w-12" />
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {talksNotInSet.map((talk) => (
                <button
                  key={talk._id}
                  onClick={() => clerkId && addTalk({ id: id as Id<'talkSets'>, userId: clerkId, talkId: talk._id })}
                  className="w-full flex items-center justify-between bg-[var(--surface)] rounded-xl px-4 py-4 text-left"
                >
                  <span className="font-medium text-[var(--foreground)] truncate">{talk.title}</span>
                  <span className="text-[var(--primary)] text-lg ml-3">+</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
