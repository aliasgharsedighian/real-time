import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { GetMessagesService } from './polling.service';
import { JwtGuard } from 'src/libs/guard';
import { GetUser } from 'src/libs/decorators';
import { User } from '@prisma/client';
import {
  CreateChatRequestDto,
  GetChatByIdParamsDto,
  PaginatedQueryRequestDto,
  SendMessageRequestDto,
} from './polling.request.dto';

@Controller(routesV1.version)
@UseGuards(JwtGuard)
export class PollingController {
  constructor(private messageService: GetMessagesService) {}

  @Get(routesV1.polling.message)
  async getMessage(@GetUser() user: User) {
    const result = await this.messageService.getMessage(user.id);
    return result;
  }

  @Get(routesV1.polling.getChatContentById)
  async getMessageById(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() queryParams: PaginatedQueryRequestDto,
  ) {
    const result = await this.messageService.getChatContentsById(
      user.id,
      params.id,
      queryParams,
    );
    return result;
  }

  @Get(routesV1.polling.getChatIdUnreadMessage)
  async GetUnreadChatMessage(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
  ) {
    const result = await this.messageService.GetUnreadChatMessage(
      params.id,
      user.id,
    );
    return result;
  }

  @Post(routesV1.polling.message)
  async sendMessage(
    @Body() body: SendMessageRequestDto,
    @GetUser() user: User,
  ) {
    const result = await this.messageService.sendMessage(user.id, body);
    return result;
  }

  @Post(routesV1.polling.createChat)
  async createChat(@GetUser() user: User, @Body() body: CreateChatRequestDto) {
    const result = await this.messageService.createChat(user.id, body);
    return result;
  }
}
