export type SegmentElement =
  | { type: 'word'; text: string }
  | { type: 'emphasis-open' }
  | { type: 'emphasis-close' }
  | { type: 'prosody-open'; rate: number }
  | { type: 'prosody-close' }
  | { type: 'break'; ms: number }
  | { type: 'tag'; value: string }
  | { type: 'say-as'; text: string; interpretAs: 'characters' };

/** Per-word annotation model used by the brick editor (not stored in Convex). */
export interface WordAnnotation {
  id: string;           // ephemeral React key — not persisted
  text: string;
  emphasis: boolean;
  rate: number | null;  // null = no prosody; 0.7 = slow, 1.4 = fast
  sayAs: 'characters' | null;
  pauseAfterMs: number | null;
}

/** Convert stored SegmentElement[] → editable WordAnnotation[]. */
export function buildAnnotations(elements: SegmentElement[]): WordAnnotation[] {
  const result: WordAnnotation[] = [];
  let pendingEmphasis = false;
  let pendingRate: number | null = null;

  for (const el of elements) {
    switch (el.type) {
      case 'emphasis-open':  pendingEmphasis = true; break;
      case 'emphasis-close': pendingEmphasis = false; break;
      case 'prosody-open':   pendingRate = el.rate; break;
      case 'prosody-close':  pendingRate = null; break;
      case 'word':
        result.push({ id: crypto.randomUUID(), text: el.text, emphasis: pendingEmphasis, rate: pendingRate, sayAs: null, pauseAfterMs: null });
        break;
      case 'say-as':
        result.push({ id: crypto.randomUUID(), text: el.text, emphasis: pendingEmphasis, rate: pendingRate, sayAs: el.interpretAs, pauseAfterMs: null });
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
    if (ann.rate !== null) elements.push({ type: 'prosody-open', rate: ann.rate });
    if (ann.emphasis)      elements.push({ type: 'emphasis-open' });

    if (ann.sayAs) {
      elements.push({ type: 'say-as', text: ann.text, interpretAs: ann.sayAs });
    } else {
      elements.push({ type: 'word', text: ann.text });
    }

    if (ann.emphasis)      elements.push({ type: 'emphasis-close' });
    if (ann.rate !== null) elements.push({ type: 'prosody-close' });
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
    .map((w) => ({ id: crypto.randomUUID(), text: w, emphasis: false, rate: null, sayAs: null, pauseAfterMs: null }));
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
      case 'prosody-open':   inner += `<prosody rate="${Math.round(el.rate * 100)}%">`; break;
      case 'prosody-close':  inner += '</prosody>'; break;
      case 'break':          inner += `<break time="${el.ms / 1000}s"/>`; break;
      case 'tag':            break; // ElevenLabs v3 — not used in SSML
    }
  }
  return `<speak>${inner.trimEnd()}</speak>`;
}
