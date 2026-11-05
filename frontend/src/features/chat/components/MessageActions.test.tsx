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
});
