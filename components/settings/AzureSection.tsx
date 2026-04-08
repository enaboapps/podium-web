'use client';

import { FormEvent } from 'react';

interface AzureSectionProps {
  hasSavedKey: boolean;
  keyInput: string;
  keyMasked: boolean;
  maskedValue: string;
  regionInput: string;
  saved: boolean;
  onClear: () => void;
  onKeyChange: (value: string) => void;
  onKeyFocus: () => void;
  onRegionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function AzureSection({
  hasSavedKey,
  keyInput,
  keyMasked,
  maskedValue,
  regionInput,
  saved,
  onClear,
  onKeyChange,
  onKeyFocus,
  onRegionChange,
  onSubmit,
}: AzureSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Azure Credentials
      </h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Your subscription key and region are stored securely and never shared.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type={keyMasked ? 'text' : 'password'}
          value={keyMasked ? maskedValue : keyInput}
          onChange={(event) => {
            if (!keyMasked) onKeyChange(event.target.value);
          }}
          onFocus={onKeyFocus}
          placeholder="Subscription key"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono text-sm text-[var(--foreground)] outline-none placeholder-[var(--muted)] focus:border-[var(--primary)]"
        />
        <input
          type="text"
          value={regionInput}
          onChange={(event) => onRegionChange(event.target.value)}
          placeholder="Region (e.g. eastus)"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono text-sm text-[var(--foreground)] outline-none placeholder-[var(--muted)] focus:border-[var(--primary)]"
        />
        {keyMasked ? (
          <p className="text-xs text-[var(--muted)]">Key saved. Tap the field to replace it.</p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={(!keyMasked && !keyInput.trim()) || !regionInput.trim()}
            className="flex-1 rounded-xl bg-[var(--primary)] py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            {saved ? 'Saved!' : 'Save'}
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
