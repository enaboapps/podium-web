export const DEFAULT_VOICE_ID = 'bIHbv24MWmeRgasZH58o'; // Will (ElevenLabs)
export const DEFAULT_AZURE_VOICE = 'en-US-AriaNeural';

export type TTSConfig =
  | { provider: 'elevenlabs'; apiKey: string; voiceId?: string }
  | { provider: 'azure'; subscriptionKey: string; region: string; voiceId?: string };

export interface TTSVoice {
  id: string;
  name: string;
  previewUrl?: string;
}

export async function fetchTTSBlob(text: string, config: TTSConfig): Promise<Blob> {
  if (config.provider === 'elevenlabs') {
    const voiceId = config.voiceId ?? DEFAULT_VOICE_ID;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: 'eleven_v3' }),
    });
    if (!res.ok) throw new Error(`ElevenLabs error: ${res.status}`);
    return res.blob();
  } else {
    const voiceName = config.voiceId ?? DEFAULT_AZURE_VOICE;
    // text is inner SSML from buildSSML: <speak>...</speak>
    // Unwrap and re-wrap with full Azure SSML envelope including voice
    const inner = text.startsWith('<speak>') && text.endsWith('</speak>')
      ? text.slice('<speak>'.length, -'</speak>'.length)
      : text;
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voiceName}">${inner}</voice></speak>`;
    const res = await fetch(
      `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
        },
        body: ssml,
      }
    );
    if (!res.ok) throw new Error(`Azure TTS error: ${res.status}`);
    return res.blob();
  }
}

export async function fetchVoices(config: TTSConfig): Promise<TTSVoice[]> {
  if (config.provider === 'elevenlabs') {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': config.apiKey },
    });
    if (!res.ok) throw new Error(`ElevenLabs voices error: ${res.status}`);
    const data = await res.json();
    return (data.voices as Array<{ voice_id: string; name: string; preview_url?: string }>)
      .map((v) => ({ id: v.voice_id, name: v.name, previewUrl: v.preview_url }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const res = await fetch(
      `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
      { headers: { 'Ocp-Apim-Subscription-Key': config.subscriptionKey } }
    );
    if (!res.ok) throw new Error(`Azure voices error: ${res.status}`);
    const data = await res.json();
    return (data as Array<{ ShortName: string; DisplayName: string; LocalName: string }>)
      .map((v) => ({ id: v.ShortName, name: `${v.DisplayName} (${v.LocalName})` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
