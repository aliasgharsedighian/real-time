import {
  NotificationsService,
  SentMessage,
} from '../../modules/notifications/notifications.service';
import { NotificationPresenceService } from '../../modules/notifications/notification-presence.service';
import {
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import { CallsService } from './calls.service';
import { PresenceService } from '../../modules/presence/presence.service';
import { ChatTypingService } from './chat-typing.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit {
  private readonly typingSequence = new WeakMap<Socket, Map<number, number>>();
  @WebSocketServer() server: Server;
  constructor(
    private readonly chatService: ChatService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly calls: CallsService,
    private readonly notifications: NotificationsService,
    private readonly presence: NotificationPresenceService,
    private readonly chatPresence: PresenceService,
    private readonly chatTyping: ChatTypingService,
  ) {}
  afterInit(server: Server) {
    this.calls.server = server;
    this.chatPresence.server = server;
    this.chatTyping.server = server;
    server.use((client, next) => {
      void this.authenticate(client).then(
        () => next(),
        () => next(new Error('Unauthorized')),
      );
    });
  }
  handleConnection(client: Socket) {
    const data = client.data as {
      userId: number;
      expiresAt: number;
      expiryTimer?: ReturnType<typeof setTimeout>;
    };
    data.expiryTimer = setTimeout(
      () => client.disconnect(true),
      Math.min(2_147_483_647, Math.max(0, data.expiresAt - Date.now())),
    );
    data.expiryTimer.unref();
    return this.chatPresence.connect(client.id, data.userId);
  }
  handleDisconnect(client: Socket) {
    clearTimeout(
      (client.data as { expiryTimer?: ReturnType<typeof setTimeout> })
        .expiryTimer,
    );
    this.chatTyping.remove(client.id);
    this.calls.disconnect(client);
    this.presence.remove(client.id);
    return this.chatPresence.disconnect(client.id);
  }
  @SubscribeMessage('call:list')
  async callList(@ConnectedSocket() client: Socket) {
    try {
      return await this.calls.list(this.userId(client));
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('call:config')
  callConfig(@ConnectedSocket() client: Socket) {
    try {
      this.userId(client);
      return this.calls.iceServers();
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('call:pending')
  callPending(@ConnectedSocket() client: Socket) {
    try {
      return this.calls.pending(this.userId(client));
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('call:start')
  async callStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number; mode: string },
  ) {
    try {
      return await this.calls.start(client, this.userId(client), payload);
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('call:accept')
  async callAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id: string },
  ) {
    try {
      return await this.calls.accept(client, this.userId(client), payload?.id);
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('call:end')
  async callEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id: string; failed?: boolean },
  ) {
    try {
      return await this.calls.end(
        client,
        this.userId(client),
        payload?.id,
        payload?.failed === true,
      );
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('call:connected')
  async callConnected(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id: string },
  ) {
    try {
      return await this.calls.connected(
        client,
        this.userId(client),
        payload?.id,
      );
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('call:signal')
  callSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id: string; signal: unknown },
  ) {
    try {
      return this.calls.signal(client, this.userId(client), payload);
    } catch (error) {
      return this.failure(client, error);
    }
  }
  private async authenticate(client: Socket) {
    const token: unknown = client.handshake.auth?.token;
    if (typeof token !== 'string') throw new Error('Unauthorized');
    const payload = await this.jwt.verifyAsync<{ sub: number; exp: number }>(
      token,
      { secret: process.env.JWT_SECRET },
    );
    if (
      !Number.isSafeInteger(payload.sub) ||
      !Number.isFinite(payload.exp) ||
      !(await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      }))
    )
      throw new Error('Unauthorized');
    const data = client.data as { userId: number; expiresAt: number };
    data.userId = payload.sub;
    data.expiresAt = payload.exp * 1000;
    await client.join(`user:${payload.sub}`);
  }
  private userId(client: Socket): number {
    const data = client.data as { userId?: number; expiresAt?: number };
    if (!data.userId || !data.expiresAt || Date.now() >= data.expiresAt) {
      client.disconnect(true);
      throw new Error('Please reconnect with a valid session.');
    }
    return data.userId;
  }
  private async participant(client: Socket, chatId: number) {
    const userId = this.userId(client);
    if (
      !Number.isSafeInteger(chatId) ||
      chatId <= 0 ||
      !(await this.chatService.ensureParticipant(chatId, userId))
    )
      throw new Error('Not a participant');
    return userId;
  }
  private failure(client: Socket, error: unknown) {
    const result = {
      message: error instanceof Error ? error.message : 'Chat request failed',
    };
    client.emit('error', result);
    return result;
  }
  @SubscribeMessage('notification:presence')
  notificationPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { active: boolean; chatId: number | null },
  ) {
    try {
      const userId = this.userId(client);
      if (typeof payload?.active !== 'boolean') return;
      this.chatPresence.touch(userId);
      // Only a room joined through participant authorization can be considered open.
      const chatId =
        Number.isSafeInteger(payload.chatId) &&
        client.rooms.has(`chat:${payload.chatId}`)
          ? payload.chatId
          : null;
      this.presence.update(client.id, {
        userId,
        active: payload.active,
        chatId,
        expiresAt: (client.data as { expiresAt: number }).expiresAt,
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
  @SubscribeMessage('chat:list')
  async onGetAllChats(@ConnectedSocket() client: Socket) {
    try {
      const chats = await this.chatService.getAllUserChats(this.userId(client));
      client.emit('chat:list', chats);
      return chats;
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number },
  ) {
    try {
      await this.participant(client, payload?.chatId);
      const room = `chat:${payload.chatId}`;
      await client.join(room);
      client.emit('chat:joined', { room, chatId: payload.chatId });
      for (const entry of this.chatTyping.snapshot(payload.chatId))
        client.emit('typing:start', entry);
      return { chatId: payload.chatId };
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('chat:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number },
  ) {
    this.chatTyping.remove(client.id, payload?.chatId);
    await client.leave(`chat:${payload?.chatId}`);
    return { ok: true };
  }
  @SubscribeMessage('typing:list')
  async typingList(@ConnectedSocket() client: Socket) {
    try {
      const members = await this.prisma.chatParticipant.findMany({
        where: { userId: this.userId(client) },
        select: { chatId: true },
      });
      const entries = members.flatMap(({ chatId }) =>
        this.chatTyping.snapshot(chatId),
      );
      client.emit('typing:list', entries);
      return entries;
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('chat:presence')
  async onPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number },
  ) {
    try {
      await this.participant(client, payload?.chatId);
      const snapshot = await this.chatPresence.snapshot(payload.chatId);
      client.emit('chat:presence', snapshot);
      return snapshot;
    } catch (error) {
      return this.failure(client, error);
    }
  }
  broadcast(message: SentMessage) {
    this.server.to(`chat:${message.chatId}`).emit('message:new', message);
    this.notifications.dispatch(this.server, message);
  }
  notifyChatChanged(chatId: number, userIds: number[]) {
    this.chatTyping.updateAudience(chatId, userIds);
    for (const userId of userIds)
      this.server?.to(`user:${userId}`).emit('chat:updated', { chatId });
  }
  chatDeleted(chatId: number, userIds: number[]) {
    this.calls.discardChat(chatId);
    for (const userId of userIds) this.removeChatMember(chatId, userId);
  }
  pinsChanged(chatId: number, userIds: number[]) {
    for (const userId of userIds)
      this.server?.to(`user:${userId}`).emit('message:pins', { chatId });
  }
  reactionsChanged(
    userIds: number[],
    payload: {
      chatId: number;
      messageId: number;
      reactionVersion: number;
      reactions: { userId: number; emoji: string }[];
    },
  ) {
    for (const userId of userIds)
      this.server?.to(`user:${userId}`).emit('message:reactions', payload);
  }
  messagesChanged(
    chatId: number,
    userIds: number[],
    event: string,
    payload: unknown,
  ) {
    for (const userId of userIds)
      this.server?.to(`user:${userId}`).emit(event, payload);
    this.notifyChatChanged(chatId, userIds);
  }
  removeChatMember(chatId: number, userId: number) {
    if (!this.server) return;
    this.chatTyping.removeMember(userId, chatId);
    this.server.to(`user:${userId}`).emit('chat:removed', { chatId });
    this.server.in(`user:${userId}`).socketsLeave(`chat:${chatId}`);
  }
  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      chatId: number;
      content: string;
      attachmentId?: string;
      attachmentIds?: string[];
      replyToId?: number;
    },
  ) {
    try {
      const userId = await this.participant(client, payload?.chatId);
      if (
        (payload.attachmentId !== undefined &&
          typeof payload.attachmentId !== 'string') ||
        (payload.attachmentIds !== undefined &&
          (!Array.isArray(payload.attachmentIds) ||
            payload.attachmentId !== undefined))
      )
        throw new Error('Invalid attachments.');
      const msg = await this.chatService.createMessage(
        payload.chatId,
        userId,
        payload.content,
        payload.attachmentIds ?? payload.attachmentId,
        payload.replyToId,
      );
      this.broadcast(msg);
      this.chatTyping.remove(client.id, payload.chatId);
      return msg;
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number; messageIds: number[] },
  ) {
    try {
      const userId = await this.participant(client, payload?.chatId);
      if (
        !Array.isArray(payload.messageIds) ||
        payload.messageIds.length > 1000 ||
        payload.messageIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
      )
        throw new Error('Invalid message IDs');
      const receipts = await this.chatService.markMessagesRead(
        userId,
        payload.messageIds,
        payload.chatId,
      );
      for (const receipt of receipts)
        this.server.to(`chat:${payload.chatId}`).emit('message:read', receipt);
      return receipts;
    } catch (error) {
      return this.failure(client, error);
    }
  }
  @SubscribeMessage('typing:start')
  async onTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number; username: string },
  ) {
    return this.typing(client, payload, 'typing:start');
  }
  @SubscribeMessage('typing:stop')
  async onTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number; username: string },
  ) {
    return this.typing(client, payload, 'typing:stop');
  }
  private async typing(
    client: Socket,
    payload: { chatId: number; username: string },
    event: string,
  ) {
    try {
      const sequence =
        this.typingSequence.get(client) ?? new Map<number, number>();
      this.typingSequence.set(client, sequence);
      const version = (sequence.get(payload?.chatId) ?? 0) + 1;
      sequence.set(payload?.chatId, version);
      const userId = await this.participant(client, payload?.chatId);
      if (
        !client.connected ||
        !client.rooms.has(`chat:${payload.chatId}`) ||
        sequence.get(payload.chatId) !== version
      )
        return;
      if (event === 'typing:stop')
        this.chatTyping.stop(client.id, payload.chatId);
      else {
        const user = await this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            email: true,
            profile: { select: { firstname: true, lastname: true } },
          },
        });
        const members = await this.prisma.chatParticipant.findMany({
          where: { chatId: payload.chatId },
          select: { userId: true },
        });
        if (
          !client.connected ||
          !client.rooms.has(`chat:${payload.chatId}`) ||
          sequence.get(payload.chatId) !== version
        )
          return;
        const username =
          [user.profile?.firstname, user.profile?.lastname]
            .filter(Boolean)
            .join(' ') ||
          user.email ||
          'Someone';
        this.chatTyping.start(
          client.id,
          payload.chatId,
          userId,
          username,
          members.map((member) => member.userId),
        );
      }
      return { ok: true };
    } catch (error) {
      return this.failure(client, error);
    }
  }
}
