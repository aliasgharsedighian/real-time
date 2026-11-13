import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import sharp = require('sharp');
import { FilesUploadService } from '../src/modules/files-upload/files-upload.service';
import { ChatService } from '../src/gateway/chat/chat.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/libs/db/prisma/prisma.service';
import { mkdtemp, rm, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { io } = require('../../frontend/node_modules/socket.io-client');

describe('groups with PostgreSQL, HTTP authentication and Socket.IO', () => {
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
  it('validates group inputs and keeps direct conversation reuse', async () => {
    await request(base)
      .post('/api/v1/realtime/polling/create-chat')
      .send({ participant: [ids[1]] })
      .expect(401);
    for (const body of [
      { participant: [] },
      { participant: [ids[0]] },
      { participant: [0] },
      { participant: [1.5] },
      { participant: [ids[1], ids[2]] },
      { participant: [ids[1]], isGroup: true, name: '   ' },
      { participant: [ids[1]], isGroup: true, name: 'x'.repeat(101) },
      { participant: [ids[1], ids[2]], isGroup: false },
      { participant: [2147483647], isGroup: true, name: 'Missing user' },
      { participant: Array(100).fill(ids[1]), isGroup: true, name: 'Too big' },
    ])
      await http().post('polling/create-chat').send(body).expect(400);
    const direct = await create({ participant: [ids[1]] });
    expect(direct.isGroup).toBe(false);
    const reused = await http(1)
      .post('polling/create-chat')
      .send({ participant: [ids[0]] })
      .expect(201);
    expect(reused.body.data.id).toBe(direct.id);
    const group = await create({
      participant: [ids[1]],
      isGroup: true,
      name: 'Two people',
    });
    expect(group.id).not.toBe(direct.id);
    expect(group.isGroup).toBe(true);
    await http().patch(`groups/${direct.id}`).send({ name: 'No' }).expect(400);
  });
  it('serializes concurrent direct creation and enforces group capacity during concurrent additions', async () => {
    const pair = await Promise.all([
      http(2)
        .post('polling/create-chat')
        .send({ participant: [ids[3]] })
        .expect(201),
      http(3)
        .post('polling/create-chat')
        .send({ participant: [ids[2]] })
        .expect(201),
    ]);
    chatIds.push(pair[0].body.data.id, pair[1].body.data.id);
    expect(pair[0].body.data.id).toBe(pair[1].body.data.id);
    const extras: number[] = [];
    for (let i = 0; i < 98; i++) {
      const u = await prisma.user.create({
        data: { email: `capacity-${Date.now()}-${i}@example.invalid` },
      });
      extras.push(u.id);
      ids.push(u.id);
    }
    const group = await create({
      participant: extras,
      isGroup: true,
      name: 'Capacity test',
    });
    const additions = await Promise.all([
      http()
        .post(`groups/${group.id}/members`)
        .send({ participant: [ids[1]] }),
      http()
        .post(`groups/${group.id}/members`)
        .send({ participant: [ids[2]] }),
    ]);
    expect(additions.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(
      await prisma.chatParticipant.count({ where: { chatId: group.id } }),
    ).toBe(100);
  });

  it('restricts group photos to the owner, shares with members, publishes reactable photo history and keeps previous photos', async () => {
    const chat = await create({
      participant: [ids[1]],
      isGroup: true,
      name: 'Photo group',
    });
    const member = await socket(1);
    const picture = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#2584ac' },
    })
      .png()
      .toBuffer();
    const upload = (index: number) =>
      request(base)
        .post(`/api/v1/files/groups/${chat.id}/avatar`)
        .auth(tokens[index], { type: 'bearer' })
        .attach('file', picture, 'group.png');
    for (const index of [1, 2]) await upload(index).expect(403);
    await request(base)
      .post(`/api/v1/files/groups/${chat.id}/avatar`)
      .attach('file', picture, 'group.png')
      .expect(401);
    await request(base)
      .post(`/api/v1/files/groups/${chat.id}/avatar`)
      .auth(tokens[0], { type: 'bearer' })
      .attach('file', Buffer.from('<svg/>'), 'bad.png')
      .expect(400);
    await request(base)
      .post(`/api/v1/files/groups/${chat.id}/avatar`)
      .auth(tokens[0], { type: 'bearer' })
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.png')
      .expect(413);
    await member.timeout(5000).emitWithAck('chat:join', { chatId: chat.id });
    const update = once(member, 'chat:updated');
    const photoActivity = once(member, 'message:new');
    const first = await upload(0).expect(201);
    expect((await update).chatId).toBe(chat.id);
    const firstId = first.body.avatarId;
    const event = await photoActivity;
    expect(event).toMatchObject({
      kind: 'GROUP_PHOTO_CHANGED',
      content: 'Member 0 changed the group photo.',
      attachments: [{ id: firstId }],
    });
    const react = (index: number) =>
      request(base)
        .put(`/api/v1/realtime/chats/${chat.id}/messages/${event.id}/reaction`)
        .auth(tokens[index], { type: 'bearer' })
        .send({ emoji: '👍' });
    await react(2).expect(404);
    const reaction = await react(1).expect(200);
    expect(reaction.body.data.reactions).toMatchObject([
      { emoji: '👍', userId: ids[1] },
    ]);
    const read = (index: number, id = firstId) =>
      request(base)
        .get(`/api/v1/files/${id}/content`)
        .auth(tokens[index], { type: 'bearer' });
    await read(1)
      .expect(200)
      .expect('Content-Type', /image\/webp/);
    await read(2).expect(403);
    expect(
      (await http(1).get(`polling/${chat.id}`).expect(200)).body.data.chat
        .avatarId,
    ).toBe(firstId);
    expect(
      (await member.timeout(5000).emitWithAck('chat:list')).find(
        (c: any) => c.id === chat.id,
      ).avatarId,
    ).toBe(firstId);
    const owner = await socket(0);
    const claim = await owner.timeout(5000).emitWithAck('message:send', {
      chatId: chat.id,
      content: '',
      attachmentId: firstId,
    });
    expect(claim.id).toBeUndefined();
    await request(base)
      .delete(`/api/v1/files/${firstId}`)
      .auth(tokens[0], { type: 'bearer' })
      .expect(404);
    await read(1).expect(200);
    const stored = await prisma.uploadFile.update({
      where: { id: firstId },
      data: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    await app.get(FilesUploadService).cleanup();
    await read(1).expect(200);
    const replacement = once(member, 'message:new');
    const second = await upload(0).expect(201);
    expect((await replacement).attachments[0].id).toBe(second.body.avatarId);
    expect(second.body.avatarId).not.toBe(firstId);
    expect(
      await prisma.uploadFile.findUnique({ where: { id: firstId } }),
    ).toMatchObject({ messageId: event.id });
    await access(join(directory, stored.storageKey));
    await read(1).expect(200);
    await read(2).expect(403);
    const history = await http(1).get(`polling/${chat.id}`).expect(200);
    expect(history.body.data.chats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: event.id,
          attachments: [expect.objectContaining({ id: firstId })],
          reactions: [expect.objectContaining({ emoji: '👍', userId: ids[1] })],
        }),
      ]),
    );
    await http().post(`groups/${chat.id}/owner/${ids[1]}`).expect(201);
    await upload(0).expect(403);
    await request(base)
      .delete(`/api/v1/files/groups/${chat.id}/avatar`)
      .auth(tokens[0], { type: 'bearer' })
      .expect(403);
    const removal = once(member, 'message:new');
    for (let attempt = 0; attempt < 2; attempt++)
      await request(base)
        .delete(`/api/v1/files/groups/${chat.id}/avatar`)
        .auth(tokens[1], { type: 'bearer' })
        .expect(200);
    expect(await removal).toMatchObject({
      kind: 'GROUP_PHOTO_REMOVED',
      content: 'Member 1 removed the group photo.',
      attachments: [],
    });
    expect(
      await prisma.message.count({
        where: { chatId: chat.id, kind: 'GROUP_PHOTO_REMOVED' },
      }),
    ).toBe(1);
    await read(1, second.body.avatarId).expect(200);
    expect(
      (await prisma.chat.findUniqueOrThrow({ where: { id: chat.id } }))
        .avatarId,
    ).toBeNull();
    const third = await upload(1).expect(201);
    await http(1).delete(`groups/${chat.id}/members/${ids[0]}`).expect(200);
    await read(0, third.body.avatarId).expect(403);
    await read(1, third.body.avatarId).expect(200);
    expect(await readdir(join(directory, 'tmp'))).toEqual([]);
  });

  it('marks skipped unread messages across history pages through the requested last message', async () => {
    const group = await create({
      participant: [ids[1]],
      isGroup: true,
      name: 'Read through',
    });
    const messages = await prisma.message.createManyAndReturn({
      data: Array.from({ length: 55 }, () => ({
        chatId: group.id,
        senderId: ids[0],
        content: 'Incoming message',
      })),
      select: { id: true },
    });
    const ordered = messages.map(({ id }) => id).sort((a, b) => a - b);
    const throughMessageId = ordered[53];
    const reader = await socket(1);
    const readThrough = (id: number) =>
      reader.timeout(5000).emitWithAck('message:read-through', {
        chatId: group.id,
        throughMessageId: id,
      });

    expect(await readThrough(throughMessageId)).toEqual({ unreadCount: 1 });
    expect(await readThrough(throughMessageId)).toEqual({ unreadCount: 1 });
    expect(
      await prisma.messageReadStatus.findMany({
        where: { userId: ids[1], message: { chatId: group.id } },
        select: { messageId: true },
        orderBy: { messageId: 'asc' },
      }),
    ).toEqual(ordered.slice(0, 54).map((messageId) => ({ messageId })));
    expect(await readThrough(ordered[54])).toEqual({ unreadCount: 0 });
  });

  it('protects named message readers, preserves first-seen times and rejects forged or cross-chat receipts', async () => {
    const group = await create({
      participant: [ids[1], ids[2]],
      isGroup: true,
      name: 'Readers',
    });
    const other = await create({
      participant: [ids[1]],
      isGroup: true,
      name: 'Other readers',
    });
    const message = (
      await http()
        .post('polling')
        .send({ chatId: group.id, content: 'Read me' })
        .expect(201)
    ).body.data;
    const elsewhere = (
      await http()
        .post('polling')
        .send({ chatId: other.id, content: 'Other room' })
        .expect(201)
    ).body.data;
    const url = `chats/${group.id}/messages/${message.id}/readers`;
    await request(base).get(`/api/v1/realtime/${url}`).expect(401);
    expect((await http().get(url).expect(200)).body.data).toEqual([]);
    await http(1).get(url).expect(404);
    await http(3).get(url).expect(404);
    await http()
      .get(`chats/${other.id}/messages/${message.id}/readers`)
      .expect(404);
    await http().get(`chats/${group.id}/messages/invalid/readers`).expect(400);
    const reader = await socket(1),
      second = await socket(2),
      outsider = await socket(3);
    const read = (client: any, messageIds: number[], extra: object = {}) =>
      client.timeout(5000).emitWithAck('message:read', {
        chatId: group.id,
        messageIds,
        ...extra,
      });
    await read(outsider, [message.id], { userId: ids[1] });
    expect(
      await prisma.messageReadStatus.count({
        where: { messageId: message.id },
      }),
    ).toBe(0);
    const receipts = await read(
      reader,
      [message.id, message.id, elsewhere.id],
      { userId: ids[2], readAt: '2000-01-01' },
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].userId).toBe(ids[1]);
    expect(
      await prisma.messageReadStatus.count({
        where: { messageId: elsewhere.id },
      }),
    ).toBe(0);
    const firstSeen = new Date('2026-01-01T12:34:56.000Z');
    await prisma.messageReadStatus.update({
      where: { messageId_userId: { messageId: message.id, userId: ids[1] } },
      data: { readAt: firstSeen },
    });
    const repeated = await read(reader, [message.id]);
    expect(repeated[0].readAt).toBe(firstSeen.toISOString());
    await read(second, [message.id]);
    const readers = (await http().get(url).expect(200)).body.data;
    expect(readers.map((r: any) => r.userId)).toEqual([ids[1], ids[2]]);
    expect(readers[0].readAt).toBe(firstSeen.toISOString());
    expect(readers[0].user.profile.firstname).toBe('Member 1');
    expect(JSON.stringify(readers)).not.toMatch(/password|address|phoneNumber/);
    await http(1).delete(`groups/${group.id}/members/${ids[1]}`).expect(200);
    await expect(
      app.get(ChatService).markMessagesRead(ids[1], [message.id], group.id),
    ).rejects.toThrow('Conversation unavailable');
    await read(reader, [message.id]);
    expect((await http().get(url).expect(200)).body.data).toHaveLength(2);
    const self = await socket(0);
    expect(await read(self, [message.id])).toEqual([]);
    await expect(
      app.get(ChatService).markMessagesRead(ids[2], [2147483648], group.id),
    ).rejects.toThrow('Invalid message IDs');
    await http()
      .delete(`chats/${group.id}/messages`)
      .send({ messageIds: [message.id] })
      .expect(200);
    await http().get(url).expect(404);
    expect(
      await prisma.messageReadStatus.count({
        where: { messageId: message.id },
      }),
    ).toBe(0);
  });

  it('records each newly added member once, broadcasts immediately and preserves activity after reload', async () => {
    const chat = await create({
      participant: [ids[1]],
      isGroup: true,
      name: 'Invitations',
    });
    const owner = await socket(0);
    await owner.timeout(5000).emitWithAck('chat:join', { chatId: chat.id });
    await http(1)
      .post(`groups/${chat.id}/members`)
      .send({ participant: [ids[2]] })
      .expect(403);
    const delivered: any[] = [];
    owner.on('message:new', (message: any) => {
      if (message.chatId === chat.id) delivered.push(message);
    });
    await http()
      .post(`groups/${chat.id}/members`)
      .send({ participant: [ids[2], ids[2], ids[1], ids[3]] })
      .expect(201);
    await owner.timeout(5000).emitWithAck('chat:list');
    expect(delivered.map((m) => m.content)).toEqual([
      'Member 2 was added to the group.',
      'Member 3 was added to the group.',
    ]);
    expect(delivered.every((m) => m.kind === 'MEMBER_ADDED')).toBe(true);
    await http()
      .post(`groups/${chat.id}/members`)
      .send({ participant: [ids[2], ids[3]] })
      .expect(201);
    expect(
      await prisma.message.count({
        where: { chatId: chat.id, kind: 'MEMBER_ADDED' },
      }),
    ).toBe(2);
    const history = await http(2).get(`polling/${chat.id}`).expect(200);
    expect(
      history.body.data.chats.filter((m: any) => m.kind === 'MEMBER_ADDED'),
    ).toHaveLength(2);
    expect(history.body.data.unreadCount).toBe(0);
    const inbox = await owner.timeout(5000).emitWithAck('chat:list');
    expect(inbox.find((c: any) => c.id === chat.id)._count.messages).toBe(0);
    await http()
      .post(`groups/${chat.id}/members`)
      .send({ participant: [2147483647] })
      .expect(400);
    expect(
      await prisma.message.count({
        where: { chatId: chat.id, kind: 'MEMBER_ADDED' },
      }),
    ).toBe(2);
    await http(2).delete(`groups/${chat.id}/members/${ids[2]}`).expect(200);
    await http()
      .post(`groups/${chat.id}/members`)
      .send({ participant: [ids[2]] })
      .expect(201);
    expect(
      await prisma.message.count({
        where: { chatId: chat.id, kind: 'MEMBER_ADDED' },
      }),
    ).toBe(3);
  });

  it('persists and broadcasts named departure events without unread counts or client-forged event types', async () => {
    const chat = await create({
      participant: [ids[1], ids[2]],
      isGroup: true,
      name: 'Activity group',
    });
    const owner = await socket(0),
      remaining = await socket(2);
    await owner.timeout(5000).emitWithAck('chat:join', { chatId: chat.id });
    await remaining.timeout(5000).emitWithAck('chat:join', { chatId: chat.id });
    await http(1).delete(`groups/${chat.id}/members/${ids[2]}`).expect(403);
    expect(await prisma.message.count({ where: { chatId: chat.id } })).toBe(0);
    const notification = once(owner, 'message:new');
    await http(1).delete(`groups/${chat.id}/members/${ids[1]}`).expect(200);
    const event = await notification;
    expect(event).toMatchObject({
      chatId: chat.id,
      kind: 'MEMBER_LEFT',
      content: 'Member 1 left the group.',
      senderId: ids[1],
    });
    await http(1).delete(`groups/${chat.id}/members/${ids[1]}`).expect(404);
    expect(await prisma.message.count({ where: { chatId: chat.id } })).toBe(1);
    const inbox = await owner.timeout(5000).emitWithAck('chat:list');
    expect(inbox.find((c: any) => c.id === chat.id)._count.messages).toBe(0);
    expect(inbox.find((c: any) => c.id === chat.id).messages[0].content).toBe(
      'Member 1 left the group.',
    );
    const history = await http().get(`polling/${chat.id}`).expect(200);
    expect(history.body.data.chats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: event.id, kind: 'MEMBER_LEFT' }),
      ]),
    );
    expect(history.body.data.unreadMessages).toHaveLength(0);
    await owner
      .timeout(5000)
      .emitWithAck('message:read', { chatId: chat.id, messageIds: [event.id] });
    expect(
      await prisma.messageReadStatus.count({ where: { messageId: event.id } }),
    ).toBe(0);
    const forged = await owner.timeout(5000).emitWithAck('message:send', {
      chatId: chat.id,
      content: 'Regular text',
      kind: 'MEMBER_LEFT',
    });
    expect(forged.kind).toBe('TEXT');
    await http()
      .post('polling')
      .send({ chatId: chat.id, content: 'Fake', kind: 'MEMBER_LEFT' })
      .expect(400);
    const removed = once(owner, 'message:new');
    await http().delete(`groups/${chat.id}/members/${ids[2]}`).expect(200);
    expect(await removed).toMatchObject({
      kind: 'MEMBER_REMOVED',
      content: 'Member 0 removed Member 2 from the group.',
    });
    const reloaded = await http().get(`polling/${chat.id}`).expect(200);
    expect(
      reloaded.body.data.chats.filter((m: any) => m.kind !== 'TEXT'),
    ).toHaveLength(2);
  });

  it('delivers to multiple members, protects management, keeps independent reads and evicts removed sockets', async () => {
    const owner = await socket(0),
      member = await socket(1),
      second = await socket(2),
      outsider = await socket(3);
    const invite = once(member, 'chat:updated');
    const chat = await create({
      participant: [ids[1], ids[2], ids[2]],
      name: '  Project team  ',
    });
    const id = chat.id;
    expect((await invite).chatId).toBe(id);
    expect(chat.name).toBe('Project team');
    expect(chat.participants).toHaveLength(3);
    expect(
      chat.participants
        .filter((p: any) => p.role === 'OWNER')
        .map((p: any) => p.userId),
    ).toEqual([ids[0]]);
    expect(JSON.stringify(chat)).not.toContain('password');
    for (const client of [owner, member, second])
      expect(
        (await client.timeout(5000).emitWithAck('chat:join', { chatId: id }))
          .chatId,
      ).toBe(id);
    expect(
      (await outsider.timeout(5000).emitWithAck('chat:join', { chatId: id }))
        .message,
    ).toBe('Not a participant');
    await http(3).get(`polling/${id}`).expect(403);
    await http(3).get(`polling/unread/${id}`).expect(403);
    await http(1).patch(`groups/${id}`).send({ name: 'No' }).expect(403);
    await http(1)
      .post(`groups/${id}/members`)
      .send({ participant: [ids[3]] })
      .expect(403);
    await http(1).delete(`groups/${id}/members/${ids[2]}`).expect(403);
    await http(1).post(`groups/${id}/owner/${ids[1]}`).expect(403);
    const firstDelivery = once(member, 'message:new'),
      secondDelivery = once(second, 'message:new');
    const message = await owner
      .timeout(5000)
      .emitWithAck('message:send', { chatId: id, content: 'Hello everyone' });
    expect((await firstDelivery).id).toBe(message.id);
    expect((await secondDelivery).id).toBe(message.id);
    const unreadBefore = await second.timeout(5000).emitWithAck('chat:list');
    expect(unreadBefore.find((c: any) => c.id === id)._count.messages).toBe(1);
    const history = await http(1).get(`polling/${id}`).expect(200);
    expect(history.body.data.chat.name).toBe('Project team');
    expect(history.body.data.chat.participants).toHaveLength(3);
    expect(history.body.data.unreadCount).toBe(1);
    expect(
      await prisma.messageReadStatus.count({
        where: { messageId: message.id },
      }),
    ).toBe(0);
    const another = await owner
      .timeout(5000)
      .emitWithAck('message:send', { chatId: id, content: 'Second message' });
    const receipts = await member
      .timeout(5000)
      .emitWithAck('message:read', { chatId: id, messageIds: [message.id] });
    expect(receipts).toHaveLength(1);
    expect(
      await prisma.messageReadStatus.count({
        where: { messageId: another.id },
      }),
    ).toBe(0);
    const inboxMember = await member.timeout(5000).emitWithAck('chat:list');
    const inboxSecond = await second.timeout(5000).emitWithAck('chat:list');
    expect(inboxMember.find((c: any) => c.id === id)._count.messages).toBe(1);
    expect(inboxSecond.find((c: any) => c.id === id)._count.messages).toBe(2);
    const updated = once(second, 'chat:updated');
    await http()
      .patch(`groups/${id}`)
      .send({ name: 'New team name' })
      .expect(200);
    expect((await updated).chatId).toBe(id);
    await http()
      .post(`groups/${id}/members`)
      .send({ participant: [ids[3], ids[3]] })
      .expect(201);
    expect(await prisma.chatParticipant.count({ where: { chatId: id } })).toBe(
      4,
    );
    await http(3).get(`polling/${id}`).expect(200);
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#2584ac' },
    })
      .jpeg()
      .toBuffer();
    const upload = await request(base)
      .post(`/api/v1/files/chats/${id}`)
      .auth(tokens[0], { type: 'bearer' })
      .attach('file', image, 'group.jpg')
      .expect(201);
    await owner.timeout(5000).emitWithAck('message:send', {
      chatId: id,
      content: '',
      attachmentId: upload.body.id,
    });
    await request(base)
      .get(`/api/v1/files/${upload.body.id}/content`)
      .auth(tokens[1], { type: 'bearer' })
      .expect(200);
    const removal = once(member, 'chat:removed');
    await http().delete(`groups/${id}/members/${ids[1]}`).expect(200);
    expect((await removal).chatId).toBe(id);
    await request(base)
      .get(`/api/v1/files/${upload.body.id}/content`)
      .auth(tokens[1], { type: 'bearer' })
      .expect(403);
    await http(1).get(`polling/${id}`).expect(403);
    expect(
      (
        await member
          .timeout(5000)
          .emitWithAck('message:send', { chatId: id, content: 'Not allowed' })
      ).id,
    ).toBeUndefined();
    let receivedAfterRemoval = false;
    member.on('message:new', () => {
      receivedAfterRemoval = true;
    });
    await owner
      .timeout(5000)
      .emitWithAck('message:send', { chatId: id, content: 'Members only' });
    // A second ack round-trip ensures earlier broadcasts had time to reach connected clients.
    await member.timeout(5000).emitWithAck('chat:list');
    expect(receivedAfterRemoval).toBe(false);
    expect(
      (await member.timeout(5000).emitWithAck('chat:join', { chatId: id }))
        .chatId,
    ).toBeUndefined();
    await http().post(`groups/${id}/owner/${ids[2]}`).expect(201);
    await http()
      .patch(`groups/${id}`)
      .send({ name: 'Former owner' })
      .expect(403);
    await http(2).patch(`groups/${id}`).send({ name: 'New owner' }).expect(200);
    await http(2).delete(`groups/${id}/members/${ids[2]}`).expect(200);
    const newOwner = await prisma.chatParticipant.findFirstOrThrow({
      where: { chatId: id, role: 'OWNER' },
    });
    expect(newOwner.userId).toBe(ids[0]);
    await http().delete(`groups/${id}/members/${ids[0]}`).expect(200);
    await http(3).delete(`groups/${id}/members/${ids[3]}`).expect(200);
    expect(await prisma.chatParticipant.count({ where: { chatId: id } })).toBe(
      0,
    );
    await http()
      .post(`groups/${id}/members`)
      .send({ participant: [ids[1]] })
      .expect(404);
  });
});
