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
  },
  handler: async (ctx, { userId, title, segments, fullText }) => {
    return await ctx.db.insert('talks', { userId, title, segments, fullText });
  },
});

export const saveEditedText = mutation({
  args: {
    id: v.id('talks'),
    userId: v.string(),
    fullText: v.string(),
    segments: v.array(v.object({ id: v.string(), text: v.string() })),
  },
  handler: async (ctx, { id, userId, fullText, segments }) => {
    const talk = await ctx.db.get(id);
    if (!talk || talk.userId !== userId) throw new Error('Not found');

    // Save current state as a version
    const existingVersions = await ctx.db
      .query('talkVersions')
      .withIndex('by_talk', (q) => q.eq('talkId', id))
      .collect();

    await ctx.db.insert('talkVersions', {
      talkId: id,
      version: existingVersions.length + 1,
      fullText: talk.fullText,
      segments: talk.segments,
    });

    // Update talk with new text and segments
    await ctx.db.patch(id, { fullText, segments });
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
