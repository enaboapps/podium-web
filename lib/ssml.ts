export type SegmentElement =
  | { type: 'word'; text: string }
  | { type: 'emphasis-open' }
  | { type: 'emphasis-close' }
  | { type: 'prosody-open'; rate: number }
  | { type: 'prosody-close' }
  | { type: 'break'; ms: number };

/** Build an SSML string from a brick element array. */
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
        inner += `<prosody rate="${el.rate}">`;
        break;
      case 'prosody-close':
        inner += '</prosody>';
        break;
      case 'break':
        inner += `<break time="${el.ms}ms"/>`;
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
