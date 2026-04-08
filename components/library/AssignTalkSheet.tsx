'use client';

import { Id } from '@/convex/_generated/dataModel';
import { TalkSetDoc } from './libraryTypes';

interface AssignTalkSheetProps {
  assignTalkId: string | null;
  sets: TalkSetDoc[] | undefined;
  onClose: () => void;
  onToggleSet: (setId: Id<'talkSets'>, inSet: boolean) => void;
}

export function AssignTalkSheet({
  assignTalkId,
  sets,
  onClose,
  onToggleSet,
}: AssignTalkSheetProps) {
  if (!assignTalkId || !sets) return null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[60dvh] flex-col rounded-t-2xl bg-[var(--background)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 pb-3 pt-5">
          <button onClick={onClose} className="text-sm text-[var(--muted)]">
            Done
          </button>
          <span className="text-sm font-semibold">Add to set</span>
          <div className="w-12" />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {sets.map((set) => {
            const inSet = set.talkIds.includes(assignTalkId as Id<'talks'>);

            return (
              <button
                key={set._id}
                onClick={() => onToggleSet(set._id, inSet)}
                className="flex w-full items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-4 text-left"
              >
                <span className="font-medium text-[var(--foreground)]">{set.title}</span>
                <span className={`text-lg ${inSet ? 'text-[var(--primary)]' : 'text-[var(--muted)]'}`}>
                  {inSet ? 'OK' : '+'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
