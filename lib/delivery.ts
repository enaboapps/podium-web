/**
 * Delivery presets: what the user wants a segment to sound like, stored as
 * intents and rendered per provider / voice family / model. See
 * docs/tts-provider-capabilities.md for the research behind the mappings below.
 */
import { SegmentElement } from '@/lib/ssml';

export type Mood = 'calm' | 'warm' | 'excited' | 'serious' | 'sad' | 'whisper';
export type Pace = 'slower' | 'faster';
export type PauseLength = 'short' | 'medium' | 'long';

export interface DeliveryWord {
  text: string;
  stress?: boolean;
  spell?: boolean;
  /** Spoken instead of `text` ("Say it like…") */
  sayAs?: string;
  /** Pause after this word */
  pause?: PauseLength;
}

export interface DeliverySegment {
  text: string;
  words?: DeliveryWord[];
  mood?: Mood;
  pace?: Pace;
  /** Legacy word-level SSML bricks, converted on read */
  elements?: unknown[];
}

// ─── Providers, models and capabilities ──────────────────────────────────────

export const DEFAULT_ELEVENLABS_MODEL = 'eleven_multilingual_v2';

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'Steady and reliable. Exact pauses, no moods.' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5', description: 'Fastest and cheapest. Exact pauses, no moods.' },
  { id: 'eleven_v3', label: 'Eleven v3', description: 'Expressive. Moods work, pauses are approximate.' },
  { id: 'eleven_v4', label: 'Eleven v4', description: 'Newest and most expressive. Moods work, pauses are approximate.' },
] as const;

/** Azure voices that honour <emphasis> (per Microsoft's SSML docs). */
const AZURE_EMPHASIS_VOICES = new Set(['en-us-guyneural', 'en-us-davisneural', 'en-us-janeneural']);

export type SpeechTarget =
  | { provider: 'azure'; family: 'neural' | 'hd' | 'hd-omni'; nativeEmphasis: boolean }
  | { provider: 'elevenlabs'; family: 'classic' | 'expressive' };

export function getAzureTarget(voiceId: string): SpeechTarget {
  const id = voiceId.toLowerCase();
  const family = id.includes('dragonhdomni') ? 'hd-omni' : id.includes('dragonhd') ? 'hd' : 'neural';
  return { provider: 'azure', family, nativeEmphasis: AZURE_EMPHASIS_VOICES.has(id) };
}

export function getElevenLabsTarget(modelId: string): SpeechTarget {
  const expressive = modelId.startsWith('eleven_v3') || modelId.startsWith('eleven_v4');
  return { provider: 'elevenlabs', family: expressive ? 'expressive' : 'classic' };
}

/** yes = does what it says; approx = a best-effort stand-in; no = can't be done */
export type Support = 'yes' | 'approx' | 'no';

export interface DeliveryCapabilities {
  mood: Support;
  pace: Support;
  pause: Support;
  stress: Support;
}

export function getCapabilities(target: SpeechTarget): DeliveryCapabilities {
  if (target.provider === 'elevenlabs') {
    return target.family === 'expressive'
      ? { mood: 'yes', pace: 'yes', pause: 'approx', stress: 'approx' }
      : { mood: 'no', pace: 'yes', pause: 'yes', stress: 'approx' };
  }
  switch (target.family) {
    case 'neural':
      // Styles are voice-specific; unsupported styles fall back to prosody
      return { mood: 'approx', pace: 'yes', pause: 'yes', stress: target.nativeEmphasis ? 'yes' : 'approx' };
    case 'hd':
      return { mood: 'approx', pace: 'no', pause: 'yes', stress: 'approx' };
    case 'hd-omni':
      return { mood: 'yes', pace: 'no', pause: 'approx', stress: 'approx' };
  }
}

