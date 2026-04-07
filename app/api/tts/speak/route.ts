import { NextRequest, NextResponse } from 'next/server';
import type { TTSConfig } from '@/lib/tts';

export async function POST(req: NextRequest) {
  const { text, config }: { text: string; config: TTSConfig } = await req.json();

  if (config.provider === 'elevenlabs') {
    const voiceId = config.voiceId ?? 'bIHbv24MWmeRgasZH58o';
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: 'eleven_v3' }),
    });
    if (!res.ok) return NextResponse.json({ error: `ElevenLabs error: ${res.status}` }, { status: res.status });
    const blob = await res.blob();
    return new NextResponse(blob, { headers: { 'Content-Type': 'audio/mpeg' } });
  }

  // Azure — text is <speak>...</speak> from buildSSML; wrap with voice element
  const voiceName = config.voiceId ?? 'en-US-AriaNeural';
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
  if (!res.ok) return NextResponse.json({ error: `Azure TTS error: ${res.status}` }, { status: res.status });
  const blob = await res.blob();
  return new NextResponse(blob, { headers: { 'Content-Type': 'audio/mpeg' } });
}
