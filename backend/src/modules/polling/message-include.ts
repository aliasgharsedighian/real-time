import { fileSelect } from '../files-upload/upload.policy';
export const reactionSelect = { userId: true, emoji: true } as const;
export const messageRelations = {
  reactions: { select: reactionSelect, orderBy: { userId: 'asc' } },
  forwardedFrom: { select: { id: true, email: true, profile: true } },
  replyTo: {
    include: {
      sender: { select: { id: true, email: true, profile: true } },
      attachments: { select: fileSelect },
    },
  },
} as const;
export const messageInclude = {
  ...messageRelations,
  sender: { select: { id: true, email: true, profile: true } },
  attachments: { select: fileSelect },
  readStatuses: true,
} as const;
