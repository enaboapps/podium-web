import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const sync = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { clerkId, name, email }) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (existing) {
      if (existing.name !== name || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, email });
      }
      return existing._id;
    }

    return await ctx.db.insert('users', { clerkId, name, email });
  },
});

export const getSettings = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
  },
});

export const saveApiKey = mutation({
  args: { clerkId: v.string(), elevenLabsApiKey: v.string() },
  handler: async (ctx, { clerkId, elevenLabsApiKey }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (!user) throw new Error('User not found');
    await ctx.db.patch(user._id, { elevenLabsApiKey });
  },
});

export const clearApiKey = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (!user) throw new Error('User not found');
    await ctx.db.patch(user._id, { elevenLabsApiKey: undefined });
  },
});
