import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/libs/db/prisma/prisma.service';
const { io } = require('../../frontend/node_modules/socket.io-client');

describe('authenticated call signaling and persistent history', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let base: string;
  let chatId: number;
  let groupId: number;
  const ids: number[] = [];
  const sockets: any[] = [];
  let tokens: string[];
  const once = (socket: any, event: string) =>
    new Promise<any>((resolve) => socket.once(event, resolve));
  const ack = (index: number, event: string, payload = {}) =>
    sockets[index].timeout(5000).emitWithAck(event, payload);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({
        data: { email: `calls-${Date.now()}-${i}@example.invalid` },
      });
      ids.push(user.id);
    }
    tokens = await Promise.all(
      ids.map((sub) =>
        app
          .get(JwtService)
          .signAsync(
            { sub },
            { secret: process.env.JWT_SECRET, expiresIn: '5m' },
          ),
      ),
    );
    const chat = await prisma.chat.create({
      data: {
        participants: { create: ids.slice(0, 2).map((userId) => ({ userId })) },
      },
    });
    chatId = chat.id;
    const group = await prisma.chat.create({
      data: {
        isGroup: true,
        name: 'Calls test',
        participants: { create: ids.map((userId) => ({ userId })) },
      },
    });
    groupId = group.id;
    for (const token of tokens) {
      const socket = io(`${base}/chat`, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: false,
      });
      sockets.push(socket);
      const connected = once(socket, 'connect');
      socket.connect();
      await connected;
    }
  });
  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (prisma) {
      await prisma.call.deleteMany({
        where: { chatId: { in: [chatId, groupId].filter(Boolean) } },
      });
      await prisma.chatParticipant.deleteMany({
        where: { chatId: { in: [chatId, groupId].filter(Boolean) } },
      });
      await prisma.chat.deleteMany({
        where: { id: { in: [chatId, groupId].filter(Boolean) } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });
  it('rejects anonymous sockets, group calls and nonmembers', async () => {
    const guest = io(`${base}/chat`, {
      transports: ['websocket'],
      autoConnect: false,
    });
    const rejected = once(guest, 'connect_error');
    guest.connect();
    expect((await rejected).message).toBe('Unauthorized');
    guest.disconnect();
    expect(
      await ack(0, 'call:start', { chatId: groupId, mode: 'audio' }),
    ).toHaveProperty('message');
    expect(
      await ack(2, 'call:start', { chatId, mode: 'audio' }),
    ).toHaveProperty('message');
  });
  it('rings outside chat rooms, restricts signaling, connects both peers and persists history', async () => {
    const incoming = once(sockets[1], 'call:updated');
    const call = await ack(0, 'call:start', { chatId, mode: 'video' });
    expect(await incoming).toMatchObject({
      id: call.id,
      mode: 'video',
      status: 'RINGING',
    });
    expect(
      await ack(1, 'call:start', { chatId, mode: 'audio' }),
    ).toHaveProperty('message');
    expect(await ack(2, 'call:accept', { id: call.id })).toHaveProperty(
      'message',
    );
    expect(
      await ack(0, 'call:signal', {
        id: call.id,
        signal: { type: 'offer', sdp: 'v=0' },
      }),
    ).toHaveProperty('message');
    await ack(1, 'call:accept', { id: call.id });
    const signal = once(sockets[1], 'call:signal');
    await ack(0, 'call:signal', {
      id: call.id,
      signal: { type: 'offer', sdp: 'v=0' },
    });
    expect(await signal).toMatchObject({
      id: call.id,
      signal: { type: 'offer', sdp: 'v=0' },
    });
    await ack(0, 'call:connected', { id: call.id });
    await ack(1, 'call:connected', { id: call.id });
    expect(
      await prisma.call.findUnique({ where: { id: call.id } }),
    ).toMatchObject({ status: 'ACTIVE', connectedAt: expect.any(Date) });
    await ack(1, 'call:end', { id: call.id });
    expect(await ack(0, 'call:list')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: call.id,
          status: 'ENDED',
          endedAt: expect.any(String),
        }),
      ]),
    );
    expect(await ack(2, 'call:list')).toEqual([]);
  });
  it('marks unanswered calls missed after 30 seconds on the server', async () => {
    const call = await ack(0, 'call:start', { chatId, mode: 'audio' });
    const missed = new Promise<any>((resolve) => {
      const handler = (event: any) => {
        if (event.id === call.id && event.status === 'MISSED') {
          sockets[0].off('call:updated', handler);
          resolve(event);
        }
      };
      sockets[0].on('call:updated', handler);
    });
    const event = await missed;
    expect(
      new Date(event.endedAt).getTime() - new Date(event.createdAt).getTime(),
    ).toBeGreaterThanOrEqual(30000);
    // Notification precedes persistence by one database round-trip.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      await prisma.call.findUnique({ where: { id: call.id } }),
    ).toMatchObject({ status: 'MISSED' });
  });
  it('distinguishes decline and cancellation and cleans up a disconnected call', async () => {
    let call = await ack(0, 'call:start', { chatId, mode: 'audio' });
    await ack(1, 'call:end', { id: call.id });
    expect(
      await prisma.call.findUnique({ where: { id: call.id } }),
    ).toHaveProperty('status', 'REJECTED');
    call = await ack(0, 'call:start', { chatId, mode: 'audio' });
    await ack(0, 'call:end', { id: call.id });
    expect(
      await prisma.call.findUnique({ where: { id: call.id } }),
    ).toHaveProperty('status', 'CANCELLED');
    call = await ack(0, 'call:start', { chatId, mode: 'audio' });
    const ended = new Promise<any>((resolve) => {
      const handler = (event: any) => {
        if (event.id === call.id && event.status === 'FAILED') {
          sockets[1].off('call:updated', handler);
          resolve(event);
        }
      };
      sockets[1].on('call:updated', handler);
    });
    sockets[0].disconnect();
    expect(await ended).toMatchObject({ id: call.id, status: 'FAILED' });
  });
});
