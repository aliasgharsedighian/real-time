// src/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaClient) {}

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
        chatId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: { id: true, email: true, phoneNumber: true, profile: true },
        },
      },
    });
    return message;
  }

  async markMessagesRead(userId: number, messageIds: number[]) {
    const now = new Date();
    // Upsert each read status (unique by messageId+userId)
    const ops = messageIds.map((messageId) =>
      this.prisma.messageReadStatus.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { readAt: now },
        create: { messageId, userId, readAt: now },
      }),
    );
    return Promise.all(ops);
  }
}
