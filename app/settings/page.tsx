'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { AzureSection } from '@/components/settings/AzureSection';
import { ElevenLabsSection } from '@/components/settings/ElevenLabsSection';
import { ProviderToggle } from '@/components/settings/ProviderToggle';
import { VoicePicker } from '@/components/settings/VoicePicker';
import { OfflineGate } from '@/components/offline/OfflineGate';
import { api } from '@/convex/_generated/api';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { DEFAULT_VOICE_ID, fetchVoices, TTSConfig, TTSVoice } from '@/lib/tts';

const MASKED = '****************';

export default function SettingsPage() {
  return (
    <OfflineGate
      unavailableTitle="Settings unavailable offline"
      unavailableMessage="Settings require a live connection and are not part of Podium's offline emergency mode."
    >
      <OnlineSettingsPage />
    </OfflineGate>
  );
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

  const [elKeyInput, setElKeyInput] = useState('');
  const [elMasked, setElMasked] = useState(false);
  const [elSaved, setElSaved] = useState(false);

  const [azKeyInput, setAzKeyInput] = useState('');
  const [azKeyMasked, setAzKeyMasked] = useState(false);
  const [azRegionInput, setAzRegionInput] = useState('');
  const [azSaved, setAzSaved] = useState(false);

  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (settings?.elevenLabsApiKey) {
      setElKeyInput('');
      setElMasked(true);
      return;
    }

    setElMasked(false);
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
        ? {
            provider: 'azure',
            subscriptionKey: settings.azureSubscriptionKey,
            region: settings.azureRegion,
            voiceId: settings.voiceId,
          }
        : null
      : settings.elevenLabsApiKey
        ? {
            provider: 'elevenlabs',
            apiKey: settings.elevenLabsApiKey,
            voiceId: settings.voiceId,
          }
        : null
    : null;

  useEffect(() => {
    if (!ttsConfig) {
      setVoices([]);
      return;
    }

    setVoicesLoading(true);
    setVoicesError(false);
    fetchVoices(ttsConfig)
      .then((availableVoices) => setVoices(availableVoices))
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
    void audio.play();
  }

  async function handleSelectVoice(voiceId: string) {
    if (!clerkId) return;
    await saveVoiceId({ clerkId, voiceId });
  }

  async function handleProviderChange(nextProvider: 'elevenlabs' | 'azure') {
    if (!clerkId) return;
    await saveProvider({ clerkId, provider: nextProvider });
  }

  async function handleElSave(event: React.FormEvent) {
    event.preventDefault();
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

  async function handleAzSave(event: React.FormEvent) {
    event.preventDefault();
    if (!clerkId || !azRegionInput.trim()) return;

    const nextKey = azKeyMasked ? undefined : azKeyInput.trim();
    if (!azKeyMasked && !nextKey) return;

    if (nextKey) {
      await saveAzureCredentials({
        clerkId,
        azureSubscriptionKey: nextKey,
        azureRegion: azRegionInput.trim(),
      });
    } else if (settings?.azureSubscriptionKey) {
      await saveAzureCredentials({
        clerkId,
        azureSubscriptionKey: settings.azureSubscriptionKey,
        azureRegion: azRegionInput.trim(),
      });
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
  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 pb-4 pt-6">
        <a href="/library" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          &lt;- Library
        </a>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <main className="max-w-lg flex-1 space-y-8 px-5 py-6">
        <ProviderToggle isAzure={isAzure} onProviderChange={handleProviderChange} />

        {!isAzure ? (
          <ElevenLabsSection
            hasSavedKey={!!settings?.elevenLabsApiKey}
            keyInput={elKeyInput}
            masked={elMasked}
            maskedValue={MASKED}
            saved={elSaved}
            onChange={setElKeyInput}
            onClear={handleElClear}
            onFocus={() => {
              if (elMasked) {
                setElMasked(false);
                setElKeyInput('');
              }
            }}
            onSubmit={handleElSave}
          />
        ) : (
          <AzureSection
            hasSavedKey={!!settings?.azureSubscriptionKey}
            keyInput={azKeyInput}
            keyMasked={azKeyMasked}
            maskedValue={MASKED}
            regionInput={azRegionInput}
            saved={azSaved}
            onClear={handleAzClear}
            onKeyChange={setAzKeyInput}
            onKeyFocus={() => {
              if (azKeyMasked) {
                setAzKeyMasked(false);
                setAzKeyInput('');
              }
            }}
            onRegionChange={setAzRegionInput}
            onSubmit={handleAzSave}
          />
        )}

        {hasCredentials ? (
          <VoicePicker
            selectedVoice={selectedVoice}
            selectedVoiceId={selectedVoiceId}
            voices={voices}
            voicesError={voicesError}
            voicesLoading={voicesLoading}
            onPreview={handlePreview}
            onSelectVoice={handleSelectVoice}
          />
        ) : null}
      </main>
    </div>
  );
}
