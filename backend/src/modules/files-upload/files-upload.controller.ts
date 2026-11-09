import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Response } from 'express';
import { JwtGuard } from '../../libs/guard';
import { GetUser } from '../../libs/decorators';
import { FilesUploadService } from './files-upload.service';
import { uploadPolicy, uploadRoot } from './upload.policy';

function interceptor(maxBytes: number) {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(uploadRoot(), 'tmp');
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 2 },
  });
}

@Controller('api/v1/files')
@UseGuards(JwtGuard)
export class FilesUploadController {
  constructor(private readonly files: FilesUploadService) {}
  @Get('policy') policy() {
    return uploadPolicy;
  }

  @Post('avatar')
  @UseInterceptors(interceptor(uploadPolicy.avatarMaxBytes))
  avatar(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id);
  }
  @Delete('avatar')
  removeAvatar(@GetUser() user: { id: number }) {
    return this.files.removeAvatar(user.id);
  }

  @Post('groups/:chatId/avatar')
  @UseInterceptors(interceptor(uploadPolicy.avatarMaxBytes))
  groupAvatar(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id, chatId, true);
  }
  @Delete('groups/:chatId/avatar')
  removeGroupAvatar(
    @Param('chatId', ParseIntPipe) chatId: number,
    @GetUser() user: { id: number },
  ) {
    return this.files.removeGroupAvatar(chatId, user.id);
  }

  @Post('chats/:chatId')
  @UseInterceptors(interceptor(uploadPolicy.videoMaxBytes))
  chat(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id, chatId);
  }
  @Post('chats/:chatId/music')
  @UseInterceptors(interceptor(uploadPolicy.audioMaxBytes))
  music(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id, chatId, false, true);
  }
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: { id: number },
  ) {
    return this.files.removeDraft(id, user.id);
  }

  @Get(':id/content')
  async content(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: { id: number },
    @Res() response: Response,
  ) {
    const file = await this.files.readable(id, user.id);
    response.set({
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    });
    response.sendFile(file.path, (error) => {
      if (error && !response.headersSent) response.status(404).end();
    });
  }
}
