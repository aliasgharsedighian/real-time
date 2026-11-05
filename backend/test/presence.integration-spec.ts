import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/libs/db/prisma/prisma.service';
import { PresenceService } from '../src/modules/presence/presence.service';
import { PrismaClient } from '@prisma/client';
const { io } = require('../../frontend/node_modules/socket.io-client');

describe('last seen and typing over authenticated sockets', () => {
  let app: INestApplication,
    prisma: PrismaService,
    base: string,
    chatId: number;
  const ids: number[] = [],
    tokens: string[] = [],
    sockets: any[] = [];
  const accountUpdatedAt: Date[] = [];
  beforeAll(async () => {
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
    for (let index = 0; index < 3; index++) {
      const user = await prisma.user.create({
        data: {
          email: `presence-${randomUUID()}@example.invalid`,
          profile: { create: { firstname: `Member${index}` } },
        },
      });
      ids.push(user.id);
      accountUpdatedAt.push(user.updatedAt);
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
        participants: { create: ids.slice(0, 2).map((userId) => ({ userId })) },
      },
    });
    chatId = chat.id;
  });
  afterAll(async () => {
    for (const client of sockets) client.disconnect();
    if (app) {
      await until(() =>
        ids.every((id) => !app.get(PresenceService).online(id)),
      );
      await app.get(PresenceService).onModuleDestroy();
    }
    if (app) await app.close();
    // Gateway shutdown flushes disconnect writes before removing disposable records.
    if (prisma) {
      const cleanup = new PrismaClient();
      await cleanup.chatParticipant.deleteMany({ where: { chatId } });
      await cleanup.chat.deleteMany({ where: { id: chatId } });
      await cleanup.profile.deleteMany({ where: { userId: { in: ids } } });
      await cleanup.user.deleteMany({ where: { id: { in: ids } } });
      await cleanup.$disconnect();
    }
  });
  async function connect(index: number) {
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
  const ack = (client: any, event: string, payload: object) =>
    client.timeout(3000).emitWithAck(event, payload);
  async function until(check: () => boolean | Promise<boolean>) {
    const deadline = Date.now() + 4000;
    while (!(await check())) {
      if (Date.now() > deadline)
        throw new Error('Expected presence transition did not arrive');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  const profile = (index: number, data: object) =>
    request(base)
      .put('/api/v1/auth/update-profile')
      .auth(tokens[index], { type: 'bearer' })
      .send(data);
  it('authorizes snapshots, derives typing identity, and handles multiple tabs, leave and disconnect', async () => {
    const observer = await connect(0),
      member = await connect(1),
      tab = await connect(1),
      outsider = await connect(2);
    await ack(observer, 'chat:join', { chatId });
    await ack(member, 'chat:join', { chatId });
    const online = await ack(observer, 'chat:presence', { chatId });
    expect(
      online.users.find((user: any) => user.userId === ids[1]),
    ).toMatchObject({ online: true, lastSeenAt: null });
    expect((await ack(outsider, 'chat:presence', { chatId })).message).toBe(
      'Not a participant',
    );
    const starts: any[] = [],
      stops: any[] = [],
      changes: any[] = [];
    observer.on('typing:start', (data: any) => starts.push(data));
    observer.on('typing:stop', (data: any) => stops.push(data));
    observer.on('chat:presence', (data: any) => changes.push(...data.users));
    await ack(observer, 'chat:leave', { chatId });
    await ack(member, 'typing:start', {
      chatId,
      userId: ids[0],
      username: 'FORGED',
    });
    await until(() => starts.length > 0);
    expect(starts.at(-1)).toMatchObject({
      userId: ids[1],
      username: 'Member1',
    });
    expect(await ack(outsider, 'typing:list', {})).toEqual([]);
    expect(await ack(observer, 'typing:list', {})).toEqual([
      { chatId, userId: ids[1], username: 'Member1' },
    ]);
    // An observer arriving after typing began still sees the existing draft.
    await ack(observer, 'chat:leave', { chatId });
    starts.length = 0;
    await ack(observer, 'chat:join', { chatId });
    await until(() => starts.some((entry) => entry.userId === ids[1]));
    await ack(member, 'chat:leave', { chatId });
    await until(() => stops.length === 1);
    await ack(member, 'chat:join', { chatId });
    await ack(member, 'typing:start', { chatId });
    member.disconnect();
    await until(() => stops.length === 2);
    expect(
      (await ack(observer, 'chat:presence', { chatId })).users.find(
        (user: any) => user.userId === ids[1],
      ).online,
    ).toBe(true);
    tab.disconnect();
    await until(() =>
      changes.some((user) => user.userId === ids[1] && !user.online),
    );
    const offline = (
      await ack(observer, 'chat:presence', { chatId })
    ).users.find((user: any) => user.userId === ids[1]);
    expect(offline.online).toBe(false);
    expect(Date.now() - new Date(offline.lastSeenAt).getTime()).toBeLessThan(
      5000,
    );
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } }))
        .updatedAt,
    ).toEqual(accountUpdatedAt[1]);
  });
  it('persists the profile switch, validates booleans, and never leaks private timestamps', async () => {
    const observer = sockets[0];
    await profile(1, { showLastSeen: 'false' }).expect(400);
    await profile(1, { showLastSeen: false }).expect(200);
    const self = await request(base)
      .get('/api/v1/auth/user-info')
      .auth(tokens[1], { type: 'bearer' })
      .expect(200);
    expect(self.body.data.profile.showLastSeen).toBe(false);
    const publicUser = await request(base)
      .get(`/api/v1/realtime/user/${ids[1]}`)
      .auth(tokens[0], { type: 'bearer' })
      .expect(200);
    expect(publicUser.body.data.lastSeenAt).toBeUndefined();
    for (const [days, bucket] of [
      [0, 'recently'],
      [4, 'week'],
      [14, 'month'],
      [60, 'month'],
    ] as const) {
      await prisma.user.update({
        where: { id: ids[1] },
        data: { lastSeenAt: new Date(Date.now() - days * 86_400_000) },
      });
      const view = (
        await ack(observer, 'chat:presence', { chatId })
      ).users.find((user: any) => user.userId === ids[1]);
      expect(view).toEqual({
        userId: ids[1],
        online: false,
        lastSeenAt: null,
        lastSeen: bucket,
      });
    }
    const changes: any[] = [];
    observer.on('chat:presence', (data: any) => changes.push(...data.users));
    await profile(1, { showLastSeen: true }).expect(200);
    await until(() =>
      changes.some((user) => user.userId === ids[1] && user.lastSeenAt),
    );
    await profile(1, { showLastSeen: false }).expect(200);
    await until(() => changes.at(-1)?.lastSeen === 'month');
    expect(changes.at(-1).lastSeenAt).toBeNull();
    expect(app.get(PresenceService).online(ids[1])).toBe(false);
  });
});
