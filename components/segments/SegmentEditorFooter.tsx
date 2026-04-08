'use client';

import { TTSConfig } from '@/lib/tts';

interface SegmentEditorFooterProps {
  dirty: boolean;
  playError: string | null;
  playState: 'idle' | 'loading' | 'playing' | 'error';
  savedBriefly: boolean;
  saving: boolean;
  ttsConfig: TTSConfig | null;
  onSave: () => void;
  onTest: () => void;
}

function getTestLabel(playState: SegmentEditorFooterProps['playState'], playError: string | null) {
  if (playState === 'loading') return 'Loading...';
  if (playState === 'playing') return '[Stop]';
  if (playState === 'error') return playError ?? 'Test failed';
  return '[Play] Test';
}

function getSaveLabel(saving: boolean, savedBriefly: boolean) {
  if (saving) return 'Saving...';
  if (savedBriefly) return 'Saved';
  return 'Save';
}

export function SegmentEditorFooter({
  dirty,
  playError,
  playState,
  savedBriefly,
  saving,
  ttsConfig,
  onSave,
  onTest,
}: SegmentEditorFooterProps) {
  return (
    <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-3">
      <button
        onClick={onTest}
        disabled={!ttsConfig || playState === 'loading'}
        className={`text-sm font-medium transition-colors disabled:opacity-40 ${
          playState === 'playing'
            ? 'text-[var(--primary)]'
            : playState === 'error'
              ? 'text-red-400'
              : 'text-[var(--muted)]'
        }`}
      >
        {getTestLabel(playState, playError)}
      </button>

      {!ttsConfig ? (
        <a href="/settings" className="text-xs text-[var(--primary)]">
          Add Azure key
        </a>
      ) : null}

      <div className="flex-1" />

      <button
        onClick={onSave}
        disabled={saving || !dirty}
        className={`text-sm font-semibold transition-colors disabled:opacity-40 ${
          savedBriefly ? 'text-[var(--muted)]' : 'text-[var(--primary)]'
        }`}
      >
        {getSaveLabel(saving, savedBriefly)}
      </button>
    </div>
  );
}
