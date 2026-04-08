'use client';

import { TTSVoice } from '@/lib/tts';

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
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Voice
      </h2>
      {voicesLoading ? <p className="text-sm text-[var(--muted)]">Loading voices...</p> : null}
      {voicesError ? <p className="text-sm text-red-400">Failed to load voices.</p> : null}
      {!voicesLoading && !voicesError && voices.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedVoiceId}
            onChange={(event) => onSelectVoice(event.target.value)}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            {voices.map((voice) => (
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
      ) : null}
    </section>
  );
}
