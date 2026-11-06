import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import sharp = require('sharp');
import { FilesUploadService } from '../src/modules/files-upload/files-upload.service';
import { CallsService } from '../src/gateway/chat/calls.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/libs/db/prisma/prisma.service';
import { mkdtemp, rm, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { io } = require('../../frontend/node_modules/socket.io-client');

describe('message actions with PostgreSQL, HTTP authentication and Socket.IO', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let base: string;
  let directory: string;
  const ids: number[] = [];
  const tokens: string[] = [];
  const chatIds: number[] = [];
  const sockets: any[] = [];
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'batgram-groups-'));
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
    for (let i = 0; i < 4; i++) {
      const user = await prisma.user.create({
        data: {
          email: `groups-${Date.now()}-${i}@example.invalid`,
          profile: { create: { firstname: `Member ${i}` } },
        },
      });
      ids.push(user.id);
      tokens.push(
        await app
          .get(JwtService)
          .signAsync(
            { sub: user.id },
            { secret: process.env.JWT_SECRET, expiresIn: '5m' },
          ),
      );
    }
  });
  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    if (prisma) {
      await prisma.uploadFile.deleteMany({
        where: { chatId: { in: chatIds } },
      });
      await prisma.message.deleteMany({ where: { chatId: { in: chatIds } } });
      await prisma.chatParticipant.deleteMany({
        where: { chatId: { in: chatIds } },
      });
      await prisma.chat.deleteMany({ where: { id: { in: chatIds } } });
      await prisma.profile.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (directory) await rm(directory, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });
  function http(index = 0) {
    return {
      get: (path: string) =>
        request(base)
          .get(`/api/v1/realtime/${path}`)
          .auth(tokens[index], { type: 'bearer' }),
      post: (path: string) =>
        request(base)
          .post(`/api/v1/realtime/${path}`)
          .auth(tokens[index], { type: 'bearer' }),
      patch: (path: string) =>
        request(base)
          .patch(`/api/v1/realtime/${path}`)
          .auth(tokens[index], { type: 'bearer' }),
      delete: (path: string) =>
        request(base)
          .delete(`/api/v1/realtime/${path}`)
          .auth(tokens[index], { type: 'bearer' }),
    };
  }
  async function socket(index: number) {
    const client = io(`${base}/chat`, {
      auth: { token: tokens[index] },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  }
  function once(client: any, event: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Missing ${event}`)),
        5000,
      );
      client.once(event, (data: any) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
  async function create(data: object) {
    const result = await http()
      .post('polling/create-chat')
      .send(data)
      .expect(201);
    chatIds.push(result.body.data.id);
    return result.body.data;
  }

  it('authorizes permanent direct chat deletion for either member, removes media/receipts/calls and notifies both users', async () => {
    const chat = await create({
      participant: [ids[1]],
      firstMessage: 'Erase this',
    });
    const a = await socket(0);
    const b = await socket(1);
    const message = await prisma.message.findFirstOrThrow({
      where: { chatId: chat.id },
    });
    await prisma.messageReadStatus.create({
      data: { messageId: message.id, userId: ids[1] },
    });
    await prisma.call.create({
      data: {
        chatId: chat.id,
        callerId: ids[0],
        calleeId: ids[1],
        mode: 'audio',
      },
    });
    const upload = await request(base)
      .post(`/api/v1/files/chats/${chat.id}`)
      .auth(tokens[0], { type: 'bearer' })
      .attach(
        'file',
        await sharp({
          create: { width: 8, height: 8, channels: 3, background: '#fff' },
        })
          .png()
          .toBuffer(),
        'picture.png',
      )
      .expect(201);
    const file = await prisma.uploadFile.findUniqueOrThrow({
      where: { id: upload.body.id },
    });
    await http(2).delete(`chats/${chat.id}`).expect(404);
    const activeCall = await a.emitWithAck('call:start', {
      chatId: chat.id,
      mode: 'audio',
    });
    expect(activeCall.id).toBeTruthy();
    const removedA = once(a, 'chat:removed');
    const removedB = once(b, 'chat:removed');
    await http(1).delete(`chats/${chat.id}`).expect(200);
    expect((await removedA).chatId).toBe(chat.id);
    expect((await removedB).chatId).toBe(chat.id);
    expect(app.get(CallsService).pending(ids[1])).toBeNull();
    expect(await prisma.chat.findUnique({ where: { id: chat.id } })).toBeNull();
    expect(
      await prisma.messageReadStatus.count({
        where: { messageId: message.id },
      }),
    ).toBe(0);
    expect(await prisma.call.count({ where: { chatId: chat.id } })).toBe(0);
    expect(await prisma.uploadFile.count({ where: { chatId: chat.id } })).toBe(
      0,
    );
    await expect(access(join(directory, file.storageKey))).rejects.toThrow();
    await http(0).get(`polling/${chat.id}`).expect(403);
    const recreated = await create({ participant: [ids[1]] });
    expect(recreated.id).not.toBe(chat.id);
    await http(0).delete(`chats/${recreated.id}`).expect(200);
  });
  it('allows only the group owner to delete a group, including after ownership transfer', async () => {
    const chat = await create({
      isGroup: true,
      name: 'Delete group',
      participant: [ids[1], ids[2]],
    });
    await http(1).delete(`chats/${chat.id}`).expect(403);
    await http(0).post(`groups/${chat.id}/owner/${ids[1]}`).expect(201);
    await http(0).delete(`chats/${chat.id}`).expect(403);
    await http(1).delete(`chats/${chat.id}`).expect(200);
    expect(
      await prisma.chatParticipant.count({ where: { chatId: chat.id } }),
    ).toBe(0);
  });
  it('keeps mute private to a member and suppresses in-app notifications while preserving inbox updates', async () => {
    const chat = await create({ participant: [ids[1]] });
    const a = await socket(0);
    const b = await socket(1);
    await b.emitWithAck('notification:presence', {
      active: true,
      chatId: null,
    });
    const notices: any[] = [];
    b.on('notification:new', (value: any) => notices.push(value));
    await http(1)
      .patch(`chats/${chat.id}/mute`)
      .send({ muted: true })
      .expect(200);
    await http(2)
      .patch(`chats/${chat.id}/mute`)
      .send({ muted: true })
      .expect(404);
    expect(
      (await b.emitWithAck('chat:list')).find((c: any) => c.id === chat.id)
        .muted,
    ).toBe(true);
    expect(
      (await a.emitWithAck('chat:list')).find((c: any) => c.id === chat.id)
        .muted,
    ).toBe(false);
    const changed = once(b, 'chat:updated');
    await a.emitWithAck('message:send', {
      chatId: chat.id,
      content: 'Muted message',
    });
    await changed;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(notices).toHaveLength(0);
    await http(1)
      .patch(`chats/${chat.id}/mute`)
      .send({ muted: false })
      .expect(200);
    const notice = once(b, 'notification:new');
    await a.emitWithAck('message:send', {
      chatId: chat.id,
      content: 'Audible message',
    });
    expect((await notice).body).toBe('Audible message');
    await http(0).delete(`chats/${chat.id}`).expect(200);
  });
  it('validates replies, restricts editing, broadcasts editedAt and clears reply references on hard deletion', async () => {
    const chat = await create({
      participant: [ids[1]],
      firstMessage: 'Original',
    });
    const other = await create({
      participant: [ids[2]],
      firstMessage: 'Private',
    });
    const original = await prisma.message.findFirstOrThrow({
      where: { chatId: chat.id },
    });
    const privateMessage = await prisma.message.findFirstOrThrow({
      where: { chatId: other.id },
    });
    const a = await socket(0);
    const b = await socket(1);
    expect(
      (
        await b.emitWithAck('message:send', {
          chatId: chat.id,
          content: 'Leak?',
          replyToId: privateMessage.id,
        })
      ).id,
    ).toBeUndefined();
    const reply = await b.emitWithAck('message:send', {
      chatId: chat.id,
      content: 'Answer',
      replyToId: original.id,
    });
    expect(reply.replyTo.content).toBe('Original');
    await http(1)
      .patch(`chats/${chat.id}/messages`)
      .send({ messageId: original.id, content: 'Forged' })
      .expect(403);
    const edited = once(b, 'message:updated');
    await http(0)
      .patch(`chats/${chat.id}/messages`)
      .send({ messageId: original.id, content: 'Changed' })
      .expect(200);
    expect((await edited).editedAt).toBeTruthy();
    const history = await http(1).get(`polling/${chat.id}`).expect(200);
    expect(
      history.body.data.chats.find((m: any) => m.id === reply.id).replyTo
        .content,
    ).toBe('Changed');
    await http(0)
      .delete(`chats/${chat.id}/messages`)
      .send({ messageIds: [original.id, reply.id] })
      .expect(403);
    expect(await prisma.message.count({ where: { chatId: chat.id } })).toBe(2);
    const deleted = once(a, 'message:deleted');
    await http(0)
      .delete(`chats/${chat.id}/messages`)
      .send({ messageIds: [original.id] })
      .expect(200);
    expect((await deleted).messageIds).toEqual([original.id]);
    expect(
      (await prisma.message.findUniqueOrThrow({ where: { id: reply.id } }))
        .replyToId,
    ).toBeNull();
    const sync = await http(1)
      .post(`chats/${chat.id}/messages/sync`)
      .send({ messageIds: [original.id, reply.id] })
      .expect(201);
    expect(sync.body.data.map((m: any) => m.id)).toEqual([reply.id]);
    await http(1)
      .delete(`chats/${chat.id}/messages`)
      .send({ messageIds: [reply.id] })
      .expect(200);
    await http(1).delete(`chats/${chat.id}`).expect(200);
  });
  it('forwards selected text and media in order with independent files and rejects inaccessible destinations', async () => {
    const source = await create({
      participant: [ids[1]],
      firstMessage: 'First',
    });
    const destination = await create({ participant: [ids[2]] });
    const inaccessible = await http(2)
      .post('polling/create-chat')
      .send({ participant: [ids[3]] })
      .expect(201);
    chatIds.push(inaccessible.body.data.id);
    const a = await socket(0);
    const first = await prisma.message.findFirstOrThrow({
      where: { chatId: source.id },
    });
    const upload = await request(base)
      .post(`/api/v1/files/chats/${source.id}`)
      .auth(tokens[0], { type: 'bearer' })
      .attach(
        'file',
        await sharp({
          create: { width: 8, height: 8, channels: 3, background: '#fff' },
        })
          .png()
          .toBuffer(),
        'picture.png',
      )
      .expect(201);
    const media = await a.emitWithAck('message:send', {
      chatId: source.id,
      content: 'Second',
      attachmentId: upload.body.id,
    });
    await http(0)
      .post(`chats/${source.id}/forward`)
      .send({ messageIds: [media.id], targetChatId: inaccessible.body.data.id })
      .expect(404);
    const result = await http(0)
      .post(`chats/${source.id}/forward`)
      .send({ messageIds: [media.id, first.id], targetChatId: destination.id })
      .expect(201);
    expect(result.body.data.map((m: any) => m.content)).toEqual([
      'First',
      'Second',
    ]);
    expect(
      result.body.data.every((m: any) => m.forwarded && m.senderId === ids[0]),
    ).toBe(true);
    const copyId = result.body.data[1].attachments[0].id;
    expect(copyId).not.toBe(upload.body.id);
    await http(1).delete(`chats/${source.id}`).expect(200);
    await request(base)
      .get(`/api/v1/files/${copyId}/content`)
      .auth(tokens[2], { type: 'bearer' })
      .expect(200);
    await http(0)
      .delete(`chats/${destination.id}/messages`)
      .send({ messageIds: result.body.data.map((m: any) => m.id) })
      .expect(200);
    expect(
      await prisma.uploadFile.findUnique({ where: { id: copyId } }),
    ).toBeNull();
  });
  it('keeps the original author through chained forwards, source deletion and history reloads', async () => {
    const source = await create({ participant: [ids[1]] });
    const target = await create({ participant: [ids[2]] });
    const peer = await socket(1);
    const original = await peer.emitWithAck('message:send', {
      chatId: source.id,
      content: 'Original author',
    });
    const first = await http(0)
      .post(`chats/${source.id}/forward`)
      .send({ messageIds: [original.id], targetChatId: target.id })
      .expect(201);
    expect(first.body.data[0].forwardedFrom.id).toBe(ids[1]);
    expect(first.body.data[0].senderId).toBe(ids[0]);
    const third = await http(2)
      .post('polling/create-chat')
      .send({ participant: [ids[3]] })
      .expect(201);
    chatIds.push(third.body.data.id);
    const second = await http(2)
      .post(`chats/${target.id}/forward`)
      .send({
        messageIds: [first.body.data[0].id],
        targetChatId: third.body.data.id,
      })
      .expect(201);
    expect(second.body.data[0].forwardedFrom.id).toBe(ids[1]);
    expect(second.body.data[0].senderId).toBe(ids[2]);
    await http(1).delete(`chats/${source.id}`).expect(200);
    const history = await http(3)
      .get(`polling/${third.body.data.id}`)
      .expect(200);
    expect(
      history.body.data.chats.find((m: any) => m.id === second.body.data[0].id)
        .forwardedFrom.id,
    ).toBe(ids[1]);
    const profile = await http(3).get(`user/${ids[1]}`).expect(200);
    expect(profile.body.data.profile.firstname).toBe('Member 1');
    expect(profile.body.data.password).toBeUndefined();
    expect(profile.body.data.lastSeenAt).toBeUndefined();
  });
  it('counts and paginates shared content across history, excludes draft/avatar files and enforces membership', async () => {
    const chat = await create({
      isGroup: true,
      name: 'Shared content',
      participant: [ids[1]],
    });
    await prisma.message.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        chatId: chat.id,
        senderId: ids[0],
        content: `https://example.invalid/${i}`,
      })),
    });
    const photo = await prisma.message.create({
      data: { chatId: chat.id, senderId: ids[0], content: 'Photo' },
    });
    const metadata = {
      ownerId: ids[0],
      chatId: chat.id,
      kind: 'IMAGE',
      mimeType: 'image/webp',
      width: 8,
      height: 8,
      size: 10,
    };
    await prisma.uploadFile.create({
      data: {
        ...metadata,
        storageKey: `media/shared-${chat.id}`,
        messageId: photo.id,
      },
    });
    await prisma.uploadFile.create({
      data: { ...metadata, storageKey: `media/draft-${chat.id}` },
    });
    const avatar = await prisma.uploadFile.create({
      data: { ...metadata, storageKey: `media/avatar-${chat.id}` },
    });
    await prisma.chat.update({
      where: { id: chat.id },
      data: { avatarId: avatar.id },
    });
    await request(base)
      .get(`/api/v1/realtime/polling/${chat.id}/shared`)
      .expect(401);
    await http(2).get(`polling/${chat.id}/shared`).expect(403);
    await http(1).get(`polling/${chat.id}/shared?kind=GIF`).expect(400);
    const counts = await http(1).get(`polling/${chat.id}/shared`).expect(200);
    expect(counts.body.data.counts).toEqual({
      IMAGE: 1,
      VIDEO: 0,
      AUDIO: 0,
      LINK: 25,
    });
    const images = await http(1)
      .get(`polling/${chat.id}/shared?kind=IMAGE`)
      .expect(200);
    expect(images.body.data.messages.map((m: any) => m.id)).toEqual([photo.id]);
    const first = await http(1)
      .get(`polling/${chat.id}/shared?kind=LINK`)
      .expect(200);
    expect(first.body.data.messages).toHaveLength(20);
    const second = await http(1)
      .get(
        `polling/${chat.id}/shared?kind=LINK&beforeId=${first.body.data.nextCursor}`,
      )
      .expect(200);
    expect(second.body.data.messages).toHaveLength(5);
    expect(second.body.data.nextCursor).toBeNull();
    await http(0)
      .delete(`chats/${chat.id}/messages`)
      .send({ messageIds: [photo.id] })
      .expect(200);
    expect(
      (await http(1).get(`polling/${chat.id}/shared`).expect(200)).body.data
        .counts.IMAGE,
    ).toBe(0);
    await http(0).delete(`groups/${chat.id}/members/${ids[1]}`).expect(200);
    await http(1).get(`polling/${chat.id}/shared?kind=LINK`).expect(403);
    await http(0).delete(`chats/${chat.id}`).expect(200);
  });
  it('persists one reaction per participant, broadcasts changes, and removes reactions with the message', async () => {
    const chat = await create({
      isGroup: true,
      name: 'Reactions',
      participant: [ids[1]],
      firstMessage: 'React here',
    });
    const message = await prisma.message.findFirstOrThrow({
      where: { chatId: chat.id },
    });
    const path = `/api/v1/realtime/chats/${chat.id}/messages/${message.id}/reaction`;
    const react = (index: number, emoji: string | null) =>
      request(base)
        .put(path)
        .auth(tokens[index], { type: 'bearer' })
        .send({ emoji });
    await request(base).put(path).send({ emoji: '👍' }).expect(401);
    await react(2, '👍').expect(404);
    await react(1, 'not an emoji').expect(400);
    await react(1, '👍🔥').expect(400);

    const peer = await socket(0);
    const changed = once(peer, 'message:reactions');
    const first = await react(1, '👍').expect(200);
    expect(await changed).toEqual(first.body.data);
    await react(0, '👍').expect(200);
    await react(1, '❤️‍🔥').expect(200);
    const history = await http(0).get(`polling/${chat.id}`).expect(200);
    const [saved] = history.body.data.chats;
    expect(saved.reactions).toEqual([
      { userId: ids[0], emoji: '👍' },
      { userId: ids[1], emoji: '❤️‍🔥' },
    ]);
    const removed = await react(1, null).expect(200);
    expect(removed.body.data.reactionVersion).toBeGreaterThan(
      saved.reactionVersion,
    );
    expect(removed.body.data.reactions).toEqual([
      { userId: ids[0], emoji: '👍' },
    ]);
    await http(0)
      .delete(`chats/${chat.id}/messages`)
      .send({ messageIds: [message.id] })
      .expect(200);
    expect(
      await prisma.messageReaction.count({ where: { messageId: message.id } }),
    ).toBe(0);
  });
});
