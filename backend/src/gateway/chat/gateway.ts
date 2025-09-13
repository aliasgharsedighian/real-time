import {
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    // You can attach auth here (e.g., token parsing) and disconnect if invalid
    // For simplicity we skip it.
    // client.data.userId = decodedUserId;
  }

  @SubscribeMessage('chat:list')
  async onGetAllChats(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: number },
  ) {
    try {
      const chats = await this.chatService.getAllUserChats(payload.userId);
      client.emit('chat:list', chats); // send back only to the requester
      return chats;
    } catch (err) {
      client.emit('error', {
        message: 'Failed to fetch chats',
        details: err.message,
      });
      throw err;
    }
  }

  // Client requests to join a chat room
  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: number; userId: number },
  ) {
    const ok = await this.chatService.ensureParticipant(
      payload.chatId,
      payload.userId,
    );
    if (!ok) {
      client.emit('error', { message: 'Not a participant' });
      return;
    }
    const room = `chat:${payload.chatId}`;
    await client.join(room);
    client.emit('chat:joined', { room, chatId: payload.chatId });
  }

  // Send a message -> persist -> broadcast
  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { chatId: number; senderId: number; content: string },
  ) {
    const ok = await this.chatService.ensureParticipant(
      payload.chatId,
      payload.senderId,
    );
    if (!ok) {
      client.emit('error', { message: 'Not a participant' });
      return;
    }
    const msg = await this.chatService.createMessage(
      payload.chatId,
      payload.senderId,
      payload.content,
    );

    const room = `chat:${payload.chatId}`;
    this.server.to(room).emit('message:new', msg);
    return msg;
  }

  // Mark messages as read
  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { chatId: number; userId: number; messageIds: number[] },
  ) {
    const ok = await this.chatService.ensureParticipant(
      payload.chatId,
      payload.userId,
    );
    if (!ok) {
      client.emit('error', { message: 'Not a participant' });
      return;
    }
    const readStatuses = await this.chatService.markMessagesRead(
      payload.userId,
      payload.messageIds,
      payload.chatId,
    );

    const room = `chat:${payload.chatId}`;
    // Broadcast each read receipt
    for (const rs of readStatuses) {
      this.server.to(room).emit('message:read', rs);
    }
    return readStatuses;
  }

  // Optional typing indicators
  @SubscribeMessage('typing:start')
  async onTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { chatId: number; userId: number; username: string },
  ) {
    const room = `chat:${payload.chatId}`;
    client.to(room).emit('typing:start', payload);
  }

  @SubscribeMessage('typing:stop')
  async onTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { chatId: number; userId: number; username: string },
  ) {
    const room = `chat:${payload.chatId}`;
    client.to(room).emit('typing:stop', payload);
  }
}
