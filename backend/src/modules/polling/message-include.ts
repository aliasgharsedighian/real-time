import { fileSelect } from '../files-upload/upload.policy';
export const replyInclude = {
  forwardedFrom: { select: { id: true, email: true, profile: true } },
  replyTo: {
    include: {
      sender: { select: { id: true, email: true, profile: true } },
      attachments: { select: fileSelect },
    },
  },
} as const;
export const messageInclude = {
  ...replyInclude,
  sender: { select: { id: true, email: true, profile: true } },
  attachments: { select: fileSelect },
  readStatuses: true,
} as const;
