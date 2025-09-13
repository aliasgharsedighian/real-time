// src/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaClient) {}

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

  async createMessage(chatId: number, senderId: number, content: string) {
    const message = await this.prisma.message.create({
      data: {
        content: content,
        chat: { connect: { id: chatId } },
        sender: { connect: { id: senderId } },
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        readStatuses: {
          where: {
            userId: {
              not: senderId,
            },
          },
        },
      },
    });
    return message;
  }

  async markMessagesRead(userId: number, messageIds: number[], chatId: number) {
    const now = new Date();
    // Upsert each read status (unique by messageId+userId)
    const ops = messageIds.map((messageId) =>
      this.prisma.messageReadStatus.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { readAt: now },
        create: { messageId, userId, readAt: now },
      }),
    );

    // Mark as read when someone views the chat

    const unreadMessages = await this.prisma.message.findMany({
      where: {
        chatId,
        NOT: [
          // { senderId: userId },
          {
            readStatuses: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    await this.prisma.messageReadStatus.createMany({
      data: unreadMessages.map((msg) => ({
        userId,
        messageId: msg.id,
      })),
      skipDuplicates: true,
    });

    return Promise.all(ops);
  }
}
