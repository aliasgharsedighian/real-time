import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import {
  CreateChatRequestDto,
  PaginatedQueryRequestDto,
  SendMessageRequestDto,
} from './polling.request.dto';
import { PrsimaPollingRepository } from './polling.repository';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';

@Injectable()
export class GetMessagesService {
  constructor(
    private pollingRepo: PrsimaPollingRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getMessage(userId: number) {
    try {
      const allUserChats = await this.pollingRepo.getAllUserChats(userId);
      return {
        statusCode: HttpStatus.OK,
        message: 'get Message successfully',
        data: allUserChats,
      };
    } catch (error) {
      throw new Error(`Service Error "getMessage": ${error.message}`);
    }
  }

  async getChatContentsById(
    userId: number,
    chatId: number,
    queryParams: PaginatedQueryRequestDto,
  ) {
    try {
      // Verify user is a participant
      const isParticipant = await this.prisma.chatParticipant.findFirst({
        where: {
          chatId,
          userId,
        },
      });

      if (!isParticipant) {
        throw new ForbiddenException('You are not a participant in this chat.');
      }

      const chat = await this.pollingRepo.getChatContentsById(
        chatId,
        userId,
        queryParams,
      );
      return {
        statusCode: HttpStatus.OK,
        message: 'chat get successfully',
        data: chat,
      };
    } catch (error) {
      throw new Error(`Service Error "getChatContentsById": ${error.message}`);
    }
  }

  async GetUnreadChatMessage(chatId: number, userId: number) {
    try {
      const unreadMessages = await this.pollingRepo.getChatIdUnreadMessage(
        chatId,
        userId,
      );
      return {
        statusCode: HttpStatus.OK,
        message: 'unread chat message get successfully',
        data: unreadMessages,
      };
    } catch (error) {
      throw new Error(`Service Error "GetUnreadChatMessage": ${error.message}`);
    }
  }

  async sendMessage(senderUserId: number, dto: SendMessageRequestDto) {
    const chatId = dto.chatId;
    const content = dto.content;
    try {
      // Verify user is a participant
      const isParticipant = await this.prisma.chatParticipant.findFirst({
        where: {
          chatId: chatId,
          userId: senderUserId,
        },
        select: { id: true },
      });
      if (!isParticipant) {
        throw new Error('User is not a participant of this chat.');
      }

      const messageCreated = await this.pollingRepo.sendMessage(
        senderUserId,
        chatId,
        content,
      );

      return {
        statusCode: HttpStatus.CREATED,
        message: 'send Message successfully',
        data: messageCreated,
      };
    } catch (error) {
      throw new Error(`Service Error "sendMessage": ${error.message}`);
    }
  }

  async createChat(creatorUserId: number, dto: CreateChatRequestDto) {
    try {
      const participantUserIds = dto.participant;
      const firstMessageContent = dto.firstMessage;

      // Remove any accidental duplicate user IDs
      const uniqueParticipantIds = Array.from(new Set(participantUserIds));

      // Check if creator is included; if not, add them
      if (!uniqueParticipantIds.includes(creatorUserId)) {
        uniqueParticipantIds.unshift(creatorUserId);
      }

      // Optional: Check if all users exist (recommended for validation)
      const users = await this.prisma.user.findMany({
        where: { id: { in: uniqueParticipantIds } },
        select: { id: true },
      });
      if (users.length !== uniqueParticipantIds.length) {
        throw new Error('One or more users do not exist.');
      }

      const chatCreated = await this.pollingRepo.createChat(
        creatorUserId,
        uniqueParticipantIds,
        firstMessageContent,
      );

      return chatCreated;
    } catch (error) {
      throw new Error(`Service Error "createChat": ${error.message}`);
    }
  }
}
