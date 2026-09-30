import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Legacy word-level SSML bricks (read-only; replaced by `words` when a segment is edited) */
const elementUnion = v.union(
  v.object({ type: v.literal('word'), text: v.string() }),
  v.object({ type: v.literal('emphasis-open') }),
  v.object({ type: v.literal('emphasis-close') }),
  v.object({ type: v.literal('prosody-open'), rate: v.optional(v.number()), pitch: v.optional(v.string()), volume: v.optional(v.string()) }),
  v.object({ type: v.literal('prosody-close') }),
  v.object({ type: v.literal('break'), ms: v.number() }),
  v.object({ type: v.literal('tag'), value: v.string() }),
  v.object({ type: v.literal('say-as'), text: v.string(), interpretAs: v.literal('characters') }),
);

export const moodValidator = v.union(
  v.literal('calm'),
  v.literal('warm'),
  v.literal('excited'),
  v.literal('serious'),
  v.literal('sad'),
  v.literal('whisper'),
);

export const paceValidator = v.union(v.literal('slower'), v.literal('faster'));

export const deliveryWordValidator = v.object({
  text: v.string(),
  stress: v.optional(v.boolean()),
  spell: v.optional(v.boolean()),
  /** Spoken instead of `text` ("Say it like…") */
  sayAs: v.optional(v.string()),
  /** Pause after this word */
  pause: v.optional(v.union(v.literal('short'), v.literal('medium'), v.literal('long'))),
});

export const segmentValidator = v.object({
  id: v.string(),
  text: v.string(),
  /** Unused */
  tempo: v.optional(v.number()),
  /** Unused */
  emphasis: v.optional(v.boolean()),
  /** Legacy word-level SSML brick sequence */
  elements: v.optional(v.array(elementUnion)),
  /** Per-word delivery presets */
  words: v.optional(v.array(deliveryWordValidator)),
  /** Mood for the whole segment; absent = normal */
  mood: v.optional(moodValidator),
  /** Pace for the whole segment; absent = normal */
  pace: v.optional(paceValidator),
});

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    provider: v.optional(v.union(v.literal('elevenlabs'), v.literal('azure'))),
    elevenLabsApiKey: v.optional(v.string()),
    azureSubscriptionKey: v.optional(v.string()),
    azureRegion: v.optional(v.string()),
    elevenLabsVoiceId: v.optional(v.string()),
    elevenLabsModelId: v.optional(v.string()),
    azureVoiceId: v.optional(v.string()),
  }).index('by_clerk_id', ['clerkId']),

  talks: defineTable({
    userId: v.string(),
    title: v.string(),
    /** Ordered segments of the script */
    segments: v.array(segmentValidator),
    /** ElevenLabs voice ID */
    voiceId: v.optional(v.string()),
    /** Raw full text of the talk, joined from all segments */
    fullText: v.optional(v.string()),
    /** How the text is split into segments */
    segmentMode: v.optional(v.union(v.literal('paragraphs'), v.literal('sentences'))),
  })
    .index('by_user', ['userId']),

  talkVersions: defineTable({
    talkId: v.id('talks'),
    version: v.optional(v.number()),
    fullText: v.optional(v.string()),
    segmentMode: v.optional(v.union(v.literal('paragraphs'), v.literal('sentences'))),
    segments: v.array(segmentValidator),
  }).index('by_talk', ['talkId']),

  talkSets: defineTable({
    userId: v.string(),
    title: v.string(),
    talkIds: v.array(v.id('talks')),
  }).index('by_user', ['userId']),

  pronunciations: defineTable({
    userId: v.string(),
    word: v.string(),
    pronunciation: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_user_word', ['userId', 'word']),

  acronymRules: defineTable({
    userId: v.string(),
    acronym: v.string(),
    /** 'letters' = spell out (default), 'word' = pronounce as a word */
    speakAs: v.union(v.literal('letters'), v.literal('word')),
    /** Custom pronunciation when speakAs is 'word' */
    pronunciation: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_acronym', ['userId', 'acronym']),
});
