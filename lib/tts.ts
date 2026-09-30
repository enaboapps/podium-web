import { checkConnection } from "./provider-connection";
import { normaliseSpeechBlob } from "./loudness";
import { AzureTTSClient } from "js-tts-wrapper/browser";
import {
  DEFAULT_ELEVENLABS_MODEL,
  type DeliverySegment,
  getAzureTarget,
  getElevenLabsTarget,
  renderSegment,
  type SpeechTarget,
} from "./delivery";

export const DEFAULT_VOICE_ID = "bIHbv24MWmeRgasZH58o"; // Will (ElevenLabs)
// GuyNeural is one of three voices that support <emphasis> in Azure Neural TTS
export const DEFAULT_AZURE_VOICE = "en-US-GuyNeural";

export type TTSConfig =
  | { provider: "elevenlabs"; apiKey: string; voiceId?: string; modelId?: string }
  | {
      provider: "azure";
      subscriptionKey: string;
      region: string;
      voiceId?: string;
    };

export interface TTSSettings {
  provider?: "elevenlabs" | "azure";
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModelId?: string;
  azureSubscriptionKey?: string;
  azureRegion?: string;
  azureVoiceId?: string;
}

export interface TTSVoice {
  id: string;
  name: string;
  previewUrl?: string;
  gender?: "Male" | "Female" | "Unknown";
  languageCodes: { bcp47: string; iso639_3: string; display: string }[];
  provider: string;
}

/** Build the active provider's TTS config from user settings, or null if it isn't connected. */
export function getTTSConfig(settings: TTSSettings | null | undefined): TTSConfig | null {
  if (!settings) return null;
  if (settings.provider === "azure") {
    return settings.azureSubscriptionKey && settings.azureRegion
      ? {
          provider: "azure",
          subscriptionKey: settings.azureSubscriptionKey,
          region: settings.azureRegion,
          voiceId: settings.azureVoiceId,
        }
      : null;
  }
  return settings.elevenLabsApiKey
    ? {
        provider: "elevenlabs",
        apiKey: settings.elevenLabsApiKey,
        voiceId: settings.elevenLabsVoiceId,
        modelId: settings.elevenLabsModelId,
      }
    : null;
}

/** Identifies the voice (and model) audio was generated with, for cache invalidation. */
export function getVoiceKey(settings: TTSSettings) {
  if (settings.provider === "azure") return `azure:${settings.azureVoiceId ?? "default"}`;
  return `elevenlabs:${settings.elevenLabsVoiceId ?? "default"}:${settings.elevenLabsModelId ?? DEFAULT_ELEVENLABS_MODEL}`;
}

export function getSpeechTarget(config: TTSConfig): SpeechTarget {
  return config.provider === "azure"
    ? getAzureTarget(config.voiceId ?? DEFAULT_AZURE_VOICE)
    : getElevenLabsTarget(config.modelId ?? DEFAULT_ELEVENLABS_MODEL);
}

async function fetchAzureBlob(
  input: string,
  config: Extract<TTSConfig, { provider: "azure" }>,
  rawSSML = false,
): Promise<Blob> {
  const client = new AzureTTSClient({
    subscriptionKey: config.subscriptionKey,
    region: config.region,
  });
  client.setVoice(config.voiceId ?? DEFAULT_AZURE_VOICE);
  const bytes = await client.synthToBytes(input, { rawSSML });
  return new Blob([bytes.buffer as ArrayBuffer]);
}

/**
 * Call ElevenLabs directly: js-tts-wrapper strips <break> tags and non-v3 audio
 * tags, and doesn't let us choose the model per request.
 */
async function fetchElevenLabsBlob(
  text: string,
  config: Extract<TTSConfig, { provider: "elevenlabs" }>,
  speed = 1,
): Promise<Blob> {
  const voiceId = config.voiceId ?? DEFAULT_VOICE_ID;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": config.apiKey },
      body: JSON.stringify({
        text,
        model_id: config.modelId ?? DEFAULT_ELEVENLABS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          use_speaker_boost: true,
          style: 0,
          speed,
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs synthesis failed: ${response.status} ${await response.text()}`);
  }
  return response.blob();
}

export async function fetchTTSBlob(
  text: string,
  config: TTSConfig,
): Promise<Blob> {
  const blob = config.provider === "azure"
    ? await fetchAzureBlob(text, config)
    : await fetchElevenLabsBlob(text, config);
  return normaliseSpeechBlob(blob);
}

/** Synthesize a talk segment with its mood, pace and word presets applied. */
export async function fetchSegmentBlob(
  segment: DeliverySegment,
  config: TTSConfig,
): Promise<Blob> {
  const { input, speed } = renderSegment(segment, getSpeechTarget(config));
  const blob = config.provider === "azure"
    ? await fetchAzureBlob(input, config, true)
    : await fetchElevenLabsBlob(input, config, speed);
  return normaliseSpeechBlob(blob);
}

export async function fetchVoices(config: TTSConfig): Promise<TTSVoice[]> {
  const result = await checkConnection(config);
  if (!result.ok) throw new Error(result.message);
  return result.voices;
}
