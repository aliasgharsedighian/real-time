import { api, unwrap } from "@/shared/lib/api";
import type { ApiResponse, User } from "@/shared/lib/types";
import { getSocket } from "./socket";
import { normalizeHistory } from "./message-cache";
import type { Chat, HistoryResponse } from "./types";

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

export async function getHistory(chatId: number, signal?: AbortSignal) {
  const { data } = await api.get<ApiResponse<HistoryResponse>>(
    `realtime/polling/${chatId}`,
    { params: { page: 1, limit: 100 }, signal },
  );
  return normalizeHistory(unwrap(data));
}

export async function searchUsers(search: string, signal?: AbortSignal) {
  const { data } = await api.post<ApiResponse<User[]>>(
    "realtime/search-user",
    { search },
    { signal },
  );
  return unwrap(data);
}

export async function createChat(participants: number[], firstMessage: string) {
  const { data } = await api.post<ApiResponse<Chat>>(
    "realtime/polling/create-chat",
    { participant: participants, firstMessage },
  );
  const chat = unwrap(data);
  if (!chat || typeof chat.id !== "number")
    throw new Error(
      "The server could not create this chat. Group chats are not yet supported by the current backend.",
    );
  return chat;
}
