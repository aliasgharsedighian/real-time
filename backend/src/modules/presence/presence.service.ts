import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../../libs/db/prisma/prisma.service';

const DAY = 86_400_000;
export function presenceView(
  user: {
    id: number;
    lastSeenAt: Date | null;
    profile: { showLastSeen: boolean } | null;
  },
  online: boolean,
  now = Date.now(),
) {
  const base = { userId: user.id, online };
  if (online) return { ...base, lastSeenAt: null, lastSeen: null };
  if (user.profile?.showLastSeen !== false)
    return {
      ...base,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      lastSeen: null,
    };
  // Never send the exact timestamp for a private last seen, including in socket snapshots.
  const age = user.lastSeenAt
    ? Math.max(0, now - user.lastSeenAt.getTime())
    : Infinity;
  const lastSeen =
    age < 3 * DAY ? 'recently' : age < 7 * DAY ? 'week' : 'month';
  return { ...base, lastSeenAt: null, lastSeen };
}

@Injectable()
export class PresenceService implements OnModuleDestroy {
  server?: Server;
  private readonly logger = new Logger(PresenceService.name);
  private readonly sockets = new Map<string, number>();
  private readonly pending = new Map<number, Promise<void>>();
  private readonly touched = new Map<number, number>();
  constructor(private readonly prisma: PrismaService) {}
  async onModuleDestroy() {
    await Promise.all(this.pending.values());
  }

  online(userId: number) {
    return [...this.sockets.values()].includes(userId);
  }
  connect(socketId: string, userId: number) {
    const wasOnline = this.online(userId);
    this.sockets.set(socketId, userId);
    return wasOnline ? Promise.resolve() : this.changed(userId);
  }
  disconnect(socketId: string) {
    const userId = this.sockets.get(socketId);
    this.sockets.delete(socketId);
    if (userId && !this.online(userId)) this.touched.delete(userId);
    return userId && !this.online(userId)
      ? this.changed(userId)
      : Promise.resolve();
  }
  touch(userId: number) {
    const now = Date.now();
    if (now - (this.touched.get(userId) ?? 0) < 30_000) return;
    this.touched.set(userId, now);
    // Heartbeats bound the persisted age if a process or device stops abruptly.
    // Preserve User.updatedAt: public contact responses expose it, so changing it
    // on presence writes would reveal a private last seen through another field.
    void this.prisma
      .$executeRaw`UPDATE "User" SET "lastSeenAt" = ${new Date(now)}
        WHERE "id" = ${userId} AND ("lastSeenAt" IS NULL OR "lastSeenAt" < ${new Date(now)})`.catch(
      () => this.logger.warn('Could not persist presence heartbeat'),
    );
  }
  private changed(userId: number) {
    // Serialize writes and events across fast disconnect/reconnect and multiple tabs.
    const task = (this.pending.get(userId) ?? Promise.resolve())
      .then(async () => {
        await this.prisma
          .$executeRaw`UPDATE "User" SET "lastSeenAt" = ${new Date()} WHERE "id" = ${userId}`;
        await this.publish(userId);
      })
      .catch((error: unknown) => {
        this.logger.error(
          'Could not update chat presence',
          error instanceof Error ? error.stack : undefined,
        );
      });
    this.pending.set(userId, task);
    void task.then(() => {
      if (this.pending.get(userId) === task) this.pending.delete(userId);
    });
    return task;
  }
  async snapshot(chatId: number) {
    const members = await this.prisma.chatParticipant.findMany({
      where: { chatId },
      select: {
        user: {
          select: {
            id: true,
            lastSeenAt: true,
            profile: { select: { showLastSeen: true } },
          },
        },
      },
    });
    return {
      chatId,
      users: members.map(({ user }) =>
        presenceView(user, this.online(user.id)),
      ),
    };
  }
  async publish(userId: number) {
    if (!this.server) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lastSeenAt: true,
        profile: { select: { showLastSeen: true } },
        chats: { select: { chatId: true } },
      },
    });
    if (!user) return;
    const view = presenceView(user, this.online(userId));
    for (const { chatId } of user.chats)
      this.server
        .to(`chat:${chatId}`)
        .emit('chat:presence', { chatId, users: [view] });
  }
}
