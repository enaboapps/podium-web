import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const get = query({
  args: { id: v.id('talkSets') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('talkSets')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});

export const create = mutation({
  args: { userId: v.string(), title: v.string() },
  handler: async (ctx, { userId, title }) => {
    return await ctx.db.insert('talkSets', { userId, title, talkIds: [] });
  },
});

export const remove = mutation({
  args: { id: v.id('talkSets'), userId: v.string() },
  handler: async (ctx, { id, userId }) => {
    const set = await ctx.db.get(id);
    if (!set || set.userId !== userId) throw new Error('Not found');
    await ctx.db.delete(id);
  },
});

export const addTalk = mutation({
  args: { id: v.id('talkSets'), userId: v.string(), talkId: v.id('talks') },
  handler: async (ctx, { id, userId, talkId }) => {
    const set = await ctx.db.get(id);
    if (!set || set.userId !== userId) throw new Error('Not found');
    if (set.talkIds.includes(talkId)) return;
    await ctx.db.patch(id, { talkIds: [...set.talkIds, talkId] });
  },
});

export const removeTalk = mutation({
  args: { id: v.id('talkSets'), userId: v.string(), talkId: v.id('talks') },
  handler: async (ctx, { id, userId, talkId }) => {
    const set = await ctx.db.get(id);
    if (!set || set.userId !== userId) throw new Error('Not found');
    await ctx.db.patch(id, { talkIds: set.talkIds.filter((t) => t !== talkId) });
  },
});
