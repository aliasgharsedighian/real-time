import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';

interface Typist {
  socketId: string;
  chatId: number;
  userId: number;
  username: string;
}
@Injectable()
export class ChatTypingService implements OnModuleDestroy {
  server?: Server;
  private readonly entries = new Map<string, Typist>();
  private key(socketId: string, chatId: number) {
    return `${socketId}:${chatId}`;
  }
  start(socketId: string, chatId: number, userId: number, username: string) {
    const key = this.key(socketId, chatId);
    this.entries.set(key, { socketId, chatId, userId, username });
    this.server
      ?.to(`chat:${chatId}`)
      .emit('typing:start', { chatId, userId, username });
  }
  stop(socketId: string, chatId: number) {
    const key = this.key(socketId, chatId);
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    if (
      ![...this.entries.values()].some(
        (other) => other.chatId === chatId && other.userId === entry.userId,
      )
    )
      this.server?.to(`chat:${chatId}`).emit('typing:stop', {
        chatId,
        userId: entry.userId,
        username: entry.username,
      });
  }
  remove(socketId: string, chatId?: number) {
    for (const entry of this.entries.values())
      if (
        entry.socketId === socketId &&
        (chatId === undefined || entry.chatId === chatId)
      )
        this.stop(socketId, entry.chatId);
  }
  removeMember(userId: number, chatId: number) {
    for (const entry of this.entries.values())
      if (entry.userId === userId && entry.chatId === chatId)
        this.stop(entry.socketId, chatId);
  }
  snapshot(chatId: number) {
    const users = new Map<
      number,
      { chatId: number; userId: number; username: string }
    >();
    for (const entry of this.entries.values())
      if (entry.chatId === chatId)
        users.set(entry.userId, {
          chatId,
          userId: entry.userId,
          username: entry.username,
        });
    return [...users.values()];
  }
  onModuleDestroy() {
    this.entries.clear();
  }
}
