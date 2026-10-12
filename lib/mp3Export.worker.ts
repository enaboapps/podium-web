/// <reference lib="webworker" />
import { encodeMp3 } from './mp3Export';

export interface Mp3WorkerRequest {
  samples: Int16Array;
  sampleRate: number;
}

export type Mp3WorkerResponse =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; parts: Uint8Array[] }
  | { type: 'error'; message: string };

/** Encodes off the main thread, so long talks don't freeze the page. */
self.onmessage = (event: MessageEvent<Mp3WorkerRequest>) => {
  const post = (message: Mp3WorkerResponse, transfer: Transferable[] = []) =>
    (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);
  try {
    const { samples, sampleRate } = event.data;
    const parts = encodeMp3(samples, sampleRate, (fraction) => post({ type: 'progress', fraction }));
    post({ type: 'done', parts }, parts.map((part) => part.buffer as ArrayBuffer));
  } catch (err) {
    post({ type: 'error', message: (err as Error).message });
  }
};
