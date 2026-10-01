'use client';

import { Ref } from 'react';
import { DeliverySegment, hasDelivery } from '@/lib/delivery';

interface SegmentBlockListProps {
  /** Text of each block, in order */
  texts: string[];
  /** Stored segments matching `texts`; omit while the text is unsaved, which outlines and disables the blocks */
  segments?: (DeliverySegment & { id: string })[];
  highlightId: string | null;
  highlightRef?: Ref<HTMLButtonElement>;
  onOpen: (segmentId: string) => void;
}

/** The talk as tappable segment blocks, one per paragraph or sentence. */
export function SegmentBlockList({ texts, segments, highlightId, highlightRef, onOpen }: SegmentBlockListProps) {
  const unsaved = !segments;

  return (
    <ol className="space-y-2 px-5 py-4">
      {texts.map((text, i) => {
        const segment = segments?.[i];
        const styled = !!segment && hasDelivery(segment);
        const highlighted = !!segment && segment.id === highlightId;
        return (
          <li key={segment?.id ?? `preview-${i}`}>
            <button
              type="button"
              ref={highlighted ? highlightRef : undefined}
              disabled={!segment}
              onClick={() => { if (segment) onOpen(segment.id); }}
              aria-current={highlighted ? 'true' : undefined}
              className={`flex w-full gap-3 rounded-xl px-4 py-3 text-left transition-colors active:opacity-70 disabled:active:opacity-100 ${
                unsaved ? 'border border-dashed border-[var(--primary)]/60' : 'border border-[var(--border)]'
              } ${i % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface)]/40'} ${
                highlighted ? 'ring-2 ring-[var(--primary)]' : ''
              }`}
            >
              <span className="w-6 shrink-0 pt-0.5 text-xs text-[var(--muted)]">{i + 1}</span>
              <span className="flex-1 text-base leading-relaxed text-[var(--foreground)]">{text}</span>
              {styled ? (
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" aria-label="Has styling" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
