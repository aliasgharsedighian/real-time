import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useChatViewport } from "./use-chat-viewport";

function Shell() {
  const ref = useChatViewport();
  return <div ref={ref} data-testid="viewport" />;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("follows keyboard resize and Safari pan, restores height and cleans up", () => {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
  });
  vi.stubGlobal("visualViewport", viewport);
  const { unmount } = render(<Shell />);
  act(() => vi.advanceTimersByTime(20));
  const element = screen.getByTestId("viewport");
  expect(element.style.getPropertyValue("--chat-height")).toBe("800px");
  act(() => {
    viewport.height = 420;
    viewport.offsetTop = 60;
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
  });
  expect(element.style.getPropertyValue("--chat-height")).toBe("420px");
  expect(element.style.getPropertyValue("--chat-top")).toBe("60px");
  act(() => {
    viewport.height = 800;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(20);
  });
  expect(element.style.getPropertyValue("--chat-height")).toBe("800px");
  const pinch = new Event("gesturestart", { cancelable: true });
  document.dispatchEvent(pinch);
  expect(pinch.defaultPrevented).toBe(true);
  unmount();
  expect(
    document.documentElement.classList.contains("chat-viewport-active"),
  ).toBe(false);
  const gesture = new Event("gesturestart", { cancelable: true });
  document.dispatchEvent(gesture);
  expect(gesture.defaultPrevented).toBe(false);
});
it("falls back to window height when VisualViewport is unavailable", () => {
  vi.useFakeTimers();
  vi.stubGlobal("visualViewport", undefined);
  render(<Shell />);
  act(() => vi.advanceTimersByTime(20));
  expect(
    screen.getByTestId("viewport").style.getPropertyValue("--chat-height"),
  ).toBe(`${window.innerHeight}px`);
});
