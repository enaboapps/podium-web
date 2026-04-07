export type SegmentElement =
  | { type: 'word'; text: string }
  | { type: 'emphasis-open' }
  | { type: 'emphasis-close' }
  | { type: 'prosody-open'; rate: number }
  | { type: 'prosody-close' }
  | { type: 'break'; ms: number }
  | { type: 'tag'; value: string };

/**
 * Build a proper SSML string from a brick element array for Azure TTS.
 * tag elements (ElevenLabs v3 only) are silently skipped.
 */
export function buildSSML(elements: SegmentElement[]): string {
  let inner = '';
  for (const el of elements) {
    switch (el.type) {
      case 'word':
        inner += el.text + ' ';
        break;
      case 'emphasis-open':
        inner += '<emphasis level="strong">';
        break;
      case 'emphasis-close':
        inner += '</emphasis>';
        break;
      case 'prosody-open':
        inner += `<prosody rate="${Math.round(el.rate * 100)}%">`;
        break;
      case 'prosody-close':
        inner += '</prosody>';
        break;
      case 'break':
        inner += `<break time="${el.ms / 1000}s"/>`;
        break;
      case 'tag':
        // ElevenLabs v3 audio tags — not used in SSML
        break;
    }
  }
  return `<speak>${inner.trimEnd()}</speak>`;
}

/** Tokenise plain text into word elements. */
export function tokenise(text: string): SegmentElement[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ type: 'word' as const, text: w }));
}
