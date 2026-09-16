"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { VoiceSetup } from "@/components/settings/VoiceSetup";
import { OfflineGate } from "@/components/offline/OfflineGate";
import { api } from "@/convex/_generated/api";
import { useOnlineCurrentUser } from "@/hooks/useOnlineCurrentUser";
import {
  DEFAULT_AZURE_VOICE,
  DEFAULT_VOICE_ID,
  fetchTTSBlob,
  type TTSConfig,
} from "@/lib/tts";

export default function SettingsPage() {
  return (
    <OfflineGate
      unavailableTitle="Settings unavailable offline"
      unavailableMessage="Connect to the internet to change your voice settings."
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
  const connectProvider = useMutation(api.users.connectProvider);
  const clearApiKey = useMutation(api.users.clearApiKey);
  const clearAzureCredentials = useMutation(api.users.clearAzureCredentials);
  const saveVoiceId = useMutation(api.users.saveVoiceId);
  const elKey = settings?.elevenLabsApiKey;
  const azKey = settings?.azureSubscriptionKey;
  const azRegion = settings?.azureRegion;
  const configs = useMemo<Record<TTSConfig["provider"], TTSConfig | null>>(
    () => ({
      elevenlabs: elKey ? { provider: "elevenlabs", apiKey: elKey } : null,
      azure:
        azKey && azRegion
          ? { provider: "azure", subscriptionKey: azKey, region: azRegion }
          : null,
    }),
    [elKey, azKey, azRegion],
  );
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const playbackGeneration = useRef(0);
  function stopAudio() {
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }
  useEffect(() => {
    const playback = playbackGeneration;
    return () => {
      playback.current++;
      stopAudio();
    };
  }, [settings?.provider, elKey, azKey, azRegion]);
  async function tryVoice(config: TTSConfig) {
    const current = ++playbackGeneration.current;
    stopAudio();
    const blob = await fetchTTSBlob(
      "Hello, this is a test of the selected voice.",
      config,
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
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-xl px-5 py-6">
        <header className="mb-8">
          <a
            className="inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
            href="/library"
          >
            ← Library
          </a>
          <h1 className="text-2xl font-semibold">Your voice</h1>
        </header>
        <main>
          {!settings ? (
            <p role="status">Loading your settings…</p>
          ) : (
            <VoiceSetup
              provider={settings.provider ?? "elevenlabs"}
              configs={configs}
              voiceIds={{
                elevenlabs: settings.elevenLabsVoiceId ?? DEFAULT_VOICE_ID,
                azure: settings.azureVoiceId ?? DEFAULT_AZURE_VOICE,
              }}
              onConnect={async (config) => {
                await connectProvider({ config });
              }}
              onDisconnect={async (provider) => {
                if (!clerkId) throw new Error("Sign in again");
                playbackGeneration.current++;
                stopAudio();
                if (provider === "azure")
                  await clearAzureCredentials({ clerkId });
                else await clearApiKey({ clerkId });
              }}
              onSelectVoice={async (provider, voiceId) => {
                if (!clerkId) throw new Error("Sign in again");
                await saveVoiceId({ clerkId, provider, voiceId });
              }}
              onLeaveVoiceScreen={() => {
                playbackGeneration.current++;
                stopAudio();
              }}
              onTryVoice={tryVoice}
            />
          )}
        </main>
      </div>
    </div>
  );
}
