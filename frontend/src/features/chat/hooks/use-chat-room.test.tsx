import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionContext } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { useChatRoom } from "./use-chat-room";
import { chatKeys } from "../api";
import type { History, Message } from "../types";

const fake = vi.hoisted(() => ({
  handlers: new Map<string, (...args: never[]) => void>(),
  emit: vi.fn(),
  intersect: (entries: unknown[]) => {
    void entries;
  },
}));
vi.mock("../socket", () => ({
  getSocket: () => ({
    connected: true,
    connect: vi.fn(),
    emit: fake.emit,
    on: (event: string, handler: (...args: never[]) => void) =>
      fake.handlers.set(event, handler),
    off: (event: string) => fake.handlers.delete(event),
  }),
}));

function mount() {
  const cache = new QueryClient();
  const key = chatKeys.history("refresh", 7);
  cache.setQueryData<History>(key, { messages: [], users: [], unreadIds: [] });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>
      <SessionContext.Provider
        value={{
          user: { id: 1, email: "me@example.test", profile: null },
          checking: false,
          error: null,
          retry: vi.fn(),
        }}
      >
        {children}
        <div role="log" aria-label="Messages">
          <div data-message-id="8" />
        </div>
      </SessionContext.Provider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useChatRoom(7, true), { wrapper });
  return { cache, key, ...hook };
}

