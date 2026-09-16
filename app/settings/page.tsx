"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConnectionCard } from "@/components/settings/ConnectionCard";
import { VoicePicker } from "@/components/settings/VoicePicker";
import { OfflineGate } from "@/components/offline/OfflineGate";
import { api } from "@/convex/_generated/api";
import { useOnlineCurrentUser } from "@/hooks/useOnlineCurrentUser";
import {
  DEFAULT_AZURE_VOICE,
  DEFAULT_VOICE_ID,
  fetchTTSBlob,
  TTSConfig,
  TTSVoice,
} from "@/lib/tts";
import { checkConnection } from "@/lib/provider-connection";

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
  const settings = useQuery(
    api.users.getSettings,
    clerkId ? { clerkId } : "skip",
  );
  const saveApiKey = useMutation(api.users.saveApiKey);
  const clearApiKey = useMutation(api.users.clearApiKey);
  const saveVoiceId = useMutation(api.users.saveVoiceId);
  const saveProvider = useMutation(api.users.saveProvider);
  const saveAzureCredentials = useMutation(api.users.saveAzureCredentials);
  const clearAzureCredentials = useMutation(api.users.clearAzureCredentials);
  const provider = settings?.provider ?? "elevenlabs";
  const elKey = settings?.elevenLabsApiKey;
  const azKey = settings?.azureSubscriptionKey;
  const azRegion = settings?.azureRegion;
  const elevenlabs = useMemo<TTSConfig | null>(
    () => (elKey ? { provider: "elevenlabs", apiKey: elKey } : null),
    [elKey],
  );
  const azure = useMemo<TTSConfig | null>(
    () =>
      azKey && azRegion
        ? { provider: "azure", subscriptionKey: azKey, region: azRegion }
        : null,
    [azKey, azRegion],
  );
  const config = provider === "azure" ? azure : elevenlabs;
  const [voiceState, setVoiceState] = useState<{
    config: TTSConfig | null;
    voices: TTSVoice[];
    error: string;
  }>({ config: null, voices: [], error: "" });
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const playbackGeneration = useRef(0);
  const selectedVoiceId =
    provider === "azure"
      ? (settings?.azureVoiceId ?? DEFAULT_AZURE_VOICE)
      : (settings?.elevenLabsVoiceId ?? DEFAULT_VOICE_ID);

  function stopAudio() {
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }
  useEffect(() => {
    const controller = new AbortController();
    // Defer state updates so changes to configuration never display the old voice list.
    Promise.resolve().then(async () => {
      if (controller.signal.aborted || !config) return;
      setLoading(true);
      const result = await checkConnection(config, controller.signal);
      if (controller.signal.aborted) return;
      setVoiceState({
        config,
        voices: result.ok ? result.voices : [],
        error: result.ok ? "" : result.message,
      });
      setLoading(false);
    });
    const playback = playbackGeneration;
    return () => {
      controller.abort();
      playback.current++;
      stopAudio();
    };
  }, [config, retry]);

  async function save(config: TTSConfig) {
    if (!clerkId || !settings) throw new Error("Account not ready");
    if (config.provider === "azure")
      await saveAzureCredentials({
        clerkId,
        azureSubscriptionKey: config.subscriptionKey,
        azureRegion: config.region,
      });
    else await saveApiKey({ clerkId, elevenLabsApiKey: config.apiKey });
  }
  async function disconnect(which: TTSConfig["provider"]) {
    if (!clerkId) throw new Error("Account not ready");
    if (which === "azure") await clearAzureCredentials({ clerkId });
    else await clearApiKey({ clerkId });
  }
  async function selectProvider(next: TTSConfig["provider"]) {
    if (!clerkId || switching) return;
    setSwitching(true);
    setError("");
    try {
      await saveProvider({ clerkId, provider: next });
    } catch {
      setError("Could not change the active provider. Try again.");
    } finally {
      setSwitching(false);
    }
  }
  async function testVoice() {
    if (!config) return;
    const current = ++playbackGeneration.current;
    stopAudio();
    const blob = await fetchTTSBlob(
      "Hello, this is a test of the selected voice.",
      { ...config, voiceId: selectedVoiceId },
    );
    if (current !== playbackGeneration.current) return;
    if (!blob.size) throw new Error("Empty audio");
    audioUrl.current = URL.createObjectURL(blob);
    audio.current = new Audio(audioUrl.current);
    audio.current.onended = stopAudio;
    try {
      await audio.current.play();
    } catch {
      stopAudio();
      throw new Error("Playback failed");
    }
  }
  const voices = voiceState.config === config ? voiceState.voices : [];
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-5 py-6">
        <a
          href="/library"
          className="inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
        >
          ← Library
        </a>
        <h1 className="text-2xl font-semibold">Voice connections</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Connect your speech providers, then choose which one Podium uses.
        </p>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-5 py-6">
        {!settings ? (
          <p role="status">Loading your account settings…</p>
        ) : (
          <>
            <section className="space-y-2">
              <label htmlFor="active-provider" className="block font-semibold">
                Provider used for speech
              </label>
              <select
                id="active-provider"
                className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                disabled={switching}
                value={provider}
                onChange={(e) =>
                  void selectProvider(e.target.value as TTSConfig["provider"])
                }
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="azure">Azure Speech</option>
              </select>
              <p className="text-sm text-[var(--muted)]">
                Connecting or disconnecting a provider does not change this
                selection.
              </p>
              {switching && <p role="status">Changing provider…</p>}
              {error && (
                <p role="alert" className="text-red-400">
                  {error}
                </p>
              )}
            </section>
            <ConnectionCard
              provider="elevenlabs"
              active={provider === "elevenlabs"}
              savedConfig={elevenlabs}
              onSave={save}
              onDisconnect={() => disconnect("elevenlabs")}
            />
            <ConnectionCard
              provider="azure"
              active={provider === "azure"}
              savedConfig={azure}
              onSave={save}
              onDisconnect={() => disconnect("azure")}
            />
            {config ? (
              <VoicePicker
                key={provider}
                selectedVoice={voices.find((v) => v.id === selectedVoiceId)}
                selectedVoiceId={selectedVoiceId}
                voices={voices}
                voicesError={
                  voiceState.config === config ? voiceState.error : ""
                }
                voicesLoading={loading || voiceState.config !== config}
                onRetry={() => setRetry((n) => n + 1)}
                onPreview={(voice) => {
                  stopAudio();
                  if (!voice.previewUrl) return;
                  audio.current = new Audio(voice.previewUrl);
                  audio.current.onended = stopAudio;
                  void audio.current
                    .play()
                    .catch(() =>
                      setError("Could not play the preview. Try again."),
                    );
                }}
                onSelectVoice={async (voiceId) => {
                  if (!clerkId) return;
                  await saveVoiceId({ clerkId, voiceId, provider });
                }}
                onTest={testVoice}
              />
            ) : (
              <p className="rounded-xl border border-[var(--border)] p-4">
                Connect {provider === "azure" ? "Azure Speech" : "ElevenLabs"}{" "}
                above to choose and test a voice.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
