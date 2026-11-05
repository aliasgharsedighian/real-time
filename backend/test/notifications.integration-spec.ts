import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/libs/db/prisma/prisma.service';
import { FirebasePushService } from '../src/modules/notifications/firebase-push.service';
const { io } = require('../../frontend/node_modules/socket.io-client');

// Real PostgreSQL, HTTP and sockets; only Google's delivery transport is replaced.
describe('message notification integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let base: string;
  const ids: number[] = [],
    tokens: string[] = [],
    chatIds: number[] = [];
  const sockets: any[] = [];
  const sent: any[] = [];
  const send = jest.fn(async (message: any) => {
    sent.push(message);
    return { responses: message.tokens.map(() => ({ success: true })) };
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebasePushService)
      .useValue({ configured: true, send })
      .compile();
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
          email: `notification-${randomUUID()}@example.invalid`,
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
    for (const isGroup of [false, true]) {
      const chat = await prisma.chat.create({
        data: {
          isGroup,
          name: isGroup ? 'Notification test group' : null,
          participants: {
            create: ids.slice(0, isGroup ? 3 : 2).map((userId) => ({ userId })),
          },
        },
      });
      chatIds.push(chat.id);
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
  });
  const http = (index: number) => ({
    put: (path: string, data: object) =>
      request(base)
        .put(`/api/v1/${path}`)
        .auth(tokens[index], { type: 'bearer' })
        .send(data),
    delete: (path: string) =>
      request(base)
        .delete(`/api/v1/${path}`)
        .auth(tokens[index], { type: 'bearer' }),
  });
  async function socket(index: number) {
    const client = io(`${base}/chat`, {
      auth: { token: tokens[index] },
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  }
  async function until(check: () => boolean) {
    const deadline = Date.now() + 3000;
    while (!check()) {
      if (Date.now() > deadline) throw new Error('Notification did not arrive');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  const device = randomUUID();
  it('authenticates registration, transfers rotated browser tokens, and scopes deletion to the owner', async () => {
    await request(base)
      .put('/api/v1/notifications/subscription')
      .send({ installationId: device, token: 'test-notification-token-long' })
      .expect(401);
    await http(1)
      .put('notifications/subscription', {
        installationId: device,
        token: 'test-notification-token-long',
      })
      .expect(200);
    await http(0).delete(`notifications/subscription/${device}`).expect(200);
    expect(
      await prisma.pushSubscription.count({
        where: { installationId: device },
      }),
    ).toBe(1);
    await http(0)
      .put('notifications/subscription', {
        installationId: device,
        token: 'test-rotated-token-long-value',
      })
      .expect(200);
    expect(
      (
        await prisma.pushSubscription.findUniqueOrThrow({
          where: { installationId: device },
        })
      ).userId,
    ).toBe(ids[0]);
    await http(1)
      .put('notifications/subscription', {
        installationId: device,
        token: 'test-notification-token-long',
      })
      .expect(200);
    await http(2)
      .put('notifications/subscription', {
        installationId: randomUUID(),
        token: 'test-offline-third-user-token',
      })
      .expect(200);
    await http(1)
      .put('notifications/subscription', {
        installationId: 'bad',
        token: 'short',
      })
      .expect(400);
  });
  it.each([false, true])(
    'applies all three states for a %s group conversation and handles captions/media',
    async (group) => {
      const chatId = chatIds[group ? 1 : 0];
      const sender = await socket(0),
        recipient = await socket(1),
        extraTab = await socket(1);
      const banners: any[] = [],
        duplicates: any[] = [];
      recipient.on('notification:new', (data: any) => banners.push(data));
      extraTab.on('notification:new', (data: any) => duplicates.push(data));
      const ack = (client: any, event: string, payload: unknown) =>
        client.timeout(3000).emitWithAck(event, payload);
      // Other page: one selected active tab receives the banner, independent of FCM.
      await ack(recipient, 'notification:presence', {
        active: true,
        chatId: null,
      });
      const first = await ack(sender, 'message:send', {
        chatId,
        content: 'Hello outside chat',
      });
      expect(first.id).toBeGreaterThan(0);
      await until(() => banners.length === 1);
      expect(banners[0]).toMatchObject({
        chatId: String(chatId),
        recipientId: String(ids[1]),
        senderName: 'Member 0',
      });
      expect(duplicates).toHaveLength(0);
      // The same chat in another active tab silences banners AND push for that user.
      await ack(extraTab, 'chat:join', { chatId });
      await ack(extraTab, 'notification:presence', { active: true, chatId });
      const baseline = sent.length;
      await ack(sender, 'message:send', {
        chatId,
        content: 'Already reading this chat',
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(banners).toHaveLength(1);
      expect(
        sent.slice(baseline).some((m) => m.data.recipientId === String(ids[1])),
      ).toBe(false);
      // Hidden tab holding the room must receive browser push, with typed media labels.
      await ack(recipient, 'notification:presence', {
        active: false,
        chatId: null,
      });
      await ack(extraTab, 'notification:presence', { active: false, chatId });
      for (const [kind, label] of [
        ['IMAGE', 'Photo'],
        ['VIDEO', 'Video'],
        ['AUDIO', 'Voice message'],
      ]) {
        const file = await prisma.uploadFile.create({
          data: {
            storageKey: randomUUID(),
            kind,
            mimeType:
              kind === 'IMAGE'
                ? 'image/png'
                : kind === 'VIDEO'
                  ? 'video/mp4'
                  : 'audio/webm',
            size: 100,
            width: 1,
            height: 1,
            chatId,
            ownerId: ids[0],
          },
        });
        const count = sent.length;
        const message = await ack(sender, 'message:send', {
          chatId,
          content: 'Caption',
          attachmentId: file.id,
        });
        await until(() =>
          sent
            .slice(count)
            .some(
              (m) =>
                m.data.messageId === String(message.id) &&
                m.data.recipientId === String(ids[1]),
            ),
        );
        const push = sent
          .slice(count)
          .find((m) => m.data.recipientId === String(ids[1]));
        expect(push.data.body).toContain(`${label} · Caption`);
        expect(push.data.mediaKind).toBe(kind);
        expect(push.notification).toBeUndefined(); // no automatic OS notification bypassing our policy
        expect(JSON.stringify(push)).not.toContain(file.storageKey);
      }
      sender.disconnect();
      recipient.disconnect();
      extraTab.disconnect();
    },
  );
  it('REST sends use the same pipeline, and Firebase failure cannot reject a saved message', async () => {
    send.mockRejectedValueOnce(new Error('Google blocked'));
    const response = await request(base)
      .post('/api/v1/realtime/polling')
      .auth(tokens[0], { type: 'bearer' })
      .send({ chatId: chatIds[0], content: 'HTTP survives Firebase failure' })
      .expect(201);
    expect(response.body.data.id).toBeGreaterThan(0);
    expect(
      await prisma.message.findUnique({ where: { id: response.body.data.id } }),
    ).not.toBeNull();
  });
});
