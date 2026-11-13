import { ApiTags } from '@nestjs/swagger';
import { DocumentBearerAuth, DocumentEndpoint } from '../../documentation/http';
import {
  array,
  boolean,
  envelope,
  nullData,
  object,
  ref,
} from '../../documentation/schemas';
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

@ApiTags('Chats and messages')
@DocumentBearerAuth()
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
  @DocumentEndpoint(
    'List pinned messages',
    200,
    envelope(array(ref('PinnedMessage'))),
    [400, 404],
  )
  pinnedMessages(@Param() params: GetChatByIdParamsDto, @GetUser() user: User) {
    return this.actions.pinnedMessages(params.id, user.id);
  }

  @Put('realtime/chats/:id/messages/:messageId/pin')
  @DocumentEndpoint('Pin a message', 200, envelope(nullData), [400, 404])
  pinMessage(@Param() params: MessageReadersParamsDto, @GetUser() user: User) {
    return this.actions.setPin(params.id, user.id, params.messageId, true);
  }

  @Delete('realtime/chats/:id/messages/:messageId/pin')
  @DocumentEndpoint('Unpin a message', 200, envelope(nullData), [400, 404])
  unpinMessage(
    @Param() params: MessageReadersParamsDto,
    @GetUser() user: User,
  ) {
    return this.actions.setPin(params.id, user.id, params.messageId, false);
  }

  @Put('realtime/chats/:id/messages/:messageId/reaction')
  @DocumentEndpoint(
    'Set or remove a reaction on a regular message or group photo change',
    200,
    envelope(ref('ReactionState')),
    [400, 404],
  )
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
  @DocumentEndpoint(
    'List readers of your message',
    200,
    envelope(array(ref('Reader'))),
    [400, 404],
  )
  messageReaders(
    @Param() params: MessageReadersParamsDto,
    @GetUser() user: User,
  ) {
    return this.actions.readers(params.id, user.id, params.messageId);
  }

  @Post('realtime/chats/:id/messages/sync')
  @DocumentEndpoint(
    'Synchronize messages by ID',
    201,
    envelope(array(ref('Message'))),
    [400, 404],
  )
  syncMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: SyncMessagesDto,
  ) {
    return this.actions.sync(params.id, user.id, body.messageIds);
  }
  @Delete('realtime/chats/:id')
  @DocumentEndpoint(
    'Permanently delete a conversation',
    200,
    envelope(nullData),
    [400, 403, 404],
  )
  deleteChat(@Param() params: GetChatByIdParamsDto, @GetUser() user: User) {
    return this.actions.deleteChat(params.id, user.id);
  }
  @Patch('realtime/chats/:id/mute')
  @DocumentEndpoint(
    'Mute or unmute notifications',
    200,
    envelope(object({ muted: boolean })),
    [400, 404],
  )
  muteChat(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: MuteChatDto,
  ) {
    return this.actions.mute(params.id, user.id, body.muted);
  }
  @Patch('realtime/chats/:id/messages')
  @DocumentEndpoint(
    'Edit your message',
    200,
    envelope(ref('Message')),
    [400, 403, 404],
  )
  editMessage(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: EditMessageDto,
  ) {
    return this.actions.edit(params.id, user.id, body.messageId, body.content);
  }
  @Delete('realtime/chats/:id/messages')
  @DocumentEndpoint(
    'Permanently delete your messages',
    200,
    envelope(nullData),
    [400, 403, 404],
  )
  deleteMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Body() body: MessageIdsDto,
  ) {
    return this.actions.deleteMessages(params.id, user.id, body.messageIds);
  }
  @Post('realtime/chats/:id/forward')
  @DocumentEndpoint(
    'Forward messages to another chat',
    201,
    envelope(array(ref('Message'))),
    [400, 403, 404],
  )
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
  @DocumentEndpoint(
    'List shared media and link counts',
    200,
    envelope(ref('SharedContent')),
    [400, 403],
  )
  sharedContent(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: SharedContentDto,
  ) {
    return this.search.shared(params.id, user.id, query);
  }
  @Get('realtime/polling/:id/days')
  @DocumentEndpoint(
    'List message dates in a time zone',
    200,
    envelope(ref('MessageDays'), 200),
    [400, 403],
  )
  messageDays(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: MessageDaysDto,
  ) {
    return this.search.days(params.id, user.id, query);
  }

  @Get('realtime/polling/:id/search')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @DocumentEndpoint(
    'Search message text, song titles and artists',
    200,
    envelope(ref('MessageSearch'), 200),
    [400, 403],
  )
  searchMessages(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: SearchMessagesDto,
  ) {
    return this.search.search(params.id, user.id, query);
  }

  @Get('realtime/polling/:id/window')
  @DocumentEndpoint(
    'Get a window before, after, or around one message ID',
    200,
    envelope(ref('MessageWindow'), 200),
    [400, 403, 404],
  )
  messageWindow(
    @Param() params: GetChatByIdParamsDto,
    @GetUser() user: User,
    @Query() query: MessageWindowDto,
  ) {
    return this.search.window(params.id, user.id, query);
  }

  @Get(routesV1.polling.message)
  @DocumentEndpoint(
    'List conversations',
    200,
    envelope(array(ref('ChatListEntry')), 200),
  )
  async getMessage(@GetUser() user: User) {
    const result = await this.messageService.getMessage(user.id);
    return result;
  }

  @Get(routesV1.polling.getChatContentById)
  @DocumentEndpoint(
    'Get chat history (default page 1, limit 500)',
    200,
    envelope(ref('ChatHistory'), 200),
    [400, 403],
  )
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
  @DocumentEndpoint(
    'List unread messages',
    200,
    envelope(array(ref('UnreadMessage')), 200),
    [400, 403],
  )
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
  @DocumentEndpoint(
    'Send a message and optionally attach drafts',
    201,
    envelope(ref('Message'), 201),
    [400, 403],
  )
  async sendMessage(
    @Body() body: SendMessageRequestDto,
    @GetUser() user: User,
  ) {
    const result = await this.messageService.sendMessage(user.id, body);
    return result;
  }

  @Post(routesV1.polling.createChat)
  @DocumentEndpoint(
    'Create a direct chat or a named group',
    201,
    envelope(ref('ChatWithMembers'), 201),
    [400],
  )
  async createChat(@GetUser() user: User, @Body() body: CreateChatRequestDto) {
    const result = await this.groups.create(user.id, body);
    return result;
  }

  @Patch('realtime/groups/:id')
  @DocumentEndpoint(
    'Rename a group as owner',
    200,
    envelope(ref('ChatWithMembers')),
    [400, 403, 404],
  )
  renameGroup(
    @GetUser() user: User,
    @Param() params: GetChatByIdParamsDto,
    @Body() body: UpdateGroupRequestDto,
  ) {
    return this.groups.rename(params.id, user.id, body.name);
  }

  @Post('realtime/groups/:id/members')
  @DocumentEndpoint(
    'Add group members as owner',
    201,
    envelope(ref('ChatWithMembers')),
    [400, 403, 404],
  )
  addMembers(
    @GetUser() user: User,
    @Param() params: GetChatByIdParamsDto,
    @Body() body: AddGroupMembersRequestDto,
  ) {
    return this.groups.add(params.id, user.id, body.participant);
  }

  @Delete('realtime/groups/:id/members/:userId')
  @DocumentEndpoint(
    'Remove a member as owner or leave a group',
    200,
    envelope(nullData),
    [400, 403, 404],
  )
  removeMember(@GetUser() user: User, @Param() params: GroupMemberParamsDto) {
    return this.groups.remove(params.id, user.id, params.userId);
  }

  @Post('realtime/groups/:id/owner/:userId')
  @DocumentEndpoint(
    'Transfer group ownership to a member',
    201,
    envelope(ref('ChatWithMembers')),
    [400, 403, 404],
  )
  transferOwner(@GetUser() user: User, @Param() params: GroupMemberParamsDto) {
    return this.groups.transfer(params.id, user.id, params.userId);
  }
}
