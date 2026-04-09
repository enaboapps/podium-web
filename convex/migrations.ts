import { internalMutation } from './_generated/server';

/**
 * One-time migration: move legacy `voiceId` to `elevenLabsVoiceId` or `azureVoiceId`
 * based on the user's `provider` field, then clear `voiceId`.
 *
 * Run via: npx convex run migrations:migrateVoiceIds
 */
export const migrateVoiceIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    let migrated = 0;

    for (const user of users) {
      const legacy = (user as Record<string, unknown>).voiceId as string | undefined;
      if (!legacy) continue;

      const provider = user.provider ?? 'elevenlabs';
      const field = provider === 'azure' ? 'azureVoiceId' : 'elevenLabsVoiceId';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.db.patch as any)(user._id, {
        [field]: (user as any)[field] ?? legacy,
        voiceId: undefined,
      });

      migrated++;
    }

    return { migrated };
  },
});
