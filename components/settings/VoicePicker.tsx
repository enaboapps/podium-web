'use client';

import { useMemo, useState } from 'react';
import { TTSVoice } from '@/lib/tts';

type GenderFilter = 'All' | 'Male' | 'Female' | 'Unknown';

const selectClass =
  'rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]';

interface VoicePickerProps {
  selectedVoice: TTSVoice | undefined;
  selectedVoiceId: string;
  voices: TTSVoice[];
  voicesError: boolean;
  voicesLoading: boolean;
  onPreview: (voice: TTSVoice) => void;
  onSelectVoice: (voiceId: string) => void;
}

export function VoicePicker({
  selectedVoice,
  selectedVoiceId,
  voices,
  voicesError,
  voicesLoading,
  onPreview,
  onSelectVoice,
}: VoicePickerProps) {
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('All');
  const [langFilter, setLangFilter] = useState<string>('All');

  const languageOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const voice of voices) {
      for (const lc of voice.languageCodes) {
        if (!seen.has(lc.bcp47)) seen.set(lc.bcp47, lc.display);
      }
    }
    return Array.from(seen.entries())
      .map(([bcp47, display]) => ({ bcp47, display }))
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [voices]);

  const filteredVoices = useMemo(
    () =>
      voices.filter(
        (v) =>
          (genderFilter === 'All' || v.gender === genderFilter) &&
          (langFilter === 'All' || v.languageCodes.some((lc) => lc.bcp47 === langFilter)),
      ),
    [voices, genderFilter, langFilter],
  );

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Voice
      </h2>
      {voicesLoading ? <p className="text-sm text-[var(--muted)]">Loading voices...</p> : null}
      {voicesError ? <p className="text-sm text-red-400">Failed to load voices.</p> : null}
      {!voicesLoading && !voicesError && voices.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
              aria-label="Filter by gender"
              className={selectClass}
            >
              <option value="All">All genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Unknown">Unknown</option>
            </select>
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              aria-label="Filter by language"
              className={selectClass}
            >
              <option value="All">All languages</option>
              {languageOptions.map((o) => (
                <option key={o.bcp47} value={o.bcp47}>
                  {o.display || o.bcp47}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {filteredVoices.length} of {voices.length} voices
          </p>
          {filteredVoices.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No voices match the selected filters.</p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedVoiceId}
                onChange={(event) => onSelectVoice(event.target.value)}
                className={`flex-1 ${selectClass}`}
              >
                {filteredVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
              {selectedVoice?.previewUrl ? (
                <button
                  type="button"
                  onClick={() => onPreview(selectedVoice)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Preview
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
