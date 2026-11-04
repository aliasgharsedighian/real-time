import type { MediaFile } from "@/features/uploads/api";
import type { User } from "@/shared/lib/types";

export interface ReadReceipt {
  messageId: number;
  userId: number;
  readAt: string;
}
export interface Message {
  kind?: "TEXT" | "MEMBER_LEFT" | "MEMBER_REMOVED";
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
  window?: Omit<MessageWindow, "messages"> & { focusId: number };
  nextPage?: number | null;
  chat?: ChatDetails;
  messages: Message[];
  users: Participant[];
  unreadIds: number[];
}
export interface MessageWindow {
  messages: Message[];
  beforeId: number | null;
  afterId: number | null;
}
export interface MessageSearchPage {
  messages: Message[];
  nextCursor: number | null;
}
export interface TypingEvent {
  chatId: number;
  userId: number;
  username: string;
}
