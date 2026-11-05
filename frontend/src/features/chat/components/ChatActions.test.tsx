import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationActions } from "./ChatActions";
import { muteChat } from "../api";
vi.mock("../api", () => ({ muteChat: vi.fn(), deleteChat: vi.fn() }));
function mount(isGroup = false, myRole: "MEMBER" | "OWNER" = "MEMBER") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ConversationActions
          chat={{
            id: 1,
            isGroup,
            myRole,
            createdAt: "2026-11-05T00:00:00Z",
            participants: [],
            messages: [],
          }}
        >
          <a href="/dashboard/websocket/1">Conversation</a>
        </ConversationActions>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function touch(element: HTMLElement, type: string, x: number, y = 100) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: "touch", clientX: x, clientY: y });
  fireEvent(element, event);
}
describe("conversation actions", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reveals mute and delete after a left swipe and suppresses navigation", async () => {
    vi.mocked(muteChat).mockResolvedValue(undefined);
    mount();
    const link = screen.getByText("Conversation");
    touch(link, "pointerdown", 200);
    touch(link, "pointerup", 100);
    expect(link.parentElement?.style.transform).toBe("translateX(-144px)");
    expect(fireEvent.click(link)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(muteChat).toHaveBeenCalledWith(1, true));
  });
  it("restores focus to the trigger when the menu is dismissed with Escape", () => {
    mount();
    const link = screen.getByRole("link", { name: "Conversation" });
    link.focus();
    fireEvent.contextMenu(link);
    const first = screen.getByRole("menuitem", { name: "Mute notifications" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(link);
  });
  it("shows permanent deletion for direct chats on right click", () => {
    mount();
    fireEvent.contextMenu(screen.getByText("Conversation"));
    expect(screen.getByRole("menuitem", { name: "Delete chat" })).toBeTruthy();
  });
  it("hides group deletion from members", () => {
    mount(true);
    fireEvent.contextMenu(screen.getByText("Conversation"));
    expect(screen.queryByRole("menuitem", { name: "Delete group" })).toBeNull();
  });
  it("lets a group owner open the delete confirmation", () => {
    mount(true, "OWNER");
    fireEvent.contextMenu(screen.getByText("Conversation"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete group" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("tracks the finger during opening and closing, then settles to the action width", () => {
    mount();
    const link = screen.getByText("Conversation");
    touch(link, "pointerdown", 200);
    touch(link, "pointermove", 170);
    expect(link.parentElement?.style.transform).toBe("translateX(-30px)");
    touch(link, "pointermove", 120);
    expect(link.parentElement?.style.transform).toBe("translateX(-80px)");
    touch(link, "pointerup", 120);
    expect(link.parentElement?.style.transform).toBe("translateX(-144px)");
    touch(link, "pointerdown", 100);
    touch(link, "pointermove", 160);
    expect(link.parentElement?.style.transform).toBe("translateX(-84px)");
    touch(link, "pointerup", 160);
    expect(link.parentElement?.style.transform).toBe("translateX(0px)");
  });
  it("snaps back for short drags, vertical scrolling or cancelled gestures", () => {
    mount();
    const link = screen.getByText("Conversation");
    touch(link, "pointerdown", 200);
    touch(link, "pointermove", 175);
    touch(link, "pointerup", 175);
    expect(link.parentElement?.style.transform).toBe("translateX(0px)");
    touch(link, "pointerdown", 200);
    touch(link, "pointermove", 198, 130);
    touch(link, "pointerup", 100, 150);
    expect(link.parentElement?.style.transform).toBe("translateX(0px)");
    touch(link, "pointerdown", 200);
    touch(link, "pointermove", 100);
    touch(link, "pointercancel", 100);
    expect(link.parentElement?.style.transform).toBe("translateX(0px)");
    expect(muteChat).not.toHaveBeenCalled();
  });
});
