'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useMp3Export } from '@/hooks/useMp3Export';
import { DeliverySegment } from '@/lib/delivery';
import { saveFile, savesViaShareSheet } from '@/lib/saveFile';
import { TTSConfig } from '@/lib/tts';

interface TalkDownloadSheetProps {
  talkId: string;
  title: string;
  segments: DeliverySegment[];
  /** Offer this section as well as the whole talk. */
  sectionIndex?: number;
  voiceKey: string | undefined;
  ttsConfig: TTSConfig | null;
  onClose: () => void;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const primaryButton =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 text-base font-semibold text-white active:scale-[0.98] transition-transform';
const secondaryButton =
  'flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base font-medium text-[var(--foreground)] active:scale-[0.98] transition-transform';

/** Choose what to download as MP3, follow progress, then save the file. */
export function TalkDownloadSheet({
  talkId,
  title,
  segments,
  sectionIndex,
  voiceKey,
  ttsConfig,
  onClose,
}: TalkDownloadSheetProps) {
  const { state, start, cancel } = useMp3Export({ talkId, title, segments, voiceKey, ttsConfig });
  // What was last asked for, so "Try again" repeats it; null is the whole talk.
  const [choice, setChoice] = useState<number | null>(null);

  function begin(index: number | null) {
    setChoice(index);
    void start(index ?? undefined);
  }

  function close() {
    cancel();
    onClose();
  }

  const busy = state.status === 'preparing' || state.status === 'encoding';
  const progress =
    state.status === 'preparing' ? (state.done / state.total) * 0.8 :
    state.status === 'encoding' ? 0.8 + state.fraction * 0.2 :
    0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={busy ? undefined : close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="talk-download-title"
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--background)] px-5 pt-5 shadow-lg"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <h3 id="talk-download-title" className="text-lg font-semibold text-[var(--foreground)]">
          Download as MP3
        </h3>

        {state.status === 'idle' && (
          <div className="mt-4 flex flex-col gap-3">
            {sectionIndex !== undefined && (
              <button onClick={() => begin(sectionIndex)} className={primaryButton}>
                <Download className="h-5 w-5" aria-hidden />
                This section ({sectionIndex + 1})
              </button>
            )}
            <button
              onClick={() => begin(null)}
              className={sectionIndex === undefined ? primaryButton : secondaryButton}
            >
              Whole talk ({segments.length} {segments.length === 1 ? 'section' : 'sections'})
            </button>
            <button onClick={close} className="min-h-11 text-sm text-[var(--muted)]">
              Cancel
            </button>
          </div>
        )}

        {busy && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm text-[var(--muted)]">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {state.status === 'preparing' ? 'Preparing speech…' : 'Creating MP3…'}
              </span>
              {state.status === 'preparing' && state.total > 1 && (
                <span className="tabular-nums">{state.done} of {state.total}</span>
              )}
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[var(--border)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <button onClick={close} className="min-h-11 text-sm text-[var(--muted)]">
              Cancel
            </button>
          </div>
        )}

        {state.status === 'ready' && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="truncate text-sm text-[var(--muted)]">
              {state.file.name} · {formatSize(state.file.size)}
            </p>
            <button onClick={() => void saveFile(state.file)} className={primaryButton}>
              <Download className="h-5 w-5" aria-hidden />
              {savesViaShareSheet() ? 'Save to Files' : 'Download MP3'}
            </button>
            <button onClick={close} className={secondaryButton}>
              Done
            </button>
          </div>
        )}

        {state.status === 'error' && (
          <div className="mt-4 flex flex-col gap-3">
            <p role="alert" className="text-sm text-red-400">{state.message}</p>
            <button onClick={() => begin(choice)} className={primaryButton}>
              Try again
            </button>
            <button onClick={close} className={secondaryButton}>
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
}
