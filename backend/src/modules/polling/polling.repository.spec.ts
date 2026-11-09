import { PrsimaPollingRepository } from './polling.repository';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';

describe('paginated history', () => {
  it('bounds unread payload to the requested page while keeping the total unread count', async () => {
    const prisma = {
      message: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 52 }, { id: 51 }])
          .mockResolvedValueOnce([{ id: 51 }]),
        count: jest.fn().mockResolvedValue(1000),
      },
      chat: { findUnique: jest.fn().mockResolvedValue({ participants: [] }) },
    };
    const repository = new PrsimaPollingRepository(
      prisma as unknown as PrismaService,
    );
    const result = await repository.getChatContentsById(7, 1, {
      page: 2,
      limit: 50,
    });
    expect(prisma.message.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        skip: 50,
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(prisma.message.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          chatId: 7,
          kind: 'TEXT',
          senderId: { not: 1 },
          NOT: [{ readStatuses: { some: { userId: 1 } } }],
          id: { in: [52, 51] },
        },
      }),
    );
    expect(result.chats).toEqual([{ id: 51 }, { id: 52 }]);
    expect(result.unreadMessages).toEqual([{ id: 51 }]);
    expect(result.unreadCount).toBe(1000);
  });

  it('finds the oldest unread message even when it is outside the latest page', async () => {
    const prisma = {
      message: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 52 }])
          .mockResolvedValueOnce([]),
        findFirst: jest.fn().mockResolvedValue({ id: 3 }),
        count: jest.fn().mockResolvedValue(1),
      },
      chat: { findUnique: jest.fn().mockResolvedValue({ participants: [] }) },
    };
    const repository = new PrsimaPollingRepository(
      prisma as unknown as PrismaService,
    );
    const result = await repository.getChatContentsById(7, 1, {
      page: 1,
      limit: 50,
    });
    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: {
        chatId: 7,
        kind: 'TEXT',
        senderId: { not: 1 },
        NOT: [{ readStatuses: { some: { userId: 1 } } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    expect(result.firstUnreadId).toBe(3);
    expect(result.unreadMessages).toEqual([]);
  });
});
