import { Injectable } from '@nestjs/common';

interface Presence {
  userId: number;
  active: boolean;
  chatId: number | null;
  updatedAt: number;
  expiresAt: number;
}

@Injectable()
export class NotificationPresenceService {
  private readonly connections = new Map<string, Presence>();

  update(socketId: string, presence: Omit<Presence, 'updatedAt'>) {
    this.connections.set(socketId, { ...presence, updatedAt: Date.now() });
  }
  remove(socketId: string) {
    this.connections.delete(socketId);
  }
  // An open socket alone does not mean that its owner is looking at the app.
  destination(userId: number, chatId: number) {
    const now = Date.now();
    const active: (Presence & { socketId: string })[] = [];
    for (const [socketId, entry] of this.connections) {
      if (entry.expiresAt <= now || now - entry.updatedAt > 60_000) {
        this.connections.delete(socketId);
        continue;
      }
      if (entry.userId === userId && entry.active)
        active.push({ ...entry, socketId });
    }
    if (active.some((entry) => entry.chatId === chatId))
      return { mode: 'silent' as const };
    const target = active.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return target
      ? { mode: 'in-app' as const, socketId: target.socketId }
      : { mode: 'push' as const };
  }
}
