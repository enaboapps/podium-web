'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DeliverySegment } from '@/lib/delivery';
import { OUTPUT_SAMPLE_RATE, decodeToMono, isNormalisedAudio } from '@/lib/loudness';
import { floatToInt16, getExportFilename, joinWithGaps, parseWav } from '@/lib/mp3Export';
import type { Mp3WorkerRequest, Mp3WorkerResponse } from '@/lib/mp3Export.worker';
import { ensureSegmentAudio } from '@/lib/segmentAudio';
import { TTSConfig } from '@/lib/tts';

export type Mp3ExportState =
  | { status: 'idle' }
  | { status: 'preparing'; done: number; total: number }
  | { status: 'encoding'; fraction: number }
  | { status: 'ready'; file: File }
  | { status: 'error'; message: string };

interface UseMp3ExportArgs {
  talkId: string;
  title: string;
  segments: DeliverySegment[];
  /** Voice the cached audio belongs to; export is unavailable without one. */
  voiceKey: string | undefined;
  /** Used to generate sections that aren't cached yet; null when offline. */
  ttsConfig: TTSConfig | null;
}

class ExportCancelled extends Error {}

/** Mono PCM at the output rate: read cached WAV directly, decode anything else. */
async function blobToSamples(blob: Blob): Promise<Int16Array> {
  if (isNormalisedAudio(blob)) {
    const pcm = parseWav(await blob.arrayBuffer());
    if (pcm?.sampleRate === OUTPUT_SAMPLE_RATE) return pcm.samples;
  }
  return floatToInt16(await decodeToMono(blob));
}

function encodeInWorker(
  samples: Int16Array,
  onProgress: (fraction: number) => void,
  onWorker: (worker: Worker) => void,
): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../lib/mp3Export.worker.ts', import.meta.url), { type: 'module' });
    onWorker(worker);
    worker.onmessage = (event: MessageEvent<Mp3WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') return onProgress(message.fraction);
      worker.terminate();
      if (message.type === 'done') resolve(message.parts);
      else reject(new Error(message.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'MP3 encoding failed'));
    };
    const request: Mp3WorkerRequest = { samples, sampleRate: OUTPUT_SAMPLE_RATE };
    worker.postMessage(request, [samples.buffer as ArrayBuffer]);
  });
}

/** Export the whole talk, or one section, as an MP3 file. */
export function useMp3Export({ talkId, title, segments, voiceKey, ttsConfig }: UseMp3ExportArgs) {
  const [state, setState] = useState<Mp3ExportState>({ status: 'idle' });
  // Bumped to cancel the export in progress.
  const runRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);

  const cancel = useCallback(() => {
    runRef.current++;
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ status: 'idle' });
  }, []);

  useEffect(() => cancel, [cancel]);

  /** Export one section, or the whole talk when `sectionIndex` is omitted. */
  const start = useCallback(async (sectionIndex?: number) => {
    const run = ++runRef.current;
    const checkCancelled = () => {
      if (run !== runRef.current) throw new ExportCancelled();
    };
    const chosen = sectionIndex === undefined ? segments : segments.slice(sectionIndex, sectionIndex + 1);

    try {
      if (!voiceKey) throw new Error('Set up a voice in Settings to download speech.');
      if (chosen.length === 0) throw new Error('There’s nothing to download yet.');

      setState({ status: 'preparing', done: 0, total: chosen.length });
      const sections: Int16Array[] = [];
      for (const [i, segment] of chosen.entries()) {
        const number = (sectionIndex ?? i) + 1;
        let blob: Blob | undefined;
        try {
          blob = await ensureSegmentAudio(voiceKey, talkId, segment, ttsConfig);
        } catch {
          checkCancelled();
          throw new Error(`Couldn’t prepare section ${number}. Check your connection and try again.`);
        }
        checkCancelled();
        if (!blob) {
          throw new Error(
            `Section ${number} hasn’t been prepared on this device. Connect to the internet and try again.`,
          );
        }
        sections.push(await blobToSamples(blob));
        checkCancelled();
        setState({ status: 'preparing', done: i + 1, total: chosen.length });
      }

      setState({ status: 'encoding', fraction: 0 });
      const parts = await encodeInWorker(
        joinWithGaps(sections, OUTPUT_SAMPLE_RATE),
        (fraction) => {
          if (run === runRef.current) setState({ status: 'encoding', fraction });
        },
        (worker) => { workerRef.current = worker; },
      );
      checkCancelled();
      workerRef.current = null;

      const file = new File(parts as BlobPart[], getExportFilename(title, sectionIndex), { type: 'audio/mpeg' });
      setState({ status: 'ready', file });
    } catch (err) {
      if (err instanceof ExportCancelled || run !== runRef.current) return;
      workerRef.current = null;
      setState({ status: 'error', message: (err as Error).message || 'Couldn’t create the MP3. Try again.' });
    }
  }, [segments, talkId, title, ttsConfig, voiceKey]);

  return { state, start, cancel };
}
