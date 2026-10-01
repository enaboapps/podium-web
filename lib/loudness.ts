/**
 * Loudness normalisation for synthesized speech.
 *
 * TTS providers return audio at very different levels (some ElevenLabs voices
 * come back ~12 dB quieter than Azure), and an <audio> element can only turn
 * volume down. So speech is decoded once when it's fetched, brought to a common
 * loudness with a peak limiter, and stored as WAV for plain <audio> playback.
 */

/** Target integrated loudness, in LUFS-like units (gated mean square, dBFS). */
export const TARGET_LOUDNESS_DB = -18;
/** Never boost more than this, so near-silent audio doesn't become hiss. */
const MAX_GAIN_DB = 15;
const MAX_CUT_DB = -10;
/** Peak ceiling after gain, just under full scale. */
const PEAK_CEILING = 10 ** (-1 / 20);
/** Output sample rate: speech-quality, and a third the size of 48 kHz. */
export const OUTPUT_SAMPLE_RATE = 24000;

export const NORMALISED_AUDIO_TYPE = 'audio/wav';

const dbToGain = (db: number) => 10 ** (db / 20);

/**
 * Integrated loudness using ITU-R BS.1770-style gating (400 ms blocks, 75 %
 * overlap, -70 dB absolute gate, -10 dB relative gate). K-weighting is skipped:
 * for speech it shifts the result by about a decibel, which the target absorbs.
 * Returns -Infinity for silence.
 */
export function measureLoudness(samples: Float32Array, sampleRate: number): number {
  const blockSize = Math.round(sampleRate * 0.4);
  const hop = Math.round(sampleRate * 0.1);
  const blocks: number[] = [];

  if (samples.length < blockSize) {
    let sum = 0;
    for (const value of samples) sum += value * value;
    if (samples.length > 0) blocks.push(sum / samples.length);
  } else {
    for (let start = 0; start + blockSize <= samples.length; start += hop) {
      let sum = 0;
      for (let i = start; i < start + blockSize; i++) sum += samples[i] * samples[i];
      blocks.push(sum / blockSize);
    }
  }

  const toDb = (meanSquare: number) => 10 * Math.log10(meanSquare);
  const aboveAbsolute = blocks.filter((meanSquare) => meanSquare > 0 && toDb(meanSquare) > -70);
  if (aboveAbsolute.length === 0) return -Infinity;

  const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const relativeGate = toDb(mean(aboveAbsolute)) - 10;
  const gated = aboveAbsolute.filter((meanSquare) => toDb(meanSquare) > relativeGate);
  return toDb(mean(gated));
}

/**
 * Gain (dB) that brings `loudness` to the target, within safe limits.
 * `targetOffsetDb` shifts the target, e.g. to keep whispers quiet.
 */
export function getNormalisationGainDb(loudness: number, targetOffsetDb = 0): number {
  if (!Number.isFinite(loudness)) return 0;
  return Math.min(MAX_GAIN_DB, Math.max(MAX_CUT_DB, TARGET_LOUDNESS_DB + targetOffsetDb - loudness));
}

/**
 * Apply gain, then a smooth peak limiter so boosted peaks never clip. The
 * limiter's gain envelope ramps down ahead of each peak (lookahead via a
 * backward pass) and recovers afterwards (release via a forward pass).
 */
export function applyGainWithLimiter(samples: Float32Array, sampleRate: number, gainDb: number): Float32Array {
  const gain = dbToGain(gainDb);
  const output = new Float32Array(samples.length);
  const envelope = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    output[i] = samples[i] * gain;
    const magnitude = Math.abs(output[i]);
    envelope[i] = magnitude > PEAK_CEILING ? PEAK_CEILING / magnitude : 1;
  }

  // Linear ramps: ~5 ms attack ahead of a peak, ~80 ms release after it.
  const attackStep = 1 / (sampleRate * 0.005);
  const releaseStep = 1 / (sampleRate * 0.08);
  for (let i = 1; i < envelope.length; i++) {
    envelope[i] = Math.min(envelope[i], envelope[i - 1] + releaseStep);
  }
  for (let i = envelope.length - 2; i >= 0; i--) {
    envelope[i] = Math.min(envelope[i], envelope[i + 1] + attackStep);
  }

  for (let i = 0; i < output.length; i++) output[i] *= envelope[i];
  return output;
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return buffer;
}

export function isNormalisedAudio(blob: Blob) {
  return blob.type === NORMALISED_AUDIO_TYPE;
}

/** Decode to mono at the output rate. Browser only. */
async function decodeToMono(blob: Blob): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, 1, OUTPUT_SAMPLE_RATE);
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);

  const mono = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const data = decoded.getChannelData(channel);
    for (let i = 0; i < mono.length; i++) mono[i] += data[i] / decoded.numberOfChannels;
  }
  return mono;
}

/**
 * Bring synthesized speech to the target loudness. Returns the original blob
 * if it's already normalised, or if decoding isn't possible, so speech never
 * breaks because of this step.
 */
export async function normaliseSpeechBlob(blob: Blob, targetOffsetDb = 0): Promise<Blob> {
  if (isNormalisedAudio(blob) || typeof OfflineAudioContext === 'undefined') return blob;
  try {
    const samples = await decodeToMono(blob);
    if (samples.length === 0) return blob;
    const gainDb = getNormalisationGainDb(measureLoudness(samples, OUTPUT_SAMPLE_RATE), targetOffsetDb);
    const processed = applyGainWithLimiter(samples, OUTPUT_SAMPLE_RATE, gainDb);
    return new Blob([encodeWav(processed, OUTPUT_SAMPLE_RATE)], { type: NORMALISED_AUDIO_TYPE });
  } catch {
    return blob;
  }
}
