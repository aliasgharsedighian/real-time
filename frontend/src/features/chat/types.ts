import type { MediaFile } from "@/features/uploads/api";
import type { User } from "@/shared/lib/types";

export interface ReadReceipt {
  messageId: number;
  userId: number;
  readAt: string;
}
export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  attachments?: MediaFile[];
  createdAt: string;
  sender?: User;
  readStatuses?: ReadReceipt[];
}
export interface Participant {
  id: number;
  userId: number;
  chatId: number;
  user: User;
  role?: "OWNER" | "MEMBER";
  joinedAt?: string;
}
export interface Chat {
  id: number;
  isGroup: boolean;
  name?: string | null;
  avatarId?: string | null;
  createdAt: string;
  participants: Participant[];
  messages: Message[];
  _count?: { messages: number };
}
export type ChatDetails = Omit<Chat, "messages" | "_count">;

export interface HistoryResponse {
  chat?: ChatDetails;
  chats: Message[];
  unreadMessages: Message[];
  unreadCount: number;
  users: Participant[];
}
export interface History {
  chat?: ChatDetails;
  messages: Message[];
  users: Participant[];
  unreadIds: number[];
}
export interface TypingEvent {
  chatId: number;
  userId: number;
  username: string;
}
