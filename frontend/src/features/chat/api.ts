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
