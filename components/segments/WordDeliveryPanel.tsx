'use client';

import { DeliveryWord, normaliseWord, PAUSE_LENGTHS, PAUSE_PRESETS, PauseLength } from '@/lib/delivery';

interface WordDeliveryPanelProps {
  word: DeliveryWord;
  pauseNote?: string;
  stressNote?: string;
  onChange: (word: DeliveryWord) => void;
  onClose: () => void;
}

function toggleClass(active: boolean, activeClass: string) {
  return `h-11 flex-1 rounded-xl text-sm font-medium transition-colors ${
    active ? activeClass : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
  }`;
}

export function WordDeliveryPanel({ word, pauseNote, stressNote, onChange, onClose }: WordDeliveryPanelProps) {
  function update(patch: Partial<DeliveryWord>) {
    onChange(normaliseWord({ ...word, ...patch }));
  }

  function setPause(pause: PauseLength | undefined) {
    update({ pause });
  }

  return (
    <section className="space-y-4 border-t border-[var(--border)] bg-[var(--surface)]/60 px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm">
          <span className="text-[var(--muted)]">Word: </span>
          <span className="font-semibold">{word.text}</span>
        </p>
        <button onClick={onClose} className="h-10 px-3 text-sm font-semibold text-[var(--primary)]">
          Done
        </button>
      </div>

      <div>
        <div className="flex gap-2">
          <button
            onClick={() => update({ stress: !word.stress })}
            aria-pressed={!!word.stress}
            className={toggleClass(!!word.stress, 'bg-amber-600 text-white')}
          >
            Stress
          </button>
          <button
            onClick={() => update({ spell: !word.spell, sayAs: undefined })}
            aria-pressed={!!word.spell}
            className={toggleClass(!!word.spell, 'bg-teal-600 text-white')}
          >
            Spell out
          </button>
        </div>
        {word.stress && stressNote ? <p className="mt-1.5 text-xs text-[var(--muted)]">{stressNote}</p> : null}
      </div>

      <div>
        <p className="mb-1.5 text-xs text-[var(--muted)]">Pause after</p>
        <div className="flex gap-1.5">
          <button onClick={() => setPause(undefined)} className={toggleClass(!word.pause, 'bg-purple-600 text-white')}>
            None
          </button>
          {PAUSE_LENGTHS.map((length) => (
            <button
              key={length}
              onClick={() => setPause(length)}
              className={toggleClass(word.pause === length, 'bg-purple-600 text-white')}
            >
              {PAUSE_PRESETS[length].label}
            </button>
          ))}
        </div>
        {word.pause && pauseNote ? <p className="mt-1.5 text-xs text-[var(--muted)]">{pauseNote}</p> : null}
      </div>

      <div>
        <label htmlFor="say-it-like" className="mb-1.5 block text-xs text-[var(--muted)]">
          Say it like… <span className="opacity-70">(type how it should sound)</span>
        </label>
        <input
          id="say-it-like"
          value={word.sayAs ?? ''}
          onChange={(event) => onChange({ ...word, spell: undefined, sayAs: event.target.value })}
          onBlur={() => update({})}
          placeholder={word.text}
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder-[var(--muted)] focus:border-[var(--primary)]"
        />
      </div>
    </section>
  );
}
