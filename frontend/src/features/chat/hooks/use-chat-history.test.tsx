import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/features/auth/session-store";
import { chatKeys, getHistory, getMessageWindow } from "../api";
import type { History, Message } from "../types";
import { useChatHistory } from "./use-chat-history";
vi.mock("../api", async (original) => ({
  ...(await original<object>()),
  getHistory: vi.fn(),
  getMessageWindow: vi.fn(),
}));
const get = vi.mocked(getHistory);
const getWindow = vi.mocked(getMessageWindow);
const message = (id: number): Message => ({
  id,
  chatId: 7,
  senderId: 2,
  content: `Message ${id}`,
  createdAt: "2026-11-04T10:00:00Z",
});
function page(ids: number[], nextPage: number | null) {
  return { messages: ids.map(message), unreadIds: ids, users: [], nextPage };
}
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  return {
    ...renderHook(() => useChatHistory(7), { wrapper }),
    cache,
    key: chatKeys.history("refresh", 7),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore
    .getState()
    .setTokens({ accessToken: "access", refreshToken: "refresh" });
});
describe("incremental chat history", () => {
  it("opens an old result directly and traverses its context without merging the disconnected latest history", async () => {
    get.mockResolvedValue(page([99, 100], null));
    getWindow
      .mockResolvedValueOnce({
        messages: [message(30), message(31)],
        beforeId: 30,
        afterId: 31,
      })
      .mockResolvedValueOnce({
        messages: [message(29)],
        beforeId: null,
        afterId: 29,
      })
      .mockResolvedValueOnce({
        messages: [message(32)],
        beforeId: 32,
        afterId: null,
      });
    const { result } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.openMessage(30));
    await waitFor(() =>
      expect(result.current.data?.messages.map((m) => m.id)).toEqual([30, 31]),
    );
    expect(getWindow.mock.calls[0][1]).toEqual({ aroundId: 30 });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data?.messages.map((m) => m.id)).toEqual([30, 31]);
    await act(() => result.current.loadOlder());
    await waitFor(() =>
      expect(result.current.data?.messages.map((m) => m.id)).toEqual([
        29, 30, 31,
      ]),
    );
    await act(() => result.current.loadNewer());
    await waitFor(() =>
      expect(result.current.data?.messages.map((m) => m.id)).toEqual([
        29, 30, 31, 32,
      ]),
    );
    expect(getWindow.mock.calls[1][1]).toEqual({ beforeId: 30 });
    expect(getWindow.mock.calls[2][1]).toEqual({ afterId: 31 });
    await act(() => result.current.returnToLatest());
    await waitFor(() =>
      expect(result.current.data?.messages.map((m) => m.id)).toEqual([99, 100]),
    );
    expect(result.current.data?.window).toBeUndefined();
  });

  it("keeps the current conversation intact if loading a search result fails", async () => {
    get.mockResolvedValue(page([99, 100], null));
    getWindow.mockRejectedValueOnce(new Error("Not found"));
    const { result } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await expect(result.current.openMessage(30)).rejects.toThrow("Not found");
    });
    expect(result.current.data?.messages.map((m) => m.id)).toEqual([99, 100]);
    expect(result.current.navigationError).toBeInstanceOf(Error);
  });
  it("merges overlapping pages and live messages without duplicates, then stops at the end", async () => {
    get
      .mockResolvedValueOnce(page([51, 52], 2))
      .mockResolvedValueOnce(page([50, 51], null));
    const { result, cache, key } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() =>
      cache.setQueryData<History>(key, (old) => ({
        ...old!,
        messages: [...old!.messages, message(53)],
      })),
    );
    await act(() => result.current.loadOlder());
    expect(get.mock.calls[1][2]).toBe(2);
    expect(result.current.data?.messages.map((m) => m.id)).toEqual([
      50, 51, 52, 53,
    ]);
    await act(() => result.current.loadOlder());
    expect(get).toHaveBeenCalledTimes(2);
  });
  it("keeps the same page available after failure and prevents simultaneous requests", async () => {
    get
      .mockResolvedValueOnce(page([51], 2))
      .mockRejectedValueOnce(new Error("Offline"));
    const { result } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.loadOlder());
    expect(result.current.olderError).toBeInstanceOf(Error);
    expect(result.current.data?.messages.map((m) => m.id)).toEqual([51]);
    let finish!: (value: ReturnType<typeof page>) => void;
    get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadOlder();
    });
    await act(() => result.current.loadOlder());
    expect(get).toHaveBeenCalledTimes(3);
    expect(result.current.loadingOlder).toBe(true);
    await act(async () => {
      finish(page([50], null));
      await pending;
    });
    expect(result.current.olderError).toBeNull();
    expect(result.current.loadingOlder).toBe(false);
    expect(get.mock.calls[2][2]).toBe(2);
  });
  it("retains older pages and the next page when refreshing the latest messages", async () => {
    get
      .mockResolvedValueOnce(page([51], 2))
      .mockResolvedValueOnce(page([1], 3))
      .mockResolvedValueOnce(page([52], 2));
    const { result } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.loadOlder());
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.data?.messages.map((m) => m.id)).toEqual([
        1, 51, 52,
      ]),
    );
    expect(result.current.data?.nextPage).toBe(3);
  });
  it("aborts an older-page request when leaving the room", async () => {
    get
      .mockResolvedValueOnce(page([51], 2))
      .mockImplementationOnce(() => new Promise(() => {}));
    const { result, unmount } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => {
      void result.current.loadOlder();
    });
    const signal = get.mock.calls[1][1]!;
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
