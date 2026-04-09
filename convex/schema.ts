import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

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
    azureVoiceId: v.optional(v.string()),
  }).index('by_clerk_id', ['clerkId']),

  talks: defineTable({
    userId: v.string(),
    title: v.string(),
    /** Ordered segments of the script */
    segments: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        /** 0.5–2.0, default 1.0 */
        tempo: v.optional(v.number()),
        /** Whether this segment has emphasis */
        emphasis: v.optional(v.boolean()),
        /** Word-level SSML brick sequence; if present, used instead of text for TTS */
        elements: v.optional(v.array(elementUnion)),
      })
    ),
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
    segments: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        tempo: v.optional(v.number()),
        emphasis: v.optional(v.boolean()),
        elements: v.optional(v.array(elementUnion)),
      })
    ),
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
