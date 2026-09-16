import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionCard } from "./ConnectionCard";
import {
  checkConnection,
  type ConnectionResult,
} from "@/lib/provider-connection";
import type { TTSConfig } from "@/lib/tts";
vi.mock("@/lib/provider-connection", () => ({ checkConnection: vi.fn() }));
const check = vi.mocked(checkConnection);
const saved: TTSConfig = {
  provider: "elevenlabs",
  apiKey: "old-synthetic-secret",
};
const success: ConnectionResult = { ok: true, voices: [] };
beforeEach(() => check.mockResolvedValue(success));
afterEach(cleanup);
const props = () => ({
  provider: "elevenlabs" as const,
  active: true,
  savedConfig: null,
  onSave: vi.fn().mockResolvedValue(undefined),
  onDisconnect: vi.fn().mockResolvedValue(undefined),
});

it("verifies before saving, trims the draft, and never displays a saved secret", async () => {
  const p = props();
  const user = userEvent.setup();
  render(<ConnectionCard {...p} />);
  await user.type(screen.getByLabelText("Secret API key"), "  new-secret  ");
  await user.click(screen.getByRole("button", { name: "Check and save" }));
  await waitFor(() =>
    expect(p.onSave).toHaveBeenCalledWith({
      provider: "elevenlabs",
      apiKey: "new-secret",
    }),
  );
  expect(screen.getByText(/Key saved. Voice access verified/)).toBeTruthy();
  expect(
    (screen.getByLabelText("Secret API key") as HTMLInputElement).value,
  ).toBe("");
});
it("preserves saved credentials and a rejected replacement draft", async () => {
  const p = props();
  const user = userEvent.setup();
  render(<ConnectionCard {...p} savedConfig={saved} />);
  await screen.findByText(/Voice access verified/);
  await user.click(screen.getByRole("button", { name: "Replace key" }));
  expect(
    (screen.getByLabelText("Secret API key") as HTMLInputElement).value,
  ).toBe("");
  check.mockResolvedValueOnce({
    ok: false,
    code: "invalid_credentials",
    message: "Use the secret, not its ID.",
  });
  await user.type(screen.getByLabelText("Secret API key"), "invalid-id");
  await user.click(screen.getByRole("button", { name: "Check and save" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Use the secret, not its ID.",
  );
  expect(p.onSave).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("Secret API key") as HTMLInputElement).value,
  ).toBe("invalid-id");
});
it("reports persistence failure without claiming success", async () => {
  const p = props();
  p.onSave.mockRejectedValue(new Error("private error"));
  const user = userEvent.setup();
  render(<ConnectionCard {...p} />);
  await user.type(screen.getByLabelText("Secret API key"), "valid");
  await user.click(screen.getByRole("button", { name: "Check and save" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "could not save",
  );
  expect(screen.queryByText(/Key saved. Voice access verified/)).toBeNull();
});
it.each(["cancel", "edit"])(
  "does not save a stale validation after %s",
  async (action) => {
    const p = props();
    const user = userEvent.setup();
    let resolve!: (result: ConnectionResult) => void;
    check.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<ConnectionCard {...p} />);
    await user.type(screen.getByLabelText("Secret API key"), "draft");
    await user.click(screen.getByRole("button", { name: "Check and save" }));
    if (action === "cancel")
      await user.click(screen.getByRole("button", { name: "Cancel" }));
    else await user.type(screen.getByLabelText("Secret API key"), "changed");
    await act(async () => resolve(success));
    expect(p.onSave).not.toHaveBeenCalled();
  },
);
it("blocks duplicate saves and cancels while persistence is pending", async () => {
  const p = props();
  let resolve!: () => void;
  p.onSave.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const user = userEvent.setup();
  render(<ConnectionCard {...p} />);
  await user.type(screen.getByLabelText("Secret API key"), "valid");
  await user.click(screen.getByRole("button", { name: "Check and save" }));
  await screen.findByRole("button", { name: "Saving…" });
  expect(
    (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.submit(screen.getByLabelText("Secret API key").closest("form")!);
  expect(p.onSave).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
});
it("handles a saved-config subscription update while saving", async () => {
  const p = props();
  let resolve!: () => void;
  p.onSave.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const user = userEvent.setup();
  const { rerender } = render(<ConnectionCard {...p} />);
  await user.type(screen.getByLabelText("Secret API key"), "valid");
  await user.click(screen.getByRole("button", { name: "Check and save" }));
  await screen.findByRole("button", { name: "Saving…" });
  rerender(<ConnectionCard {...p} savedConfig={saved} />);
  await act(async () => resolve());
  expect(screen.queryByLabelText("Secret API key")).toBeNull();
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Replace key" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
});
it("requires disconnect confirmation and leaves other provider callbacks untouched", async () => {
  const p = props();
  const other = props();
  const user = userEvent.setup();
  render(
    <>
      <ConnectionCard {...p} savedConfig={saved} />
      <ConnectionCard {...other} provider="azure" active={false} />
    </>,
  );
  await screen.findByText(/Voice access verified/);
  await user.click(
    screen.getByRole("button", { name: "Disconnect", exact: true }),
  );
  expect(p.onDisconnect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm disconnect" }));
  await waitFor(() => expect(p.onDisconnect).toHaveBeenCalledTimes(1));
  expect(other.onDisconnect).not.toHaveBeenCalled();
});
it("labels Azure fields, trims values, and retains official help links", async () => {
  const p = props();
  const user = userEvent.setup();
  render(<ConnectionCard {...p} provider="azure" />);
  await user.type(screen.getByLabelText("Speech resource key"), " azure-key ");
  await user.type(screen.getByLabelText("Azure region"), " eastus ");
  await user.click(screen.getByRole("button", { name: "Check and save" }));
  expect(p.onSave).toHaveBeenCalledWith({
    provider: "azure",
    subscriptionKey: "azure-key",
    region: "eastus",
  });
  expect(
    screen
      .getByRole("link", { name: /How to set up Azure Speech/ })
      .getAttribute("target"),
  ).toBe("_blank");
});
