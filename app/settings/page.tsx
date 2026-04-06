'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchVoices, ElevenLabsVoice, DEFAULT_VOICE_ID } from '@/lib/tts';

const MASKED = '••••••••••••••••';

export default function SettingsPage() {
  const { clerkId } = useCurrentUser();
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');
  const saveApiKey = useMutation(api.users.saveApiKey);
  const clearApiKey = useMutation(api.users.clearApiKey);
  const saveVoiceId = useMutation(api.users.saveVoiceId);

  const [keyInput, setKeyInput] = useState('');
  const [masked, setMasked] = useState(false);
  const [saved, setSaved] = useState(false);

  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (settings?.elevenLabsApiKey) {
      setKeyInput('');
      setMasked(true);
    } else {
      setMasked(false);
    }
  }, [settings?.elevenLabsApiKey]);

  useEffect(() => {
    if (!settings?.elevenLabsApiKey) return;
    setVoicesLoading(true);
    setVoicesError(false);
    fetchVoices(settings.elevenLabsApiKey)
      .then((v) => setVoices(v.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setVoicesError(true))
      .finally(() => setVoicesLoading(false));
  }, [settings?.elevenLabsApiKey]);

  function handlePreview(voice: ElevenLabsVoice) {
    previewAudio?.pause();
    const audio = new Audio(voice.preview_url);
    setPreviewAudio(audio);
    audio.onended = () => setPreviewAudio(null);
    audio.play();
  }

  async function handleSelectVoice(voiceId: string) {
    if (!clerkId) return;
    await saveVoiceId({ clerkId, voiceId });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkId || !keyInput.trim()) return;
    await saveApiKey({ clerkId, elevenLabsApiKey: keyInput.trim() });
    setKeyInput('');
    setMasked(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    if (!clerkId) return;
    await clearApiKey({ clerkId });
    setKeyInput('');
    setMasked(false);
  }

  function handleFocus() {
    if (masked) {
      setMasked(false);
      setKeyInput('');
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center gap-3 px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <a href="/library" className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm">
          ← Library
        </a>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <main className="flex-1 px-5 py-6 space-y-8 max-w-lg">
        <section>
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            ElevenLabs
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Enter your ElevenLabs API key to enable text-to-speech. Your key is stored securely and never shared.
          </p>
          <form onSubmit={handleSave} className="space-y-3">
            <input
              type={masked ? 'text' : 'password'}
              value={masked ? MASKED : keyInput}
              onChange={(e) => { if (!masked) setKeyInput(e.target.value); }}
              onFocus={handleFocus}
              placeholder="sk_..."
              className="w-full bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)] font-mono"
            />
            {masked && (
              <p className="text-xs text-[var(--muted)]">Key saved. Tap the field to replace it.</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={masked || !keyInput.trim()}
                className="flex-1 bg-[var(--primary)] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
              >
                {saved ? 'Saved!' : 'Save key'}
              </button>
              {settings?.elevenLabsApiKey && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-3 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </form>
        </section>

        {settings?.elevenLabsApiKey && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
              Voice
            </h2>
            {voicesLoading && (
              <p className="text-sm text-[var(--muted)]">Loading voices…</p>
            )}
            {voicesError && (
              <p className="text-sm text-red-400">Failed to load voices.</p>
            )}
            {!voicesLoading && !voicesError && voices.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={settings.voiceId ?? DEFAULT_VOICE_ID}
                  onChange={(e) => handleSelectVoice(e.target.value)}
                  className="flex-1 bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] outline-none border border-[var(--border)] focus:border-[var(--primary)]"
                >
                  {voices.map((voice) => (
                    <option key={voice.voice_id} value={voice.voice_id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const voice = voices.find((v) => v.voice_id === (settings.voiceId ?? DEFAULT_VOICE_ID));
                    if (voice) handlePreview(voice);
                  }}
                  className="px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  ▶
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
