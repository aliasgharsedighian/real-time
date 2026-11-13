import { displayName } from "@/shared/lib/types";
import type { Chat } from "./types";

export const savedMessagesTitle = "Saved Messages";

export function chatTitle(
  chat: Pick<Chat, "savedOwnerId" | "isGroup" | "name" | "participants">,
) {
  if (chat.savedOwnerId) return savedMessagesTitle;
  if (chat.isGroup) return chat.name || "Group";
  return displayName(chat.participants[0]?.user);
}
