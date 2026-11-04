import { fileSelect } from '../../modules/files-upload/upload.policy';
// src/chat/chat.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../libs/db/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUserChats(userId: number) {
    return this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          where: { userId: { not: userId } },
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
      const message = await tx.message.create({
        data: { content, chatId, senderId },
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
          attachments: { select: fileSelect },
          sender: { select: { id: true, email: true, profile: true } },
          readStatuses: true,
        },
      });
    });
  }

  async markMessagesRead(userId: number, messageIds: number[], chatId: number) {
    const now = new Date();
    // Upsert each read status (unique by messageId+userId)
    const allowed = await this.prisma.message.findMany({
      where: {
        id: { in: messageIds },
        chatId,
        kind: 'TEXT',
        senderId: { not: userId },
      },
      select: { id: true },
    });
    const ops = allowed.map(({ id: messageId }) =>
      this.prisma.messageReadStatus.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { readAt: now },
        create: { messageId, userId, readAt: now },
      }),
    );

    return Promise.all(ops);
  }
}
