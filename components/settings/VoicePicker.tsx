"use client";

import { useMemo, useState } from "react";
import { VoiceUtils, type UnifiedVoice } from "js-tts-wrapper/browser";
import { TTSVoice } from "@/lib/tts";

// TTSVoice is structurally compatible with UnifiedVoice for filtering purposes
type AsUnified = UnifiedVoice[];

type GenderFilter = "All" | "Male" | "Female" | "Unknown";

const selectClass =
  "min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]";

interface VoicePickerProps {
  selectedVoice: TTSVoice | undefined;
  selectedVoiceId: string;
  voices: TTSVoice[];
  voicesError: string;
  onRetry: () => void;
  voicesLoading: boolean;
  onPreview: (voice: TTSVoice) => void;
  onSelectVoice: (voiceId: string) => Promise<void>;
  onTest?: () => Promise<void>;
}

export function VoicePicker({
  selectedVoice,
  selectedVoiceId,
  voices,
  voicesError,
  voicesLoading,
  onPreview,
  onSelectVoice,
  onTest,
  onRetry,
}: VoicePickerProps) {
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("All");
  const [langFilter, setLangFilter] = useState<string>("All");
  const [testing, setTesting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [selecting, setSelecting] = useState(false);

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
    if (genderFilter !== "All")
      result = VoiceUtils.filterByGender(result, genderFilter);
    if (langFilter !== "All")
      result = VoiceUtils.filterByLanguage(result, langFilter);
    return result as unknown as TTSVoice[];
  }, [u, genderFilter, langFilter]);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Voice
      </h2>
      {voicesLoading ? (
        <p role="status" className="text-sm text-[var(--muted)]">
          Loading voices...
        </p>
      ) : null}
      {voicesError ? (
        <div role="alert">
          <p className="text-sm text-red-400">{voicesError}</p>
          <button className="min-h-11 underline" onClick={onRetry}>
            Retry loading voices
          </button>
        </div>
      ) : null}
      {!voicesLoading && !voicesError && voices.length === 0 && (
        <p>
          No voices are available for this account. Add a voice in your provider
          account, then{" "}
          <button className="min-h-11 underline" onClick={onRetry}>
            refresh voices
          </button>
          .
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-red-400">
          {actionError}
        </p>
      )}
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
            <p className="text-sm text-[var(--muted)]">
              No voices match the selected filters.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                aria-label="Voice"
                disabled={selecting || testing}
                value={
                  filteredVoices.some((v) => v.id === selectedVoiceId)
                    ? selectedVoiceId
                    : ""
                }
                onChange={async (event) => {
                  setSelecting(true);
                  setActionError("");
                  try {
                    await onSelectVoice(event.target.value);
                  } catch {
                    setActionError(
                      "Could not save your voice selection. Try again.",
                    );
                  } finally {
                    setSelecting(false);
                  }
                }}
                className={`min-w-0 flex-1 ${selectClass}`}
              >
                <option value="" disabled>
                  Choose a voice
                </option>
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
              {onTest ? (
                <button
                  type="button"
                  disabled={testing || selecting || !selectedVoice}
                  onClick={async () => {
                    setTesting(true);
                    setActionError("");
                    try {
                      await onTest();
                    } catch {
                      setActionError(
                        "Could not generate or play speech. Check synthesis permissions, provider quota, and your connection, then try again.",
                      );
                    } finally {
                      setTesting(false);
                    }
                  }}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  {testing ? "Testing…" : "Test voice"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {onTest && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Testing a voice generates speech and may consume provider usage.
        </p>
      )}
    </section>
  );
}
