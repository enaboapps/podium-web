"use client";

import { useEffect, useRef, useState } from "react";
import type { TTSConfig, TTSVoice } from "@/lib/tts";
import {
  checkConnection,
  type ConnectionResult,
} from "@/lib/provider-connection";
import { VoicePicker } from "./VoicePicker";

type Provider = TTSConfig["provider"];
type Screen = "home" | "choose" | "connect" | "manage" | "disconnect";
export interface VoiceSetupProps {
  provider: Provider;
  configs: Record<Provider, TTSConfig | null>;
  voiceIds: Record<Provider, string>;
  onConnect: (config: TTSConfig) => Promise<void>;
  onDisconnect: (provider: Provider) => Promise<void>;
  onSelectVoice: (provider: Provider, voiceId: string) => Promise<void>;
  onTryVoice: (config: TTSConfig) => Promise<void>;
  onLeaveVoiceScreen?: () => void;
}
const name = (p: Provider) => (p === "azure" ? "Azure" : "ElevenLabs");
const button =
  "min-h-11 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
const primary = `${button} bg-[var(--primary)] text-slate-950`;
const input =
  "min-h-11 min-w-0 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3";
const same = (a: TTSConfig | null, b: TTSConfig | null) =>
  JSON.stringify(a) === JSON.stringify(b);

