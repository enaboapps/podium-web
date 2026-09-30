/**
 * Legacy word-level SSML bricks. No longer written — kept so segments saved by
 * the old editor can still be read and converted (see lib/delivery.ts).
 */
export type SegmentElement =
  | { type: 'word'; text: string }
  | { type: 'emphasis-open' }
  | { type: 'emphasis-close' }
  | { type: 'prosody-open'; rate?: number; pitch?: string; volume?: string }
  | { type: 'prosody-close' }
  | { type: 'break'; ms: number }
  | { type: 'tag'; value: string }
  | { type: 'say-as'; text: string; interpretAs: 'characters' };
