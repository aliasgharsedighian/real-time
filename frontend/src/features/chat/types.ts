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
  createdAt: string;
  sender?: User;
  readStatuses?: ReadReceipt[];
}
export interface Participant {
  id: number;
  userId: number;
  chatId: number;
  user: User;
}
export interface Chat {
  id: number;
  isGroup: boolean;
  createdAt: string;
  participants: Participant[];
  messages: Message[];
  _count?: { messages: number };
}
export interface HistoryResponse {
  chats: Message[];
  unreadMessages: Message[];
  unreadCount: number;
  users: Participant[];
}
export interface History {
  messages: Message[];
  users: Participant[];
  unreadIds: number[];
}
export interface TypingEvent {
  chatId: number;
  userId: number;
  username: string;
}
