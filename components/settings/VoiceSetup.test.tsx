import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceSetup, type VoiceSetupProps } from "./VoiceSetup";
import {
  checkConnection,
  type ConnectionResult,
} from "@/lib/provider-connection";
import type { TTSConfig } from "@/lib/tts";
vi.mock("@/lib/provider-connection", () => ({ checkConnection: vi.fn() }));
vi.mock("js-tts-wrapper/browser", () => ({
  VoiceUtils: { getAvailableLanguages: () => [] },
}));
const check = vi.mocked(checkConnection);
const el: TTSConfig = { provider: "elevenlabs", apiKey: "old-el" };
const az: TTSConfig = {
  provider: "azure",
  subscriptionKey: "old-az",
  region: "eastus",
};
const success: ConnectionResult = {
  ok: true,
  voices: [
    {
      id: "voice",
      name: "My voice",
      provider: "elevenlabs",
      languageCodes: [],
    },
  ],
};
beforeEach(() => check.mockResolvedValue(success));
afterEach(cleanup);
function props(): VoiceSetupProps {
  return {
    provider: "elevenlabs",
    configs: { elevenlabs: el, azure: az },
    voiceIds: { elevenlabs: "voice", azure: "voice" },
    onConnect: vi.fn().mockResolvedValue(undefined),
    onDisconnect: vi.fn().mockResolvedValue(undefined),
    onSelectVoice: vi.fn().mockResolvedValue(undefined),
    onTryVoice: vi.fn().mockResolvedValue(undefined),
  };
}
function Harness({ initial }: { initial: VoiceSetupProps }) {
  const [provider, setProvider] = useState(initial.provider);
  const [configs, setConfigs] = useState(initial.configs);
  return (
    <VoiceSetup
      {...initial}
      provider={provider}
      configs={configs}
      onConnect={async (c) => {
        await initial.onConnect(c);
        setConfigs((old) => ({ ...old, [c.provider]: c }));
        setProvider(c.provider);
      }}
      onDisconnect={async (p) => {
        await initial.onDisconnect(p);
        setConfigs((old) => ({ ...old, [p]: null }));
      }}
    />
  );
}
async function changeService(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Manage" }));
  await user.click(screen.getByRole("button", { name: "Change service" }));
  await user.click(screen.getByLabelText("Azure"));
  await user.click(screen.getByRole("button", { name: "Continue" }));
}
it("opens existing users on their voice and performs only one check", async () => {
  render(<Harness initial={props()} />);
  await screen.findByRole("combobox", { name: "Voice" });
  expect(check).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("heading", { name: "Using ElevenLabs" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Replace key" })).toBeNull();
  expect(screen.queryByText(/Voice access verified/)).toBeNull();
  expect(screen.getByText("Filter voices").closest("details")?.open).toBe(
    false,
  );
});
it("first-time setup validates once, activates, and focuses the voice screen", async () => {
  const p = props();
  p.configs = { elevenlabs: null, azure: null };
  const user = userEvent.setup();
  render(<Harness initial={p} />);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("heading", { name: "Connect ElevenLabs" })).toBe(
    document.activeElement,
  );
  expect(
    screen.getByText("Where do I get my key?").closest("details")?.open,
  ).toBe(false);
  await user.type(screen.getByLabelText("Secret API key"), " new-key ");
  await user.click(
    screen.getByRole("button", { name: "Connect", exact: true }),
  );
  await screen.findByRole("combobox", { name: "Voice" });
  expect(p.onConnect).toHaveBeenCalledWith({
    provider: "elevenlabs",
    apiKey: "new-key",
  });
  expect(check).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("heading", { name: "Using ElevenLabs" })).toBe(
    document.activeElement,
  );
});
it("changing service uses the saved key, validates once and reuses the voices", async () => {
  const p = props();
  const user = userEvent.setup();
  render(<Harness initial={p} />);
  await screen.findByRole("combobox", { name: "Voice" });
  await changeService(user);
  expect(p.onConnect).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Speech resource key")).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Connect", exact: true }),
  );
  await screen.findByRole("heading", { name: "Using Azure" });
  expect(p.onConnect).toHaveBeenCalledWith(az);
  expect(check).toHaveBeenCalledTimes(2);
});
it("cancelling a provider choice leaves the previous setup intact", async () => {
  const p = props();
  const user = userEvent.setup();
  render(<Harness initial={p} />);
  await screen.findByRole("combobox", { name: "Voice" });
  await changeService(user);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByRole("heading", { name: "Using ElevenLabs" });
  expect(p.onConnect).not.toHaveBeenCalled();
});
it("failed save/activation stays in setup and preserves the old service", async () => {
  const p = props();
  vi.mocked(p.onConnect).mockRejectedValue(new Error("save failed"));
  const user = userEvent.setup();
  render(<Harness initial={p} />);
  await screen.findByRole("combobox", { name: "Voice" });
  await changeService(user);
  await user.click(
    screen.getByRole("button", { name: "Connect", exact: true }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "previous setup is unchanged",
  );
  expect(screen.queryByRole("heading", { name: "Using Azure" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByRole("heading", { name: "Using ElevenLabs" });
});
it("invalid saved credentials show one repair prompt and no duplicate voice error", async () => {
  check.mockResolvedValue({
    ok: false,
    code: "invalid_credentials",
    message: "Replace your key.",
  });
  render(<Harness initial={props()} />);
  await screen.findByRole("alert");
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Replace key" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Voice" })).toBeNull();
});
it("temporary failures offer Retry without asking for a key", async () => {
  check.mockResolvedValueOnce({
    ok: false,
    code: "network",
    message: "Check your connection.",
  });
  const user = userEvent.setup();
  render(<Harness initial={props()} />);
  await user.click(await screen.findByRole("button", { name: "Retry" }));
  await screen.findByRole("combobox", { name: "Voice" });
  expect(screen.queryByLabelText("Secret API key")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});
it.each(["cancel", "edit"])(
  "ignores late validation after %s",
  async (action) => {
    const p = props();
    const user = userEvent.setup();
    render(<Harness initial={p} />);
    await screen.findByRole("combobox", { name: "Voice" });
    await user.click(screen.getByRole("button", { name: "Manage" }));
    await user.click(screen.getByRole("button", { name: "Replace key" }));
    let resolve!: (r: ConnectionResult) => void;
    check.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await user.type(screen.getByLabelText("Secret API key"), "replacement");
    await user.click(
      screen.getByRole("button", { name: "Connect", exact: true }),
    );
    if (action === "cancel")
      await user.click(screen.getByRole("button", { name: "Cancel" }));
    else await user.type(screen.getByLabelText("Secret API key"), "changed");
    await act(async () => resolve(success));
    expect(p.onConnect).not.toHaveBeenCalled();
  },
);
it("failed replacement preserves the existing key and draft", async () => {
  const p = props();
  const user = userEvent.setup();
  render(<Harness initial={p} />);
  await screen.findByRole("combobox", { name: "Voice" });
  await user.click(screen.getByRole("button", { name: "Manage" }));
  await user.click(screen.getByRole("button", { name: "Replace key" }));
  check.mockResolvedValueOnce({
    ok: false,
    code: "invalid_credentials",
    message: "Use the secret key.",
  });
  await user.type(screen.getByLabelText("Secret API key"), "bad");
  await user.click(
    screen.getByRole("button", { name: "Connect", exact: true }),
  );
  await screen.findByRole("alert");
  expect(p.onConnect).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("Secret API key") as HTMLInputElement).value,
  ).toBe("bad");
});
it("disconnect requires confirmation and removes only the active service", async () => {
  const p = props();
  const user = userEvent.setup();
  render(<Harness initial={p} />);
  await screen.findByRole("combobox", { name: "Voice" });
  await user.click(screen.getByRole("button", { name: "Manage" }));
  await user.click(screen.getByRole("button", { name: "Disconnect" }));
  expect(p.onDisconnect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Disconnect" }));
  await screen.findByRole("heading", { name: "Choose your voice service" });
  expect(p.onDisconnect).toHaveBeenCalledWith("elevenlabs");
  await user.click(screen.getByLabelText("Azure"));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText(/Use your saved Azure key/)).toBeTruthy();
});
it("empty voice lists remain understandable", async () => {
  check.mockResolvedValue({ ok: true, voices: [] });
  render(<Harness initial={props()} />);
  expect(await screen.findByText(/No voices are available/)).toBeTruthy();
});
it("prevents cancel and duplicate connects during the atomic save", async () => {
  const p = props();
  let resolve!: () => void;
  vi.mocked(p.onConnect).mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const user = userEvent.setup();
  render(<Harness initial={p} />);
  await screen.findByRole("combobox", { name: "Voice" });
  await changeService(user);
  await user.click(
    screen.getByRole("button", { name: "Connect", exact: true }),
  );
  await screen.findByRole("button", { name: "Saving…" });
  expect(
    (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await act(async () => resolve());
  await waitFor(() => expect(p.onConnect).toHaveBeenCalledTimes(1));
});
