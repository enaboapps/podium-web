import { describe, expect, it } from "vitest";
import {
  applyGainWithLimiter,
  encodeWav,
  getNormalisationGainDb,
  measureLoudness,
  TARGET_LOUDNESS_DB,
} from "./loudness";

const RATE = 24000;

function sine(amplitude: number, seconds: number, frequency = 220) {
  const samples = new Float32Array(Math.round(RATE * seconds));
  for (let i = 0; i < samples.length; i++) samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / RATE);
  return samples;
}

function peak(samples: Float32Array) {
  return samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

describe("measureLoudness", () => {
  it("measures a full-scale sine at about -3 dB", () => {
    expect(measureLoudness(sine(1, 2), RATE)).toBeCloseTo(-3.01, 1);
  });

  it("ignores silence between words", () => {
    const speech = sine(0.1, 1);
    const withGap = new Float32Array(speech.length * 3);
    withGap.set(speech, 0);
    withGap.set(speech, speech.length * 2);
    // Blocks half-filled at the edges still pass the gate, so allow a decibel.
    expect(Math.abs(measureLoudness(withGap, RATE) - measureLoudness(speech, RATE))).toBeLessThan(1);
  });

  it("returns -Infinity for silence", () => {
    expect(measureLoudness(new Float32Array(RATE), RATE)).toBe(-Infinity);
  });
});

describe("getNormalisationGainDb", () => {
  it("boosts quiet audio and cuts loud audio towards the target", () => {
    expect(getNormalisationGainDb(TARGET_LOUDNESS_DB - 6)).toBeCloseTo(6);
    expect(getNormalisationGainDb(TARGET_LOUDNESS_DB + 4)).toBeCloseTo(-4);
  });

  it("shifts the target by an offset", () => {
    expect(getNormalisationGainDb(TARGET_LOUDNESS_DB, -8)).toBeCloseTo(-8);
  });

  it("limits extreme changes and leaves silence alone", () => {
    expect(getNormalisationGainDb(-80)).toBe(15);
    expect(getNormalisationGainDb(0)).toBe(-10);
    expect(getNormalisationGainDb(-Infinity)).toBe(0);
  });
});

describe("applyGainWithLimiter", () => {
  it("applies gain exactly when nothing would clip", () => {
    const output = applyGainWithLimiter(sine(0.1, 0.5), RATE, 6);
    expect(peak(output)).toBeCloseTo(0.1 * 10 ** (6 / 20), 3);
  });

  it("keeps boosted peaks under the ceiling", () => {
    const output = applyGainWithLimiter(sine(0.5, 0.5), RATE, 12);
    expect(peak(output)).toBeLessThanOrEqual(10 ** (-1 / 20) + 1e-6);
  });
});

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM header and samples", () => {
    const view = new DataView(encodeWav(new Float32Array([0, 1, -1]), RATE));
    const text = (offset: number) => String.fromCharCode(...Array.from({ length: 4 }, (_, i) => view.getUint8(offset + i)));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(RATE);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
  });
});
