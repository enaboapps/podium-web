'use client';

import { FormEvent } from 'react';
import { CreateMode, TalkSetDoc } from './libraryTypes';

interface SetListProps {
  confirmDeleteId: string | null;
  createMode: CreateMode;
  newSetTitle: string;
  sets: TalkSetDoc[] | undefined;
  onCancelCreate: () => void;
  onCreateSet: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (setId: string) => void;
  onDeleteRequest: (setId: string) => void;
  onNewSetTitleChange: (value: string) => void;
}

export function SetList({
  confirmDeleteId,
  createMode,
  newSetTitle,
  sets,
  onCancelCreate,
  onCreateSet,
  onDeleteCancel,
  onDeleteConfirm,
  onDeleteRequest,
  onNewSetTitleChange,
}: SetListProps) {
  return (
    <>
      {sets === undefined ? <p className="py-8 text-center text-[var(--muted)]">Loading...</p> : null}

      {sets?.length === 0 && createMode === 'none' ? (
        <p className="py-12 text-center text-sm text-[var(--muted)]">
          No sets yet. Group talks for an event.
        </p>
      ) : null}

      {sets?.map((set) => (
        <div
          key={set._id}
          className="rounded-xl bg-[var(--surface)] px-4 py-4 transition-colors hover:bg-[var(--surface-hover)]"
        >
          <div className="flex items-center justify-between">
            <a href={`/set/${set._id}`} className="flex-1 font-medium text-[var(--foreground)]">
              {set.title}
            </a>
            {confirmDeleteId === set._id ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => onDeleteConfirm(set._id)}
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
              </div>
            ) : (
              <button
                onClick={() => onDeleteRequest(set._id)}
                className="rounded px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {set.talkIds.length} {set.talkIds.length === 1 ? 'talk' : 'talks'}
          </p>
        </div>
      ))}

      {createMode === 'set' ? (
        <form onSubmit={onCreateSet} className="flex gap-2">
          <input
            autoFocus
            value={newSetTitle}
            onChange={(event) => onNewSetTitleChange(event.target.value)}
            placeholder="Set title (e.g. Conference 2026)"
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
    </>
  );
}