/** Short explanations for anything that isn't fully supported by the target. */
export function getCapabilityNotes(target: SpeechTarget): Partial<Record<keyof DeliveryCapabilities, string>> {
  const capitals = 'Stressed words are sent in capitals, which the voice reads with extra weight.';
  if (target.provider === 'elevenlabs') {
    return target.family === 'expressive'
      ? { pause: 'Pauses are approximate on this model.', stress: capitals }
      : { mood: 'Moods need the Eleven v3 or v4 model. You can change it in Settings.', stress: capitals };
  }
  switch (target.family) {
    case 'neural':
      return {
        mood: 'Voices with their own speaking styles use them; others get a similar speed and pitch.',
        ...(!target.nativeEmphasis && {
          stress: "Your voice doesn't support true emphasis, so stressed words are said a little slower and louder.",
        }),
      };
    case 'hd':
      return { mood: 'Moods work on English text only.', pace: "HD voices can't change pace.", stress: capitals };
    case 'hd-omni':
      return { pace: "HD voices can't change pace.", pause: 'HD Omni voices pause approximately.', stress: capitals };
  }
}

// ─── Presets ─────────────────────────────────────────────────────────────────

interface ProsodyHint {
  rate?: number;
  pitch?: string;
  volume?: string;
}

interface MoodPreset {
  label: string;
  /** Azure Neural express-as style (ignored by voices without it) */
  neuralStyle: string;
  /** Azure DragonHD style marker */
  hdStyle: string;
  /** Azure DragonHD Omni express-as style */
  omniStyle: string;
  /** ElevenLabs v3/v4 audio tag */
  elevenTag: string;
  /** Azure Neural prosody fallback */
  prosody: ProsodyHint;
}

export const MOOD_PRESETS: Record<Mood, MoodPreset> = {
  calm: { label: 'Calm', neuralStyle: 'calm', hdStyle: 'calm', omniStyle: 'calm', elevenTag: '[calmly]', prosody: { rate: 0.95 } },
  warm: { label: 'Warm', neuralStyle: 'friendly', hdStyle: 'encouraging', omniStyle: 'encouraging', elevenTag: '[warmly]', prosody: { pitch: '+3%' } },
  excited: { label: 'Excited', neuralStyle: 'excited', hdStyle: 'excited', omniStyle: 'excited', elevenTag: '[excited]', prosody: { rate: 1.08, pitch: '+8%' } },
  serious: { label: 'Serious', neuralStyle: 'serious', hdStyle: 'serious', omniStyle: 'serious', elevenTag: '[seriously]', prosody: { rate: 0.95, pitch: '-5%' } },
  sad: { label: 'Sad', neuralStyle: 'sad', hdStyle: 'sad', omniStyle: 'sad', elevenTag: '[sadly]', prosody: { rate: 0.9, pitch: '-8%' } },
  whisper: { label: 'Whisper', neuralStyle: 'whispering', hdStyle: 'whispering', omniStyle: 'quiet', elevenTag: '[whispers]', prosody: { rate: 0.95, volume: 'x-soft' } },
};

export const MOODS = Object.keys(MOOD_PRESETS) as Mood[];

export const PACE_PRESETS: Record<Pace, { label: string; rate: number }> = {
  slower: { label: 'Slower', rate: 0.85 },
  faster: { label: 'Faster', rate: 1.15 },
};

export const PAUSE_PRESETS: Record<PauseLength, { label: string; ms: number }> = {
  short: { label: 'Short', ms: 500 },
  medium: { label: 'Medium', ms: 1000 },
  long: { label: 'Long', ms: 2000 },
};

export const PAUSE_LENGTHS = Object.keys(PAUSE_PRESETS) as PauseLength[];

// ─── Reading stored segments ─────────────────────────────────────────────────

export function tokeniseWords(text: string): DeliveryWord[] {
  return text.trim().split(/\s+/).filter(Boolean).map((word) => ({ text: word }));
}

function pauseFromMs(ms: number): PauseLength {
  if (ms <= 750) return 'short';
  if (ms <= 1500) return 'medium';
  return 'long';
}

/** Convert legacy SSML bricks to words. Prosody (rate/pitch/volume) has no word-level equivalent and is dropped. */
export function wordsFromLegacyElements(elements: SegmentElement[]): DeliveryWord[] {
  const words: DeliveryWord[] = [];
  let stress = false;

  for (const el of elements) {
    switch (el.type) {
      case 'emphasis-open': stress = true; break;
      case 'emphasis-close': stress = false; break;
      case 'word': words.push({ text: el.text, ...(stress && { stress: true }) }); break;
      case 'say-as': words.push({ text: el.text, spell: true, ...(stress && { stress: true }) }); break;
      case 'break':
        if (words.length > 0) words[words.length - 1].pause = pauseFromMs(el.ms);
        break;
      default: break;
    }
  }
  return words;
}

