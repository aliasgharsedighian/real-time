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

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() server: Server;
  constructor(
    private readonly chatService: ChatService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly calls: CallsService,
  ) {}
  afterInit(server: Server) {
    this.calls.server = server;
    server.use((client, next) => {
      void this.authenticate(client).then(
        () => next(),
        () => next(new Error('Unauthorized')),
      );
    });
  }
  handleDisconnect(client: Socket) {
    this.calls.disconnect(client);
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
    await client.leave(`chat:${payload?.chatId}`);
  }
  broadcast(message: { chatId: number }) {
    this.server.to(`chat:${message.chatId}`).emit('message:new', message);
  }
  notifyChatChanged(chatId: number, userIds: number[]) {
    for (const userId of userIds)
      this.server?.to(`user:${userId}`).emit('chat:updated', { chatId });
  }
  removeChatMember(chatId: number, userId: number) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit('chat:removed', { chatId });
    this.server.in(`user:${userId}`).socketsLeave(`chat:${chatId}`);
  }
  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { chatId: number; content: string; attachmentId?: string },
  ) {
    try {
      const userId = await this.participant(client, payload?.chatId);
      const msg = await this.chatService.createMessage(
        payload.chatId,
        userId,
        payload.content,
        payload.attachmentId,
      );
      this.broadcast(msg);
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
      const userId = await this.participant(client, payload?.chatId);
      client.to(`chat:${payload.chatId}`).emit(event, {
        chatId: payload.chatId,
        userId,
        username:
          typeof payload.username === 'string'
            ? payload.username.slice(0, 100)
            : '',
      });
    } catch (error) {
      return this.failure(client, error);
    }
  }
}
