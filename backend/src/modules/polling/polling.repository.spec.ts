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
    expect(prisma.message.findMany.mock.calls[0][0]).toMatchObject({
      skip: 50,
      take: 50,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(prisma.message.findMany.mock.calls[1][0].where.id).toEqual({
      in: [52, 51],
    });
    expect(result.chats).toEqual([{ id: 51 }, { id: 52 }]);
    expect(result.unreadMessages).toEqual([{ id: 51 }]);
    expect(result.unreadCount).toBe(1000);
  });
});
