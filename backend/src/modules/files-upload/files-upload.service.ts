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
  ) {
    if (!file) throw new BadRequestException('Choose a file to upload.');
    const avatar = chatId === undefined;
    let output: string | undefined;
    let saved = false;
    let acquired = false;
    try {
      if (!avatar) await this.ensureParticipant(chatId, ownerId);
      const image = uploadPolicy.imageMimeTypes.includes(file.mimetype);
      const video = uploadPolicy.videoMimeTypes.includes(file.mimetype);
      const audio = uploadPolicy.audioMimeTypes.includes(file.mimetype);
      if ((!image && !video && !audio) || (avatar && !image))
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
          ? await this.processor.audio(file.path, output)
          : await this.processor.video(file.path, output);
      if (!avatar) {
        const record = await this.prisma.uploadFile.create({
          data: { ...metadata, storageKey, ownerId, chatId },
          select: fileSelect,
        });
        saved = true;
        return record;
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
      where: { id, messageId: null, avatar: null },
    });
    if (result.count)
      await rm(join(uploadRoot(), file.storageKey), { force: true });
  }

  async readable(id: string, userId: number) {
    const file = await this.prisma.uploadFile.findUnique({
      where: { id },
      include: { avatar: { select: { id: true } } },
    });
    if (!file) throw new NotFoundException('File not found.');
    if (!file.avatar) {
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
      where: { createdAt: { lt: cutoff }, messageId: null, avatar: null },
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
