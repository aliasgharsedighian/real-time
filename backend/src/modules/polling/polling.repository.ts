import { fileSelect } from '../files-upload/upload.policy';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';
import { PaginatedQueryRequestDto } from './polling.request.dto';

@Injectable()
export class PrsimaPollingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getChatContentsById(
    chatId: number,
    userId: number,
    queryparams: PaginatedQueryRequestDto,
  ) {
    const page = queryparams?.page || 1;
    const limit = queryparams?.limit || 500;
    const skip = (+page - 1) * +limit;
    const chat = await this.prisma.message.findMany({
      where: {
        chatId: chatId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        attachments: { select: fileSelect },
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
              not: userId,
            },
          },
        },
      },
    });

    const users = await this.prisma.chat.findUnique({
      where: {
        id: chatId,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        chatId,
        kind: 'TEXT',
        senderId: { not: userId },
        NOT: [
          {
            readStatuses: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        attachments: { select: fileSelect },
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
              not: userId,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      unreadCount: unreadMessages.length,
      users: users?.participants.filter((p) => p.userId !== userId),
      chat: users,
      chats: chat.reverse(),
      unreadMessages,
    };
  }

  async getChatIdUnreadMessage(chatId: number, userId: number) {
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        chatId: chatId,
        kind: 'TEXT',
        senderId: {
          not: userId,
        },
        readStatuses: {
          none: {
            userId: userId,
          },
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return unreadMessages;
  }
}
