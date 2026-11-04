import type { History, HistoryResponse, Message, ReadReceipt } from "./types";

export function mergeMessages(...groups: Message[][]): Message[] {
  const messages = new Map<number, Message>();
  for (const group of groups)
    for (const message of group) {
      const previous = messages.get(message.id);
      const receipts = new Map<number, ReadReceipt>();
      for (const receipt of [
        ...(previous?.readStatuses ?? []),
        ...(message.readStatuses ?? []),
      ])
        receipts.set(receipt.userId, receipt);
      messages.set(message.id, {
        ...previous,
        ...message,
        readStatuses: [...receipts.values()],
      });
    }
  return [...messages.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
}

// The existing API returns overlapping history/unread arrays. Normalize once at the boundary.
export function normalizeHistory(data: HistoryResponse): History {
  return {
    chat: data.chat,
    messages: mergeMessages(data.chats ?? [], data.unreadMessages ?? []),
    users: data.users ?? [],
    unreadIds: (data.unreadMessages ?? []).map((message) => message.id),
  };
}

export function applyReceipt(
  messages: Message[],
  receipt: ReadReceipt,
): Message[] {
  return messages.map((message) =>
    message.id !== receipt.messageId
      ? message
      : {
          ...message,
          readStatuses: [
            ...(message.readStatuses ?? []).filter(
              (entry) => entry.userId !== receipt.userId,
            ),
            receipt,
          ],
        },
  );
}
