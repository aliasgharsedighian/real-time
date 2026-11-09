import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ChatGateway } from '../../gateway/chat/gateway';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import { MediaProcessorService } from './media-processor.service';
import { fileSelect, uploadPolicy, uploadRoot } from './upload.policy';

@Injectable()
export class FilesUploadService implements OnModuleInit, OnModuleDestroy {
  private active = 0;
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(FilesUploadService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: MediaProcessorService,
    private readonly gateway: ChatGateway,
  ) {}
  async onModuleInit() {
    await mkdir(join(uploadRoot(), 'media'), { recursive: true });
    await mkdir(join(uploadRoot(), 'tmp'), { recursive: true });
    this.timer = setInterval(
      () => void this.cleanup().catch((e) => this.logger.error(e)),
      60 * 60 * 1000,
    );
    this.timer.unref();
    void this.cleanup().catch((e) => this.logger.error(e));
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async ensureParticipant(chatId: number, userId: number) {
    if (
      !(await this.prisma.chatParticipant.findUnique({
        where: { userId_chatId: { userId, chatId } },
      }))
    )
      throw new ForbiddenException('You are not a participant of this chat.');
  }

  async upload(
    file: Express.Multer.File | undefined,
    ownerId: number,
    chatId?: number,
    groupAvatar = false,
    music = false,
  ) {
    if (!file) throw new BadRequestException('Choose a file to upload.');
    const avatar = chatId === undefined || groupAvatar;
    let output: string | undefined;
    let saved = false;
    let acquired = false;
    try {
      if (groupAvatar)
        await this.ensureGroupOwner(this.prisma, chatId!, ownerId);
      else if (!avatar) await this.ensureParticipant(chatId, ownerId);
      const image = uploadPolicy.imageMimeTypes.includes(file.mimetype);
      const video = uploadPolicy.videoMimeTypes.includes(file.mimetype);
      const audio = uploadPolicy.audioMimeTypes.includes(file.mimetype);
      if (
        (!image && !video && !audio) ||
        (avatar && !image) ||
        (music && !audio)
      )
        throw new BadRequestException('Unsupported file type.');
      const max = avatar
        ? uploadPolicy.avatarMaxBytes
        : image
          ? uploadPolicy.imageMaxBytes
          : audio
            ? uploadPolicy.audioMaxBytes
            : uploadPolicy.videoMaxBytes;
      if (!file.size || file.size > max)
        throw new BadRequestException(
          `File must be between 1 byte and ${max / 1024 / 1024} MB.`,
        );
      if (this.active >= 2)
        throw new ServiceUnavailableException(
          'Media processor is busy. Please try again shortly.',
        );
      this.active++;
      acquired = true;
      const storageKey = `media/${randomUUID()}.${image ? 'webp' : audio ? 'm4a' : 'mp4'}`;
      output = join(uploadRoot(), storageKey);
      const metadata = image
        ? await this.processor.image(file.path, output, avatar)
        : audio
          ? await this.processor.audio(
              file.path,
              output,
              music ? file.originalname : undefined,
            )
          : await this.processor.video(file.path, output);
      if (!avatar) {
        const record = await this.prisma.uploadFile.create({
          data: { ...metadata, storageKey, ownerId, chatId },
          select: fileSelect,
        });
        saved = true;
        return record;
      }
      if (groupAvatar) {
        const { chat, oldId } = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Chat" WHERE id = ${chatId!} FOR UPDATE`;
          const old = await this.ensureGroupOwner(tx, chatId!, ownerId);
          const record = await tx.uploadFile.create({
            data: { ...metadata, storageKey, ownerId, chatId },
          });
          const chat = await tx.chat.update({
            where: { id: chatId },
            data: { avatarId: record.id },
          });
          return { chat, oldId: old.avatarId };
        });
        saved = true;
        if (oldId)
          await this.removeUnused(oldId).catch((e) => this.logger.error(e));
        await this.notifyGroup(chat.id);
        return chat;
      }
      const result = await this.prisma.$transaction(async (tx) => {
        // Serialize replacements, including requests from different browser tabs/processes.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId} FOR UPDATE`;
        const old = await tx.profile.findUnique({
          where: { userId: ownerId },
          select: { avatarId: true },
        });
        const record = await tx.uploadFile.create({
          data: { ...metadata, storageKey, ownerId },
          select: fileSelect,
        });
        const profile = await tx.profile.upsert({
          where: { userId: ownerId },
          create: { userId: ownerId, avatarId: record.id },
          update: { avatarId: record.id },
        });
        return { profile, oldId: old?.avatarId };
      });
      saved = true;
      if (result.oldId)
        await this.removeUnused(result.oldId).catch((e) =>
          this.logger.error(e),
        );
      return result.profile;
    } finally {
      if (acquired) this.active--;
      await rm(file.path, { force: true });
      if (output && !saved) await rm(output, { force: true });
    }
  }

  private async ensureGroupOwner(
    tx: Prisma.TransactionClient,
    chatId: number,
    userId: number,
  ) {
    const chat = await tx.chat.findUnique({
      where: { id: chatId },
      include: { participants: { where: { userId }, select: { role: true } } },
    });
    if (!chat?.isGroup || chat.participants[0]?.role !== 'OWNER')
      throw new ForbiddenException(
        'Only the group owner can change the group photo.',
      );
    return chat;
  }

  private async notifyGroup(chatId: number) {
    const members = await this.prisma.chatParticipant.findMany({
      where: { chatId },
      select: { userId: true },
    });
    this.gateway.notifyChatChanged(
      chatId,
      members.map((p) => p.userId),
    );
  }

  async removeGroupAvatar(chatId: number, userId: number) {
    const { chat, oldId } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Chat" WHERE id = ${chatId} FOR UPDATE`;
      const old = await this.ensureGroupOwner(tx, chatId, userId);
      const chat = await tx.chat.update({
        where: { id: chatId },
        data: { avatarId: null },
      });
      return { chat, oldId: old.avatarId };
    });
    if (oldId)
      await this.removeUnused(oldId).catch((e) => this.logger.error(e));
    await this.notifyGroup(chatId);
    return chat;
  }

  async removeAvatar(userId: number) {
    const { profile, oldId } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const old = await tx.profile.findUnique({
        where: { userId },
        select: { avatarId: true },
      });
      const profile = await tx.profile.upsert({
        where: { userId },
        create: { userId },
        update: { avatarId: null },
      });
      return { profile, oldId: old?.avatarId };
    });
    if (oldId)
      await this.removeUnused(oldId).catch((e) => this.logger.error(e));
    return profile;
  }

  async removeDraft(id: string, ownerId: number) {
    const file = await this.prisma.uploadFile.findUnique({ where: { id } });
    if (!file || file.ownerId !== ownerId || file.messageId || !file.chatId)
      throw new NotFoundException('Draft file not found.');
    await this.removeUnused(id);
  }
  private async removeUnused(id: string) {
    const file = await this.prisma.uploadFile.findUnique({ where: { id } });
    if (!file) return;
    const result = await this.prisma.uploadFile.deleteMany({
      where: { id, messageId: null, avatar: null, groupAvatar: null },
    });
    if (result.count)
      await rm(join(uploadRoot(), file.storageKey), { force: true });
  }

  async readable(id: string, userId: number) {
    const file = await this.prisma.uploadFile.findUnique({
      where: { id },
      include: {
        avatar: { select: { id: true } },
        groupAvatar: { select: { id: true } },
      },
    });
    if (!file) throw new NotFoundException('File not found.');
    if (file.groupAvatar) {
      await this.ensureParticipant(file.groupAvatar.id, userId);
    } else if (!file.avatar) {
      if (!file.chatId) throw new NotFoundException('File not found.');
      await this.ensureParticipant(file.chatId, userId);
      if (!file.messageId && file.ownerId !== userId)
        throw new ForbiddenException();
    }
    return {
      path: join(uploadRoot(), file.storageKey),
      mimeType: file.mimeType,
    };
  }

  async cleanup() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const unused = await this.prisma.uploadFile.findMany({
      where: {
        createdAt: { lt: cutoff },
        messageId: null,
        avatar: null,
        groupAvatar: null,
      },
      select: { id: true },
      take: 500,
    });
    for (const file of unused) await this.removeUnused(file.id);
    // Also collect abandoned temporary files and output files from interrupted processes.
    for (const folder of ['tmp', 'media']) {
      for (const name of await readdir(join(uploadRoot(), folder))) {
        const path = join(uploadRoot(), folder, name);
        if ((await stat(path)).mtimeMs >= cutoff.getTime()) continue;
        if (
          folder === 'media' &&
          (await this.prisma.uploadFile.findUnique({
            where: { storageKey: `${folder}/${name}` },
            select: { id: true },
          }))
        )
          continue;
        await rm(path, { force: true });
      }
    }
  }
}
