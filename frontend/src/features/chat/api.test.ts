import { expect, it, vi } from "vitest";
import { api } from "@/shared/lib/api";
import { getHistory } from "./api";
vi.mock("@/shared/lib/api", async (original) => ({
  ...(await original<object>()),
  api: { get: vi.fn() },
}));
it("requests exactly 50 messages and uses the page size to find the next page", async () => {
  const chats = Array.from({ length: 50 }, (_, index) => ({
    id: index + 1,
    chatId: 7,
    senderId: 2,
    content: "Message",
    createdAt: "2026-11-04T10:00:00Z",
  }));
  vi.mocked(api.get).mockResolvedValueOnce({
    data: { data: { chats, unreadMessages: [], users: [], unreadCount: 0 } },
  });
  const signal = new AbortController().signal;
  expect((await getHistory(7, signal)).nextPage).toBe(2);
  expect(api.get).toHaveBeenCalledWith("realtime/polling/7", {
    params: { page: 1, limit: 50 },
    signal,
  });
  vi.mocked(api.get).mockResolvedValueOnce({
    data: {
      data: {
        chats: chats.slice(0, 5),
        unreadMessages: [],
        users: [],
        unreadCount: 0,
      },
    },
  });
  expect((await getHistory(7, signal, 2)).nextPage).toBeNull();
});
