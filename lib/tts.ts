export const DEFAULT_VOICE_ID = 'bIHbv24MWmeRgasZH58o'; // Will
const MODEL_ID = 'eleven_v3';

export async function fetchTTSBlob(
  text: string,
  apiKey: string,
  voiceId: string = DEFAULT_VOICE_ID,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal,
    }
  );
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  return res.blob();
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url: string;
}

export async function fetchVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Failed to fetch voices: ${res.status}`);
  const data = await res.json();
  return data.voices as ElevenLabsVoice[];
}
