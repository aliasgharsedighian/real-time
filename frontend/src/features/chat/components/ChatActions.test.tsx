import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationActions } from "./ChatActions";
import { getHistory, muteChat } from "../api";
vi.mock("../api", () => ({
  muteChat: vi.fn(),
  deleteChat: vi.fn(),
  getHistory: vi.fn(),
}));
function mount(isGroup = false, myRole: "MEMBER" | "OWNER" = "MEMBER") {
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <ConversationActions
          chat={{
            id: 1,
            isGroup,
            myRole,
            createdAt: "2026-11-05T00:00:00Z",
            participants: [],
            messages: [],
            _count: { messages: 24 },
          }}
        >
          <a href="/dashboard/websocket/1">Conversation</a>
        </ConversationActions>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
function touch(element: HTMLElement, type: string, x: number, y = 100) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: "touch", clientX: x, clientY: y });
  fireEvent(element, event);
}
describe("conversation actions", () => {
  beforeEach(() => vi.clearAllMocks());
  it("previews history in a separate cache and keeps the unread badge when scrolling", async () => {
    vi.mocked(getHistory).mockResolvedValue({
      messages: [
        {
          id: 5,
          chatId: 1,
          senderId: 2,
          createdAt: "2026-11-05T00:00:00Z",
          content: "Unread message",
        },
      ],
      unreadCount: 24,
      unreadIds: [5],
      users: [],
      nextPage: null,
    });
    const cache = mount();
    fireEvent.contextMenu(screen.getByRole("link", { name: "Conversation" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Preview message" }));
    await screen.findByText("Unread message");
    fireEvent.scroll(screen.getByRole("region", { name: "Preview messages" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Go to latest preview messages" }),
    );
    expect(screen.getByLabelText("24 unread messages").textContent).toBe("24");
    expect(cache.getQueriesData({ queryKey: ["messages"] })).toEqual([]);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("shows incoming music as a Play button in the conversation preview", async () => {
    vi.mocked(getHistory).mockResolvedValue({
      messages: [{
        id: 5,
        chatId: 1,
        senderId: 2,
        createdAt: "2026-11-05T00:00:00Z",
        content: "",
        attachments: [{
          id: "incoming-music",
          kind: "MUSIC",
          title: "Incoming song",
          mimeType: "audio/mp4",
          size: 100,
          width: 0,
          height: 0,
        }],
      }],
      unreadCount: 1,
      unreadIds: [5],
      users: [],
      nextPage: null,
    });
    mount();
    fireEvent.contextMenu(screen.getByRole("link", { name: "Conversation" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Preview message" }));
    expect(await screen.findByRole("button", { name: "Play Incoming song" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Preview messages" }).querySelector("audio")).toBeNull();
  });
  it("loads earlier preview messages on scroll and keeps the visible message in place", async () => {
    const message = (id: number, content: string) => ({
      id,
      content,
      chatId: 1,
      senderId: 2,
      createdAt: "2026-11-05T00:00:00Z",
    });
    vi.mocked(getHistory)
      .mockResolvedValueOnce({
        messages: [message(5, "Visible message")],
        unreadCount: 24,
        unreadIds: [5],
        users: [],
        nextPage: 2,
      })
      .mockResolvedValueOnce({
        messages: [message(4, "Earlier message")],
        unreadCount: 24,
        unreadIds: [],
        users: [],
        nextPage: null,
      });

    let intersect: IntersectionObserverCallback | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const height = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(200);
    const total = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(600);
    try {
      const cache = mount();
      fireEvent.contextMenu(screen.getByRole("link", { name: "Conversation" }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Preview message" }),
      );
      const visible = (
        await screen.findByText("Visible message")
      ).closest<HTMLElement>("[data-message-id]")!;
      const region = screen.getByRole("region", { name: "Preview messages" });
      Object.defineProperties(region, {
        clientHeight: { value: 200 },
        scrollHeight: { value: 600 },
      });
      visible.getBoundingClientRect = () => {
        const insertedHeight = region.querySelector('[data-message-id="4"]')
          ? 120
          : 0;
        const top = 40 + insertedHeight - region.scrollTop;
        return new DOMRect(0, top, 100, 100);
      };
      // The first measured layout starts at the end, then the user scrolls up.
      region.scrollTop = 400;
      fireEvent.scroll(region);
      region.scrollTop = 30;
      fireEvent.scroll(region);
      await waitFor(() => expect(intersect).toBeDefined());
      // Trigger the same observer used by the normal conversation.
      await act(async () =>
        intersect?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      );
      await screen.findByText("Earlier message");
      expect(getHistory).toHaveBeenCalledWith(1, expect.any(AbortSignal), 2);
      expect(region.scrollTop).toBe(150);
      expect(screen.getByLabelText("24 unread messages").textContent).toBe(
        "24",
      );
      expect(cache.getQueriesData({ queryKey: ["messages"] })).toEqual([]);
    } finally {
      height.mockRestore();
      total.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it("opens touch preview with the available actions and consumes the long-press click", async () => {
    vi.mocked(getHistory).mockResolvedValue({
      messages: [],
      users: [],
      unreadIds: [],
      nextPage: null,
    });
    mount(true);
    const link = screen.getByRole("link", { name: "Conversation" });
    vi.useFakeTimers();
    try {
      touch(link, "pointerdown", 100);
      act(() => vi.advanceTimersByTime(500));
      touch(link, "pointerup", 100);
      expect(fireEvent.click(link)).toBe(false);
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
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
    const first = screen.getByRole("menuitem", { name: "Preview message" });
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
