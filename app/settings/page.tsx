'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { fetchVoices, TTSConfig, TTSVoice, DEFAULT_VOICE_ID } from '@/lib/tts';

const MASKED = '••••••••••••••••';

export default function SettingsPage() {
  const { mode } = useOfflineBoot();

  if (mode === 'offline-emergency' || mode === 'offline-unavailable') {
    return (
      <OfflineUnavailable
        title="Settings unavailable offline"
        message="Settings require a live connection and are not part of Podium's offline emergency mode."
      />
    );
  }

  return <OnlineSettingsPage />;
}

function OnlineSettingsPage() {
  const { clerkId } = useOnlineCurrentUser();
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');
  const saveApiKey = useMutation(api.users.saveApiKey);
  const clearApiKey = useMutation(api.users.clearApiKey);
  const saveVoiceId = useMutation(api.users.saveVoiceId);
  const saveProvider = useMutation(api.users.saveProvider);
  const saveAzureCredentials = useMutation(api.users.saveAzureCredentials);
  const clearAzureCredentials = useMutation(api.users.clearAzureCredentials);

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure = provider === 'azure';

  // ElevenLabs key state
  const [elKeyInput, setElKeyInput] = useState('');
  const [elMasked, setElMasked] = useState(false);
  const [elSaved, setElSaved] = useState(false);

  // Azure credentials state
  const [azKeyInput, setAzKeyInput] = useState('');
  const [azKeyMasked, setAzKeyMasked] = useState(false);
  const [azRegionInput, setAzRegionInput] = useState('');
  const [azSaved, setAzSaved] = useState(false);

  // Voice state
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (settings?.elevenLabsApiKey) {
      setElKeyInput('');
      setElMasked(true);
    } else {
      setElMasked(false);
    }
  }, [settings?.elevenLabsApiKey]);

  useEffect(() => {
    if (settings?.azureSubscriptionKey) {
      setAzKeyInput('');
      setAzKeyMasked(true);
    } else {
      setAzKeyMasked(false);
    }
    if (settings?.azureRegion) {
      setAzRegionInput(settings.azureRegion);
    }
  }, [settings?.azureSubscriptionKey, settings?.azureRegion]);

  const ttsConfig: TTSConfig | null = settings
    ? isAzure
      ? settings.azureSubscriptionKey && settings.azureRegion
        ? { provider: 'azure', subscriptionKey: settings.azureSubscriptionKey, region: settings.azureRegion, voiceId: settings.voiceId }
        : null
      : settings.elevenLabsApiKey
        ? { provider: 'elevenlabs', apiKey: settings.elevenLabsApiKey, voiceId: settings.voiceId }
        : null
    : null;

  useEffect(() => {
    if (!ttsConfig) { setVoices([]); return; }
    setVoicesLoading(true);
    setVoicesError(false);
    fetchVoices(ttsConfig)
      .then((v) => setVoices(v))
      .catch(() => setVoicesError(true))
      .finally(() => setVoicesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.elevenLabsApiKey, settings?.azureSubscriptionKey, settings?.azureRegion, provider]);

  function handlePreview(voice: TTSVoice) {
    if (!voice.previewUrl) return;
    previewAudio?.pause();
    const audio = new Audio(voice.previewUrl);
    setPreviewAudio(audio);
    audio.onended = () => setPreviewAudio(null);
    audio.play();
  }

  async function handleSelectVoice(voiceId: string) {
    if (!clerkId) return;
    await saveVoiceId({ clerkId, voiceId });
  }

  async function handleProviderChange(p: 'elevenlabs' | 'azure') {
    if (!clerkId) return;
    await saveProvider({ clerkId, provider: p });
  }

  async function handleElSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkId || !elKeyInput.trim()) return;
    await saveApiKey({ clerkId, elevenLabsApiKey: elKeyInput.trim() });
    setElKeyInput('');
    setElMasked(true);
    setElSaved(true);
    setTimeout(() => setElSaved(false), 2000);
  }

  async function handleElClear() {
    if (!clerkId) return;
    await clearApiKey({ clerkId });
    setElKeyInput('');
    setElMasked(false);
  }

  async function handleAzSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkId || !azRegionInput.trim()) return;
    const key = azKeyMasked ? undefined : azKeyInput.trim();
    if (!azKeyMasked && !key) return;
    if (key) {
      await saveAzureCredentials({ clerkId, azureSubscriptionKey: key, azureRegion: azRegionInput.trim() });
    } else {
      // Only region changed — patch region via saveAzureCredentials with existing key
      await saveAzureCredentials({ clerkId, azureSubscriptionKey: settings!.azureSubscriptionKey!, azureRegion: azRegionInput.trim() });
    }
    setAzKeyInput('');
    setAzKeyMasked(true);
    setAzSaved(true);
    setTimeout(() => setAzSaved(false), 2000);
  }

  async function handleAzClear() {
    if (!clerkId) return;
    await clearAzureCredentials({ clerkId });
    setAzKeyInput('');
    setAzKeyMasked(false);
    setAzRegionInput('');
  }

  const hasCredentials = isAzure
    ? !!(settings?.azureSubscriptionKey && settings?.azureRegion)
    : !!settings?.elevenLabsApiKey;

  const selectedVoiceId = settings?.voiceId ?? DEFAULT_VOICE_ID;
  const selectedVoice = voices.find((v) => v.id === selectedVoiceId);

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center gap-3 px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <a href="/library" className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm">
          ← Library
        </a>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <main className="flex-1 px-5 py-6 space-y-8 max-w-lg">

        {/* Provider toggle */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            TTS Provider
          </h2>
          <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
            <button
              onClick={() => handleProviderChange('elevenlabs')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                !isAzure
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              ElevenLabs
            </button>
            <button
              onClick={() => handleProviderChange('azure')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                isAzure
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              Azure
            </button>
          </div>
        </section>

        {/* ElevenLabs credentials */}
        {!isAzure && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
              ElevenLabs API Key
            </h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Your key is stored securely and never shared.
            </p>
            <form onSubmit={handleElSave} className="space-y-3">
              <input
                type={elMasked ? 'text' : 'password'}
                value={elMasked ? MASKED : elKeyInput}
                onChange={(e) => { if (!elMasked) setElKeyInput(e.target.value); }}
                onFocus={() => { if (elMasked) { setElMasked(false); setElKeyInput(''); } }}
                placeholder="sk_..."
                className="w-full bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)] font-mono"
              />
              {elMasked && (
                <p className="text-xs text-[var(--muted)]">Key saved. Tap the field to replace it.</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={elMasked || !elKeyInput.trim()}
                  className="flex-1 bg-[var(--primary)] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
                >
                  {elSaved ? 'Saved!' : 'Save key'}
                </button>
                {settings?.elevenLabsApiKey && (
                  <button
                    type="button"
                    onClick={handleElClear}
                    className="px-4 py-3 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* Azure credentials */}
        {isAzure && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
              Azure Credentials
            </h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Your subscription key and region are stored securely and never shared.
            </p>
            <form onSubmit={handleAzSave} className="space-y-3">
              <input
                type={azKeyMasked ? 'text' : 'password'}
                value={azKeyMasked ? MASKED : azKeyInput}
                onChange={(e) => { if (!azKeyMasked) setAzKeyInput(e.target.value); }}
                onFocus={() => { if (azKeyMasked) { setAzKeyMasked(false); setAzKeyInput(''); } }}
                placeholder="Subscription key"
                className="w-full bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)] font-mono"
              />
              <input
                type="text"
                value={azRegionInput}
                onChange={(e) => setAzRegionInput(e.target.value)}
                placeholder="Region (e.g. eastus)"
                className="w-full bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)] font-mono"
              />
              {azKeyMasked && (
                <p className="text-xs text-[var(--muted)]">Key saved. Tap the field to replace it.</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={(!azKeyMasked && !azKeyInput.trim()) || !azRegionInput.trim()}
                  className="flex-1 bg-[var(--primary)] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
                >
                  {azSaved ? 'Saved!' : 'Save'}
                </button>
                {settings?.azureSubscriptionKey && (
                  <button
                    type="button"
                    onClick={handleAzClear}
                    className="px-4 py-3 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* Voice picker */}
        {hasCredentials && (
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
                  value={selectedVoiceId}
                  onChange={(e) => handleSelectVoice(e.target.value)}
                  className="flex-1 bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] outline-none border border-[var(--border)] focus:border-[var(--primary)]"
                >
                  {voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                {selectedVoice?.previewUrl && (
                  <button
                    type="button"
                    onClick={() => selectedVoice && handlePreview(selectedVoice)}
                    className="px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    ▶
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
