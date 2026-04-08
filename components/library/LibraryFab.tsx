'use client';

import { LibraryTab } from './libraryTypes';

interface LibraryFabProps {
  fabOpen: boolean;
  tab: LibraryTab;
  onOpenImport: () => void;
  onOpenNew: () => void;
  onToggle: () => void;
  onClose: () => void;
}

export function LibraryFab({
  fabOpen,
  tab,
  onOpenImport,
  onOpenNew,
  onToggle,
  onClose,
}: LibraryFabProps) {
  return (
    <>
      {fabOpen ? <div className="fixed inset-0 z-10" onClick={onClose} /> : null}

      <div className="fixed bottom-6 right-5 z-20 flex flex-col items-end gap-3">
        {fabOpen && tab === 'talks' ? (
          <>
            <button
              onClick={onOpenImport}
              className="flex items-center gap-3 whitespace-nowrap rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--foreground)] shadow-lg"
            >
              Import file
              <span className="text-xs text-[var(--muted)]">.docx / .pdf</span>
            </button>
            <button
              onClick={onOpenNew}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--foreground)] shadow-lg"
            >
              New talk
            </button>
          </>
        ) : null}
        <button
          onClick={tab === 'sets' ? onOpenNew : onToggle}
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-2xl text-white shadow-lg transition-transform active:scale-95 ${
            fabOpen ? 'rotate-45' : ''
          }`}
        >
          +
        </button>
      </div>
    </>
  );
}
