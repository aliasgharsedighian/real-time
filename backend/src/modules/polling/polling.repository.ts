import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';

@Injectable()
export class PrsimaPollingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUserChats(userId: number) {
    try {
      return this.prisma.chat.findMany({
        where: {
          participants: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          participants: {
            where: {
              userId: {
                not: userId,
              },
            },
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
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // latest message
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getChatContentsById(chatId: number, userId: number) {
    const page = 1;
    const limit = 20;
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
        sender: {
          select: {
            id: true,
            email: true,
            profile: true,
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
          where: {
            userId: {
              not: userId,
            },
          },
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

    return {
      users: users?.participants,
      chats: chat.reverse(),
    };
  }

  async createChat(
    creatorUserId: number,
    participantUserIds: number[],
    firstMessageContent: string,
  ) {
    try {
      // Remove any accidental duplicate user IDs
      const uniqueParticipantIds = Array.from(new Set(participantUserIds));

      const createdChat = this.prisma.chat.create({
        data: {
          participants: {
            create: uniqueParticipantIds.map((id) => ({
              user: { connect: { id } },
            })),
          },
          messages: firstMessageContent
            ? {
                create: {
                  content: firstMessageContent,
                  sender: { connect: { id: creatorUserId } },
                },
              }
            : undefined,
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
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return createdChat;
    } catch (error) {
      throw error;
    }
  }

  async sendMessage(senderUserId: number, chatId: number, content: string) {
    try {
      const message = await this.prisma.message.create({
        data: {
          content: content,
          chat: { connect: { id: chatId } },
          sender: { connect: { id: senderUserId } },
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              profile: true,
            },
          },
        },
      });

      return message;
    } catch (error) {
      throw error;
    }
  }
}
