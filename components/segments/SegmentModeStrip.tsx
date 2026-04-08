'use client';

import { EditorMode, SEGMENT_EDITOR_MODES } from '@/lib/segmentEditorStyles';

interface SegmentModeStripProps {
  activeMode: EditorMode | null;
  anchorId: string | null;
  onModeToggle: (mode: EditorMode) => void;
  onCancelAnchor: () => void;
}

export function SegmentModeStrip({
  activeMode,
  anchorId,
  onModeToggle,
  onCancelAnchor,
}: SegmentModeStripProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)]/60 px-3 py-2">
      {anchorId ? (
        <>
          <span className="shrink-0 text-sm text-[var(--foreground)]">
            Now tap the last word in the range
          </span>
          <div className="flex-1" />
          <button
            onClick={onCancelAnchor}
            className="h-10 shrink-0 px-3 text-sm text-[var(--muted)]"
          >
            x Cancel
          </button>
        </>
      ) : (
        SEGMENT_EDITOR_MODES.map((mode) => {
          const isPauseGroupStart = mode.key === 'pause-250';
          return (
            <span key={mode.key} className="contents">
              {isPauseGroupStart ? (
                <span className="ml-1 shrink-0 self-center text-[10px] text-[var(--muted)]">
                  Pause
                </span>
              ) : null}
              <button
                onClick={() => onModeToggle(mode.key)}
                className={`h-10 shrink-0 rounded-xl px-3 text-sm font-medium transition-colors ${
                  activeMode === mode.key ? mode.on : mode.off
                }`}
              >
                {mode.label}
              </button>
            </span>
          );
        })
      )}
    </div>
  );
}
