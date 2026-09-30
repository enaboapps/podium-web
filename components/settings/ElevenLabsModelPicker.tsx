"use client";

import { useState } from "react";
import { DEFAULT_ELEVENLABS_MODEL, ELEVENLABS_MODELS } from "@/lib/delivery";

interface ElevenLabsModelPickerProps {
  modelId: string | undefined;
  onSelect: (modelId: string) => Promise<void>;
}

export function ElevenLabsModelPicker({ modelId, onSelect }: ElevenLabsModelPickerProps) {
  const [error, setError] = useState<string | null>(null);
  const selected = modelId ?? DEFAULT_ELEVENLABS_MODEL;

  async function handleChange(next: string) {
    setError(null);
    try {
      await onSelect(next);
    } catch {
      setError("Couldn't save the model. Try again.");
    }
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Speech model
      </h2>
      <fieldset className="space-y-2">
        <legend className="mb-3 text-sm text-[var(--muted)]">
          Decides which moods and pauses your talks can use.
        </legend>
        {ELEVENLABS_MODELS.map((model) => (
          <label
            key={model.id}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <input
              type="radio"
              name="elevenlabs-model"
              value={model.id}
              checked={selected === model.id}
              onChange={() => void handleChange(model.id)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">{model.label}</span>
              <span className="block text-xs text-[var(--muted)]">{model.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
