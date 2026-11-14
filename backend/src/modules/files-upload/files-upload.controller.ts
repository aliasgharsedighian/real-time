import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  DocumentBearerAuth,
  DocumentEndpoint,
  DocumentUpload,
} from '../../documentation/http';
import { integer, ref, uuid } from '../../documentation/schemas';
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

@ApiTags('Files')
@DocumentBearerAuth()
@Controller('api/v1/files')
@UseGuards(JwtGuard)
export class FilesUploadController {
  constructor(private readonly files: FilesUploadService) {}
  @Get('policy')
  @DocumentEndpoint(
    'Get accepted media types and upload limits',
    200,
    ref('UploadPolicy'),
  )
  policy() {
    return uploadPolicy;
  }

  @Post('avatar')
  @UseInterceptors(interceptor(uploadPolicy.avatarMaxBytes))
  @DocumentEndpoint(
    'Upload a profile avatar',
    201,
    ref('Profile'),
    [400, 413, 503],
  )
  @DocumentUpload()
  avatar(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id);
  }
  @Delete('avatar')
  @DocumentEndpoint('Remove the profile avatar', 200, ref('Profile'))
  removeAvatar(@GetUser() user: { id: number }) {
    return this.files.removeAvatar(user.id);
  }

  @Post('groups/:chatId/avatar')
  @UseInterceptors(interceptor(uploadPolicy.avatarMaxBytes))
  @DocumentEndpoint(
    'Upload a group avatar as owner and publish a photo activity message',
    201,
    ref('Chat'),
    [400, 403, 413, 503],
  )
  @DocumentUpload()
  @ApiParam({ name: 'chatId', schema: integer })
  groupAvatar(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id, chatId, true);
  }
  @Delete('groups/:chatId/avatar')
  @DocumentEndpoint(
    'Remove a group avatar as owner and publish activity if a photo was set',
    200,
    ref('Chat'),
    [400, 403],
  )
  @ApiParam({ name: 'chatId', schema: integer })
  removeGroupAvatar(
    @Param('chatId', ParseIntPipe) chatId: number,
    @GetUser() user: { id: number },
  ) {
    return this.files.removeGroupAvatar(chatId, user.id);
  }

  @Post('chats/:chatId')
  @UseInterceptors(interceptor(uploadPolicy.videoMaxBytes))
  @DocumentEndpoint(
    'Upload a draft chat attachment',
    201,
    ref('Attachment'),
    [400, 403, 413, 503],
  )
  @DocumentUpload()
  @ApiParam({ name: 'chatId', schema: integer })
  chat(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id, chatId);
  }
  @Post('chats/:chatId/music')
  @UseInterceptors(interceptor(uploadPolicy.audioMaxBytes))
  @DocumentEndpoint(
    'Upload a draft music attachment',
    201,
    ref('Attachment'),
    [400, 403, 413, 503],
  )
  @DocumentUpload()
  @ApiParam({ name: 'chatId', schema: integer })
  music(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.upload(file, user.id, chatId, false, true);
  }
  @Post('chats/:chatId/document')
  @UseInterceptors(interceptor(uploadPolicy.documentMaxBytes))
  @DocumentEndpoint(
    'Upload a draft document as a chat member. Allowed filename extensions and size are listed in the upload policy.',
    201,
    ref('Attachment'),
    [400, 403, 413],
  )
  @DocumentUpload()
  @ApiParam({ name: 'chatId', schema: integer })
  document(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: { id: number },
  ) {
    return this.files.uploadDocument(file, user.id, chatId);
  }

  @Delete(':id')
  @DocumentEndpoint(
    'Delete an unused draft attachment',
    200,
    undefined,
    [400, 404],
  )
  @ApiParam({ name: 'id', schema: uuid })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: { id: number },
  ) {
    return this.files.removeDraft(id, user.id);
  }

  @Get(':id/content')
  @ApiResponse({
    status: 200,
    description:
      'File bytes. Documents use application/octet-stream and attachment disposition with the original filename.',
    content: {
      'image/*': { schema: { type: 'string', format: 'binary' } },
      'video/*': { schema: { type: 'string', format: 'binary' } },
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
      'audio/*': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @DocumentEndpoint(
    'Download attachment or avatar content',
    200,
    undefined,
    [400, 403, 404],
  )
  @ApiParam({ name: 'id', schema: uuid })
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
    if (file.downloadName) {
      response.attachment(file.downloadName);
      response.type('application/octet-stream');
    }
    response.sendFile(file.path, (error) => {
      if (error && !response.headersSent) response.status(404).end();
    });
  }
}