export function getSegmentWords(segment: DeliverySegment): DeliveryWord[] {
  if (segment.words?.length) return segment.words;
  if (segment.elements?.length) return wordsFromLegacyElements(segment.elements as SegmentElement[]);
  return tokeniseWords(segment.text);
}

/** Strip empty/false fields so stored words stay minimal and Convex-safe. */
export function normaliseWord(word: DeliveryWord): DeliveryWord {
  const sayAs = word.sayAs?.trim();
  return {
    text: word.text,
    ...(word.stress && { stress: true }),
    ...(sayAs ? { sayAs } : word.spell ? { spell: true } : {}),
    ...(word.pause && { pause: word.pause }),
  };
}

export function isStyledWord(word: DeliveryWord) {
  return !!(word.stress || word.spell || word.sayAs || word.pause);
}

export function hasDelivery(segment: DeliverySegment) {
  return !!(segment.mood || segment.pace || segment.words?.some(isStyledWord) || segment.elements?.length);
}

/** Stable string that changes whenever the audio for a segment would change. */
export function getSegmentAudioIdentity(segment: DeliverySegment) {
  if (!hasDelivery(segment)) return segment.text;
  return `delivery:${JSON.stringify({
    text: segment.text,
    words: segment.words,
    mood: segment.mood,
    pace: segment.pace,
    elements: segment.elements,
  })}`;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

export interface RenderedSpeech {
  /** SSML for Azure; plain text (with <break> / [tags]) for ElevenLabs */
  input: string;
  /** ElevenLabs voice_settings.speed */
  speed?: number;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Split "“Hello," into prefix “ / core Hello / suffix , so effects apply to the word only. */
function splitPunctuation(text: string) {
  const match = text.match(/^([("'“‘[]*)(.*?)([.,!?;:…"'”’)\]]*)$/u);
  if (!match || !match[2]) return { prefix: '', core: text, suffix: '' };
  return { prefix: match[1], core: match[2], suffix: match[3] };
}

function spellOutLetters(core: string) {
  return Array.from(core)
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .map((char) => (/\p{L}/u.test(char) ? `${char.toUpperCase()}.` : char))
    .join(' ');
}

function formatPercent(multiplier: number) {
  const percent = Math.round((multiplier - 1) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function prosodyAttributes(hint: ProsodyHint) {
  const attrs: string[] = [];
  if (hint.rate !== undefined && hint.rate !== 1) attrs.push(`rate="${formatPercent(hint.rate)}"`);
  if (hint.pitch) attrs.push(`pitch="${hint.pitch}"`);
  if (hint.volume) attrs.push(`volume="${hint.volume}"`);
  return attrs.join(' ');
}

/** Word content for Azure: spelling, substitution or plain text (escaped). */
function azureWordContent(word: DeliveryWord, capitalise: boolean) {
  const { prefix, core, suffix } = splitPunctuation(word.text);
  let body: string;
  if (word.sayAs) {
    body = `<sub alias="${escapeXml(word.sayAs)}">${escapeXml(core)}</sub>`;
  } else if (word.spell) {
    body = `<say-as interpret-as="characters">${escapeXml(core)}</say-as>`;
  } else {
    body = escapeXml(capitalise && word.stress ? core.toUpperCase() : core);
  }
  return `${escapeXml(prefix)}${body}${escapeXml(suffix)}`;
}

function renderAzureNeural(words: DeliveryWord[], segment: DeliverySegment, nativeEmphasis: boolean) {
  const moodHint = segment.mood ? MOOD_PRESETS[segment.mood].prosody : {};
  const paceRate = segment.pace ? PACE_PRESETS[segment.pace].rate : 1;
  const base: ProsodyHint = { ...moodHint, rate: (moodHint.rate ?? 1) * paceRate };

  // Azure's content model forbids <emphasis> inside <prosody>, so each run of
  // words carries its own prosody and emphasis sits outermost.
  type Run = { emphasis: boolean; attrs: string; parts: string[] };
  const runs: Run[] = [];

  for (const word of words) {
    const emphasis = !!word.stress && nativeEmphasis;
    const hint = word.stress && !nativeEmphasis
      ? { ...base, rate: (base.rate ?? 1) * 0.9, volume: base.volume ?? '+20%' }
      : base;
    const attrs = prosodyAttributes(hint);
    let part = azureWordContent(word, false);
    if (word.pause) part += ` <break time="${PAUSE_PRESETS[word.pause].ms}ms"/>`;

    const last = runs[runs.length - 1];
    if (last && last.emphasis === emphasis && last.attrs === attrs) {
      last.parts.push(part);
    } else {
      runs.push({ emphasis, attrs, parts: [part] });
    }
  }

  let body = runs.map((run) => {
    let content = run.parts.join(' ');
    if (run.attrs) content = `<prosody ${run.attrs}>${content}</prosody>`;
    if (run.emphasis) content = `<emphasis level="strong">${content}</emphasis>`;
    return content;
  }).join(' ');

  if (segment.mood) {
    body = `<mstts:express-as style="${MOOD_PRESETS[segment.mood].neuralStyle}">${body}</mstts:express-as>`;
  }
  return body;
}

function renderAzureHD(words: DeliveryWord[], segment: DeliverySegment, omni: boolean) {
  const preset = segment.mood ? MOOD_PRESETS[segment.mood] : null;
  // DragonHD style markers are inline like ElevenLabs tags, so restate after pauses.
  const styleMarker = preset && !omni ? `[${preset.hdStyle}]` : null;

  // HD voices ignore prosody and emphasis: stress falls back to capitals.
  let body = words.map((word, index) => {
    let part = azureWordContent(word, true);
    if (word.pause) {
      part += omni
        ? (word.pause === 'long' ? ' ... ...' : ' ...')
        : ` <break time="${PAUSE_PRESETS[word.pause].ms}ms"/>`;
      if (styleMarker && index < words.length - 1) part += ` ${styleMarker}`;
    }
    return part;
  }).join(' ');

  if (preset) {
    body = omni
      ? `<mstts:express-as style="${preset.omniStyle}">${body}</mstts:express-as>`
      : `${styleMarker} ${body}`;
  }
  return body;
}

function renderElevenLabs(words: DeliveryWord[], segment: DeliverySegment, expressive: boolean): RenderedSpeech {
  const moodTag = expressive && segment.mood ? MOOD_PRESETS[segment.mood].elevenTag : null;

  const parts = words.map((word, index) => {
    const { prefix, core, suffix } = splitPunctuation(word.text);
    let spoken = core;
    let tail = suffix;
    if (word.sayAs) {
      spoken = word.sayAs;
    } else if (word.spell) {
      spoken = spellOutLetters(core) || core;
      if (tail.startsWith('.')) tail = tail.slice(1);
    } else if (word.stress) {
      spoken = core.toUpperCase();
    }

    let part = `${prefix}${spoken}${tail}`;
    if (word.pause) {
      if (expressive) {
        part += word.pause === 'short' ? ' ...' : word.pause === 'medium' ? ' [pause]' : ' [long pause]';
        // A mood tag stops applying after a pause, so restate it for the words that follow.
        if (moodTag && index < words.length - 1) part += ` ${moodTag}`;
      } else {
        part += ` <break time="${(PAUSE_PRESETS[word.pause].ms / 1000).toFixed(1)}s" />`;
      }
    }
    return part;
  });

  let input = parts.join(' ');
  if (moodTag) input = `${moodTag} ${input}`;

  return {
    input,
    ...(segment.pace && { speed: PACE_PRESETS[segment.pace].rate }),
  };
}

export function renderSegment(segment: DeliverySegment, target: SpeechTarget): RenderedSpeech {
  const words = getSegmentWords(segment);

  if (target.provider === 'elevenlabs') {
    if (!hasDelivery(segment)) return { input: segment.text };
    return renderElevenLabs(words, segment, target.family === 'expressive');
  }

  const body = target.family === 'neural'
    ? renderAzureNeural(words, segment, target.nativeEmphasis)
    : renderAzureHD(words, segment, target.family === 'hd-omni');
  return { input: `<speak>${body}</speak>` };
}
