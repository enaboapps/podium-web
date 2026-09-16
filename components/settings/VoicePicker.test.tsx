import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoicePicker } from "./VoicePicker";
vi.mock("js-tts-wrapper/browser", () => ({
  VoiceUtils: { getAvailableLanguages: () => [] },
}));
afterEach(cleanup);
const voice = {
  id: "voice",
  name: "Test voice",
  provider: "elevenlabs",
  languageCodes: [],
};
const props = () => ({
  selectedVoice: voice,
  selectedVoiceId: voice.id,
  voices: [voice],
  voicesError: "",
  voicesLoading: false,
  onPreview: vi.fn(),
  onSelectVoice: vi.fn().mockResolvedValue(undefined),
  onRetry: vi.fn(),
});
it("shows an explicit empty list without changing the saved voice", () => {
  const p = props();
  render(<VoicePicker {...p} voices={[]} />);
  expect(screen.getByText(/No voices are available/)).toBeTruthy();
  expect(p.onSelectVoice).not.toHaveBeenCalled();
});
it("shows an actionable provider error", async () => {
  const p = props();
  render(<VoicePicker {...p} voicesError="Check your key and region." />);
  expect(screen.getByRole("alert").textContent).toContain(
    "Check your key and region.",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Retry loading voices" }),
  );
  expect(p.onRetry).toHaveBeenCalledOnce();
});
it("catches speech failures and explains usage before testing", async () => {
  render(
    <VoicePicker
      {...props()}
      onTest={vi.fn().mockRejectedValue(new Error("secret provider body"))}
    />,
  );
  expect(screen.getByText(/may consume provider usage/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Test voice" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Check synthesis permissions",
  );
  expect(screen.queryByText("secret provider body")).toBeNull();
});
