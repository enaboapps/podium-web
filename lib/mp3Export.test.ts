import { describe, expect, it } from 'vitest';
import { encodeWav } from './loudness';
import { encodeMp3, floatToInt16, getExportFilename, joinWithGaps, parseWav } from './mp3Export';

function tone(length: number, sampleRate: number) {
  return Float32Array.from({ length }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / sampleRate));
}

describe('parseWav', () => {
  it('reads back the PCM written by encodeWav', () => {
    const samples = tone(2400, 24000);
    const pcm = parseWav(encodeWav(samples, 24000));
    expect(pcm?.sampleRate).toBe(24000);
    expect(Array.from(pcm!.samples)).toEqual(Array.from(floatToInt16(samples)));
  });

  it('rejects files that are not 16-bit mono PCM WAV', () => {
    expect(parseWav(new TextEncoder().encode('ID3 not a wav file').buffer as ArrayBuffer)).toBeNull();

    const stereo = encodeWav(tone(100, 24000), 24000);
    new DataView(stereo).setUint16(22, 2, true);
    expect(parseWav(stereo)).toBeNull();
  });
});

describe('joinWithGaps', () => {
  it('puts silence between sections but not around them', () => {
    const joined = joinWithGaps([Int16Array.of(1, 2), Int16Array.of(3)], 1000, 3);
    expect(Array.from(joined)).toEqual([1, 2, 0, 0, 0, 3]);
  });

  it('leaves a single section unchanged', () => {
    expect(Array.from(joinWithGaps([Int16Array.of(5, 6)], 24000))).toEqual([5, 6]);
  });
});

describe('encodeMp3', () => {
  it('produces MPEG audio frames and reports progress to completion', () => {
    const progress: number[] = [];
    const parts = encodeMp3(floatToInt16(tone(24000, 24000)), 24000, (fraction) => progress.push(fraction));
    const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }

    expect(bytes.length).toBeGreaterThan(1000);
    // Frame sync: 11 set bits.
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1] & 0xe0).toBe(0xe0);
    expect(progress.at(-1)).toBe(1);
  });
});

describe('getExportFilename', () => {
  it('slugifies the title', () => {
    expect(getExportFilename('My Best Man’s Speech!')).toBe('my-best-man-s-speech.mp3');
    expect(getExportFilename('Café Opening')).toBe('cafe-opening.mp3');
  });

  it('numbers sections from one, padded', () => {
    expect(getExportFilename('Toast', 2)).toBe('toast-section-03.mp3');
  });

  it('falls back when the title has no usable characters', () => {
    expect(getExportFilename('???')).toBe('talk.mp3');
  });
});
