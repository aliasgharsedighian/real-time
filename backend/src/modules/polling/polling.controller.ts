import {
  Body,
  Patch,
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
import { MessageWindowDto, SearchMessagesDto } from './message-search.dto';
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
  ) {}

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
