import type { OpenAPIObject } from '@nestjs/swagger';
import type {
  SchemaObject,
  ReferenceObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { uploadPolicy } from '../modules/files-upload/upload.policy';

type Schema = SchemaObject | ReferenceObject;

export const integer = { type: 'integer', example: 42 } as const;
export const text = { type: 'string' } as const;
export const boolean = { type: 'boolean' } as const;
export const uuid = { type: 'string', format: 'uuid' } as const;
const timestamp = { type: 'string', format: 'date-time' } as const;
const nullable = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  nullable: true,
});
export const array = (items: Schema): SchemaObject => ({
  type: 'array',
  items,
});
export const object = (
  properties: Record<string, Schema>,
  optional: string[] = [],
): SchemaObject => ({
  type: 'object',
  properties,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
});
export const envelope = (data: Schema, status?: number, field = 'statusCode') =>
  object({
    ...(status === undefined
      ? {}
      : { [field]: { ...integer, example: status } }),
    message: text,
    data,
  });

const role = { type: 'string', enum: ['USER', 'ADMIN'] };
const memberRole = { type: 'string', enum: ['OWNER', 'MEMBER'] };
const profileSummary = {
  id: integer,
  firstname: nullable(text),
  lastname: nullable(text),
  address: nullable(text),
  avatarId: nullable(uuid),
};
const user = { id: integer, email: nullable({ ...text, format: 'email' }) };
const userAccount = {
  ...user,
  phoneNumber: nullable(text),
  role,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const chatUser = object({
  ...user,
  profile: nullable(
    object({ ...profileSummary, showLastSeen: boolean, userId: integer }),
  ),
});
const chat = {
  id: integer,
  isGroup: boolean,
  savedOwnerId: nullable(integer),
  name: nullable(text),
  avatarId: nullable(uuid),
  createdAt: timestamp,
};
const message = {
  id: integer,
  chatId: integer,
  senderId: integer,
  content: { ...text, example: 'Hello' },
  createdAt: timestamp,
  editedAt: nullable(timestamp),
  pinnedAt: nullable(timestamp),
  forwarded: boolean,
  forwardedFromId: nullable(integer),
  savedFromId: nullable(integer),
  replyToId: nullable(integer),
  kind: {
    type: 'string',
    enum: [
      'TEXT',
      'MEMBER_LEFT',
      'MEMBER_REMOVED',
      'MEMBER_ADDED',
      'GROUP_PHOTO_CHANGED',
      'GROUP_PHOTO_REMOVED',
    ],
  },
  reactionVersion: integer,
};

export const ref = (name: keyof typeof schemas): ReferenceObject => ({
  $ref: '#/components/schemas/' + name,
});
// Use a typed reference here without making inference of schemas recursive.
const component = (name: string): ReferenceObject => ({
  $ref: '#/components/schemas/' + name,
});

export const schemas = {
  ErrorResponse: object(
    {
      statusCode: { ...integer, example: 400 },
      message: { oneOf: [text, array(text)] },
      error: text,
    },
    ['error'],
  ),
  Tokens: object({
    accessToken: { ...text, example: 'example-access-token' },
    refreshToken: { ...text, example: 'example-refresh-token' },
  }),
  Profile: object({
    ...profileSummary,
    showLastSeen: boolean,
    userId: integer,
  }),
  User: object({ ...userAccount, profile: nullable(object(profileSummary)) }),
  UserWithPresenceSetting: object({
    ...userAccount,
    profile: nullable(object({ ...profileSummary, showLastSeen: boolean })),
  }),
  ChatUser: chatUser,
  ChatMember: object({
    id: integer,
    userId: integer,
    chatId: integer,
    role: memberRole,
    joinedAt: timestamp,
    muted: boolean,
    user: component('ChatUser'),
  }),
  Chat: object(chat),
  ChatWithMembers: object({
    ...chat,
    participants: array(component('ChatMember')),
  }),
  ChatListEntry: object({
    ...chat,
    participants: array(component('ChatMember')),
    muted: boolean,
    myRole: memberRole,
    _count: object({ messages: integer }),
    messages: array(
      object({ ...message, attachments: array(component('Attachment')) }),
    ),
  }),
  Attachment: object({
    id: uuid,
    kind: text,
    mimeType: text,
    size: integer,
    width: integer,
    height: integer,
    duration: nullable({ type: 'number' }),
    title: nullable(text),
    artist: nullable(text),
  }),
  UploadPolicy: object({
    avatarMaxBytes: { ...integer, example: uploadPolicy.avatarMaxBytes },
    imageMaxBytes: { ...integer, example: uploadPolicy.imageMaxBytes },
    videoMaxBytes: { ...integer, example: uploadPolicy.videoMaxBytes },
    videoMaxSeconds: { ...integer, example: uploadPolicy.videoMaxSeconds },
    audioMaxBytes: { ...integer, example: uploadPolicy.audioMaxBytes },
    audioMaxSeconds: { ...integer, example: uploadPolicy.audioMaxSeconds },
    musicMaxSeconds: { ...integer, example: uploadPolicy.musicMaxSeconds },
    audioMimeTypes: { ...array(text), example: uploadPolicy.audioMimeTypes },
    imageMimeTypes: { ...array(text), example: uploadPolicy.imageMimeTypes },
    videoMimeTypes: { ...array(text), example: uploadPolicy.videoMimeTypes },
  }),
  Receipt: object({
    id: integer,
    messageId: integer,
    userId: integer,
    readAt: timestamp,
  }),
  ReaderUser: object({
    ...user,
    profile: nullable(
      object({
        firstname: nullable(text),
        lastname: nullable(text),
        avatarId: nullable(uuid),
      }),
    ),
  }),
  Reader: object({
    messageId: integer,
    userId: integer,
    readAt: timestamp,
    user: component('ReaderUser'),
  }),
  Reaction: object({
    userId: integer,
    emoji: { ...text, example: '👍' },
    user: component('ReaderUser'),
  }),
  ReactionState: object({
    chatId: integer,
    messageId: integer,
    reactionVersion: integer,
    reactions: array(component('Reaction')),
  }),
  ReplyMessage: {
    ...object({
      ...message,
      sender: component('ChatUser'),
      attachments: array(component('Attachment')),
    }),
    nullable: true,
  },
  Message: object(
    {
      ...message,
      sender: component('ChatUser'),
      attachments: array(component('Attachment')),
      readStatuses: array(component('Receipt')),
      reactions: array(component('Reaction')),
      forwardedFrom: nullable(chatUser),
      savedFrom: nullable(object({ id: integer, chatId: integer })),
      replyTo: component('ReplyMessage'),
    },
    ['readStatuses'],
  ),
  UnreadMessage: object({ ...message, sender: object(user) }),
  PinnedMessage: object({
    id: integer,
    content: text,
    createdAt: timestamp,
    sender: component('ChatUser'),
    attachments: array(component('Attachment')),
  }),
  SearchHit: object(
    {
      id: integer,
      chatId: integer,
      senderId: integer,
      createdAt: timestamp,
      content: text,
      music: array(object({ title: nullable(text), artist: nullable(text) })),
      sender: component('ChatUser'),
    },
    ['sender'],
  ),
  SharedContent: object({
    counts: object({
      IMAGE: integer,
      VIDEO: integer,
      AUDIO: integer,
      MUSIC: integer,
      LINK: integer,
    }),
    messages: array(component('Message')),
    nextCursor: nullable(integer),
  }),
  MessageDays: object({
    days: array(
      object({
        date: { ...text, format: 'date' },
        messageId: integer,
      }),
    ),
  }),
  MessageSearch: object({
    messages: array(component('SearchHit')),
    nextCursor: nullable(integer),
  }),
  MessageWindow: object({
    messages: array(component('Message')),
    unreadIds: array(integer),
    beforeId: nullable(integer),
    afterId: nullable(integer),
  }),
  ChatHistory: object(
    {
      unreadCount: integer,
      firstUnreadId: nullable(integer),
      users: array(component('ChatMember')),
      chat: component('ChatWithMembers'),
      chats: array(component('Message')),
      unreadMessages: array(component('Message')),
    },
    ['users'],
  ),
} satisfies NonNullable<OpenAPIObject['components']>['schemas'];

export const nullData: SchemaObject = {
  type: 'object',
  nullable: true,
  enum: [null],
};
export const userNotFound = object({
  statusCode: { ...integer, enum: [404], example: 404 },
  message: { ...text, example: 'user not found' },
});
