'use client';

import { Check, Loader2, Play, Settings, Square } from 'lucide-react';
import { TTSConfig } from '@/lib/tts';

export type PlayState = 'idle' | 'loading' | 'playing' | 'error';

interface SegmentEditorFooterProps {
  dirty: boolean;
  playError: string | null;
  playState: PlayState;
  savedBriefly: boolean;
  saving: boolean;
  ttsConfig: TTSConfig | null;
  onSave: () => void;
  onTest: () => void;
}

const buttonBase =
  'flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-semibold transition-all active:scale-[0.98] disabled:active:scale-100';

function PlayButtonContent({ playState }: { playState: PlayState }) {
  if (playState === 'loading') {
    return (
      <>
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading…
      </>
    );
  }
  if (playState === 'playing') {
    return (
      <>
        <Square className="h-4 w-4 fill-current" aria-hidden />
        Stop
      </>
    );
  }
  return (
    <>
      <Play className="h-5 w-5 fill-current" aria-hidden />
      Listen
    </>
  );
}

function SaveButtonContent({ dirty, saving, savedBriefly }: { dirty: boolean; saving: boolean; savedBriefly: boolean }) {
  if (saving) {
    return (
      <>
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Saving…
      </>
    );
  }
  if (savedBriefly || !dirty) {
    return (
      <>
        <Check className="h-5 w-5" aria-hidden />
        {savedBriefly ? 'Saved' : 'No changes'}
      </>
    );
  }
  return <>Save</>;
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
  const canSave = dirty && !saving;

  return (
    <div
      className="border-t border-[var(--border)] bg-[var(--background)] px-4 pt-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {playState === 'error' ? (
        <p role="alert" className="pb-3 text-center text-sm text-red-400">
          {playError ?? 'Couldn’t play this segment. Try again.'}
        </p>
      ) : null}

      <div className="flex gap-3">
        {ttsConfig ? (
          <button
            onClick={onTest}
            aria-label={playState === 'playing' || playState === 'loading' ? 'Stop playback' : 'Listen to this segment'}
            className={`${buttonBase} ${
              playState === 'playing'
                ? 'bg-[var(--primary)]/15 text-[var(--primary)] ring-2 ring-[var(--primary)]'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
            } disabled:opacity-60`}
          >
            <PlayButtonContent playState={playState} />
          </button>
        ) : (
          <a
            href="/settings"
            className={`${buttonBase} border border-dashed border-[var(--border)] text-sm text-[var(--primary)]`}
          >
            <Settings className="h-5 w-5" aria-hidden />
            Set up a voice
          </a>
        )}

        <button
          onClick={onSave}
          disabled={!canSave}
          className={`${buttonBase} ${
            canSave
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--surface)] text-[var(--muted)]'
          }`}
        >
          <SaveButtonContent dirty={dirty} saving={saving} savedBriefly={savedBriefly} />
        </button>
      </div>
    </div>
  );
}
