import { AzureTTSClient, ElevenLabsTTSClient } from 'js-tts-wrapper/browser';

export const DEFAULT_VOICE_ID = 'bIHbv24MWmeRgasZH58o'; // Will (ElevenLabs)
// GuyNeural is one of three voices that support <emphasis> in Azure Neural TTS
export const DEFAULT_AZURE_VOICE = 'en-US-GuyNeural';

export type TTSConfig =
  | { provider: 'elevenlabs'; apiKey: string; voiceId?: string }
  | { provider: 'azure'; subscriptionKey: string; region: string; voiceId?: string };

export interface TTSVoice {
  id: string;
  name: string;
  previewUrl?: string;
  gender?: 'Male' | 'Female' | 'Unknown';
  languageCodes: { bcp47: string; iso639_3: string; display: string }[];
}

function createClient(config: TTSConfig) {
  if (config.provider === 'azure') {
    const client = new AzureTTSClient({ subscriptionKey: config.subscriptionKey, region: config.region });
    if (config.voiceId) client.setVoice(config.voiceId);
    return client;
  }
  const client = new ElevenLabsTTSClient({ apiKey: config.apiKey });
  if (config.voiceId) client.setVoice(config.voiceId);
  return client;
}

export async function fetchTTSBlob(text: string, config: TTSConfig): Promise<Blob> {
  const client = createClient(config);
  const bytes = await client.synthToBytes(text);
  return new Blob([bytes.buffer as ArrayBuffer]);
}

export async function fetchVoices(config: TTSConfig): Promise<TTSVoice[]> {
  const client = createClient(config);
  const voices = await client.getVoices();
  return voices
    .map((v) => ({
      id: v.id,
      name: v.name,
      gender: v.gender,
      languageCodes: v.languageCodes ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
