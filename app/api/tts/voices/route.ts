import { NextRequest, NextResponse } from 'next/server';
import type { TTSConfig, TTSVoice } from '@/lib/tts';

export async function POST(req: NextRequest) {
  const { config }: { config: TTSConfig } = await req.json();

  if (config.provider === 'elevenlabs') {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': config.apiKey },
    });
    if (!res.ok) return NextResponse.json({ error: `ElevenLabs voices error: ${res.status}` }, { status: res.status });
    const data = await res.json();
    const voices: TTSVoice[] = (data.voices as Array<{ voice_id: string; name: string; preview_url?: string }>)
      .map((v) => ({ id: v.voice_id, name: v.name, previewUrl: v.preview_url }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(voices);
  }

  // Azure
  const res = await fetch(
    `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    { headers: { 'Ocp-Apim-Subscription-Key': config.subscriptionKey } }
  );
  if (!res.ok) return NextResponse.json({ error: `Azure voices error: ${res.status}` }, { status: res.status });
  const data = await res.json();
  const voices: TTSVoice[] = (data as Array<{ ShortName: string; DisplayName: string; LocalName: string }>)
    .map((v) => ({ id: v.ShortName, name: `${v.DisplayName} (${v.LocalName})` }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json(voices);
}
