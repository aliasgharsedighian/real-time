export interface ChatNotification {
  type: "chat.message";
  messageId: string;
  chatId: string;
  recipientId: string;
  senderId: string;
  title: string;
  body: string;
  senderName: string;
  mediaKind: string;
  createdAt: string;
}

export function isChatNotification(value: unknown): value is ChatNotification {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return data.type === "chat.message" &&
    ["messageId", "chatId", "recipientId", "senderId"].every(
      (key) => typeof data[key] === "string" && /^[1-9]\d*$/.test(data[key] as string),
    ) && ["title", "body", "senderName", "mediaKind", "createdAt"].every(
      (key) => typeof data[key] === "string",
    );
}
