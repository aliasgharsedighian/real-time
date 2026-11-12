import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import { NotificationPresenceService } from './notification-presence.service';
import { FirebasePushService } from './firebase-push.service';
import { ChatNotification, messagePreview } from './notification.types';
import { RegisterPushDto } from './notifications.dto';

// The broadcast path accepts both ordinary messages and group activity events.
export interface SentMessage {
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  kind?: string;
  createdAt: Date;
  attachments?: { kind: string }[];
  sender?: {
    email: string | null;
    profile: { firstname: string | null; lastname: string | null } | null;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: NotificationPresenceService,
    private readonly push: FirebasePushService,
  ) {}

  get configured() {
    return this.push.configured;
  }

  async register(userId: number, dto: RegisterPushDto) {
    // Serialize changes to an installation; token uniqueness also prevents duplicate devices.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.installationId}))`;
      await tx.pushSubscription.deleteMany({
        where: {
          token: dto.token,
          installationId: { not: dto.installationId },
        },
      });
      await tx.pushSubscription.upsert({
        where: { installationId: dto.installationId },
        create: { ...dto, userId },
        update: { token: dto.token, userId },
      });
      await tx.pushSubscription.deleteMany({
        where: {
          userId,
          updatedAt: { lt: new Date(Date.now() - 90 * 86400000) },
        },
      });
    });
  }
  async unregister(userId: number, installationId: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, installationId },
    });
  }

  // Called after commit, detached from message acknowledgements and HTTP responses.
  dispatch(server: Server, message: SentMessage) {
    if (message.kind && message.kind !== 'TEXT') return;
    void this.deliver(server, message).catch(() => {
      this.logger.warn(
        'Notification delivery failed. The message is already saved.',
      );
    });
  }
  private async deliver(server: Server, message: SentMessage) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: message.chatId },
      select: {
        isGroup: true,
        name: true,
        participants: { select: { userId: true, muted: true } },
      },
    });
    if (!chat) return;
    const rawSenderName =
      [message.sender?.profile?.firstname, message.sender?.profile?.lastname]
        .filter(Boolean)
        .join(' ') ||
      message.sender?.email ||
      'User';
    const senderName = Array.from(rawSenderName).slice(0, 100).join('');
    const body = messagePreview({
      ...message,
      attachments: message.attachments ?? [],
    });
    const pushRecipients: number[] = [];
    const notification = (recipientId: number): ChatNotification => ({
      type: 'chat.message',
      messageId: String(message.id),
      chatId: String(message.chatId),
      senderId: String(message.senderId),
      recipientId: String(recipientId),
      title: chat.isGroup ? chat.name || 'Group' : senderName,
      body: chat.isGroup ? `${senderName}: ${body}` : body,
      senderName,
      mediaKind: message.attachments?.[0]?.kind || 'TEXT',
      createdAt: message.createdAt.toISOString(),
    });
    const route = (userId: number) => {
      const destination = this.presence.destination(userId, message.chatId);
      if (destination.mode === 'in-app')
        server
          .to(destination.socketId)
          .emit('notification:new', notification(userId));
      return destination.mode;
    };
    for (const { userId, muted } of chat.participants) {
      server
        .to(`user:${userId}`)
        .emit('chat:updated', { chatId: message.chatId });
      if (userId === message.senderId || muted) continue;
      if (route(userId) === 'push') pushRecipients.push(userId);
    }
    if (!this.push.configured || !pushRecipients.length) return;
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        userId: { in: pushRecipients },
        updatedAt: { gte: new Date(Date.now() - 90 * 86400000) },
      },
    });
    // FCM requires one recipientId per user's payload, and <=500 tokens per request.
    for (const userId of pushRecipients) {
      const devices = subscriptions.filter((s) => s.userId === userId);
      // Opening the app during the subscription lookup still earns a banner,
      // including when the account has no registered device.
      if (route(userId) !== 'push') continue;
      for (let start = 0; start < devices.length; start += 500) {
        if (start > 0 && route(userId) !== 'push') break;
        const batch = devices.slice(start, start + 500);
        const response = await this.push.send({
          tokens: batch.map((s) => s.token),
          data: { ...notification(userId) },
          webpush: { headers: { TTL: '300', Urgency: 'high' } },
        });
        const invalid = response?.responses.flatMap((result, index) =>
          [
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token',
          ].includes(result.error?.code || '')
            ? [batch[index].token]
            : [],
        );
        if (invalid?.length)
          await this.prisma.pushSubscription.deleteMany({
            where: { token: { in: invalid } },
          });
      }
    }
  }
}
