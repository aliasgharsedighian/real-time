import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';
import { PaginatedQueryRequestDto } from './polling.request.dto';

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
          _count: {
            select: {
              messages: {
                where: {
                  chatId: 1,
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
              not: userId,
            },
          },
        },
      },
    });

    // Mark as read when someone views the chat

    await this.prisma.messageReadStatus.createMany({
      data: unreadMessages.map((msg) => ({
        userId,
        messageId: msg.id,
      })),
      skipDuplicates: true,
    });

    return {
      unreadCount: unreadMessages.length,
      users: users?.participants,
      chats:
        unreadMessages.length === 0
          ? chat.reverse()
          : chat
              .reverse()
              .filter((item) =>
                unreadMessages.some(
                  (unreadItem) => unreadItem?.id !== item?.id,
                ),
              )
              .concat(unreadMessages),
      unreadMessages,
    };
  }

  async getChatIdUnreadMessage(chatId: number, userId: number) {
    try {
      const unreadMessages = await this.prisma.message.findMany({
        where: {
          chatId: chatId,
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
      // Mark as read when someone views the chat

      await this.prisma.messageReadStatus.createMany({
        data: unreadMessages.map((msg) => ({
          userId,
          messageId: msg.id,
        })),
        skipDuplicates: true,
      });
      return unreadMessages;
    } catch (error) {
      throw error;
    }
  }

  async createChat(
    creatorUserId: number,
    participantUserIds: number[],
    firstMessageContent: string,
  ) {
    try {
      const uniqueParticipantIds = Array.from(new Set(participantUserIds));

      if (uniqueParticipantIds.length === 2) {
        const [userA, userB] = uniqueParticipantIds;

        // Find chat that is not a group and includes both users
        const existingChat = await this.prisma.chat.findFirst({
          where: {
            isGroup: false,
            participants: {
              some: { userId: userA },
            },
            AND: {
              participants: {
                some: { userId: userB },
              },
            },
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

        if (existingChat) {
          return {
            statusCode: HttpStatus.OK,
            message: 'Chat already exists',
            data: existingChat,
          };
        }

        // Create new one-on-one chat
        const newChat = await this.prisma.chat.create({
          data: {
            isGroup: false,
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

        return {
          statusCode: HttpStatus.CREATED,
          message: 'Chat created successfully',
          data: newChat,
        };
      }
      if (uniqueParticipantIds.length > 2) {
        return {
          statusCode: HttpStatus.CREATED,
          message: 'Chat created successfully',
          data: 'newChat',
        };
      }
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
          readStatuses: {
            where: {
              userId: {
                not: senderUserId,
              },
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
