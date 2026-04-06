export type SegmentElement =
  | { type: 'word'; text: string }
  | { type: 'emphasis-open' }
  | { type: 'emphasis-close' }
  | { type: 'prosody-open'; rate: number }
  | { type: 'prosody-close' }
  | { type: 'break'; ms: number }
  | { type: 'tag'; value: string };

function breakTag(ms: number): string {
  if (ms <= 300) return '[short pause]';
  if (ms <= 750) return '[pause]';
  return '[long pause]';
}

/**
 * Build a text string with ElevenLabs v3 audio tags from a brick element array.
 * Close tags (emphasis-close, prosody-close) output nothing — v3 tags are directional,
 * not paired wrappers.
 */
export function buildTTSText(elements: SegmentElement[]): string {
  let out = '';
  for (const el of elements) {
    switch (el.type) {
      case 'word':
        out += el.text + ' ';
        break;
      case 'emphasis-open':
        out += '[emphasized] ';
        break;
      case 'prosody-open':
        out += el.rate < 1 ? '[slows down] ' : '[rushed] ';
        break;
      case 'break':
        out += breakTag(el.ms) + ' ';
        break;
      case 'tag':
        out += `[${el.value}] `;
        break;
      case 'emphasis-close':
      case 'prosody-close':
        break;
    }
  }
  return out.trimEnd();
}

/** Tokenise plain text into word elements. */
export function tokenise(text: string): SegmentElement[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ type: 'word' as const, text: w }));
}
