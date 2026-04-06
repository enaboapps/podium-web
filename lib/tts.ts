const VOICE_ID = 'bIHbv24MWmeRgasZH58o';
const MODEL_ID = 'eleven_v3';

export async function fetchTTSBlob(
  text: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
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