describe("chat room events", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("keeps a nonempty draft typing through idle, restores it after rejoin and stops explicitly", () => {
    vi.useFakeTimers();
    const { result, unmount } = mount();
    act(() => result.current.startTyping());
    fake.emit.mockClear();
    act(() => vi.advanceTimersByTime(60_000));
    expect(fake.emit).not.toHaveBeenCalledWith(
      "typing:stop",
      expect.anything(),
    );
    act(() => {
      fake.handlers.get("disconnect")!();
      fake.handlers.get("connect")!();
      fake.handlers.get("chat:joined")!({ chatId: 7 } as never);
    });
    expect(fake.emit).toHaveBeenCalledWith(
      "typing:start",
      expect.objectContaining({ chatId: 7 }),
    );
    fake.emit.mockClear();
    act(() => result.current.stopTyping());
    expect(fake.emit).toHaveBeenCalledWith(
      "typing:stop",
      expect.objectContaining({ chatId: 7 }),
    );
    fake.emit.mockClear();
    act(() => fake.handlers.get("chat:joined")!({ chatId: 7 } as never));
    expect(fake.emit).not.toHaveBeenCalledWith(
      "typing:start",
      expect.anything(),
    );
    act(() => result.current.startTyping());
    fake.emit.mockClear();
    unmount();
    expect(fake.emit).toHaveBeenCalledWith(
      "typing:stop",
      expect.objectContaining({ chatId: 7 }),
    );
  });
  it("keeps new live messages out of a search window with a gap and does not mark them read", () => {
    const { cache, key } = mount();
    act(() =>
      cache.setQueryData<History>(key, {
        messages: [],
        users: [],
        unreadIds: [],
        window: { beforeId: 5, afterId: 10, focusId: 7 },
      }),
    );
    fake.emit.mockClear();
    act(() =>
      fake.handlers.get("message:new")!({
        id: 100,
        chatId: 7,
        senderId: 2,
        content: "Live",
        createdAt: "2026-11-04T12:00:00Z",
      } as never),
    );
    expect(cache.getQueryData<History>(key)?.messages).toEqual([]);
    expect(
      fake.emit.mock.calls.some(([event]) => event === "message:read"),
    ).toBe(false);
  });
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: unknown[]) => void) {
          fake.intersect = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    fake.handlers.clear();
    fake.emit.mockClear();
    useSessionStore
      .getState()
      .setTokens({ accessToken: "access", refreshToken: "refresh" });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });
  it("appends an incoming message to normalized history and reads its actual id", () => {
    const { cache, key } = mount();
    const message: Message = {
      id: 8,
      chatId: 7,
      senderId: 2,
      content: "Hello",
      createdAt: "2026-11-03T10:00:00.000Z",
    };
    act(() => {
      fake.handlers.get("message:new")!(message as never);
      expect(
        fake.emit.mock.calls.some(([event]) => event === "message:read"),
      ).toBe(false);
      fake.intersect([
        {
          target: document.querySelector('[data-message-id="8"]'),
          isIntersecting: true,
        },
      ]);
    });
    expect(
      cache.getQueryData<History>(key)?.messages.map((entry) => entry.id),
    ).toEqual([8]);
    expect(fake.emit).toHaveBeenCalledWith("message:read", {
      chatId: 7,
      userId: 1,
      messageIds: [8],
    });
  });
  it("does not acknowledge reading a message in a hidden tab", () => {
    mount();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const message: Message = {
      id: 8,
      chatId: 7,
      senderId: 2,
      content: "Hello",
      createdAt: "2026-11-03T10:00:00.000Z",
    };
    act(() => {
      fake.handlers.get("message:new")!(message as never);
      fake.intersect([
        {
          target: document.querySelector('[data-message-id="8"]'),
          isIntersecting: true,
        },
      ]);
    });
    expect(
      fake.emit.mock.calls.some(([event]) => event === "message:read"),
    ).toBe(false);
  });
  it("marks a visible message after returning to the tab and never reads offscreen messages", () => {
    const { cache, key } = mount();
    act(() =>
      cache.setQueryData<History>(key, {
        users: [],
        unreadIds: [],
        messages: [
          {
            id: 8,
            chatId: 7,
            senderId: 2,
            content: "Visible",
            createdAt: "2026-11-05T10:00:00Z",
          },
          {
            id: 9,
            chatId: 7,
            senderId: 2,
            content: "Offscreen",
            createdAt: "2026-11-05T10:01:00Z",
          },
        ],
      }),
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() =>
      fake.intersect([
        {
          target: document.querySelector('[data-message-id="8"]'),
          isIntersecting: true,
        },
      ]),
    );
    expect(
      fake.emit.mock.calls.filter(([event]) => event === "message:read"),
    ).toHaveLength(0);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(fake.emit).toHaveBeenCalledWith("message:read", {
      chatId: 7,
      userId: 1,
      messageIds: [8],
    });
    expect(
      fake.emit.mock.calls.filter(([event]) => event === "message:read"),
    ).toHaveLength(1);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(
      fake.emit.mock.calls.filter(([event]) => event === "message:read"),
    ).toHaveLength(1);
  });
  it("rejoins the room and requests missed history after reconnect", () => {
    const { cache } = mount();
    const invalidate = vi.spyOn(cache, "invalidateQueries");
    fake.emit.mockClear();
    act(() => {
      fake.handlers.get("disconnect")!();
      fake.handlers.get("connect")!();
    });
    expect(fake.emit).toHaveBeenCalledWith("chat:join", {
      chatId: 7,
      userId: 1,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: chatKeys.history("refresh", 7),
    });
  });
  it("reads only intersecting history after reconnect, splitting large visible batches", async () => {
    const { cache, key } = mount();
    const messages: Message[] = Array.from({ length: 1001 }, (_, index) => ({
      id: index + 10,
      chatId: 7,
      senderId: 2,
      content: "Missed message",
      createdAt: "2026-11-04T10:00:00.000Z",
    }));
    await act(async () => {
      fake.handlers.get("disconnect")!();
      fake.handlers.get("connect")!();
      await cache.fetchQuery({
        queryKey: key,
        queryFn: async () => ({
          messages,
          users: [],
          unreadIds: messages.map((m) => m.id),
        }),
      });
    });
    const root = document.querySelector('[role="log"]')!;
    const entries = messages.map((message) => {
      const target = document.createElement("div");
      target.setAttribute("data-message-id", String(message.id));
      root.append(target);
      return { target, isIntersecting: true };
    });
    act(() => fake.intersect(entries));
    const reads = fake.emit.mock.calls.filter(
      ([event]) => event === "message:read",
    );
    expect(reads.map(([, payload]) => payload.messageIds.length)).toEqual([
      1000, 1,
    ]);
    expect(reads[1][1].messageIds).toEqual([1010]);
  });
});
