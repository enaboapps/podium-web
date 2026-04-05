import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const get = query({
  args: { id: v.id('talks') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('talks')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { userId, title }) => {
    return await ctx.db.insert('talks', {
      userId,
      title,
      segments: [],
    });
  },
});

export const createWithSegments = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    segments: v.array(v.object({ id: v.string(), text: v.string() })),
    fullText: v.optional(v.string()),
    segmentMode: v.optional(v.union(v.literal('paragraphs'), v.literal('sentences'))),
  },
  handler: async (ctx, { userId, title, segments, fullText, segmentMode }) => {
    return await ctx.db.insert('talks', { userId, title, segments, fullText, segmentMode });
  },
});

export const saveEditedText = mutation({
  args: {
    id: v.id('talks'),
    userId: v.string(),
    fullText: v.string(),
    segments: v.array(v.object({ id: v.string(), text: v.string() })),
    segmentMode: v.union(v.literal('paragraphs'), v.literal('sentences')),
  },
  handler: async (ctx, { id, userId, fullText, segments, segmentMode }) => {
    const talk = await ctx.db.get(id);
    if (!talk || talk.userId !== userId) throw new Error('Not found');

    // Save current state as a version
    await ctx.db.insert('talkVersions', {
      talkId: id,
      fullText: talk.fullText,
      segmentMode: talk.segmentMode,
      segments: talk.segments,
    });

    // Update talk with new text, segments, and mode
    await ctx.db.patch(id, { fullText, segments, segmentMode });
  },
});

export const restoreVersion = mutation({
  args: {
    talkId: v.id('talks'),
    versionId: v.id('talkVersions'),
    userId: v.string(),
  },
  handler: async (ctx, { talkId, versionId, userId }) => {
    const talk = await ctx.db.get(talkId);
    if (!talk || talk.userId !== userId) throw new Error('Not found');

    const version = await ctx.db.get(versionId);
    if (!version || version.talkId !== talkId) throw new Error('Version not found');

    // Snapshot current state as a new version before restoring
    await ctx.db.insert('talkVersions', {
      talkId,
      fullText: talk.fullText,
      segmentMode: talk.segmentMode,
      segments: talk.segments,
    });

    await ctx.db.patch(talkId, {
      fullText: version.fullText,
      segmentMode: version.segmentMode,
      segments: version.segments,
    });
  },
});

export const getVersions = query({
  args: { talkId: v.id('talks') },
  handler: async (ctx, { talkId }) => {
    return await ctx.db
      .query('talkVersions')
      .withIndex('by_talk', (q) => q.eq('talkId', talkId))
      .order('desc')
      .collect();
  },
});

export const saveSegmentElements = mutation({
  args: {
    id: v.id('talks'),
    userId: v.string(),
    segmentId: v.string(),
    elements: v.array(v.union(
      v.object({ type: v.literal('word'), text: v.string() }),
      v.object({ type: v.literal('emphasis-open') }),
      v.object({ type: v.literal('emphasis-close') }),
      v.object({ type: v.literal('prosody-open'), rate: v.number() }),
      v.object({ type: v.literal('prosody-close') }),
      v.object({ type: v.literal('break'), ms: v.number() }),
    )),
  },
  handler: async (ctx, { id, userId, segmentId, elements }) => {
    const talk = await ctx.db.get(id);
    if (!talk || talk.userId !== userId) throw new Error('Not found');
    const segments = talk.segments.map((s) =>
      s.id === segmentId ? { ...s, elements } : s
    );
    await ctx.db.patch(id, { segments });
  },
});

export const remove = mutation({
  args: { id: v.id('talks'), userId: v.string() },
  handler: async (ctx, { id, userId }) => {
    const talk = await ctx.db.get(id);
    if (!talk || talk.userId !== userId) throw new Error('Not found');
    await ctx.db.delete(id);
  },
});

export const rename = mutation({
  args: { id: v.id('talks'), userId: v.string(), title: v.string() },
  handler: async (ctx, { id, userId, title }) => {
    const talk = await ctx.db.get(id);
    if (!talk || talk.userId !== userId) throw new Error('Not found');
    await ctx.db.patch(id, { title });
  },
});
