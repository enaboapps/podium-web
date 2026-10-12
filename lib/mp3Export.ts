/**
 * MP3 export of talk speech. Cached segment audio is loudness-normalised
 * 16-bit mono WAV (see lib/loudness.ts), so sections are read straight from
 * their PCM, joined with short pauses and encoded to MP3.
 */
import { Mp3Encoder } from '@breezystack/lamejs';

/** Pause between sections in a whole-talk export. */
export const SECTION_GAP_MS = 700;
/** Mono speech at 24 kHz: about half a megabyte per minute. */
export const MP3_BITRATE_KBPS = 64;
/** LAME encodes in frames of 1152 samples; feed it whole frames. */
const ENCODE_CHUNK_SAMPLES = 1152 * 64;

export interface Pcm {
  samples: Int16Array;
  sampleRate: number;
}

/**
 * Mono 16-bit PCM from a WAV file, or null if it isn't 16-bit mono PCM
 * (callers fall back to decoding it).
 */
export function parseWav(buffer: ArrayBuffer): Pcm | null {
  if (buffer.byteLength < 12) return null;
  const view = new DataView(buffer);
  const readString = (offset: number) =>
    String.fromCharCode(...new Uint8Array(buffer, offset, 4));
  if (readString(0) !== 'RIFF' || readString(8) !== 'WAVE') return null;

  let sampleRate = 0;
  let isMono16BitPcm = false;
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = readString(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      const format = view.getUint16(body, true);
      const channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      const bitsPerSample = view.getUint16(body + 14, true);
      isMono16BitPcm = format === 1 && channels === 1 && bitsPerSample === 16;
    } else if (id === 'data') {
      if (!isMono16BitPcm || !sampleRate) return null;
      const end = Math.min(body + size, buffer.byteLength);
      return { samples: new Int16Array(buffer.slice(body, body + ((end - body) & ~1))), sampleRate };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

export function floatToInt16(samples: Float32Array): Int16Array {
  const output = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

/** Join sections end to end with `gapMs` of silence between them. */
export function joinWithGaps(sections: Int16Array[], sampleRate: number, gapMs = SECTION_GAP_MS): Int16Array {
  const gap = Math.round((sampleRate * gapMs) / 1000);
  const total = sections.reduce((sum, section) => sum + section.length, 0) + gap * Math.max(0, sections.length - 1);
  const output = new Int16Array(total);
  let offset = 0;
  sections.forEach((section, i) => {
    if (i > 0) offset += gap;
    output.set(section, offset);
    offset += section.length;
  });
  return output;
}

/** Encode mono PCM to MP3 parts; `onProgress` gets the fraction done. */
export function encodeMp3(
  samples: Int16Array,
  sampleRate: number,
  onProgress?: (fraction: number) => void,
): Uint8Array[] {
  const encoder = new Mp3Encoder(1, sampleRate, MP3_BITRATE_KBPS);
  const parts: Uint8Array[] = [];
  for (let start = 0; start < samples.length; start += ENCODE_CHUNK_SAMPLES) {
    const frame = encoder.encodeBuffer(samples.subarray(start, start + ENCODE_CHUNK_SAMPLES));
    if (frame.length > 0) parts.push(frame);
    onProgress?.(Math.min(1, (start + ENCODE_CHUNK_SAMPLES) / samples.length));
  }
  const tail = encoder.flush();
  if (tail.length > 0) parts.push(tail);
  return parts;
}

function slugify(title: string) {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'talk';
}

/** e.g. "my-talk.mp3", or "my-talk-section-03.mp3" for the third section. */
export function getExportFilename(title: string, sectionIndex?: number) {
  const slug = slugify(title);
  return sectionIndex === undefined
    ? `${slug}.mp3`
    : `${slug}-section-${String(sectionIndex + 1).padStart(2, '0')}.mp3`;
}
