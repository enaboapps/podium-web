import { expect, it, vi } from "vitest";
import { connectProvider } from "../convex/users";
// Convex exposes the registered handler for unit testing without a deployment.
const handler = (
  connectProvider as unknown as {
    _handler: (ctx: unknown, args: unknown) => Promise<void>;
  }
)._handler;
function context() {
  const user = {
    _id: "user",
    clerkId: "owner",
    provider: "elevenlabs",
    elevenLabsApiKey: "previous",
    elevenLabsVoiceId: "el-voice",
    azureVoiceId: "az-voice",
  };
  const unique = vi.fn().mockResolvedValue(user);
  const patch = vi.fn().mockResolvedValue(undefined);
  return {
    user,
    patch,
    ctx: {
      auth: {
        getUserIdentity: vi
          .fn<() => Promise<{ subject: string } | null>>()
          .mockResolvedValue({ subject: "owner" }),
      },
      db: {
        query: vi
          .fn()
          .mockReturnValue({ withIndex: vi.fn().mockReturnValue({ unique }) }),
        patch,
      },
    },
  };
}
it("writes credentials and activation in one atomic patch without touching voices or the other key", async () => {
  const { ctx, patch } = context();
  await handler(ctx, {
    config: {
      provider: "azure",
      subscriptionKey: " new-key ",
      region: " eastus ",
    },
  });
  expect(patch).toHaveBeenCalledExactlyOnceWith("user", {
    provider: "azure",
    azureSubscriptionKey: "new-key",
    azureRegion: "eastus",
  });
});
it("propagates persistence failure rather than applying a separate activation", async () => {
  const { ctx, patch } = context();
  patch.mockRejectedValue(new Error("database failed"));
  await expect(
    handler(ctx, { config: { provider: "elevenlabs", apiKey: "new-key" } }),
  ).rejects.toThrow("database failed");
  expect(patch).toHaveBeenCalledTimes(1);
});
it("requires an authenticated owner", async () => {
  const { ctx, patch } = context();
  ctx.auth.getUserIdentity.mockResolvedValue(null);
  await expect(
    handler(ctx, { config: { provider: "elevenlabs", apiKey: "key" } }),
  ).rejects.toThrow("Sign in");
  expect(patch).not.toHaveBeenCalled();
});
