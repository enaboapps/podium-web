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
}

export async function fetchTTSBlob(text: string, config: TTSConfig): Promise<Blob> {
  const res = await fetch('/api/tts/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, config }),
  });
  if (!res.ok) throw new Error(`TTS error: ${res.status}`);
  return res.blob();
}

export async function fetchVoices(config: TTSConfig): Promise<TTSVoice[]> {
  const res = await fetch('/api/tts/voices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw new Error(`Voices error: ${res.status}`);
  return res.json();
}
