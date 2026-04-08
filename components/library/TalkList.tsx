'use client';

import { FormEvent } from 'react';
import { OfflineStatusBadge } from '@/components/offline/OfflineStatusBadge';
import { CachedTalkStatus } from '@/lib/offlineStore';
import { CreateMode, TalkDoc } from './libraryTypes';

interface TalkListProps {
  confirmDeleteId: string | null;
  createMode: CreateMode;
  importError: string;
  newTalkTitle: string;
  setsAvailable: boolean;
  talkStatuses: Record<string, CachedTalkStatus>;
  talks: TalkDoc[] | undefined;
  onAssignRequest: (talkId: string) => void;
  onCancelCreate: () => void;
  onCreateTalk: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (talkId: string) => void;
  onDeleteRequest: (talkId: string) => void;
  onNewTalkTitleChange: (value: string) => void;
}

export function TalkList({
  confirmDeleteId,
  createMode,
  importError,
  newTalkTitle,
  setsAvailable,
  talkStatuses,
  talks,
  onAssignRequest,
  onCancelCreate,
  onCreateTalk,
  onDeleteCancel,
  onDeleteConfirm,
  onDeleteRequest,
  onNewTalkTitleChange,
}: TalkListProps) {
  return (
    <>
      {talks === undefined ? (
        <p className="py-8 text-center text-[var(--muted)]">Loading...</p>
      ) : null}

      {talks?.length === 0 && createMode === 'none' ? (
        <p className="py-12 text-center text-sm text-[var(--muted)]">
          No talks yet. Tap + to create your first.
        </p>
      ) : null}

      {talks?.map((talk) => (
        <div
          key={talk._id}
          className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface)] px-4 py-4 transition-colors hover:bg-[var(--surface-hover)]"
        >
          <div className="min-w-0 flex-1">
            <a href={`/talk/${talk._id}`} className="block truncate font-medium text-[var(--foreground)]">
              {talk.title}
            </a>
            <div className="mt-2">
              <OfflineStatusBadge status={talkStatuses[talk._id]} documentAvailable />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {setsAvailable ? (
              <button
                onClick={() => onAssignRequest(talk._id)}
                className="rounded px-2 py-1 text-lg leading-none text-[var(--muted)] transition-colors hover:text-[var(--primary)]"
                title="Add to set"
              >
                +
              </button>
            ) : null}
            {confirmDeleteId === talk._id ? (
              <>
                <button
                  onClick={() => onDeleteConfirm(talk._id)}
                  className="rounded px-2 py-1 text-xs text-red-400 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={onDeleteCancel}
                  className="rounded px-2 py-1 text-xs text-[var(--muted)] transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => onDeleteRequest(talk._id)}
                className="rounded px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}

      {createMode === 'new' ? (
        <form onSubmit={onCreateTalk} className="flex gap-2">
          <input
            autoFocus
            value={newTalkTitle}
            onChange={(event) => onNewTalkTitleChange(event.target.value)}
            placeholder="Talk title"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder-[var(--muted)] focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-white"
          >
            Add
          </button>
          <button
            type="button"
            onClick={onCancelCreate}
            className="px-3 py-3 text-sm text-[var(--muted)]"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {importError ? <p className="py-2 text-center text-sm text-red-400">{importError}</p> : null}
    </>
  );
}
