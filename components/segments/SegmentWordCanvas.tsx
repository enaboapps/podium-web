'use client';

import { DeliveryWord, PAUSE_PRESETS } from '@/lib/delivery';

interface SegmentWordCanvasProps {
  words: DeliveryWord[];
  selectedIndex: number | null;
  onWordTap: (index: number) => void;
}

function getWordChipClass(word: DeliveryWord, selected: boolean) {
  const base = 'min-h-[44px] rounded-xl px-3 py-2 text-sm leading-tight transition-all active:scale-95';
  const ring = selected ? ' ring-2 ring-white ring-offset-1 ring-offset-[var(--background)]' : '';

  if (word.sayAs) return `${base}${ring} border border-sky-500/60 bg-sky-900/40 text-sky-200`;
  if (word.spell) return `${base}${ring} border border-teal-500/60 bg-teal-900/40 tracking-widest text-teal-200`;
  if (word.stress) return `${base}${ring} border border-amber-500/60 bg-amber-900/40 font-semibold text-amber-200`;
  return `${base}${ring} border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--foreground)]`;
}

export function SegmentWordCanvas({ words, selectedIndex, onWordTap }: SegmentWordCanvasProps) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-3">
      {words.map((word, index) => (
        <span key={index} className="contents">
          <button
            onClick={() => onWordTap(index)}
            className={getWordChipClass(word, index === selectedIndex)}
            aria-pressed={index === selectedIndex}
          >
            <span className={word.stress && (word.sayAs || word.spell) ? 'font-semibold' : undefined}>
              {word.text}
            </span>
            {word.sayAs ? (
              <span className="block text-[10px] leading-tight text-sky-300/80">says “{word.sayAs}”</span>
            ) : null}
          </button>
          {word.pause ? (
            <span
              className="mx-0.5 flex shrink-0 flex-col items-center justify-center"
              style={{ minWidth: 32, minHeight: 44 }}
              aria-label={`${PAUSE_PRESETS[word.pause].label} pause`}
            >
              <span className="h-4 w-0.5 rounded-full bg-purple-500/70" />
              <span className="mt-0.5 text-[9px] leading-none text-purple-400">
                {PAUSE_PRESETS[word.pause].label}
              </span>
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
