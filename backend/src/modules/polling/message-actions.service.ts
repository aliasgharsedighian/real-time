import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat/gateway';
import { uploadRoot } from '../files-upload/upload.policy';
import { messageInclude } from './message-include';

@Injectable()
export class MessageActionsService {
  private readonly logger = new Logger(MessageActionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
  ) {}
  private async member(
    tx: Prisma.TransactionClient,
    chatId: number,
    userId: number,
  ) {
    await tx.$queryRaw`SELECT id FROM "Chat" WHERE id = ${chatId} FOR UPDATE`;
    const chat = await tx.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });
    const member = chat?.participants.find((p) => p.userId === userId);
    if (!member || !chat)
      throw new NotFoundException('Conversation unavailable.');
    return { chat, member, users: chat.participants.map((p) => p.userId) };
  }
  private async removeFiles(keys: string[]) {
    await Promise.all(
      keys.map((key) =>
        rm(join(uploadRoot(), key), { force: true }).catch(() => {
          this.logger.error(
            'Deleted media could not be unlinked; orphan cleanup will retry.',
          );
        }),
      ),
    );
  }
  async sync(chatId: number, userId: number, ids: number[]) {
    const messages = await this.prisma.$transaction(async (tx) => {
      await this.member(tx, chatId, userId);
      return tx.message.findMany({
        where: { chatId, id: { in: ids } },
        include: messageInclude,
      });
    });
    return { data: messages, message: 'Messages synchronized' };
  }
  async deleteChat(chatId: number, userId: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      const { chat, member, users } = await this.member(tx, chatId, userId);
      if (chat.isGroup && member.role !== 'OWNER')
        throw new ForbiddenException(
          'Only the group owner can delete the group.',
        );
      const files = await tx.uploadFile.findMany({
        where: { chatId },
        select: { storageKey: true },
      });
      await tx.chat.update({ where: { id: chatId }, data: { avatarId: null } });
      await tx.uploadFile.deleteMany({ where: { chatId } });
      await tx.message.deleteMany({ where: { chatId } });
      await tx.chatParticipant.deleteMany({ where: { chatId } });
      await tx.chat.delete({ where: { id: chatId } });
      return { users, keys: files.map((f) => f.storageKey) };
    });
    this.gateway.chatDeleted(chatId, result.users);
    await this.removeFiles(result.keys);
    return { data: null, message: 'Conversation permanently deleted' };
  }
  async mute(chatId: number, userId: number, muted: boolean) {
    await this.prisma.$transaction(async (tx) => {
      await this.member(tx, chatId, userId);
      await tx.chatParticipant.update({
        where: { userId_chatId: { userId, chatId } },
        data: { muted },
      });
    });
    this.gateway.notifyChatChanged(chatId, [userId]);
    return { data: { muted }, message: 'Notifications updated' };
  }
  async edit(
    chatId: number,
    userId: number,
    messageId: number,
    content: string,
  ) {
    const { message, users } = await this.prisma.$transaction(async (tx) => {
      const { users } = await this.member(tx, chatId, userId);
      const old = await tx.message.findFirst({
        where: { id: messageId, chatId, kind: 'TEXT', senderId: userId },
        include: { attachments: true },
      });
      if (!old)
        throw new ForbiddenException('You can only edit your own messages.');
      if (!content.trim() && !old.attachments.length)
        throw new BadRequestException('Message cannot be empty.');
      const message = await tx.message.update({
        where: { id: messageId },
        data: { content, editedAt: new Date() },
        include: messageInclude,
      });
      return { message, users };
    });
    this.gateway.messagesChanged(chatId, users, 'message:updated', message);
    return { data: message, message: 'Message edited' };
  }
  async deleteMessages(chatId: number, userId: number, ids: number[]) {
    const result = await this.prisma.$transaction(async (tx) => {
      const { users } = await this.member(tx, chatId, userId);
      const messages = await tx.message.findMany({
        where: { chatId, id: { in: ids }, kind: 'TEXT' },
        include: { attachments: true },
      });
      if (messages.length !== new Set(ids).size)
        throw new NotFoundException('Message unavailable.');
      if (messages.some((m) => m.senderId !== userId))
        throw new ForbiddenException('You can only delete your own messages.');
      const files = messages.flatMap((m) => m.attachments);
      await tx.uploadFile.deleteMany({
        where: { messageId: { in: ids }, chatId },
      });
      await tx.message.deleteMany({ where: { chatId, id: { in: ids } } });
      return { users, keys: files.map((f) => f.storageKey) };
    });
    this.gateway.messagesChanged(chatId, result.users, 'message:deleted', {
      chatId,
      messageIds: ids,
    });
    await this.removeFiles(result.keys);
    return { data: null, message: 'Messages permanently deleted' };
  }
  async forward(
    chatId: number,
    userId: number,
    ids: number[],
    targetChatId: number,
  ) {
    const copied: string[] = [];
    let committed = false;
    try {
      const messages = await this.prisma.$transaction(
        async (tx) => {
          for (const id of [...new Set([chatId, targetChatId])].sort(
            (a, b) => a - b,
          ))
            await this.member(tx, id, userId);
          const source = await tx.message.findMany({
            where: { chatId, id: { in: ids }, kind: 'TEXT' },
            orderBy: { id: 'asc' },
            include: { attachments: true },
          });
          if (source.length !== new Set(ids).size)
            throw new NotFoundException('Message unavailable.');
          const result: Awaited<
            ReturnType<
              typeof tx.message.findUniqueOrThrow<{
                where: { id: number };
                include: typeof messageInclude;
              }>
            >
          >[] = [];
          for (const message of source) {
            const forwarded = await tx.message.create({
              data: {
                chatId: targetChatId,
                senderId: userId,
                content: message.content,
                forwarded: true,
              },
            });
            for (const file of message.attachments) {
              const storageKey = `media/${randomUUID()}${extname(file.storageKey)}`;
              copied.push(storageKey);
              await cp(
                join(uploadRoot(), file.storageKey),
                join(uploadRoot(), storageKey),
              );
              await tx.uploadFile.create({
                data: {
                  storageKey,
                  kind: file.kind,
                  mimeType: file.mimeType,
                  size: file.size,
                  width: file.width,
                  height: file.height,
                  duration: file.duration,
                  ownerId: userId,
                  chatId: targetChatId,
                  messageId: forwarded.id,
                },
              });
            }
            result.push(
              await tx.message.findUniqueOrThrow({
                where: { id: forwarded.id },
                include: messageInclude,
              }),
            );
          }
          return result;
        },
        { timeout: 60000 },
      );
      committed = true;
      for (const message of messages) this.gateway.broadcast(message);
      return { data: messages, message: 'Messages forwarded' };
    } finally {
      if (!committed) await this.removeFiles(copied);
    }
  }
}
