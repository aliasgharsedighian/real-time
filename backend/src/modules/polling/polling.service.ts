import { ChatService } from '../../gateway/chat/chat.service';
import { ChatGateway } from '../../gateway/chat/gateway';
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  PaginatedQueryRequestDto,
  SendMessageRequestDto,
} from './polling.request.dto';
import { PrsimaPollingRepository } from './polling.repository';

@Injectable()
export class GetMessagesService {
  constructor(
    private readonly pollingRepo: PrsimaPollingRepository,
    private readonly chats: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  private async ensureParticipant(chatId: number, userId: number) {
    if (!(await this.chats.ensureParticipant(chatId, userId)))
      throw new ForbiddenException('User is not a participant of this chat.');
  }

  async getMessage(userId: number) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Chats loaded',
      data: await this.chats.getAllUserChats(userId),
    };
  }

  async getChatContentsById(
    userId: number,
    chatId: number,
    queryParams: PaginatedQueryRequestDto,
  ) {
    await this.ensureParticipant(chatId, userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Chat loaded',
      data: await this.pollingRepo.getChatContentsById(
        chatId,
        userId,
        queryParams,
      ),
    };
  }

  async GetUnreadChatMessage(chatId: number, userId: number) {
    await this.ensureParticipant(chatId, userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Unread messages loaded',
      data: await this.pollingRepo.getChatIdUnreadMessage(chatId, userId),
    };
  }

  async sendMessage(senderUserId: number, dto: SendMessageRequestDto) {
    await this.ensureParticipant(dto.chatId, senderUserId);
    if (dto.attachmentIds && dto.attachmentId)
      throw new BadRequestException('Invalid attachments.');
    const message = await this.chats.createMessage(
      dto.chatId,
      senderUserId,
      dto.content,
      dto.attachmentIds ?? dto.attachmentId,
      dto.replyToId,
    );
    this.gateway.broadcast(message);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Message sent',
      data: message,
    };
  }
}