export function VoiceSetup({
  provider,
  configs,
  voiceIds,
  onConnect,
  onDisconnect,
  onSelectVoice,
  onTryVoice,
  onLeaveVoiceScreen,
}: VoiceSetupProps) {
  const [screen, setScreen] = useState<Screen>(
    configs[provider] ? "home" : "choose",
  );
  const [draftProvider, setDraftProvider] = useState(provider);
  const [replace, setReplace] = useState(false);
  const [key, setKey] = useState("");
  const [region, setRegion] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "checking" | "saving" | "disconnecting"
  >("idle");
  const [error, setError] = useState("");
  const [repair, setRepair] = useState(false);
  const [voiceState, setVoiceState] = useState<{
    config: TTSConfig | null;
    voices: TTSVoice[];
  }>({ config: null, voices: [] });
  const cache = useRef<{ config: TTSConfig; voices: TTSVoice[] } | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const activeConfig = configs[provider];
  const savedDraft = configs[draftProvider];
  const needsKey = replace || !savedDraft;
  const locked = phase === "saving" || phase === "disconnecting";

  useEffect(() => {
    heading.current?.focus();
  }, [screen]);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );

  function resetRequest() {
    generation.current++;
    request.current?.abort();
    busy.current = false;
    setPhase("idle");
    setError("");
    setRepair(false);
  }
  function navigate(next: Screen) {
    if (screen === "home") onLeaveVoiceScreen?.();
    resetRequest();
    setKey("");
    setRegion("");
    setShowKey(false);
    setReplace(false);
    setScreen(next);
  }
  function replaceKey(p: Provider) {
    navigate("connect");
    setDraftProvider(p);
    setReplace(true);
    const config = configs[p];
    setRegion(config?.provider === "azure" ? config.region : "");
  }
  function showFailure(result: Extract<ConnectionResult, { ok: false }>) {
    setError(result.message);
    setRepair(
      result.code === "invalid_credentials" ||
        result.code === "missing_permissions",
    );
  }
  // One check supplies connection feedback and the voice list. Successful setup seeds
  // the cache before Convex updates arrive, avoiding a second provider request.
  useEffect(() => {
    if (screen !== "home") return;
    if (!activeConfig) {
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) setScreen("choose");
      });
      return () => {
        cancelled = true;
      };
    }
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      if (cache.current && same(cache.current.config, activeConfig)) {
        setVoiceState(cache.current);
        setPhase("idle");
        setError("");
        setRepair(false);
        return;
      }
      busy.current = true;
      setPhase("checking");
      setError("");
      setRepair(false);
      const result = await checkConnection(activeConfig, controller.signal);
      if (controller.signal.aborted || current !== generation.current) return;
      busy.current = false;
      setPhase("idle");
      if (result.ok) {
        cache.current = { config: activeConfig, voices: result.voices };
        setVoiceState(cache.current);
      } else if (result.code !== "cancelled") showFailure(result);
    });
    return () => controller.abort();
  }, [activeConfig, screen]);

  async function retry() {
    if (!activeConfig || busy.current) return;
    resetRequest();
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setPhase("checking");
    const result = await checkConnection(activeConfig, controller.signal);
    if (current !== generation.current) return;
    busy.current = false;
    setPhase("idle");
    if (result.ok) {
      cache.current = { config: activeConfig, voices: result.voices };
      setVoiceState(cache.current);
    } else if (result.code !== "cancelled") showFailure(result);
  }
  async function connect() {
    if (busy.current) return;
    resetRequest();
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    const config: TTSConfig =
      !needsKey && savedDraft
        ? savedDraft
        : draftProvider === "azure"
          ? {
              provider: "azure",
              subscriptionKey: key.trim(),
              region: region.trim(),
            }
          : { provider: "elevenlabs", apiKey: key.trim() };
    busy.current = true;
    setPhase("checking");
    const result = await checkConnection(config, controller.signal);
    if (current !== generation.current) return;
    if (!result.ok) {
      busy.current = false;
      setPhase("idle");
      if (result.code !== "cancelled") showFailure(result);
      return;
    }
    setPhase("saving");
    try {
      await onConnect(config);
      if (current !== generation.current) return;
      cache.current = { config, voices: result.voices };
      setVoiceState(cache.current);
      setKey("");
      setRegion("");
      setShowKey(false);
      setReplace(false);
      setScreen("home");
    } catch {
      if (current === generation.current)
        setError(
          "Could not save and use this service. Your previous setup is unchanged. Try Connect again.",
        );
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setPhase("idle");
      }
    }
  }
  async function disconnect() {
    if (busy.current) return;
    resetRequest();
    busy.current = true;
    setPhase("disconnecting");
    try {
      await onDisconnect(provider);
      cache.current = null;
      navigate("choose");
    } catch {
      setError("Could not disconnect. Try again.");
    } finally {
      busy.current = false;
      setPhase("idle");
    }
  }
  const title =
    screen === "choose"
      ? "Choose your voice service"
      : screen === "connect"
        ? `Connect ${name(draftProvider)}`
        : screen === "manage"
          ? "Manage your voice service"
          : screen === "disconnect"
            ? `Disconnect ${name(provider)}?`
            : `Using ${name(provider)}`;
  const voices = same(voiceState.config, activeConfig) ? voiceState.voices : [];
  const selectedId = voiceIds[provider];
  const hasActive = !!activeConfig;

  return (
    <section className="space-y-5" aria-busy={phase !== "idle"}>
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {title}
      </h2>
      {screen === "choose" && (
        <>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm text-[var(--muted)]">
              Choose the service you have an account with.
            </legend>
            {(["elevenlabs", "azure"] as Provider[]).map((p) => (
              <label
                key={p}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <input
                  type="radio"
                  name="voice-service"
                  value={p}
                  checked={draftProvider === p}
                  onChange={() => setDraftProvider(p)}
                />
                {name(p)}
              </label>
            ))}
          </fieldset>
          <button className={primary} onClick={() => navigate("connect")}>
            Continue
          </button>
          {hasActive && (
            <button
              className={`${button} ml-2`}
              onClick={() => navigate("home")}
            >
              Cancel
            </button>
          )}
        </>
      )}
      {screen === "connect" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void connect();
          }}
        >
          {needsKey ? (
            <>
              <details>
                <summary className="min-h-11 cursor-pointer py-3 text-sm underline">
                  Where do I get my key?
                </summary>
                <div className="space-y-3 pb-3 text-sm">
                  <p>
                    {draftProvider === "azure"
                      ? "Open your Azure Speech resource and copy its key and matching region."
                      : "In ElevenLabs, open Developers → API Keys. Create a key and copy the complete secret, not its ID. Do not add a prefix yourself."}
                  </p>
                  <a
                    className="block py-2 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={
                      draftProvider === "azure"
                        ? "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-text-to-speech#prerequisites"
                        : "https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key"
                    }
                  >
                    {draftProvider === "azure"
                      ? "How to set up Azure Speech"
                      : "How to get an ElevenLabs key"}{" "}
                    (new tab)
                  </a>
                  <a
                    className="block py-2 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={
                      draftProvider === "azure"
                        ? "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions"
                        : "https://elevenlabs.io/docs/overview/administration/workspaces/api-keys"
                    }
                  >
                    {draftProvider === "azure"
                      ? "Speech regions"
                      : "API key permissions and management"}{" "}
                    (new tab)
                  </a>
                </div>
              </details>
              <label className="block" htmlFor="voice-key">
                {draftProvider === "azure"
                  ? "Speech resource key"
                  : "Secret API key"}
              </label>
              <div className="flex gap-2">
                <input
                  id="voice-key"
                  className={input}
                  type={showKey ? "text" : "password"}
                  value={key}
                  disabled={locked}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  aria-describedby="setup-error"
                  onChange={(e) => {
                    resetRequest();
                    setKey(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className={button}
                  aria-label={showKey ? "Hide key" : "Show key"}
                  aria-pressed={showKey}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              {draftProvider === "azure" && (
                <>
                  <label className="block" htmlFor="voice-region">
                    Azure region
                  </label>
                  <input
                    id="voice-region"
                    className={input}
                    placeholder="For example, eastus"
                    value={region}
                    disabled={locked}
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    onChange={(e) => {
                      resetRequest();
                      setRegion(e.target.value);
                    }}
                  />
                </>
              )}
              <p className="text-sm text-[var(--muted)]">
                Podium stores your key and sends it to {name(draftProvider)} to
                load voices and generate speech.
              </p>
            </>
          ) : (
            <p>Use your saved {name(draftProvider)} key to connect.</p>
          )}
          {error && (
            <p id="setup-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          {repair && !needsKey && (
            <button
              type="button"
              className={button}
              onClick={() => replaceKey(draftProvider)}
            >
              Replace key
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={primary}
              disabled={
                phase !== "idle" ||
                (needsKey &&
                  (!key.trim() ||
                    (draftProvider === "azure" && !region.trim())))
              }
            >
              {phase === "checking"
                ? "Connecting…"
                : phase === "saving"
                  ? "Saving…"
                  : "Connect"}
            </button>
            <button
              type="button"
              className={button}
              disabled={locked}
              onClick={() => navigate(hasActive ? "home" : "choose")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {screen === "home" && (
        <>
          {error ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
              <button
                className={button}
                onClick={() => (repair ? replaceKey(provider) : void retry())}
              >
                {repair ? "Replace key" : "Retry"}
              </button>
            </div>
          ) : phase === "checking" || !same(voiceState.config, activeConfig) ? (
            <p role="status">Loading your voices…</p>
          ) : (
            <VoicePicker
              key={provider}
              selectedVoice={voices.find((v) => v.id === selectedId)}
              selectedVoiceId={selectedId}
              voices={voices}
              voicesError=""
              voicesLoading={false}
              onRetry={() => void retry()}
              onSelectVoice={(id) => onSelectVoice(provider, id)}
              onTest={() =>
                activeConfig
                  ? onTryVoice({ ...activeConfig, voiceId: selectedId })
                  : Promise.resolve()
              }
            />
          )}
          <button className={button} onClick={() => navigate("manage")}>
            Manage
          </button>
        </>
      )}
      {screen === "manage" && (
        <div className="flex flex-col items-start gap-3">
          <button
            className={button}
            onClick={() => {
              setDraftProvider(provider);
              navigate("choose");
            }}
          >
            Change service
          </button>
          <button className={button} onClick={() => replaceKey(provider)}>
            Replace key
          </button>
          <button className={button} onClick={() => navigate("disconnect")}>
            Disconnect
          </button>
          <button className={button} onClick={() => navigate("home")}>
            Done
          </button>
        </div>
      )}
      {screen === "disconnect" && (
        <>
          <p>
            You will need to connect again to generate new speech. Your voices
            and other service’s key will be kept.
          </p>
          {error && (
            <p role="alert" className="text-red-400">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              className={button}
              disabled={locked}
              onClick={() => void disconnect()}
            >
              Disconnect
            </button>
            <button
              className={button}
              disabled={locked}
              onClick={() => navigate("manage")}
            >
              Cancel
            </button>
          </div>
        </>
      )}
      {screen !== "home" && phase !== "idle" && (
        <p role="status" className="text-sm">
          {phase === "checking"
            ? "Connecting…"
            : phase === "saving"
              ? "Saving your setup…"
              : "Disconnecting…"}
        </p>
      )}
    </section>
  );
}
