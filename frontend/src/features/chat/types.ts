import type { MediaFile } from "@/features/uploads/api";
import type { User } from "@/shared/lib/types";

export interface ReadReceipt {
  messageId: number;
  userId: number;
  readAt: string;
}
export interface MessageReader extends ReadReceipt {
  user: {
    id: number;
    email: string | null;
    profile: {
      firstname: string | null;
      lastname: string | null;
      avatarId?: string | null;
    } | null;
  };
}
export interface Reaction {
  userId: number;
  emoji: string;
  user?: MessageReader["user"];
}
export interface ReactionUpdate {
  chatId: number;
  messageId: number;
  reactionVersion: number;
  reactions: Reaction[];
}
export type PinnedMessage = Pick<
  Message,
  "id" | "content" | "createdAt" | "sender" | "attachments"
>;

export interface Message {
  kind?:
    | "TEXT"
    | "MEMBER_LEFT"
    | "MEMBER_REMOVED"
    | "MEMBER_ADDED"
    | "GROUP_PHOTO_CHANGED"
    | "GROUP_PHOTO_REMOVED";
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  editedAt?: string | null;
  forwarded?: boolean;
  forwardedFromId?: number | null;
  forwardedFrom?: User | null;
  savedFrom?: { id: number; chatId: number } | null;
  replyToId?: number | null;
  replyTo?: Message | null;
  attachments?: MediaFile[];
  createdAt: string;
  sender?: User;
  readStatuses?: ReadReceipt[];
  reactions?: Reaction[];
  reactionVersion?: number;
  pinnedAt?: string | null;
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
  savedOwnerId?: number | null;
  muted?: boolean;
  myRole?: "OWNER" | "MEMBER";
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
  firstUnreadId?: number | null;
  users: Participant[];
}
export interface History {
  window?: Pick<MessageWindow, "beforeId" | "afterId"> & { focusId: number };
  nextPage?: number | null;
  olderCursor?: number | null;
  chat?: ChatDetails;
  messages: Message[];
  users: Participant[];
  unreadIds: number[];
  unreadCount?: number;
}
export interface MessageWindow {
  messages: Message[];
  unreadIds?: number[];
  beforeId: number | null;
  afterId: number | null;
}
export interface MessageSearchPage {
  messages: (Pick<
    Message,
    "id" | "chatId" | "senderId" | "createdAt" | "content" | "sender"
  > & {
    music?: { title: string | null; artist: string | null }[];
  })[];
  nextCursor: number | null;
}
export interface TypingEvent {
  chatId: number;
  userId: number;
  username: string;
}
