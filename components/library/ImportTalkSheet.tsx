'use client';

import { ImportDraft, SegmentMode } from './libraryTypes';

const PREVIEW_CAP = 100;

interface ImportTalkSheetProps {
  importDraft: ImportDraft | null;
  importing: boolean;
  previewSegments: string[];
  onClose: () => void;
  onConfirm: () => void;
  onModeChange: (mode: SegmentMode) => void;
  onTitleChange: (value: string) => void;
}

export function ImportTalkSheet({
  importDraft,
  importing,
  previewSegments,
  onClose,
  onConfirm,
  onModeChange,
  onTitleChange,
}: ImportTalkSheetProps) {
  if (!importDraft) return null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[85dvh] flex-col rounded-t-2xl bg-[var(--background)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 pb-3 pt-5">
          <button onClick={onClose} className="text-sm text-[var(--muted)]">
            Cancel
          </button>
          <span className="text-sm font-semibold">Import talk</span>
          <button
            onClick={onConfirm}
            disabled={importing}
            className="text-sm font-semibold text-[var(--primary)] disabled:opacity-40"
          >
            {importing ? 'Saving...' : 'Import'}
          </button>
        </div>

        <div className="shrink-0 border-b border-[var(--border)] px-5 py-3">
          <input
            value={importDraft.title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full bg-transparent text-base font-medium text-[var(--foreground)] outline-none placeholder-[var(--muted)]"
            placeholder="Talk title"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-5 py-3">
          <span className="mr-2 text-xs text-[var(--muted)]">Split by</span>
          {(['paragraphs', 'sentences'] as SegmentMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                importDraft.mode === mode
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              {mode}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--muted)]">
            {previewSegments.length} segments
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-3">
          {previewSegments.slice(0, PREVIEW_CAP).map((text, index) => (
            <div key={index} className="rounded-xl bg-[var(--surface)] px-4 py-3">
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{text}</p>
            </div>
          ))}
          {previewSegments.length > PREVIEW_CAP ? (
            <p className="py-2 text-center text-xs text-[var(--muted)]">
              Showing first {PREVIEW_CAP} of {previewSegments.length} segments
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
