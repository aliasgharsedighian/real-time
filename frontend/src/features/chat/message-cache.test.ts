import { describe, expect, it } from "vitest";
import { applyReceipt, mergeMessages, normalizeHistory } from "./message-cache";
import type { Message } from "./types";

const message = (id: number): Message => ({
  id,
  chatId: 7,
  senderId: 1,
  content: `message ${id}`,
  createdAt: "2026-11-03T10:00:00.000Z",
});

describe("message history compatibility", () => {
  it("retains a message returned only in unreadMessages and removes overlap", () => {
    const history = normalizeHistory({
      chats: [message(2), message(1)],
      unreadMessages: [message(2), message(3)],
      unreadCount: 2,
      users: [],
    });
    expect(history.messages.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(history.unreadIds).toEqual([2, 3]);
  });
  it("deduplicates a socket broadcast followed by the send acknowledgement", () => {
    expect(
      mergeMessages([message(1)], [message(2)], [message(2)]).map(
        (item) => item.id,
      ),
    ).toEqual([1, 2]);
  });
  it("preserves a read receipt when a delayed send acknowledgement arrives", () => {
    const read = {
      ...message(1),
      readStatuses: [
        { messageId: 1, userId: 2, readAt: "2026-11-03T10:01:00.000Z" },
      ],
    };
    expect(
      mergeMessages([read], [{ ...message(1), readStatuses: [] }])[0]
        .readStatuses,
    ).toEqual(read.readStatuses);
  });
  it("updates one reader without dropping other readers or messages", () => {
    const initial = [
      {
        ...message(1),
        readStatuses: [
          { messageId: 1, userId: 2, readAt: "old" },
          { messageId: 1, userId: 3, readAt: "other" },
        ],
      },
      message(2),
    ];
    const result = applyReceipt(initial, {
      messageId: 1,
      userId: 2,
      readAt: "new",
    });
    expect(result[0].readStatuses).toEqual([
      { messageId: 1, userId: 3, readAt: "other" },
      { messageId: 1, userId: 2, readAt: "new" },
    ]);
    expect(result[1]).toBe(initial[1]);
    expect(initial[0].readStatuses?.[0].readAt).toBe("old");
  });
});
