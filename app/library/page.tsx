'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Doc } from '@/convex/_generated/dataModel';

type Tab = 'talks' | 'sets';

export default function LibraryPage() {
  const { clerkId } = useCurrentUser();
  const [tab, setTab] = useState<Tab>('talks');
  const [newTalkTitle, setNewTalkTitle] = useState('');
  const [newSetTitle, setNewSetTitle] = useState('');
  const [showNewTalk, setShowNewTalk] = useState(false);
  const [showNewSet, setShowNewSet] = useState(false);

  const talks = useQuery(api.talks.list, clerkId ? { userId: clerkId } : 'skip');
  const sets = useQuery(api.talkSets.list, clerkId ? { userId: clerkId } : 'skip');

  const createTalk = useMutation(api.talks.create);
  const removeTalk = useMutation(api.talks.remove);
  const createSet = useMutation(api.talkSets.create);
  const removeSet = useMutation(api.talkSets.remove);

  async function handleCreateTalk(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkId || !newTalkTitle.trim()) return;
    await createTalk({ userId: clerkId, title: newTalkTitle.trim() });
    setNewTalkTitle('');
    setShowNewTalk(false);
  }

  async function handleCreateSet(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkId || !newSetTitle.trim()) return;
    await createSet({ userId: clerkId, title: newSetTitle.trim() });
    setNewSetTitle('');
    setShowNewSet(false);
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-safe-top pb-4 pt-6 border-b border-[var(--border)]">
        <h1 className="text-xl font-semibold tracking-tight">Podium</h1>
        <a href="/settings" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Settings
        </a>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setTab('talks')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'talks'
              ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
              : 'text-[var(--muted)]'
          }`}
        >
          Talks
        </button>
        <button
          onClick={() => setTab('sets')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'sets'
              ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
              : 'text-[var(--muted)]'
          }`}
        >
          Sets
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {tab === 'talks' && (
          <>
            {talks === undefined && (
              <p className="text-center text-[var(--muted)] py-8">Loading...</p>
            )}
            {talks?.length === 0 && !showNewTalk && (
              <p className="text-center text-[var(--muted)] py-12 text-sm">
                No talks yet. Tap + to create your first.
              </p>
            )}
            {talks?.map((talk: Doc<'talks'>) => (
              <div
                key={talk._id}
                className="flex items-center justify-between bg-[var(--surface)] rounded-xl px-4 py-4 gap-3"
              >
                <a
                  href={`/talk/${talk._id}`}
                  className="flex-1 font-medium text-[var(--foreground)] truncate"
                >
                  {talk.title}
                </a>
                <button
                  onClick={() => clerkId && removeTalk({ id: talk._id as Id<'talks'>, userId: clerkId })}
                  className="text-[var(--muted)] hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
            {showNewTalk && (
              <form onSubmit={handleCreateTalk} className="flex gap-2">
                <input
                  autoFocus
                  value={newTalkTitle}
                  onChange={(e) => setNewTalkTitle(e.target.value)}
                  placeholder="Talk title"
                  className="flex-1 bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)]"
                />
                <button
                  type="submit"
                  className="bg-[var(--primary)] text-white rounded-xl px-4 py-3 text-sm font-medium"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTalk(false)}
                  className="text-[var(--muted)] px-3 py-3 text-sm"
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}

        {tab === 'sets' && (
          <>
            {sets === undefined && (
              <p className="text-center text-[var(--muted)] py-8">Loading...</p>
            )}
            {sets?.length === 0 && !showNewSet && (
              <p className="text-center text-[var(--muted)] py-12 text-sm">
                No sets yet. Group talks for an event.
              </p>
            )}
            {sets?.map((set: Doc<'talkSets'>) => (
              <div
                key={set._id}
                className="bg-[var(--surface)] rounded-xl px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--foreground)]">{set.title}</span>
                  <button
                    onClick={() => clerkId && removeSet({ id: set._id as Id<'talkSets'>, userId: clerkId })}
                    className="text-[var(--muted)] hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {set.talkIds.length} {set.talkIds.length === 1 ? 'talk' : 'talks'}
                </p>
              </div>
            ))}
            {showNewSet && (
              <form onSubmit={handleCreateSet} className="flex gap-2">
                <input
                  autoFocus
                  value={newSetTitle}
                  onChange={(e) => setNewSetTitle(e.target.value)}
                  placeholder="Set title (e.g. Conference 2026)"
                  className="flex-1 bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)]"
                />
                <button
                  type="submit"
                  className="bg-[var(--primary)] text-white rounded-xl px-4 py-3 text-sm font-medium"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewSet(false)}
                  className="text-[var(--muted)] px-3 py-3 text-sm"
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}
      </main>

      {/* FAB */}
      <div className="fixed bottom-6 right-5 pb-safe-bottom">
        <button
          onClick={() => {
            if (tab === 'talks') {
              setShowNewTalk(true);
              setShowNewSet(false);
            } else {
              setShowNewSet(true);
              setShowNewTalk(false);
            }
          }}
          className="w-14 h-14 rounded-full bg-[var(--primary)] text-white text-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          +
        </button>
      </div>
    </div>
  );
}
