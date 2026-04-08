'use client';

interface ProviderToggleProps {
  isAzure: boolean;
  onProviderChange: (provider: 'elevenlabs' | 'azure') => void;
}

export function ProviderToggle({ isAzure, onProviderChange }: ProviderToggleProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        TTS Provider
      </h2>
      <div className="flex overflow-hidden rounded-xl border border-[var(--border)]">
        <button
          onClick={() => onProviderChange('elevenlabs')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            !isAzure
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--surface)] text-[var(--muted)]'
          }`}
        >
          ElevenLabs
        </button>
        <button
          onClick={() => onProviderChange('azure')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            isAzure
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--surface)] text-[var(--muted)]'
          }`}
        >
          Azure
        </button>
      </div>
    </section>
  );
}
