import type { TTSConfig, TTSVoice } from "./tts";

export type ConnectionErrorCode =
  | "provider_rejected"
  | "invalid_credentials"
  | "missing_permissions"
  | "rate_limited"
  | "unavailable"
  | "network"
  | "timeout"
  | "cancelled";
const providerCodes = [
  "invalid_api_key",
  "invalid_api_key_length",
  "api_key_id_used_as_api_key",
  "missing_permissions",
] as const;
export type ProviderErrorCode = (typeof providerCodes)[number];

export type ConnectionResult =
  | { ok: true; voices: TTSVoice[] }
  | {
      ok: false;
      code: ConnectionErrorCode;
      message: string;
      httpStatus?: number;
      providerCode?: ProviderErrorCode;
    };
type Failure = Extract<ConnectionResult, { ok: false }>;
const failure = (code: ConnectionErrorCode, message: string): Failure => ({
  ok: false,
  code,
  message,
});
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown) => (typeof value === "string" ? value : "");

function providerError(status: number, body: unknown, azure: boolean): Failure {
  const detail = record(record(body).detail);
  // Only recognized constants may escape the provider response. A code or message
  // can contain credential material, so never echo arbitrary provider strings.
  const providerCode = providerCodes.find(
    (known) => detail.code === known || detail.status === known,
  );
  const reject = (code: ConnectionErrorCode, message: string): Failure => ({
    ...failure(code, message),
    httpStatus: status,
    ...(providerCode ? { providerCode } : {}),
  });
  if (providerCode === "api_key_id_used_as_api_key")
    return reject(
      "invalid_credentials",
      "This is an API key ID. Copy the full secret key shown when you create a key in ElevenLabs. Do not add a prefix yourself.",
    );
  if (status === 429)
    return reject(
      "rate_limited",
      "Too many requests. Wait a moment, then check the connection again.",
    );
  if (status >= 500)
    return reject(
      "unavailable",
      "The provider is temporarily unavailable. Try again later.",
    );
  if (providerCode === "missing_permissions")
    return reject(
      "missing_permissions",
      "This key cannot list voices. Enable voice access in the provider’s key permissions, then try again.",
    );
  if (!azure && providerCode === "invalid_api_key_length")
    return reject(
      "invalid_credentials",
      "ElevenLabs reports an incorrect key length. Copy the complete secret key without adding or removing a prefix.",
    );
  if (!azure && providerCode === "invalid_api_key")
    return reject(
      "invalid_credentials",
      "ElevenLabs did not recognize the submitted key. Copy the complete secret key again and check that it is still active.",
    );
  if (azure && [400, 401, 403].includes(status))
    return reject(
      "invalid_credentials",
      "Azure could not verify these credentials. Check that the Speech resource key and region belong to the same resource.",
    );
  if (status >= 400 && status < 500)
    return reject(
      "provider_rejected",
      `The provider rejected the voice-list request (HTTP ${status}). This response does not confirm that the key is invalid. Retry, or contact the provider if it continues.`,
    );
  return reject(
    "unavailable",
    "The provider could not load voices. Please try again.",
  );
}

function normalizeVoice(raw: unknown, azure: boolean): TTSVoice {
  const v = record(raw);
  const labels = record(v.labels);
  const gender = str(azure ? v.Gender : labels.gender).toLowerCase();
  const language = str(azure ? v.Locale : labels.language);
  let display = str(v.LocaleName) || language;
  if (!azure && language) {
    try {
      display =
        new Intl.DisplayNames(["en"], { type: "language" }).of(language) ||
        language;
    } catch {
      /* Keep provider label. */
    }
  }
  return {
    id: str(azure ? v.ShortName : v.voice_id),
    name: str(azure ? v.DisplayName : v.name),
    gender:
      gender === "male" ? "Male" : gender === "female" ? "Female" : "Unknown",
    previewUrl: azure ? undefined : str(v.preview_url) || undefined,
    provider: azure ? "azure" : "elevenlabs",
    languageCodes: language
      ? [{ bcp47: language, iso639_3: language.split("-")[0], display }]
      : [],
  };
}

/** Only lists voices: never synthesizes speech or tests quota. No raw provider errors escape. */
export async function checkConnection(
  config: TTSConfig,
  signal?: AbortSignal,
): Promise<ConnectionResult> {
  const azure = config.provider === "azure";
  const key = (azure ? config.subscriptionKey : config.apiKey).trim();
  if (!key)
    return failure("invalid_credentials", "Enter your provider’s secret key.");
  // A region must be a region identifier, never a URL or arbitrary hostname.
  if (azure && !/^[a-z0-9-]+$/.test(config.region.trim()))
    return failure(
      "invalid_credentials",
      "Enter your Azure region identifier, for example eastus, rather than an endpoint URL.",
    );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const response = await fetch(
      azure
        ? `https://${config.region.trim()}.tts.speech.microsoft.com/cognitiveservices/voices/list`
        : "https://api.elevenlabs.io/v1/voices",
      {
        headers: azure
          ? { "Ocp-Apim-Subscription-Key": key }
          : { "xi-api-key": key },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const body: unknown = await response.json().catch(() => null);
    if (signal?.aborted)
      return failure("cancelled", "Connection check cancelled.");
    if (timedOut)
      return failure(
        "timeout",
        "The connection check timed out. Check your connection and try again.",
      );
    if (!response.ok) return providerError(response.status, body, azure);
    const rows = azure ? body : record(body).voices;
    if (!Array.isArray(rows))
      return failure(
        "unavailable",
        "The provider returned an unexpected voice list. Try again later.",
      );
    const voices = rows.map((v) => normalizeVoice(v, azure));
    if (voices.some((v) => !v.id || !v.name))
      return failure(
        "unavailable",
        "The provider returned an unexpected voice list. Try again later.",
      );
    return {
      ok: true,
      voices: voices.sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch {
    if (signal?.aborted)
      return failure("cancelled", "Connection check cancelled.");
    if (timedOut)
      return failure(
        "timeout",
        "The connection check timed out. Check your connection and try again.",
      );
    return failure(
      "network",
      "Could not reach the provider. Check your internet connection and, for Azure, the region. Try again.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
