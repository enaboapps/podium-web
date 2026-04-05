import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

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
