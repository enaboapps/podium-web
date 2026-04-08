import { Doc } from '@/convex/_generated/dataModel';

export type LibraryTab = 'talks' | 'sets';
export type CreateMode = 'none' | 'new' | 'set';
export type SegmentMode = 'paragraphs' | 'sentences';

export interface ImportDraft {
  title: string;
  fullText: string;
  paragraphs: string[];
  mode: SegmentMode;
}

export type TalkDoc = Doc<'talks'>;
export type TalkSetDoc = Doc<'talkSets'>;
