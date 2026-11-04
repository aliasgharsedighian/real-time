import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/libs/db/prisma/prisma.service';

describe('message search with PostgreSQL and authenticated HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const users: number[] = [];
  const chats: number[] = [];
  const tokens: string[] = [];
  let target: number;
  let otherTarget: number;
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
    await app.init();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({
        data: {
          email: `search-${Date.now()}-${i}@example.invalid`,
          profile: { create: { firstname: `Searcher ${i}` } },
        },
      });
      users.push(user.id);
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
          name: isGroup ? 'Search test group' : null,
          participants: {
            create: users.slice(0, 2).map((userId) => ({ userId })),
          },
        },
      });
      chats.push(chat.id);
      await prisma.message.createMany({
        data: Array.from({ length: 150 }, (_, index) => ({
          chatId: chat.id,
          senderId: users[index % 2],
          content:
            index % 2
              ? `needle متن فارسی searchable ${index}`
              : `Regular message ${index}`,
        })),
      });
      await prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: users[0],
          kind: 'MEMBER_LEFT',
          content: 'needle searchable activity',
        },
      });
      await prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: users[0],
          content: 'literal 100%_complete',
        },
      });
      const middle = await prisma.message.findFirstOrThrow({
        where: { chatId: chat.id },
        orderBy: { id: 'asc' },
        skip: 60,
      });
      if (isGroup) otherTarget = middle.id;
      else target = middle.id;
    }
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.message.deleteMany({ where: { chatId: { in: chats } } });
      await prisma.chatParticipant.deleteMany({
        where: { chatId: { in: chats } },
      });
      await prisma.chat.deleteMany({ where: { id: { in: chats } } });
      await prisma.profile.deleteMany({ where: { userId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });
  const get = (chat: number, suffix: string, user = 0) =>
    request(app.getHttpServer())
      .get(`/api/v1/realtime/polling/${chat}/${suffix}`)
      .auth(tokens[user], { type: 'bearer' });
  it('requires authentication and current chat membership for both endpoints', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/realtime/polling/${chats[0]}/search?q=needle`)
      .expect(401);
    await get(chats[0], 'search?q=needle', 2).expect(403);
    await get(chats[0], `window?aroundId=${target}`, 2).expect(403);
  });
  it.each([0, 1])(
    'searches every text message in chat %s, paginates without overlap and excludes activity',
    async (index) => {
      const first = await get(chats[index], 'search?q=NEEDLE').expect(200);
      expect(first.body.data.messages).toHaveLength(20);
      expect(
        first.body.data.messages.every(
          (m) => m.chatId === chats[index] && !m.content.includes('activity'),
        ),
      ).toBe(true);
      expect(first.body.data.messages[0].sender.profile.firstname).toMatch(
        /Searcher/,
      );
      const second = await get(
        chats[index],
        `search?q=needle&beforeId=${first.body.data.nextCursor}`,
      ).expect(200);
      expect(second.body.data.messages).toHaveLength(20);
      expect(
        new Set(
          [...first.body.data.messages, ...second.body.data.messages].map(
            (m) => m.id,
          ),
        ).size,
      ).toBe(40);
      const persian = await get(
        chats[index],
        `search?q=${encodeURIComponent('فارسی')}`,
      ).expect(200);
      expect(persian.body.data.messages.length).toBeGreaterThan(0);
    },
  );
  it('treats SQL and LIKE metacharacters as literal input', async () => {
    const literal = await get(
      chats[0],
      `search?q=${encodeURIComponent('100%_complete')}`,
    ).expect(200);
    expect(literal.body.data.messages).toHaveLength(1);
    const injection = await get(
      chats[0],
      `search?q=${encodeURIComponent("needle' OR true --")}`,
    ).expect(200);
    expect(injection.body.data.messages).toHaveLength(0);
  });
  it('loads a bounded context around an old message and traverses both directions without gaps', async () => {
    const context = (
      await get(chats[0], `window?aroundId=${target}`).expect(200)
    ).body.data;
    expect(context.messages).toHaveLength(50);
    expect(context.messages.some((m) => m.id === target)).toBe(true);
    const before = (
      await get(chats[0], `window?beforeId=${context.beforeId}`).expect(200)
    ).body.data;
    const after = (
      await get(chats[0], `window?afterId=${context.afterId}`).expect(200)
    ).body.data;
    const ids = [
      ...before.messages,
      ...context.messages,
      ...after.messages,
    ].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const actual = await prisma.message.findMany({
      where: { chatId: chats[0], id: { gte: ids[0], lte: ids.at(-1) } },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    expect(ids).toEqual(actual.map((m) => m.id));
    expect(
      await prisma.messageReadStatus.count({
        where: { message: { chatId: chats[0] } },
      }),
    ).toBe(0);
  });
  it('validates search bounds and prevents cross-chat context access', async () => {
    await get(chats[0], 'search?q=ab').expect(400);
    await get(chats[0], 'search?q=%25%25%25').expect(400);
    await get(chats[0], 'search?q=needle&beforeId=-1').expect(400);
    await get(chats[0], `window?aroundId=${target}&beforeId=${target}`).expect(
      400,
    );
    await get(chats[0], `window?aroundId=${otherTarget}`).expect(404);
  });
  it('has a usable trigram index for literal substring search', async () => {
    const plan = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      return tx.$queryRaw<
        any[]
      >`EXPLAIN (FORMAT JSON) SELECT "id" FROM "Message" WHERE "kind" = 'TEXT' AND "content" ILIKE '%searchable%'`;
    });
    expect(JSON.stringify(plan)).toContain('Message_text_search_trgm_idx');
  });

  it('finds rare text beyond the recent page in a larger history with bounded results', async () => {
    await prisma.message.createMany({
      data: Array.from({ length: 6000 }, (_, index) => ({
        chatId: chats[1],
        senderId: users[0],
        content:
          index < 5
            ? `rarebenchmarkneedle ${index}`
            : `Benchmark ordinary message ${index}`,
      })),
    });
    const started = performance.now();
    const result = await get(chats[1], 'search?q=rarebenchmarkneedle').expect(
      200,
    );
    expect(result.body.data.messages).toHaveLength(5);
    expect(result.body.data.nextCursor).toBeNull();
    console.info(
      `Search fixture: 6,152 messages, 5 hits, HTTP ${Math.round(performance.now() - started)} ms`,
    );
  });
  it('revokes search and context access immediately when group membership is removed', async () => {
    await prisma.chatParticipant.delete({
      where: { userId_chatId: { userId: users[1], chatId: chats[1] } },
    });
    await get(chats[1], 'search?q=needle', 1).expect(403);
    await get(chats[1], `window?aroundId=${otherTarget}`, 1).expect(403);
  });
});
