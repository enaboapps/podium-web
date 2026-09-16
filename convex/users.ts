import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const sync = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { clerkId, name, email }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      if (existing.name !== name || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, email });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", { clerkId, name, email });
  },
});

export const getSettings = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});

export const saveApiKey = mutation({
  args: { clerkId: v.string(), elevenLabsApiKey: v.string() },
  handler: async (ctx, { clerkId, elevenLabsApiKey }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { elevenLabsApiKey });
  },
});

export const saveProvider = mutation({
  args: {
    clerkId: v.string(),
    provider: v.union(v.literal("elevenlabs"), v.literal("azure")),
  },
  handler: async (ctx, { clerkId, provider }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { provider });
  },
});

export const saveAzureCredentials = mutation({
  args: {
    clerkId: v.string(),
    azureSubscriptionKey: v.string(),
    azureRegion: v.string(),
  },
  handler: async (ctx, { clerkId, azureSubscriptionKey, azureRegion }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { azureSubscriptionKey, azureRegion });
  },
});

export const clearAzureCredentials = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      azureSubscriptionKey: undefined,
      azureRegion: undefined,
    });
  },
});

export const saveVoiceId = mutation({
  args: {
    clerkId: v.string(),
    voiceId: v.string(),
    provider: v.union(v.literal("elevenlabs"), v.literal("azure")),
  },
  handler: async (ctx, { clerkId, voiceId, provider }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    const field = provider === "azure" ? "azureVoiceId" : "elevenLabsVoiceId";
    await ctx.db.patch(user._id, { [field]: voiceId });
  },
});

export const clearApiKey = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { elevenLabsApiKey: undefined });
  },
});

// Save credentials and activate together: a failed switch must preserve the old setup.
export const connectProvider = mutation({
  args: {
    config: v.union(
      v.object({ provider: v.literal("elevenlabs"), apiKey: v.string() }),
      v.object({
        provider: v.literal("azure"),
        subscriptionKey: v.string(),
        region: v.string(),
      }),
    ),
  },
  handler: async (ctx, { config }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to connect a voice service");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    if (config.provider === "azure") {
      if (
        !config.subscriptionKey.trim() ||
        !/^[a-z0-9-]+$/.test(config.region.trim())
      )
        throw new Error("Invalid credentials");
      await ctx.db.patch(user._id, {
        provider: "azure",
        azureSubscriptionKey: config.subscriptionKey.trim(),
        azureRegion: config.region.trim(),
      });
    } else {
      if (!config.apiKey.trim()) throw new Error("Invalid credentials");
      await ctx.db.patch(user._id, {
        provider: "elevenlabs",
        elevenLabsApiKey: config.apiKey.trim(),
      });
    }
  },
});
