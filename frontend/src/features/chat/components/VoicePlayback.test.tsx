import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VoiceMessage, VoicePlaybackBar, VoicePlaybackProvider } from "./VoicePlayback";

vi.mock("@/features/uploads/Media", () => ({
  useFileUrl: () => ({ data: new Blob() }),
}));

afterEach(() => vi.unstubAllGlobals());

it("shares playback between the bubble and the dashboard after leaving the chat", () => {
  const audio = {
    paused: true,
    duration: 30,
    currentTime: 0,
    playbackRate: 1,
    onplay: () => {},
    onpause: () => {},
    play: vi.fn(async () => {
      audio.paused = false;
      audio.onplay();
    }),
    pause: vi.fn(() => {
      audio.paused = true;
      audio.onpause();
    }),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  };
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("Audio", vi.fn(function () { return audio; }));
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: () => "blob:voice",
    revokeObjectURL,
  }));

  function dashboard(inChat: boolean) {
    return (
      <VoicePlaybackProvider>
        <VoicePlaybackBar />
        {inChat && (
          <VoiceMessage
            file={{ id: "voice", kind: "AUDIO", mimeType: "audio/mp4", size: 50, width: 0, height: 0, duration: 30 }}
            messageId={1}
            sender="Mina"
          />
        )}
      </VoicePlaybackProvider>
    );
  }

  const { rerender } = render(dashboard(true));
  fireEvent.click(screen.getByRole("button", { name: "Play voice message" }));
  const bar = within(screen.getByRole("region", { name: "Voice message player" }));
  expect(bar.getByText("Mina")).toBeTruthy();
  expect(bar.getByText("Voice Message")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Pause voice message" })).toHaveLength(2);

  rerender(dashboard(false));
  expect(audio.paused).toBe(false);
  expect(revokeObjectURL).not.toHaveBeenCalled();
  fireEvent.click(bar.getByRole("button", { name: "Pause voice message" }));
  expect(audio.paused).toBe(true);
  fireEvent.click(bar.getByRole("button", { name: "Play voice message" }));
  expect(audio.paused).toBe(false);
  for (const [from, to] of [[1, 1.5], [1.5, 2], [2, 1]]) {
    fireEvent.click(bar.getByRole("button", { name: `Playback speed x${from}. Change speed` }));
    expect(audio.playbackRate).toBe(to);
  }

  fireEvent.click(bar.getByRole("button", { name: "Close voice player" }));
  expect(audio.paused).toBe(true);
  expect(screen.queryByRole("region", { name: "Voice message player" })).toBeNull();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice");
});
