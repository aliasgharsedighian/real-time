import { replyInclude } from '../../modules/polling/message-include';
import { fileSelect } from '../../modules/files-upload/upload.policy';
// src/chat/chat.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../libs/db/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUserChats(userId: number) {
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
          include: { attachments: { select: fileSelect } },
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
    attachmentId?: string,
    replyToId?: number,
  ) {
    if (
      typeof content !== 'string' ||
      content.length > 10000 ||
      (!content.trim() && !attachmentId)
    )
      throw new BadRequestException(
        'A message needs text or an attachment (maximum 10000 characters).',
      );
    if (
      attachmentId !== undefined &&
      (typeof attachmentId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(attachmentId))
    )
      throw new BadRequestException('Invalid attachment.');
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
      if (attachmentId) {
        const claimed = await tx.uploadFile.updateMany({
          where: {
            id: attachmentId,
            ownerId: senderId,
            chatId,
            messageId: null,
            groupAvatar: null,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          data: { messageId: message.id },
        });
        if (claimed.count !== 1)
          throw new BadRequestException(
            'Attachment expired, already sent or unavailable.',
          );
      }
      return tx.message.findUniqueOrThrow({
        where: { id: message.id },
        include: {
          ...replyInclude,
          attachments: { select: fileSelect },
          sender: { select: { id: true, email: true, profile: true } },
          readStatuses: true,
        },
      });
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
      // Serialize with departures and deletion; a stale socket cannot create receipts after removal.
      await tx.$queryRaw`SELECT id FROM "Chat" WHERE id = ${chatId} FOR UPDATE`;
      if (
        !(await tx.chatParticipant.findUnique({
          where: { userId_chatId: { userId, chatId } },
        }))
      )
        throw new ForbiddenException('Conversation unavailable.');
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
