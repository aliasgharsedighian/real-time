import type {
  History,
  HistoryResponse,
  Message,
  ReadReceipt,
  ReactionUpdate,
} from "./types";

export function keepLatestReactions(
  message: Message,
  previous?: Message,
): Message {
  return previous &&
    (previous.reactionVersion ?? 0) > (message.reactionVersion ?? 0)
    ? {
        ...message,
        reactionVersion: previous.reactionVersion,
        reactions: previous.reactions,
      }
    : message;
}

export function preserveReactions(messages: Message[], previous?: Message[]) {
  if (!previous?.length) return messages;
  const byId = new Map(previous.map((message) => [message.id, message]));
  return messages.map((message) =>
    keepLatestReactions(message, byId.get(message.id)),
  );
}

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
        ...keepLatestReactions(message, previous),
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

// Switch to a stable ID cursor after deletion so offset pagination cannot skip older messages.
export function removeMessagesFromHistory(
  history: History,
  ids: number[],
): History {
  const removed = new Set(ids);
  const before =
    history.olderCursor ??
    (history.nextPage ? history.messages[0]?.id : undefined);
  return {
    ...history,
    nextPage: before ? null : history.nextPage,
    olderCursor: before,
    messages: history.messages
      .filter((message) => !removed.has(message.id))
      .map((message) =>
        removed.has(message.replyToId ?? 0)
          ? { ...message, replyToId: null, replyTo: null }
          : message,
      ),
    unreadIds: history.unreadIds.filter((id) => !removed.has(id)),
  };
}

export function applyReactionUpdate(
  history: History | undefined,
  update: ReactionUpdate,
) {
  if (!history) return history;
  return {
    ...history,
    messages: history.messages.map((message) =>
      message.id === update.messageId &&
      (message.reactionVersion ?? 0) < update.reactionVersion
        ? {
            ...message,
            reactionVersion: update.reactionVersion,
            reactions: update.reactions,
          }
        : message,
    ),
  };
}
