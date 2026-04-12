'use client';

import { useEffect, useMemo, useState } from 'react';
import { VoiceUtils, type UnifiedVoice } from 'js-tts-wrapper/browser';
import { TTSVoice } from '@/lib/tts';

// TTSVoice is structurally compatible with UnifiedVoice for filtering purposes
type AsUnified = UnifiedVoice[];

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

  const u = voices as unknown as AsUnified;

  const languageOptions = useMemo(() => {
    const bcp47Codes = VoiceUtils.getAvailableLanguages(u);
    const seen = new Map<string, string>();
    for (const code of bcp47Codes) {
      const label = voices
        .flatMap((v) => v.languageCodes)
        .find((lc) => lc.bcp47 === code)?.display;
      seen.set(code, label || code);
    }
    return Array.from(seen.entries())
      .map(([bcp47, display]) => ({ bcp47, display }))
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [u, voices]);

  const filteredVoices = useMemo(() => {
    let result = u;
    if (genderFilter !== 'All') result = VoiceUtils.filterByGender(result, genderFilter);
    if (langFilter !== 'All') result = VoiceUtils.filterByLanguage(result, langFilter);
    return result as unknown as TTSVoice[];
  }, [u, genderFilter, langFilter]);

  // When filters change and the selected voice is no longer in the list, auto-select the first match
  useEffect(() => {
    if (filteredVoices.length === 0) return;
    if (!filteredVoices.some((v) => v.id === selectedVoiceId)) {
      onSelectVoice(filteredVoices[0].id);
    }
  }, [filteredVoices, selectedVoiceId, onSelectVoice]);

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
