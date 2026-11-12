import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playAppSound } from "@/shared/lib/app-sounds";
import { CallRing } from "./CallRing";

function windowsTouchscreen() {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0)");
  vi.stubGlobal("AudioContext", undefined);
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "maxTouchPoints");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("app sounds by platform", () => {
  it("keeps the original desktop ringtone on a touchscreen without Web Audio or a prior gesture", () => {
    windowsTouchscreen();
    const { container, rerender } = render(<CallRing sound="incomingCall" />);
    const ring = container.querySelector("audio");
    expect(ring?.autoplay).toBe(true);
    expect(ring?.loop).toBe(true);
    expect(ring?.getAttribute("src")).toBe("/sounds/incoming-call.wav");

    rerender(<CallRing sound="outgoingCall" />);
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("/sounds/outgoing-call.wav");
  });

  it("plays desktop chat effects using native audio without fetching through Web Audio", () => {
    windowsTouchscreen();
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const fetchAudio = vi.spyOn(window, "fetch");
    playAppSound("messageReceived");
    playAppSound("messageSent");

    const audio = play.mock.contexts as HTMLAudioElement[];
    expect(audio.map((element) => element.getAttribute("src"))).toEqual([
      "/sounds/message-received.wav",
      "/sounds/message-sent.mp3",
    ]);
    expect(fetchAudio).not.toHaveBeenCalled();
    for (const element of audio) fireEvent.ended(element);
  });

  it("suppresses automatic sounds on Android even when the browser requests a desktop site", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
      platform: "Linux x86_64",
      maxTouchPoints: 0,
      userAgentData: { platform: "Android", mobile: false },
    });
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const { container } = render(<CallRing sound="incomingCall" />);
    playAppSound("messageReceived");
    expect(container.querySelector("audio")).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });
});
