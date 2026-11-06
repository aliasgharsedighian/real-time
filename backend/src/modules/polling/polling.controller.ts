import { SharedContentDto } from './shared-content.dto';
import { MessageActionsService } from './message-actions.service';
import {
  SyncMessagesDto,
  SetReactionDto,
  MessageReadersParamsDto,
  MessageIdsDto,
  ForwardMessagesDto,
  EditMessageDto,
  MuteChatDto,
} from './message-actions.dto';
import {
  Body,
  Patch,
  Put,
  Delete,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { GroupsService } from './groups.service';
import { GetMessagesService } from './polling.service';
import { JwtGuard } from 'src/libs/guard';
import { GetUser } from 'src/libs/decorators';
import { User } from '@prisma/client';
import { MessageSearchService } from './message-search.service';
import {
  MessageDaysDto,
  MessageWindowDto,
  SearchMessagesDto,
} from './message-search.dto';
import { Throttle } from '@nestjs/throttler';
import {
  CreateChatRequestDto,
  UpdateGroupRequestDto,
  AddGroupMembersRequestDto,
  GroupMemberParamsDto,
  GetChatByIdParamsDto,
  PaginatedQueryRequestDto,
  SendMessageRequestDto,
} from './polling.request.dto';

@Controller(routesV1.version)
@UseGuards(JwtGuard)
export class PollingController {
  constructor(
    private messageService: GetMessagesService,
    private groups: GroupsService,
    private search: MessageSearchService,
    private actions: MessageActionsService,
  ) {}

  @Get('realtime/chats/:id/pins')
  pinnedMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
  ) {
    return this.actions.pinnedMessages(params.id, user.id);
  }

  @Put('realtime/chats/:id/messages/:messageId/pin')
  pinMessage(@Param() params: MessageReadersParamsDto, @GetUser() user: User) {
    return this.actions.setPin(params.id, user.id, params.messageId, true);
  }

  @Delete('realtime/chats/:id/messages/:messageId/pin')
  unpinMessage(
    @Param() params: MessageReadersParamsDto,
    @GetUser() user: User,
  ) {
    return this.actions.setPin(params.id, user.id, params.messageId, false);
  }

  @Put('realtime/chats/:id/messages/:messageId/reaction')
  setReaction(
    @Param() params: MessageReadersParamsDto,
    @GetUser() user: User,
    @Body() body: SetReactionDto,
  ) {
    return this.actions.setReaction(
      params.id,
      user.id,
      params.messageId,
      body.emoji,
    );
  }

  @Get('realtime/chats/:id/messages/:messageId/readers')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  messageReaders(
    @Param() params: MessageReadersParamsDto,
    @GetUser() user: User,
  ) {
    return this.actions.readers(params.id, user.id, params.messageId);
  }

  @Post('realtime/chats/:id/messages/sync')
  syncMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: SyncMessagesDto,
  ) {
    return this.actions.sync(params.id, user.id, body.messageIds);
  }
  @Delete('realtime/chats/:id')
  deleteChat(@Param() params: GetChatByIdParamsDto, @GetUser() user: User) {
    return this.actions.deleteChat(params.id, user.id);
  }
  @Patch('realtime/chats/:id/mute')
  muteChat(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: MuteChatDto,
  ) {
    return this.actions.mute(params.id, user.id, body.muted);
  }
  @Patch('realtime/chats/:id/messages')
  editMessage(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: EditMessageDto,
  ) {
    return this.actions.edit(params.id, user.id, body.messageId, body.content);
  }
  @Delete('realtime/chats/:id/messages')
  deleteMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: MessageIdsDto,
  ) {
    return this.actions.deleteMessages(params.id, user.id, body.messageIds);
  }
  @Post('realtime/chats/:id/forward')
  forwardMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: ForwardMessagesDto,
  ) {
    return this.actions.forward(
      params.id,
      user.id,
      body.messageIds,
      body.targetChatId,
    );
  }

  @Get('realtime/polling/:id/shared')
  sharedContent(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: SharedContentDto,
  ) {
    return this.search.shared(params.id, user.id, query);
  }
  @Get('realtime/polling/:id/days')
  messageDays(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: MessageDaysDto,
  ) {
    return this.search.days(params.id, user.id, query);
  }

  @Get('realtime/polling/:id/search')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  searchMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: SearchMessagesDto,
  ) {
    return this.search.search(params.id, user.id, query);
  }

  @Get('realtime/polling/:id/window')
  messageWindow(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: MessageWindowDto,
  ) {
    return this.search.window(params.id, user.id, query);
  }

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
    const result = await this.groups.create(user.id, body);
    return result;
  }

  @Patch('realtime/groups/:id')
  renameGroup(
    @GetUser() user: User,
    @Param() params: GetChatByIdParamsDto,
    @Body() body: UpdateGroupRequestDto,
  ) {
    return this.groups.rename(params.id, user.id, body.name);
  }

  @Post('realtime/groups/:id/members')
  addMembers(
    @GetUser() user: User,
    @Param() params: GetChatByIdParamsDto,
    @Body() body: AddGroupMembersRequestDto,
  ) {
    return this.groups.add(params.id, user.id, body.participant);
  }

  @Delete('realtime/groups/:id/members/:userId')
  removeMember(@GetUser() user: User, @Param() params: GroupMemberParamsDto) {
    return this.groups.remove(params.id, user.id, params.userId);
  }

  @Post('realtime/groups/:id/owner/:userId')
  transferOwner(@GetUser() user: User, @Param() params: GroupMemberParamsDto) {
    return this.groups.transfer(params.id, user.id, params.userId);
  }
}
