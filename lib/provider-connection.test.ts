import { afterEach, describe, expect, it, vi } from "vitest";
import { checkConnection } from "./provider-connection";
const el = { provider: "elevenlabs" as const, apiKey: "  synthetic-secret  " };
const az = {
  provider: "azure" as const,
  subscriptionKey: " synthetic-azure ",
  region: " eastus ",
};
function response(status: number, body: unknown) {
  return vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("voice access checks", () => {
  it("checks ElevenLabs voice access without synthesis or models permissions", async () => {
    const fetch = response(200, {
      voices: [
        {
          voice_id: "one",
          name: "Voice",
          labels: { gender: "female", language: "en" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetch);
    const result = await checkConnection(el);
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/voices",
      expect.objectContaining({
        headers: { "xi-api-key": "synthetic-secret" },
      }),
    );
  });
  it("normalizes Azure voices and trims region and key", async () => {
    const fetch = response(200, [
      {
        ShortName: "en-US-Test",
        DisplayName: "Test",
        Locale: "en-US",
        LocaleName: "English (United States)",
        Gender: "Male",
      },
    ]);
    vi.stubGlobal("fetch", fetch);
    expect(await checkConnection(az)).toMatchObject({
      ok: true,
      voices: [{ id: "en-US-Test", gender: "Male" }],
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://eastus.tts.speech.microsoft.com/cognitiveservices/voices/list",
      expect.objectContaining({
        headers: { "Ocp-Apim-Subscription-Key": "synthetic-azure" },
      }),
    );
  });
  it.each([
    [400, "api_key_id_used_as_api_key", "invalid_credentials", "API key ID"],
    [
      400,
      "invalid_api_key_length",
      "invalid_credentials",
      "complete secret key",
    ],
    [401, "invalid_api_key", "invalid_credentials", "rejected"],
    [401, "missing_permissions", "missing_permissions", "permissions"],
    [403, "", "missing_permissions", "permissions"],
    [429, "", "rate_limited", "Wait"],
    [503, "", "unavailable", "temporarily"],
  ])(
    "maps status %s / %s to safe feedback",
    async (status, code, expected, message) => {
      vi.stubGlobal(
        "fetch",
        response(status, {
          detail: { status: code, message: "SECRET MUST NOT ESCAPE" },
        }),
      );
      const result = await checkConnection(el);
      expect(result).toMatchObject({
        ok: false,
        code: expected,
        message: expect.stringContaining(message),
      });
      expect(JSON.stringify(result)).not.toContain("SECRET");
    },
  );
  it("explains Azure key and region mismatch", async () => {
    vi.stubGlobal("fetch", response(401, {}));
    expect(await checkConnection(az)).toMatchObject({
      code: "invalid_credentials",
      message: expect.stringContaining("same resource"),
    });
  });
  it("rejects an endpoint URL as a region without transmitting credentials", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      await checkConnection({ ...az, region: "https://other.example" }),
    ).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts a successful empty voice list", async () => {
    vi.stubGlobal("fetch", response(200, { voices: [] }));
    expect(await checkConnection(el)).toEqual({ ok: true, voices: [] });
  });
  it("rejects malformed success responses", async () => {
    vi.stubGlobal("fetch", response(200, {}));
    expect(await checkConnection(el)).toMatchObject({ code: "unavailable" });
  });
  it("reports network errors without raw errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret")));
    expect(await checkConnection(el)).toMatchObject({ code: "network" });
  });
  it("times out and releases the request", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      ),
    );
    const result = checkConnection(el);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toMatchObject({ code: "timeout" });
  });
  it("ignores a response received after cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", response(200, { voices: [] }));
    const result = checkConnection(el, controller.signal);
    controller.abort();
    expect(await result).toMatchObject({ code: "cancelled" });
  });
});
