import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp = require('sharp');
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { PrismaModule } from '../../libs/db/prisma/prisma.module';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import { JwtGuard } from '../../libs/guard';
import { FilesUploadModule } from './files-upload.module';
import { FilesUploadService } from './files-upload.service';
import { MediaProcessorService } from './media-processor.service';
import { ChatService } from '../../gateway/chat/chat.service';

const prisma = {
  call: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  chatParticipant: { findUnique: jest.fn() },
  uploadFile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
};
function wave(info = Buffer.alloc(0)) {
  const wav = Buffer.alloc(44 + 16000 * 2 + info.length);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(16000 * 2, 40);
  info.copy(wav, 44 + 16000 * 2);
  return wav;
}

describe('private media uploads', () => {
  let app: INestApplication;
  let directory: string;
  let authorized = true;
  let image: Buffer;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'batgram-media-test-'));
    process.env.UPLOAD_DIR = directory;
    image = await sharp({
      create: { width: 2100, height: 1000, channels: 3, background: '#136f84' },
    })
      .jpeg()
      .toBuffer();
    jest.spyOn(FilesUploadService.prototype, 'cleanup').mockResolvedValue();
    const module = await Test.createTestingModule({
      imports: [PrismaModule, FilesUploadModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = { id: 7 };
          return authorized;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    authorized = true;
    prisma.chatParticipant.findUnique.mockResolvedValue({ id: 1 });
    prisma.uploadFile.create.mockImplementation(async ({ data }) => ({
      id: 'file-id',
      ...data,
    }));
  });
  afterAll(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
    jest.restoreAllMocks();
  });
  it('reencodes images as WebP, resizes and deletes the original', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/chats/3')
      .attach('file', image, {
        filename: '../../evil.jpg',
        contentType: 'image/jpeg',
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      kind: 'IMAGE',
      mimeType: 'image/webp',
      width: 1920,
    });
    const data = prisma.uploadFile.create.mock.calls[0][0].data;
    expect(data.storageKey).toMatch(/^media\/[0-9a-f-]+\.webp$/);
    const encoded = await readFile(join(directory, data.storageKey));
    expect((await sharp(encoded).metadata()).format).toBe('webp');
    expect(response.body.size).toBe(encoded.length);
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
    await rm(join(directory, data.storageKey));
  });
  it('encodes real voice audio as M4A and removes the input', async () => {
    const wav = wave();
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/chats/3')
      .attach('file', wav, { filename: 'voice.wav', contentType: 'audio/wav' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      kind: 'AUDIO',
      mimeType: 'audio/mp4',
      width: 0,
      height: 0,
    });
    expect((response.body as { duration: number }).duration).toBeGreaterThan(0);
    const data = (
      prisma.uploadFile.create.mock.calls as [
        { data: { storageKey: string } },
      ][]
    )[0][0].data;
    expect(data.storageKey).toMatch(/\.m4a$/);
    expect(
      (await readFile(join(directory, data.storageKey))).toString(
        'ascii',
        4,
        8,
      ),
    ).toBe('ftyp');
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
    await rm(join(directory, data.storageKey));
  });
  it('stores music metadata separately from voice audio', async () => {
    const tags = Buffer.alloc(40);
    tags.write('LIST', 0);
    tags.writeUInt32LE(32, 4);
    tags.write('INFOINAM', 8);
    tags.writeUInt32LE(6, 16);
    tags.write('Track', 20);
    tags.write('IART', 26);
    tags.writeUInt32LE(6, 30);
    tags.write('Mina', 34);
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/chats/3/music')
      .attach('file', wave(tags), {
        filename: 'fallback.wav',
        contentType: 'audio/wav',
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      kind: 'MUSIC',
      mimeType: 'audio/mp4',
      title: 'Track',
      artist: 'Mina',
    });
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
    await rm(join(directory, response.body.storageKey));
  });

  it('rejects forged audio and cleans temporary files', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/chats/3')
      .attach('file', Buffer.from('not audio'), {
        filename: 'voice.webm',
        contentType: 'audio/webm',
      });
    expect(response.status).toBe(400);
    expect(prisma.uploadFile.create).not.toHaveBeenCalled();
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
    expect(await readdir(join(directory, 'media'))).toEqual([]);
  });
  it('rejects audio as an avatar', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/avatar')
      .attach('file', Buffer.from('audio'), {
        filename: 'voice.webm',
        contentType: 'audio/webm',
      });
    expect(response.status).toBe(400);
    expect(prisma.uploadFile.create).not.toHaveBeenCalled();
  });
  it('rejects a forged MIME type and cleans both original and partial output', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/chats/3')
      .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });
    expect(response.status).toBe(400);
    expect(prisma.uploadFile.create).not.toHaveBeenCalled();
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
    expect(await readdir(join(directory, 'media'))).toEqual([]);
  });
  it('blocks uploading into another chat', async () => {
    prisma.chatParticipant.findUnique.mockResolvedValue(null);
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/chats/99')
      .attach('file', image, 'photo.jpg');
    expect(response.status).toBe(403);
    expect(prisma.uploadFile.create).not.toHaveBeenCalled();
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
  });
  it('requires a session before receiving files', async () => {
    authorized = false;
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/files/chats/3')
          .attach('file', image, 'photo.jpg')
      ).status,
    ).toBe(403);
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
  });
  it('rejects oversized avatars at the multipart boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/avatar')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'photo.jpg');
    expect(response.status).toBe(413);
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
  });
  it('rejects multiple files and cleans the accepted partial upload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/chats/3')
      .attach('file', image, 'one.jpg')
      .attach('file', image, 'two.jpg');
    expect(response.status).toBe(400);
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
  });
  it('does not allow another member to read an unsent draft', async () => {
    prisma.uploadFile.findUnique.mockResolvedValue({
      ownerId: 8,
      chatId: 3,
      messageId: null,
      avatar: null,
    });
    await expect(
      app.get(FilesUploadService).readable('file', 7),
    ).rejects.toThrow();
  });
  it('blocks reading sent files from a different chat', async () => {
    prisma.uploadFile.findUnique.mockResolvedValue({
      ownerId: 8,
      chatId: 3,
      messageId: 1,
      avatar: null,
    });
    prisma.chatParticipant.findUnique.mockResolvedValue(null);
    await expect(
      app.get(FilesUploadService).readable('file', 7),
    ).rejects.toThrow();
  });
  it('rejects an attachment inside the send transaction when it belongs to someone else, another room, or is already used', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      chatParticipant: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      message: {
        create: jest.fn().mockResolvedValue({ id: 5 }),
        findUniqueOrThrow: jest.fn(),
      },
      uploadFile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new ChatService({
      $transaction: (callback) => callback(tx),
    } as never);
    await expect(
      service.createMessage(3, 7, '', '12345678-1234-1234-1234-123456789abc'),
    ).rejects.toThrow('Attachment expired');
    expect(tx.uploadFile.updateMany.mock.calls[0][0].where).toMatchObject({
      ownerId: 7,
      chatId: 3,
      messageId: null,
    });
    expect(tx.message.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it('rejects a plain empty message', async () => {
    await expect(
      new ChatService({} as never).createMessage(3, 7, ' '),
    ).rejects.toThrow();
  });
  it('rejects a fake video container', async () => {
    const input = join(directory, 'fake.mp4');
    await writeFile(input, 'not a video file content');
    await expect(
      app.get(MediaProcessorService).video(input, join(directory, 'out.mp4')),
    ).rejects.toThrow('Invalid video');
  });
});
