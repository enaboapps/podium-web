'use client';

import { WordAnnotation } from '@/lib/ssml';
import { formatPauseLabel, getWordChipClass } from '@/lib/segmentEditorStyles';

interface SegmentWordCanvasProps {
  activeMode: boolean;
  anchorId: string | null;
  annotations: WordAnnotation[];
  onWordTap: (annotation: WordAnnotation) => void;
  onPauseTap: (id: string) => void;
}

export function SegmentWordCanvas({
  activeMode,
  anchorId,
  annotations,
  onWordTap,
  onPauseTap,
}: SegmentWordCanvasProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 px-3 py-3 ${activeMode ? 'cursor-pointer' : ''}`}>
      {annotations.map((annotation) => (
        <span key={annotation.id} className="contents">
          <button
            onClick={() => onWordTap(annotation)}
            disabled={!activeMode}
            className={
              getWordChipClass(annotation, activeMode) +
              (!activeMode ? ' cursor-default' : '') +
              (annotation.id === anchorId
                ? ' animate-pulse ring-2 ring-white ring-offset-1 ring-offset-[var(--background)]'
                : '')
            }
          >
            {annotation.text}
          </button>
          {annotation.pauseAfterMs !== null ? (
            <button
              onClick={() => onPauseTap(annotation.id)}
              className="mx-0.5 flex shrink-0 flex-col items-center justify-center"
              style={{ minWidth: 32, minHeight: 44 }}
              aria-label={`${formatPauseLabel(annotation.pauseAfterMs)} pause - tap to remove`}
            >
              <div className="h-4 w-0.5 rounded-full bg-purple-500/70" />
              <span className="mt-0.5 text-[9px] leading-none text-purple-400">
                {formatPauseLabel(annotation.pauseAfterMs)}
              </span>
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
