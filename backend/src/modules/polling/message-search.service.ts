import { SharedContentDto } from './shared-content.dto';
import { messageRelations } from './message-include';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';
import { ChatService } from '../../gateway/chat/chat.service';
import { fileSelect } from '../files-upload/upload.policy';
import {
  MessageDaysDto,
  MessageWindowDto,
  SearchMessagesDto,
} from './message-search.dto';

@Injectable()
export class MessageSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chats: ChatService,
  ) {}

  private async authorize(chatId: number, userId: number) {
    if (!(await this.chats.ensureParticipant(chatId, userId)))
      throw new ForbiddenException('User is not a participant of this chat.');
  }

  async shared(chatId: number, userId: number, query: SharedContentDto) {
    await this.authorize(chatId, userId);
    const links: Prisma.MessageWhereInput = {
      OR: [
        { content: { contains: 'https://', mode: 'insensitive' } },
        { content: { contains: 'http://', mode: 'insensitive' } },
      ],
    };
    const where: Prisma.MessageWhereInput = {
      chatId,
      kind: 'TEXT',
      ...(query.kind === 'LINK'
        ? links
        : query.kind
          ? { attachments: { some: { kind: query.kind } } }
          : {}),
      ...(query.beforeId ? { id: { lt: query.beforeId } } : {}),
    };
    const [mediaCounts, linkCount, messages] = await Promise.all([
      Promise.all(
        ['IMAGE', 'VIDEO', 'AUDIO'].map((kind) =>
          this.prisma.uploadFile.count({
            where: { chatId, messageId: { not: null }, kind },
          }),
        ),
      ),
      this.prisma.message.count({ where: { chatId, kind: 'TEXT', ...links } }),
      query.kind
        ? this.prisma.message.findMany({
            where,
            orderBy: { id: 'desc' },
            take: 21,
            include: {
              ...messageRelations,
              attachments: { select: fileSelect },
              sender: { select: { id: true, email: true, profile: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    const page = messages.slice(0, 20);
    return {
      data: {
        counts: {
          IMAGE: mediaCounts[0],
          VIDEO: mediaCounts[1],
          AUDIO: mediaCounts[2],
          LINK: linkCount,
        },
        messages: page,
        nextCursor: messages.length > 20 ? page.at(-1)!.id : null,
      },
      message: 'Shared content loaded',
    };
  }

  async days(chatId: number, userId: number, query: MessageDaysDto) {
    await this.authorize(chatId, userId);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 32 * 86400000
    )
      throw new BadRequestException(
        'Provide a date range of at most one month.',
      );
    try {
      new Intl.DateTimeFormat('en', { timeZone: query.timeZone }).format(from);
    } catch {
      throw new BadRequestException('Invalid time zone.');
    }
    const days = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
        return tx.$queryRaw<{ date: string; messageId: number }[]>`
        SELECT DISTINCT ON ("date")
          to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${query.timeZone}, 'YYYY-MM-DD') AS "date",
          "id" AS "messageId"
        FROM "Message"
        WHERE "chatId" = ${chatId}
          AND "createdAt" >= (${from.toISOString()}::timestamptz AT TIME ZONE 'UTC')
          AND "createdAt" < (${to.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        ORDER BY "date", "createdAt", "id"
      `;
      },
      { timeout: 4000 },
    );
    return { statusCode: 200, message: 'Message days loaded', data: { days } };
  }

  async search(chatId: number, userId: number, query: SearchMessagesDto) {
    await this.authorize(chatId, userId);
    // Escape LIKE metacharacters: search terms are literal, never SQL or patterns.
    const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
    const rows = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
        return tx.$queryRaw<
          {
            id: number;
            chatId: number;
            senderId: number;
            createdAt: Date;
            content: string;
          }[]
        >(Prisma.sql`
        SELECT m."id", m."chatId", m."senderId", m."createdAt",
          substring(m."content" FROM greatest(1, strpos(lower(m."content"), lower(${query.q})) - 80) FOR 320) AS "content"
        FROM "Message" m
        WHERE m."chatId" = ${chatId} AND m."kind" = 'TEXT'
          AND m."content" ILIKE ${pattern}
          ${query.beforeId ? Prisma.sql`AND m."id" < ${query.beforeId}` : Prisma.empty}
          AND EXISTS (SELECT 1 FROM "ChatParticipant" p WHERE p."chatId" = m."chatId" AND p."userId" = ${userId})
        ORDER BY m."id" DESC LIMIT 21
      `);
      },
      { timeout: 4000 },
    );
    const page = rows.slice(0, 20);
    const senders = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(page.map((row) => row.senderId))] } },
      select: { id: true, email: true, profile: true },
    });
    return {
      statusCode: 200,
      message: 'Search results loaded',
      data: {
        messages: page.map((row) => ({
          ...row,
          sender: senders.find((sender) => sender.id === row.senderId),
        })),
        nextCursor: rows.length > 20 ? page.at(-1)!.id : null,
      },
    };
  }

  async window(chatId: number, userId: number, query: MessageWindowDto) {
    await this.authorize(chatId, userId);
    const cursors = [query.aroundId, query.beforeId, query.afterId].filter(
      Boolean,
    );
    if (cursors.length !== 1)
      throw new BadRequestException('Provide exactly one message cursor.');
    const cursor = cursors[0]!;
    // Paging cursors can refer to a message that was just hard deleted.
    if (
      query.aroundId &&
      !(await this.prisma.message.findFirst({
        where: { id: cursor, chatId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Message not found in this conversation.');
    const include = {
      ...messageRelations,
      attachments: { select: fileSelect },
      sender: { select: { id: true, email: true, profile: true } },
      readStatuses: { where: { userId: { not: userId } } },
    };
    const [before, after] = await Promise.all([
      query.afterId
        ? []
        : this.prisma.message.findMany({
            where: { chatId, id: { lt: cursor } },
            include,
            orderBy: { id: 'desc' },
            take: query.aroundId ? 25 : 50,
          }),
      query.beforeId
        ? []
        : this.prisma.message.findMany({
            where: {
              chatId,
              id: query.aroundId ? { gte: cursor } : { gt: cursor },
            },
            include,
            orderBy: { id: 'asc' },
            take: query.aroundId ? 25 : 50,
          }),
    ]);
    const messages = [...before.reverse(), ...after];
    // The cursor may already be the first/last message, so empty pages are valid.
    const firstId = messages[0]?.id ?? cursor;
    const lastId = messages.at(-1)?.id ?? cursor;
    const [older, newer] = await Promise.all([
      this.prisma.message.findFirst({
        where: { chatId, id: { lt: firstId } },
        select: { id: true },
        orderBy: { id: 'desc' },
      }),
      this.prisma.message.findFirst({
        where: { chatId, id: { gt: lastId } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    ]);
    return {
      statusCode: 200,
      message: 'Message context loaded',
      data: {
        messages,
        beforeId: older ? firstId : null,
        afterId: newer ? lastId : null,
      },
    };
  }
}
