import { describe, expect, it } from "vitest";
import {
  getAzureTarget,
  getCapabilities,
  getElevenLabsTarget,
  getSegmentAudioIdentity,
  getSegmentWords,
  normaliseWord,
  renderSegment,
  wordsFromLegacyElements,
} from "./delivery";

const guy = getAzureTarget("en-US-GuyNeural");
const ava = getAzureTarget("en-US-AvaNeural");
const hd = getAzureTarget("en-US-Ava:DragonHDLatestNeural");
const omni = getAzureTarget("en-US-Ava:DragonHDOmniLatestNeural");
const multilingual = getElevenLabsTarget("eleven_multilingual_v2");
const v4 = getElevenLabsTarget("eleven_v4");

describe("targets and capabilities", () => {
  it("classifies Azure voice families and emphasis support", () => {
    expect(guy).toEqual({ provider: "azure", family: "neural", nativeEmphasis: true });
    expect(ava).toEqual({ provider: "azure", family: "neural", nativeEmphasis: false });
    expect(hd).toMatchObject({ family: "hd" });
    expect(omni).toMatchObject({ family: "hd-omni" });
  });

  it("classifies ElevenLabs models", () => {
    expect(multilingual).toEqual({ provider: "elevenlabs", family: "classic" });
    expect(getElevenLabsTarget("eleven_v3")).toEqual({ provider: "elevenlabs", family: "expressive" });
    expect(v4).toEqual({ provider: "elevenlabs", family: "expressive" });
  });

  it("disables what a target cannot do", () => {
    expect(getCapabilities(multilingual).mood).toBe("no");
    expect(getCapabilities(hd).pace).toBe("no");
    expect(getCapabilities(omni).pause).toBe("approx");
    expect(getCapabilities(guy).stress).toBe("yes");
    expect(getCapabilities(ava).stress).toBe("approx");
  });
});

describe("reading segments", () => {
  it("converts legacy SSML bricks to words", () => {
    const words = wordsFromLegacyElements([
      { type: "emphasis-open" },
      { type: "word", text: "Hello" },
      { type: "emphasis-close" },
      { type: "break", ms: 1000 },
      { type: "prosody-open", rate: 0.75 },
      { type: "say-as", text: "BBC.", interpretAs: "characters" },
      { type: "prosody-close" },
      { type: "break", ms: 2000 },
    ]);
    expect(words).toEqual([
      { text: "Hello", stress: true, pause: "medium" },
      { text: "BBC.", spell: true, pause: "long" },
    ]);
  });

  it("prefers words, then legacy elements, then plain text", () => {
    expect(getSegmentWords({ text: "a b", words: [{ text: "x" }] })).toEqual([{ text: "x" }]);
    expect(getSegmentWords({ text: "a  b" })).toEqual([{ text: "a" }, { text: "b" }]);
  });

  it("keeps plain segments' cache identity as their text", () => {
    expect(getSegmentAudioIdentity({ text: "Hi there", words: [{ text: "Hi" }, { text: "there" }] })).toBe("Hi there");
    expect(getSegmentAudioIdentity({ text: "Hi", mood: "calm" })).toMatch(/^delivery:/);
  });

  it("normalises words", () => {
    expect(normaliseWord({ text: "a", stress: false, spell: true, sayAs: "  " })).toEqual({ text: "a", spell: true });
    expect(normaliseWord({ text: "a", spell: true, sayAs: "ay" })).toEqual({ text: "a", sayAs: "ay" });
  });
});

describe("Azure rendering", () => {
  it("escapes XML in plain text", () => {
    expect(renderSegment({ text: "Salt & <pepper>" }, guy).input).toBe("<speak>Salt &amp; &lt;pepper&gt;</speak>");
  });

  it("uses native emphasis on supported voices, outside prosody", () => {
    const { input } = renderSegment(
      { text: "a big deal", pace: "slower", words: [{ text: "a" }, { text: "big", stress: true }, { text: "deal" }] },
      guy,
    );
    expect(input).toBe(
      '<speak><prosody rate="-15%">a</prosody> <emphasis level="strong"><prosody rate="-15%">big</prosody></emphasis> <prosody rate="-15%">deal</prosody></speak>',
    );
  });

  it("approximates stress with prosody on other neural voices", () => {
    const { input } = renderSegment({ text: "big", words: [{ text: "big", stress: true }] }, ava);
    expect(input).toBe('<speak><prosody rate="-10%" volume="+20%">big</prosody></speak>');
  });

  it("renders mood, pauses, spelling and substitutions", () => {
    const { input } = renderSegment(
      {
        text: "The BBC. Siobhan",
        mood: "whisper",
        words: [{ text: "The", pause: "short" }, { text: "BBC.", spell: true }, { text: "Siobhan", sayAs: "shiv-awn" }],
      },
      ava,
    );
    expect(input).toBe(
      '<speak><mstts:express-as style="whispering"><prosody rate="-5%" volume="x-soft">The <break time="500ms"/> <say-as interpret-as="characters">BBC</say-as>. <sub alias="shiv-awn">Siobhan</sub></prosody></mstts:express-as></speak>',
    );
  });

  it("avoids prosody and emphasis on HD voices", () => {
    const words = [{ text: "really", stress: true, pause: "medium" as const }, { text: "good" }];
    expect(renderSegment({ text: "really good", mood: "excited", pace: "faster", words }, hd).input).toBe(
      '<speak>[excited] REALLY <break time="1000ms"/> [excited] good</speak>',
    );
    expect(renderSegment({ text: "really good", mood: "whisper", words }, omni).input).toBe(
      '<speak><mstts:express-as style="quiet">REALLY ... good</mstts:express-as></speak>',
    );
  });
});

describe("ElevenLabs rendering", () => {
  const segment = {
    text: "Hello NASA, Siobhan",
    mood: "sad" as const,
    pace: "slower" as const,
    words: [
      { text: "Hello", stress: true, pause: "long" as const },
      { text: "NASA,", spell: true },
      { text: "Siobhan", sayAs: "shiv-awn" },
    ],
  };

  it("sends plain text untouched when there is no styling", () => {
    expect(renderSegment({ text: "Hi & bye" }, multilingual)).toEqual({ input: "Hi & bye" });
  });

  it("uses break tags and speed on classic models, without moods", () => {
    expect(renderSegment(segment, multilingual)).toEqual({
      input: 'HELLO <break time="2.0s" /> N. A. S. A., shiv-awn',
      speed: 0.85,
    });
  });

  it("uses audio tags on v3/v4", () => {
    expect(renderSegment(segment, v4)).toEqual({
      input: "[sadly] HELLO [long pause] [sadly] N. A. S. A., shiv-awn",
      speed: 0.85,
    });
  });

  it("does not restate the mood after a pause on the last word", () => {
    const words = [{ text: "Hello" }, { text: "there.", pause: "short" as const }];
    expect(renderSegment({ text: "Hello there.", mood: "calm", words }, v4).input).toBe(
      "[calmly] Hello there. ...",
    );
  });
});
