import { api, unwrap } from "@/shared/lib/api";
import type { ApiResponse, User } from "@/shared/lib/types";
import { getSocket } from "./socket";
import { normalizeHistory } from "./message-cache";
import type {
  Chat,
  HistoryResponse,
  MessageSearchPage,
  MessageWindow,
} from "./types";

export const chatKeys = {
  readers: (identity: string | undefined, chatId: number, messageId: number) =>
    ["message-readers", identity, chatId, messageId] as const,
  list: (identity?: string) => ["chats", identity] as const,
  history: (identity: string | undefined, id: number) =>
    ["messages", identity, id] as const,
};

export async function getChats(userId: number): Promise<Chat[]> {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
  // Nest returns an acknowledgement in addition to the legacy chat:list emission.
  const chats: Chat[] = await socket
    .timeout(8000)
    .emitWithAck("chat:list", { userId });
  if (!Array.isArray(chats)) throw new Error("Could not load your chats.");
  return [...chats].sort((a, b) =>
    (b.messages?.[0]?.createdAt ?? b.createdAt).localeCompare(
      a.messages?.[0]?.createdAt ?? a.createdAt,
    ),
  );
}

export const HISTORY_PAGE_SIZE = 50;

export async function getHistory(
  chatId: number,
  signal?: AbortSignal,
  page = 1,
) {
  const { data } = await api.get<ApiResponse<HistoryResponse>>(
    `realtime/polling/${chatId}`,
    { params: { page, limit: HISTORY_PAGE_SIZE }, signal },
  );
  const response = unwrap(data);
  return {
    ...normalizeHistory(response),
    nextPage: response.chats.length === HISTORY_PAGE_SIZE ? page + 1 : null,
  };
}

export async function searchUsers(search: string, signal?: AbortSignal) {
  const { data } = await api.post<ApiResponse<User[]>>(
    "realtime/search-user",
    { search },
    { signal },
  );
  return unwrap(data);
}

export async function searchMessages(
  chatId: number,
  q: string,
  beforeId?: number,
  signal?: AbortSignal,
) {
  return unwrap(
    (
      await api.get<ApiResponse<MessageSearchPage>>(
        `realtime/polling/${chatId}/search`,
        {
          params: { q, ...(beforeId ? { beforeId } : {}) },
          signal,
        },
      )
    ).data,
  );
}

export async function getMessageWindow(
  chatId: number,
  cursor: { aroundId?: number; beforeId?: number; afterId?: number },
  signal?: AbortSignal,
) {
  return unwrap(
    (
      await api.get<ApiResponse<MessageWindow>>(
        `realtime/polling/${chatId}/window`,
        { params: cursor, signal },
      )
    ).data,
  );
}

export async function getMessageDays(
  chatId: number,
  range: { from: string; to: string; timeZone: string },
  signal?: AbortSignal,
) {
  return unwrap(
    (
      await api.get<
        ApiResponse<{ days: { date: string; messageId: number }[] }>
      >(`realtime/polling/${chatId}/days`, { params: range, signal })
    ).data,
  );
}

export async function createChat(
  participants: number[],
  firstMessage = "",
  group?: { name: string },
) {
  const { data } = await api.post<ApiResponse<Chat>>(
    "realtime/polling/create-chat",
    {
      participant: participants,
      firstMessage,
      ...(group ? { isGroup: true, name: group.name } : {}),
    },
  );
  const chat = unwrap(data);
  if (!chat || typeof chat.id !== "number")
    throw new Error(
      "The server could not create this conversation. Please try again.",
    );
  return chat;
}

export async function renameGroup(id: number, name: string) {
  return unwrap(
    (await api.patch<ApiResponse<Chat>>(`realtime/groups/${id}`, { name }))
      .data,
  );
}
export async function addGroupMembers(id: number, participant: number[]) {
  return unwrap(
    (
      await api.post<ApiResponse<Chat>>(`realtime/groups/${id}/members`, {
        participant,
      })
    ).data,
  );
}
export async function removeGroupMember(id: number, userId: number) {
  return unwrap(
    (
      await api.delete<ApiResponse<null>>(
        `realtime/groups/${id}/members/${userId}`,
      )
    ).data,
  );
}
export async function transferGroupOwner(id: number, userId: number) {
  return unwrap(
    (await api.post<ApiResponse<Chat>>(`realtime/groups/${id}/owner/${userId}`))
      .data,
  );
}

export async function deleteChat(id: number) {
  await api.delete(`realtime/chats/${id}`);
}
export async function muteChat(id: number, muted: boolean) {
  await api.patch(`realtime/chats/${id}/mute`, { muted });
}
export async function editMessage(
  id: number,
  messageId: number,
  content: string,
) {
  return unwrap(
    (
      await api.patch<ApiResponse<import("./types").Message>>(
        `realtime/chats/${id}/messages`,
        { messageId, content },
      )
    ).data,
  );
}
export async function deleteMessages(id: number, messageIds: number[]) {
  await api.delete(`realtime/chats/${id}/messages`, { data: { messageIds } });
}
export async function forwardMessages(
  id: number,
  messageIds: number[],
  targetChatId: number,
) {
  return unwrap(
    (
      await api.post<ApiResponse<import("./types").Message[]>>(
        `realtime/chats/${id}/forward`,
        { messageIds, targetChatId },
      )
    ).data,
  );
}

export async function syncMessages(
  chatId: number,
  messageIds: number[],
  signal?: AbortSignal,
) {
  const messages: import("./types").Message[] = [];
  for (let offset = 0; offset < messageIds.length; offset += 1000) {
    messages.push(
      ...unwrap(
        (
          await api.post<ApiResponse<import("./types").Message[]>>(
            `realtime/chats/${chatId}/messages/sync`,
            { messageIds: messageIds.slice(offset, offset + 1000) },
            { signal },
          )
        ).data,
      ),
    );
  }
  return messages;
}

export async function getUserProfile(id: number, signal?: AbortSignal) {
  const user = unwrap(
    (await api.get<ApiResponse<User>>(`realtime/user/${id}`, { signal })).data,
  );
  if (!user?.id) throw new Error("This user is no longer available.");
  return user;
}
export type SharedKind = "IMAGE" | "VIDEO" | "AUDIO" | "LINK";
export interface SharedContent {
  counts: Record<SharedKind, number>;
  messages: import("./types").Message[];
  nextCursor: number | null;
}
export async function getSharedContent(
  id: number,
  kind?: SharedKind,
  beforeId?: number,
  signal?: AbortSignal,
) {
  return unwrap(
    (
      await api.get<ApiResponse<SharedContent>>(
        `realtime/polling/${id}/shared`,
        { params: { kind, beforeId }, signal },
      )
    ).data,
  );
}

export async function getMessageReaders(
  chatId: number,
  messageId: number,
  signal?: AbortSignal,
) {
  return unwrap(
    (
      await api.get<ApiResponse<import("./types").MessageReader[]>>(
        `realtime/chats/${chatId}/messages/${messageId}/readers`,
        { signal },
      )
    ).data,
  );
}

export async function setMessageReaction(
  chatId: number,
  messageId: number,
  emoji: string | null,
) {
  return unwrap(
    (
      await api.put<ApiResponse<import("./types").ReactionUpdate>>(
        `realtime/chats/${chatId}/messages/${messageId}/reaction`,
        { emoji },
      )
    ).data,
  );
}
