"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { TTSConfig } from "@/lib/tts";
import { checkConnection } from "@/lib/provider-connection";

type Provider = TTSConfig["provider"];
type Phase = "idle" | "checking" | "saving" | "disconnecting";
interface Props {
  provider: Provider;
  active: boolean;
  savedConfig: TTSConfig | null;
  onSave: (config: TTSConfig) => Promise<void>;
  onDisconnect: () => Promise<void>;
  disabled?: boolean;
}
const button =
  "min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
const input =
  "min-h-11 min-w-0 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-[var(--foreground)]";

export function ConnectionCard({
  provider,
  active,
  savedConfig,
  onSave,
  onDisconnect,
  disabled,
}: Props) {
  const id = useId();
  const azure = provider === "azure";
  const name = azure ? "Azure Speech" : "ElevenLabs";
  const [expanded, setExpanded] = useState(active || !savedConfig);
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [region, setRegion] = useState("");
  const [visible, setVisible] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mutating = useRef(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const showForm = editing || !savedConfig;
  const locked = phase === "saving" || phase === "disconnecting";

  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );

  const cancelCheck = useCallback(() => {
    generation.current++;
    request.current?.abort();
    pending.current = false;
  }, []);

  const verifySaved = useCallback(async () => {
    if (!savedConfig || pending.current) return;
    cancelCheck();
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    pending.current = true;
    setPhase("checking");
    setError("");
    setNotice("");
    const result = await checkConnection(savedConfig, controller.signal);
    if (current !== generation.current) return;
    pending.current = false;
    setPhase("idle");
    if (result.ok)
      setNotice(
        "Voice access verified. Speech permissions and quota are checked only when you test a voice.",
      );
    else if (result.code !== "cancelled") setError(result.message);
  }, [savedConfig, cancelCheck]);

  useEffect(() => {
    if ((expanded || active) && !editing) void verifySaved();
    return () => {
      if (!mutating.current && !editing) cancelCheck();
    };
  }, [expanded, active, editing, verifySaved, cancelCheck]);

  function clearDraft() {
    cancelCheck();
    setPhase("idle");
    setKey("");
    setRegion("");
    setVisible(false);
    setEditing(false);
    setNotice("");
    setError("");
  }
  function changeDraft(update: () => void) {
    cancelCheck();
    setPhase("idle");
    setError("");
    setNotice("");
    setEditing(true);
    update();
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending.current || disabled) return;
    cancelCheck();
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    pending.current = true;
    const config: TTSConfig = azure
      ? {
          provider: "azure",
          subscriptionKey: key.trim(),
          region: region.trim(),
        }
      : { provider: "elevenlabs", apiKey: key.trim() };
    setPhase("checking");
    setNotice("");
    setError("");
    const result = await checkConnection(config, controller.signal);
    if (current !== generation.current) return;
    if (!result.ok) {
      pending.current = false;
      setPhase("idle");
      if (result.code !== "cancelled") setError(result.message);
      return;
    }
    mutating.current = true;
    setPhase("saving");
    try {
      await onSave(config);
      if (current !== generation.current) return;
      setKey("");
      setRegion("");
      setVisible(false);
      setEditing(false);
      setNotice(
        "Key saved. Voice access verified. You can test speech separately.",
      );
    } catch {
      if (current === generation.current)
        setError(
          "Voice access was verified, but Podium could not save the credentials. Your previous credentials are unchanged. Try again.",
        );
    } finally {
      mutating.current = false;
      if (current === generation.current) {
        pending.current = false;
        setPhase("idle");
      }
    }
  }
  async function disconnect() {
    if (pending.current || disabled) return;
    cancelCheck();
    pending.current = true;
    mutating.current = true;
    setPhase("disconnecting");
    setError("");
    try {
      await onDisconnect();
      clearDraft();
      setConfirmDisconnect(false);
      setNotice("Disconnected. The active provider has not changed.");
    } catch {
      setError("Podium could not disconnect this provider. Try again.");
    } finally {
      mutating.current = false;
      pending.current = false;
      setPhase("idle");
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {name}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {savedConfig ? "Key saved" : "Not connected"}
            {active ? " · Used for speech" : ""}
          </p>
        </div>
        <button
          className={button}
          disabled={phase !== "idle"}
          aria-expanded={expanded}
          aria-controls={`${id}-content`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Hide details"
            : savedConfig
              ? "Manage connection"
              : "Connect"}
        </button>
      </div>
      {expanded && (
        <div id={`${id}-content`} className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Podium stores your credentials and sends them to {name} when
            checking voices or generating speech.
          </p>
          {showForm ? (
            <form
              onSubmit={save}
              className="space-y-4"
              aria-busy={phase !== "idle"}
            >
              <p id={`${id}-help`} className="text-sm">
                {azure
                  ? "Use a Speech resource key and its matching region from the same Azure resource."
                  : "Copy the complete secret key shown when you create a key in ElevenLabs. Use the secret key, not its ID. Do not add a prefix yourself."}
              </p>
              <div className="flex flex-col items-start gap-2 text-sm text-[var(--primary)]">
                <a
                  className="underline py-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={
                    azure
                      ? "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-text-to-speech#prerequisites"
                      : "https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key"
                  }
                >
                  {azure
                    ? "How to set up Azure Speech"
                    : "How to get an ElevenLabs key"}{" "}
                  (opens in a new tab)
                </a>
                <a
                  className="underline py-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={
                    azure
                      ? "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions"
                      : "https://elevenlabs.io/docs/overview/administration/workspaces/api-keys"
                  }
                >
                  {azure
                    ? "Speech regions"
                    : "API key permissions and management"}{" "}
                  (opens in a new tab)
                </a>
              </div>
              <div>
                <label
                  htmlFor={`${id}-key`}
                  className="block mb-2 text-sm font-medium"
                >
                  {azure ? "Speech resource key" : "Secret API key"}
                </label>
                <div className="flex gap-2">
                  <input
                    id={`${id}-key`}
                    className={input}
                    type={visible ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="none"
                    aria-describedby={`${id}-help ${id}-feedback`}
                    disabled={locked || disabled}
                    value={key}
                    onChange={(e) => changeDraft(() => setKey(e.target.value))}
                    required
                  />
                  <button
                    type="button"
                    className={button}
                    aria-label={`${visible ? "Hide" : "Show"} ${name} key`}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {azure && (
                <div>
                  <label
                    htmlFor={`${id}-region`}
                    className="block mb-2 text-sm font-medium"
                  >
                    Azure region
                  </label>
                  <input
                    id={`${id}-region`}
                    className={input}
                    placeholder="For example, eastus"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={locked || disabled}
                    value={region}
                    onChange={(e) =>
                      changeDraft(() => setRegion(e.target.value))
                    }
                    required
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  className={`${button} bg-[var(--primary)] text-white`}
                  disabled={
                    phase !== "idle" ||
                    disabled ||
                    !key.trim() ||
                    (azure && !region.trim())
                  }
                >
                  {phase === "checking"
                    ? "Checking…"
                    : phase === "saving"
                      ? "Saving…"
                      : "Check and save"}
                </button>
                {(editing || key || region) && (
                  <button
                    type="button"
                    className={button}
                    disabled={locked}
                    onClick={clearDraft}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                className={button}
                disabled={phase !== "idle" || disabled}
                onClick={() => void verifySaved()}
              >
                Check connection
              </button>
              <button
                className={button}
                disabled={locked || disabled}
                onClick={() => {
                  clearDraft();
                  setEditing(true);
                  setRegion(
                    savedConfig?.provider === "azure" ? savedConfig.region : "",
                  );
                }}
              >
                Replace key
              </button>
              <button
                className={button}
                disabled={locked || disabled}
                onClick={() => setConfirmDisconnect(true)}
              >
                Disconnect
              </button>
            </div>
          )}
          {confirmDisconnect && savedConfig && (
            <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <p>
                Disconnect {name}? New speech will need credentials again. Your
                voice preference is kept.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={phase !== "idle" || disabled}
                  onClick={() => void disconnect()}
                >
                  Confirm disconnect
                </button>
                <button
                  className={button}
                  disabled={locked}
                  onClick={() => setConfirmDisconnect(false)}
                >
                  Keep connection
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div
        id={`${id}-feedback`}
        className="text-sm"
        aria-live="polite"
        aria-atomic="true"
      >
        {phase !== "idle" && (
          <p role="status">
            {phase === "checking"
              ? "Checking voice access…"
              : phase === "saving"
                ? "Saving credentials…"
                : "Disconnecting…"}
          </p>
        )}
        {error ? (
          <p role="alert" className="text-red-400">
            {error}
          </p>
        ) : notice ? (
          <p role="status">{notice}</p>
        ) : null}
      </div>
    </section>
  );
}
