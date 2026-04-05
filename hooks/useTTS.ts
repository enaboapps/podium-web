'use client';

import { useState, useRef } from 'react';

export type TTSState = 'idle' | 'loading' | 'playing';

export function useTTS(apiKey: string | undefined) {
  const [state, setState] = useState<TTSState>('idle');
  const [activeId, setActiveId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  async function speak(text: string, id: string) {
    if (!apiKey) return;

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If tapping the same segment while playing, stop it
    if (activeId === id && state === 'playing') {
      setState('idle');
      setActiveId(null);
      return;
    }

    setState('loading');
    setActiveId(id);

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!response.ok) throw new Error('TTS failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setState('idle');
        setActiveId(null);
        URL.revokeObjectURL(url);
        urlRef.current = null;
      };

      audio.onerror = () => {
        setState('idle');
        setActiveId(null);
        URL.revokeObjectURL(url);
        urlRef.current = null;
      };

      setState('playing');
      await audio.play();
    } catch {
      setState('idle');
      setActiveId(null);
    }
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setState('idle');
    setActiveId(null);
  }

  return { speak, stop, state, activeId };
}
