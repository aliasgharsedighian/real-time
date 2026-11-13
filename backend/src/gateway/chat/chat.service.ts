import { messageInclude } from '../../modules/polling/message-include';
import {
  maxAlbumPhotos,
  messageAttachments,
} from '../../modules/files-upload/upload.policy';
// src/chat/chat.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import type { MessageReadStatus, Prisma } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSavedChat(userId: number) {
    const where = { savedOwnerId: userId };
    if (await this.prisma.chat.findUnique({ where, select: { id: true } }))
      return;

    await this.prisma.$transaction(async (tx) => {
      // Serialize first-time provisioning for this account across HTTP and sockets.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (await tx.chat.findUnique({ where, select: { id: true } })) return;
      await tx.chat.create({
        data: {
          savedOwnerId: userId,
          name: 'Saved Messages',
          participants: { create: { userId } },
        },
      });
    });
  }

  async getAllUserChats(userId: number) {
    await this.ensureSavedChat(userId);
    const chats = await this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, email: true, profile: true } },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                kind: 'TEXT',
                senderId: { not: userId },
                NOT: [
                  {
                    readStatuses: {
                      some: { userId },
                    },
                  },
                ],
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { attachments: messageAttachments },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return chats.map((chat) => ({
      ...chat,
      muted: chat.participants.find((p) => p.userId === userId)?.muted ?? false,
      myRole: chat.participants.find((p) => p.userId === userId)?.role,
      participants: chat.participants.filter((p) => p.userId !== userId),
    }));
  }

  async ensureParticipant(chatId: number, userId: number): Promise<boolean> {
    const participant = await this.prisma.chatParticipant.findFirst({
      where: { chatId, userId },
      select: { id: true },
    });
    return !!participant;
  }

  async createMessage(
    chatId: number,
    senderId: number,
    content: string,
    attachment?: string | string[],
    replyToId?: number,
  ) {
    const attachmentIds =
      attachment === undefined
        ? []
        : Array.isArray(attachment)
          ? attachment
          : [attachment];
    if (
      (attachment !== undefined && !attachmentIds.length) ||
      attachmentIds.length > maxAlbumPhotos ||
      new Set(attachmentIds).size !== attachmentIds.length ||
      attachmentIds.some(
        (id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id),
      )
    )
      throw new BadRequestException('Invalid attachments.');
    if (
      typeof content !== 'string' ||
      content.length > 10000 ||
      (!content.trim() && !attachmentIds.length)
    )
      throw new BadRequestException(
        'A message needs text or an attachment (maximum 10000 characters).',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Chat" WHERE id = ${chatId} FOR UPDATE`;
      if (
        !(await tx.chatParticipant.findUnique({
          where: { userId_chatId: { userId: senderId, chatId } },
        }))
      )
        throw new BadRequestException('Conversation unavailable.');
      if (
        replyToId !== undefined &&
        (!Number.isSafeInteger(replyToId) ||
          replyToId <= 0 ||
          !(await tx.message.findFirst({
            where: { id: replyToId, chatId, kind: 'TEXT' },
          })))
      )
        throw new BadRequestException('Reply message unavailable.');
      const message = await tx.message.create({
        data: { content, chatId, senderId, replyToId },
      });
      const draftCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const [position, id] of attachmentIds.entries()) {
        const claimed = await tx.uploadFile.updateMany({
          where: {
            id,
            ...(attachmentIds.length > 1 ? { kind: 'IMAGE' } : {}),
            ownerId: senderId,
            chatId,
            messageId: null,
            groupAvatar: null,
            createdAt: { gte: draftCutoff },
          },
          data: { messageId: message.id, position },
        });
        if (claimed.count !== 1)
          throw new BadRequestException(
            'Attachment expired, already sent or unavailable.',
          );
      }
      return tx.message.findUniqueOrThrow({
        where: { id: message.id },
        include: messageInclude,
      });
    });
  }

  private async lockReadMembership(
    tx: Prisma.TransactionClient,
    userId: number,
    chatId: number,
  ) {
    // Serialize reads with departures and message deletion.
    await tx.$queryRaw`SELECT id FROM "Chat" WHERE id = ${chatId} FOR UPDATE`;
    if (
      !(await tx.chatParticipant.findUnique({
        where: { userId_chatId: { userId, chatId } },
      }))
    )
      throw new ForbiddenException('Conversation unavailable.');
  }

  async markMessagesReadThrough(
    userId: number,
    chatId: number,
    throughMessageId: number,
  ) {
    if (
      !Number.isSafeInteger(throughMessageId) ||
      throughMessageId <= 0 ||
      throughMessageId > 2147483647
    )
      throw new BadRequestException('Invalid message ID');
    return this.prisma.$transaction(async (tx) => {
      await this.lockReadMembership(tx, userId, chatId);
      const anchor = await tx.message.findFirst({
        where: { id: throughMessageId, chatId },
        select: { id: true },
      });
      if (!anchor)
        throw new BadRequestException('Message not in conversation.');
      const receipts = await tx.$queryRaw<MessageReadStatus[]>`
        INSERT INTO "MessageReadStatus" ("messageId", "userId")
        SELECT m.id, ${userId}
        FROM "Message" m
        JOIN "Message" anchor ON anchor.id = ${anchor.id}
        WHERE m."chatId" = ${chatId}
          AND m."kind" = 'TEXT'
          AND m."senderId" <> ${userId}
          AND (m."createdAt", m.id) <= (anchor."createdAt", anchor.id)
          AND NOT EXISTS (
            SELECT 1 FROM "MessageReadStatus" r
            WHERE r."messageId" = m.id AND r."userId" = ${userId}
          )
        ON CONFLICT ("messageId", "userId") DO NOTHING
        RETURNING *
      `;
      const unreadCount = await tx.message.count({
        where: {
          chatId,
          kind: 'TEXT',
          senderId: { not: userId },
          readStatuses: { none: { userId } },
        },
      });
      return { receipts, unreadCount };
    });
  }

  async markMessagesRead(userId: number, messageIds: number[], chatId: number) {
    if (
      !Array.isArray(messageIds) ||
      messageIds.length > 1000 ||
      messageIds.some(
        (id) => !Number.isSafeInteger(id) || id <= 0 || id > 2147483647,
      )
    )
      throw new BadRequestException('Invalid message IDs');
    return this.prisma.$transaction(async (tx) => {
      await this.lockReadMembership(tx, userId, chatId);
      const allowed = await tx.message.findMany({
        where: {
          id: { in: messageIds },
          chatId,
          kind: 'TEXT',
          senderId: { not: userId },
        },
        select: { id: true },
      });
      const now = new Date();
      await tx.messageReadStatus.createMany({
        data: allowed.map(({ id: messageId }) => ({
          messageId,
          userId,
          readAt: now,
        })),
        skipDuplicates: true,
      });
      // First read time is immutable, including concurrent/repeated acknowledgements.
      return tx.messageReadStatus.findMany({
        where: { userId, messageId: { in: allowed.map((m) => m.id) } },
        orderBy: { messageId: 'asc' },
      });
    });
  }
}
