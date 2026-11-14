// All values are strings to match FCM data-only messages. Never include private media URLs.
export interface ChatNotification {
  type: 'chat.message';
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

export function messagePreview(message: {
  content: string;
  attachments: { kind: string }[];
}) {
  const kind = message.attachments[0]?.kind;
  const label =
    kind === 'IMAGE'
      ? '📷 Photo'
      : kind === 'VIDEO'
        ? '🎬 Video'
        : kind === 'AUDIO'
          ? '🎤 Voice message'
          : kind === 'MUSIC'
            ? '🎵 Music'
            : kind === 'DOCUMENT'
              ? '📎 File'
              : '';
  const text = message.content.replace(/\s+/g, ' ').trim();
  return Array.from([label, text].filter(Boolean).join(' · ') || 'New message')
    .slice(0, 180)
    .join('');
}
