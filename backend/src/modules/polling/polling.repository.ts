import { messageRelations } from './message-include';
import { messageAttachments } from '../files-upload/upload.policy';
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
      include: {
        ...messageRelations,
        attachments: messageAttachments,
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
    const unreadWhere = {
      chatId,
      kind: 'TEXT' as const,
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
    };
    const unreadCount = await this.prisma.message.count({ where: unreadWhere });
    const firstUnread =
      +page === 1 && unreadCount
        ? await this.prisma.message.findFirst({
            where: unreadWhere,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true },
          })
        : null;
    const unreadMessages = await this.prisma.message.findMany({
      where: { ...unreadWhere, id: { in: chat.map((message) => message.id) } },
      include: {
        ...messageRelations,
        attachments: messageAttachments,
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
      unreadCount,
      firstUnreadId: firstUnread?.id ?? null,
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
