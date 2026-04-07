export type SegmentElement =
  | { type: 'word'; text: string }
  | { type: 'emphasis-open' }
  | { type: 'emphasis-close' }
  | { type: 'prosody-open'; rate?: number; pitch?: string; volume?: string }
  | { type: 'prosody-close' }
  | { type: 'break'; ms: number }
  | { type: 'tag'; value: string }
  | { type: 'say-as'; text: string; interpretAs: 'characters' };

/** Per-word annotation model used by the brick editor (not stored in Convex). */
export interface WordAnnotation {
  id: string;           // ephemeral React key — not persisted
  text: string;
  emphasis: boolean;
  rate: number | null;  // null = no rate; 0.75 = slow, 1.3 = fast
  pitch: string | null; // null = no pitch; '-10%' = lower, '+10%' = higher
  volume: string | null; // null = no volume; 'soft', '+6dB', '-6dB'
  sayAs: 'characters' | null;
  pauseAfterMs: number | null;
}

/** Convert stored SegmentElement[] → editable WordAnnotation[]. */
export function buildAnnotations(elements: SegmentElement[]): WordAnnotation[] {
  const result: WordAnnotation[] = [];
  let pendingEmphasis = false;
  let pendingRate: number | null = null;
  let pendingPitch: string | null = null;
  let pendingVolume: string | null = null;

  for (const el of elements) {
    switch (el.type) {
      case 'emphasis-open':  pendingEmphasis = true; break;
      case 'emphasis-close': pendingEmphasis = false; break;
      case 'prosody-open':
        pendingRate   = el.rate   ?? null;
        pendingPitch  = el.pitch  ?? null;
        pendingVolume = el.volume ?? null;
        break;
      case 'prosody-close':
        pendingRate   = null;
        pendingPitch  = null;
        pendingVolume = null;
        break;
      case 'word':
        result.push({ id: crypto.randomUUID(), text: el.text, emphasis: pendingEmphasis, rate: pendingRate, pitch: pendingPitch, volume: pendingVolume, sayAs: null, pauseAfterMs: null });
        break;
      case 'say-as':
        result.push({ id: crypto.randomUUID(), text: el.text, emphasis: pendingEmphasis, rate: pendingRate, pitch: pendingPitch, volume: pendingVolume, sayAs: el.interpretAs, pauseAfterMs: null });
        break;
      case 'break':
        if (result.length > 0) result[result.length - 1].pauseAfterMs = el.ms;
        break;
      case 'tag': break; // ElevenLabs v3 — discard
    }
  }
  return result;
}

/** Convert editable WordAnnotation[] → SegmentElement[] for storage and SSML. */
export function buildElements(annotations: WordAnnotation[]): SegmentElement[] {
  const elements: SegmentElement[] = [];

  for (const ann of annotations) {
    const hasProsody = ann.rate !== null || ann.pitch !== null || ann.volume !== null;

    // emphasis must be outermost — Azure content model: <emphasis><prosody>word</prosody></emphasis>
    if (ann.emphasis) elements.push({ type: 'emphasis-open' });
    if (hasProsody)   elements.push({
      type: 'prosody-open',
      ...(ann.rate   !== null ? { rate:   ann.rate   } : {}),
      ...(ann.pitch  !== null ? { pitch:  ann.pitch  } : {}),
      ...(ann.volume !== null ? { volume: ann.volume } : {}),
    });

    if (ann.sayAs) {
      elements.push({ type: 'say-as', text: ann.text, interpretAs: ann.sayAs });
    } else {
      elements.push({ type: 'word', text: ann.text });
    }

    if (hasProsody)   elements.push({ type: 'prosody-close' });
    if (ann.emphasis) elements.push({ type: 'emphasis-close' });
    if (ann.pauseAfterMs !== null) elements.push({ type: 'break', ms: ann.pauseAfterMs });
  }

  return elements;
}

/** Tokenise plain text into WordAnnotation[] (no effects). */
export function tokenise(text: string): WordAnnotation[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ id: crypto.randomUUID(), text: w, emphasis: false, rate: null, pitch: null, volume: null, sayAs: null, pauseAfterMs: null }));
}

/**
 * Build Azure SSML from a SegmentElement array.
 * say-as strips trailing punctuation to avoid spelling it out.
 */
export function buildSSML(elements: SegmentElement[]): string {
  let inner = '';
  for (const el of elements) {
    switch (el.type) {
      case 'word':
        inner += el.text + ' ';
        break;
      case 'say-as': {
        const m = el.text.match(/^([\w'']+)([^a-zA-Z0-9]*)$/);
        const word = m ? m[1] : el.text;
        const suffix = m ? m[2] : '';
        inner += `<say-as interpret-as="${el.interpretAs}">${word}</say-as>${suffix} `;
        break;
      }
      case 'emphasis-open':  inner += '<emphasis level="strong">'; break;
      case 'emphasis-close': inner += '</emphasis>'; break;
      case 'prosody-open': {
        const attrs: string[] = [];
        if (el.rate   !== undefined) attrs.push(`rate="${el.rate}"`);
        if (el.pitch  !== undefined) attrs.push(`pitch="${el.pitch}"`);
        if (el.volume !== undefined) attrs.push(`volume="${el.volume}"`);
        inner += `<prosody ${attrs.join(' ')}>`;
        break;
      }
      case 'prosody-close':  inner += '</prosody>'; break;
      case 'break':          inner += `<break time="${el.ms / 1000}s"/>`; break;
      case 'tag':            break; // ElevenLabs v3 — not used in SSML
    }
  }
  return `<speak>${inner.trimEnd()}</speak>`;
}
