import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import sharp = require('sharp');
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/libs/db/prisma/prisma.service';
// Reuse the application's Socket.IO client to exercise the production protocol.
const { io } = require('../../frontend/node_modules/socket.io-client');
const ffmpeg: string = require('ffmpeg-static');

describe('media with real PostgreSQL, HTTP, JWT and Socket.IO', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directory: string;
  const userIds: number[] = [];
  const clients: any[] = [];
  let chatId: number | undefined;
  let base: string;
  const tokens: string[] = [];
  let image: Buffer;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'batgram-media-integration-'));
    process.env.UPLOAD_DIR = directory;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({
        data: {
          email: `media-${Date.now()}-${i}@example.invalid`,
          profile: { create: {} },
        },
      });
      userIds.push(user.id);
      tokens.push(
        await app
          .get(JwtService)
          .signAsync(
            { sub: user.id },
            { secret: process.env.JWT_SECRET, expiresIn: '5m' },
          ),
      );
    }
    const chat = await prisma.chat.create({
      data: {
        participants: {
          create: userIds.slice(0, 2).map((userId) => ({ userId })),
        },
      },
    });
    chatId = chat.id;
    image = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: '#2584ac' },
    })
      .jpeg()
      .toBuffer();
  });
  afterAll(async () => {
    for (const client of clients) client.disconnect();
    if (prisma) {
      await prisma.profile.updateMany({
        where: { userId: { in: userIds } },
        data: { avatarId: null },
      });
      await prisma.uploadFile.deleteMany({
        where: { ownerId: { in: userIds } },
      });
      if (chatId) {
        await prisma.messageReadStatus.deleteMany({
          where: { message: { chatId } },
        });
        await prisma.message.deleteMany({ where: { chatId } });
        await prisma.chatParticipant.deleteMany({ where: { chatId } });
        await prisma.chat.delete({ where: { id: chatId } });
      }
      await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (directory) await rm(directory, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });
  function http(index = 0) {
    return {
      post: (path: string) =>
        request(base).post(path).auth(tokens[index], { type: 'bearer' }),
      get: (path: string) =>
        request(base).get(path).auth(tokens[index], { type: 'bearer' }),
      delete: (path: string) =>
        request(base).delete(path).auth(tokens[index], { type: 'bearer' }),
    };
  }
  async function socket(index: number) {
    const client = io(`${base}/chat`, {
      auth: { token: tokens[index] },
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  }
  it('uploads, delivers, protects and cleans up actual images and videos', async () => {
    await request(base).get('/api/v1/files/policy').expect(401);
    const outsider = await socket(2);
    const deniedJoin = await outsider
      .timeout(5000)
      .emitWithAck('chat:join', { chatId, userId: userIds[0] });
    expect(deniedJoin.message).toBe('Not a participant');
    const sender = await socket(0);
    const receiver = await socket(1);
    await sender.timeout(5000).emitWithAck('chat:join', { chatId });
    await receiver.timeout(5000).emitWithAck('chat:join', { chatId });
    const upload = await http()
      .post(`/api/v1/files/chats/${chatId}`)
      .attach('file', image, 'image.jpg')
      .expect(201);
    expect(upload.body.storageKey).toBeUndefined();
    const media = upload.body;
    await http(1).get(`/api/v1/files/${media.id}/content`).expect(403);
    await http(2).get(`/api/v1/files/${media.id}/content`).expect(403);
    const delivery = new Promise<any>((resolve) =>
      receiver.once('message:new', resolve),
    );
    const message = await sender.timeout(5000).emitWithAck('message:send', {
      chatId,
      senderId: userIds[2],
      content: '',
      attachmentId: media.id,
    });
    expect(message.senderId).toBe(userIds[0]);
    expect(message.attachments[0].id).toBe(media.id);
    expect((await delivery).id).toBe(message.id);
    const duplicate = await sender.timeout(5000).emitWithAck('message:send', {
      chatId,
      content: '',
      attachmentId: media.id,
    });
    expect(duplicate.id).toBeUndefined();
    expect(await prisma.message.count({ where: { chatId } })).toBe(1);
    await http(1)
      .get(`/api/v1/files/${media.id}/content`)
      .expect(200)
      .expect('Content-Type', /image\/webp/);
    await http(2).get(`/api/v1/files/${media.id}/content`).expect(403);
    const history = await http(1)
      .get(`/api/v1/realtime/polling/${chatId}`)
      .expect(200);
    expect(JSON.stringify(history.body)).toContain(media.id);
    // Replacing an avatar deletes the previous DB record and its physical file.
    const firstAvatar = await http()
      .post('/api/v1/files/avatar')
      .attach('file', image, 'avatar.jpg')
      .expect(201);
    const old = await prisma.uploadFile.findUniqueOrThrow({
      where: { id: firstAvatar.body.avatarId },
    });
    await http()
      .post('/api/v1/files/avatar')
      .attach('file', image, 'avatar.jpg')
      .expect(201);
    expect(
      await prisma.uploadFile.findUnique({ where: { id: old.id } }),
    ).toBeNull();
    await expect(access(join(directory, old.storageKey))).rejects.toThrow();
    const profile = await http().get('/api/v1/auth/user-info').expect(200);
    expect(profile.body.data.profile.avatarId).toBeTruthy();
    expect(
      (await http().delete('/api/v1/files/avatar').expect(200)).body.avatarId,
    ).toBeNull();
    // Generate and transcode a real short video, including an audio stream.
    const video = join(directory, 'fixture.mp4');
    execFileSync(ffmpeg, [
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=320x240:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440',
      '-t',
      '1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      video,
    ]);
    const videoUpload = await http()
      .post(`/api/v1/files/chats/${chatId}`)
      .attach('file', await readFile(video), {
        filename: 'clip.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);
    expect(videoUpload.body).toMatchObject({
      kind: 'VIDEO',
      mimeType: 'video/mp4',
    });
    const videoMessage = await sender
      .timeout(5000)
      .emitWithAck('message:send', {
        chatId,
        content: 'video caption',
        attachmentId: videoUpload.body.id,
      });
    expect(videoMessage.attachments[0].kind).toBe('VIDEO');
    await http(1)
      .get(`/api/v1/files/${videoUpload.body.id}/content`)
      .expect(200)
      .expect('Content-Type', /video\/mp4/);
    const range = await request(base)
      .get(`/api/v1/files/${videoUpload.body.id}/content`)
      .auth(tokens[1], { type: 'bearer' })
      .set('Range', 'bytes=0-99')
      .expect(206);
    expect(range.headers['content-length']).toBe('100');
    const badUpload = await http()
      .post(`/api/v1/files/chats/${chatId}`)
      .attach('file', Buffer.from('not a video'), {
        filename: 'clip.mp4',
        contentType: 'video/mp4',
      });
    expect(badUpload.status).toBe(400);
  });
  it('sends tagged music and returns it only in the source chat playlist', async () => {
    const sender = await socket(0);
    await sender.timeout(5000).emitWithAck('chat:join', { chatId });
    const song = execFileSync(ffmpeg, [
      '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440',
      '-t', '1', '-metadata', 'title=Evening', '-metadata', 'artist=Mina',
      '-f', 'mp3', 'pipe:1',
    ]);
    const response = await http()
      .post(`/api/v1/files/chats/${chatId}/music`)
      .attach('file', song, { filename: 'song.mp3', contentType: 'audio/mpeg' })
      .expect(201);
    const track = { id: response.body.id, kind: 'MUSIC', title: 'Evening', artist: 'Mina' };
    expect(response.body).toMatchObject(track);
    const playlist = `/api/v1/realtime/polling/${chatId}/shared?kind=MUSIC`;
    expect((await http(1).get(playlist).expect(200)).body.data.messages).toEqual([]);
    const message = await sender.timeout(5000).emitWithAck('message:send', {
      chatId,
      content: '',
      attachmentId: track.id,
    });
    expect(message.attachments[0]).toMatchObject(track);
    const shared = await http(1).get(playlist).expect(200);
    expect(shared.body.data.counts.MUSIC).toBe(1);
    expect(shared.body.data.messages[0].attachments[0]).toMatchObject(track);
    await http(1).get(`/api/v1/files/${track.id}/content`).expect(200);
    await http(2).get(playlist).expect(403);
  });
  it('sends a photo album atomically and keeps its order in the live message and history', async () => {
    const sender = await socket(0);
    const receiver = await socket(1);
    await sender.timeout(5000).emitWithAck('chat:join', { chatId });
    await receiver.timeout(5000).emitWithAck('chat:join', { chatId });
    const first = (
      await http()
        .post(`/api/v1/files/chats/${chatId}`)
        .attach('file', image, 'first.jpg')
        .expect(201)
    ).body;
    const second = (
      await http()
        .post(`/api/v1/files/chats/${chatId}`)
        .attach('file', image, 'second.jpg')
        .expect(201)
    ).body;
    const count = await prisma.message.count({ where: { chatId } });
    const send = (attachmentIds: string[]) =>
      sender.timeout(5000).emitWithAck('message:send', {
        chatId,
        content: 'Album caption',
        attachmentIds,
      });
    const failed = await send([
      first.id,
      '12345678-1234-1234-1234-123456789abc',
    ]);
    expect(failed.id).toBeUndefined();
    expect(await prisma.message.count({ where: { chatId } })).toBe(count);
    expect(
      await prisma.uploadFile.findUnique({ where: { id: first.id } }),
    ).toMatchObject({ messageId: null });
    expect((await send([first.id, first.id])).id).toBeUndefined();
    const delivered = new Promise<any>((resolve) =>
      receiver.once('message:new', resolve),
    );
    const attachmentIds = [second.id, first.id];
    const message = await send(attachmentIds);
    expect(message.attachments.map(({ id }) => id)).toEqual(attachmentIds);
    expect((await delivered).attachments.map(({ id }) => id)).toEqual(
      attachmentIds,
    );
    const history = await http(1)
      .get(`/api/v1/realtime/polling/${chatId}`)
      .expect(200);
    expect(JSON.stringify(history.body)).toContain(
      JSON.stringify(message.attachments),
    );
    await http(1).get(`/api/v1/files/${first.id}/content`).expect(200);
    await http(2).get(`/api/v1/files/${second.id}/content`).expect(403);
  });
});
