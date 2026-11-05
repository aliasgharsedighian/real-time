import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageInteraction } from "./MessageActions";

function mount() {
  const reply = vi.fn();
  render(
    <MessageInteraction
      message={{
        id: 1,
        chatId: 2,
        senderId: 3,
        content: "Message",
        createdAt: "2026-11-05T00:00:00Z",
      }}
      own={false}
      canDelete={false}
      selecting={false}
      selected={false}
      onToggle={vi.fn()}
      onReply={reply}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onForward={vi.fn()}
    >
      <p>Message</p>
    </MessageInteraction>,
  );
  return reply;
}
function touch(element: HTMLElement, type: string, x = 100, y = 100) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: "touch", clientX: x, clientY: y });
  fireEvent(element, event);
}
afterEach(() => vi.useRealTimers());
describe("message gestures", () => {
  it("opens the message menu after a one second touch hold", () => {
    vi.useFakeTimers();
    mount();
    touch(screen.getByText("Message"), "pointerdown");
    act(() => vi.advanceTimersByTime(999));
    expect(screen.queryByRole("menu")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("menuitem", { name: "Reply" })).toBeTruthy();
  });
  it("does not open the menu when the touch moves to scroll or is released early", () => {
    vi.useFakeTimers();
    mount();
    const message = screen.getByText("Message");
    touch(message, "pointerdown");
    touch(message, "pointermove", 100, 125);
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.queryByRole("menu")).toBeNull();
    touch(message, "pointerdown");
    touch(message, "pointerup");
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("supports desktop right click and escape", () => {
    mount();
    fireEvent.contextMenu(screen.getByText("Message"), {
      clientX: 20,
      clientY: 20,
    });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("tracks a left swipe and replies once on release past the threshold", () => {
    const reply = mount();
    const message = screen.getByText("Message");
    touch(message, "pointerdown");
    touch(message, "pointermove", 55);
    expect(message.parentElement?.style.transform).toBe("translateX(-45px)");
    expect(reply).not.toHaveBeenCalled();
    touch(message, "pointermove", 25);
    expect(message.parentElement?.style.transform).toBe("translateX(-75px)");
    touch(message, "pointerup", 25);
    expect(reply).toHaveBeenCalledTimes(1);
    expect(message.parentElement?.style.transform).toBe("translateX(0px)");
    expect(fireEvent.click(message)).toBe(false);
  });
  it("returns short, reversed and cancelled swipes without replying", () => {
    const reply = mount();
    const message = screen.getByText("Message");
    touch(message, "pointerdown");
    touch(message, "pointermove", 37);
    touch(message, "pointerup", 37);
    expect(reply).not.toHaveBeenCalled();
    touch(message, "pointerdown");
    touch(message, "pointermove", 20);
    touch(message, "pointermove", 80);
    touch(message, "pointerup", 80);
    expect(reply).not.toHaveBeenCalled();
    touch(message, "pointerdown");
    touch(message, "pointermove", 20);
    touch(message, "pointercancel", 20);
    expect(reply).not.toHaveBeenCalled();
    expect(message.parentElement?.style.transform).toBe("translateX(0px)");
    touch(message, "pointerdown");
    touch(message, "pointermove", 180);
    touch(message, "pointerup", 180);
    expect(reply).not.toHaveBeenCalled();
  });
  it("keeps vertical scrolling and horizontal movement from triggering a long hold or reply", () => {
    vi.useFakeTimers();
    const reply = mount();
    const message = screen.getByText("Message");
    touch(message, "pointerdown");
    touch(message, "pointermove", 98, 125);
    touch(message, "pointermove", 0, 160);
    touch(message, "pointerup", 0, 160);
    act(() => vi.advanceTimersByTime(1200));
    expect(reply).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    touch(message, "pointerdown");
    touch(message, "pointermove", 50);
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.queryByRole("menu")).toBeNull();
    touch(message, "pointerup", 50);
  });
  it("continues when capture moves from a child, but cancels when the swipe surface loses capture", () => {
    const reply = mount();
    const message = screen.getByText("Message");
    touch(message, "pointerdown");
    touch(message, "pointermove", 20);
    touch(message, "lostpointercapture", 20);
    expect(message.parentElement?.style.transform).toBe("translateX(-80px)");
    touch(message, "pointerup", 20);
    expect(reply).toHaveBeenCalledTimes(1);
    touch(message, "pointerdown");
    touch(message, "pointermove", 20);
    touch(message.parentElement!.parentElement!, "lostpointercapture", 20);
    touch(message, "pointerup", 20);
    expect(reply).toHaveBeenCalledTimes(1);
    expect(message.parentElement?.style.transform).toBe("translateX(0px)");
  });
});
