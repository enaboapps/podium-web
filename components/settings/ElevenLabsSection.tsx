'use client';

import { FormEvent } from 'react';

interface ElevenLabsSectionProps {
  hasSavedKey: boolean;
  keyInput: string;
  masked: boolean;
  maskedValue: string;
  saved: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onFocus: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ElevenLabsSection({
  hasSavedKey,
  keyInput,
  masked,
  maskedValue,
  saved,
  onChange,
  onClear,
  onFocus,
  onSubmit,
}: ElevenLabsSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        ElevenLabs API Key
      </h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Your key is stored securely and never shared.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type={masked ? 'text' : 'password'}
          value={masked ? maskedValue : keyInput}
          onChange={(event) => {
            if (!masked) onChange(event.target.value);
          }}
          onFocus={onFocus}
          placeholder="sk_..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono text-sm text-[var(--foreground)] outline-none placeholder-[var(--muted)] focus:border-[var(--primary)]"
        />
        {masked ? (
          <p className="text-xs text-[var(--muted)]">Key saved. Tap the field to replace it.</p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={masked || !keyInput.trim()}
            className="flex-1 rounded-xl bg-[var(--primary)] py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            {saved ? 'Saved!' : 'Save key'}
          </button>
          {hasSavedKey ? (
            <button
              type="button"
              onClick={onClear}
              className="px-4 py-3 text-sm text-red-400 transition-colors hover:text-red-300"
            >
              Remove
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
