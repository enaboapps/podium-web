'use client';

import { Mood, MOOD_PRESETS, MOODS, Pace, PACE_PRESETS, Support } from '@/lib/delivery';

interface DeliveryPresetPickerProps {
  mood: Mood | undefined;
  pace: Pace | undefined;
  moodSupport: Support;
  paceSupport: Support;
  moodNote?: string;
  paceNote?: string;
  /** Moods this voice only approximates (marked ≈) */
  approximateMoods?: Mood[];
  onMoodChange: (mood: Mood | undefined) => void;
  onPaceChange: (pace: Pace | undefined) => void;
}

function chipClass(active: boolean) {
  return `h-10 shrink-0 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-35 ${
    active
      ? 'bg-[var(--primary)] text-white'
      : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
  }`;
}

export function DeliveryPresetPicker({
  mood,
  pace,
  moodSupport,
  paceSupport,
  moodNote,
  paceNote,
  approximateMoods = [],
  onMoodChange,
  onPaceChange,
}: DeliveryPresetPickerProps) {
  const moodDisabled = moodSupport === 'no';
  const paceDisabled = paceSupport === 'no';

  return (
    <section className="space-y-3 border-b border-[var(--border)] px-4 py-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        How should this part sound?
      </h2>

      <div>
        <p className="mb-1.5 text-xs text-[var(--muted)]">Mood</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onMoodChange(undefined)}
            disabled={moodDisabled}
            className={chipClass(!mood)}
          >
            Normal
          </button>
          {MOODS.map((key) => (
            <button
              key={key}
              onClick={() => onMoodChange(key)}
              disabled={moodDisabled}
              className={chipClass(mood === key)}
            >
              {MOOD_PRESETS[key].label}
              {approximateMoods.includes(key) ? (
                <>
                  <span aria-hidden> ≈</span>
                  <span className="sr-only"> (approximate)</span>
                </>
              ) : null}
            </button>
          ))}
        </div>
        {moodNote ? <p className="mt-1.5 text-xs text-[var(--muted)]">{moodNote}</p> : null}
      </div>

      <div>
        <p className="mb-1.5 text-xs text-[var(--muted)]">Pace</p>
        <div className="flex gap-1.5">
          <button onClick={() => onPaceChange('slower')} disabled={paceDisabled} className={chipClass(pace === 'slower')}>
            {PACE_PRESETS.slower.label}
          </button>
          <button onClick={() => onPaceChange(undefined)} disabled={paceDisabled} className={chipClass(!pace)}>
            Normal
          </button>
          <button onClick={() => onPaceChange('faster')} disabled={paceDisabled} className={chipClass(pace === 'faster')}>
            {PACE_PRESETS.faster.label}
          </button>
        </div>
        {paceNote ? <p className="mt-1.5 text-xs text-[var(--muted)]">{paceNote}</p> : null}
      </div>
    </section>
  );
}
