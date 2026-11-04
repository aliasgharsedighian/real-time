import { CallsService } from './calls.service';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import { Server, Socket } from 'socket.io';

describe('call coordinator', () => {
  let service: CallsService;
  let record: any;
  let db: any;
  let emit: jest.Mock;
  const caller = { id: 'caller-device', connected: true } as Socket;
  const callee = { id: 'callee-device', connected: true } as Socket;
  beforeEach(() => {
    jest.useFakeTimers();
    emit = jest.fn();
    db = {
      chat: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 1,
            isGroup: false,
            participants: [{ userId: 10 }, { userId: 20 }],
          }),
      },
      call: {
        create: jest.fn().mockImplementation(({ data }) => {
          record = {
            ...data,
            status: 'RINGING',
            createdAt: new Date(),
            answeredAt: null,
            connectedAt: null,
            endedAt: null,
          };
          return Promise.resolve({ ...record });
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          record = { ...record, ...data };
          return Promise.resolve(record);
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new CallsService(db as PrismaService);
    service.server = {
      to: jest.fn().mockReturnThis(),
      emit,
    } as unknown as Server;
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });
  const start = () => service.start(caller, 10, { chatId: 1, mode: 'audio' });
  it('expires at exactly 30 seconds and releases both users', async () => {
    const call = await start();
    await jest.advanceTimersByTimeAsync(29999);
    expect(db.call.update).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(record.status).toBe('MISSED');
    await expect(start()).resolves.toHaveProperty('status', 'RINGING');
    await expect(service.accept(callee, 20, call.id)).rejects.toThrow(
      'unavailable',
    );
  });
  it('requires both media connections before active and clears ringing deadline', async () => {
    const call = await start();
    await jest.advanceTimersByTimeAsync(25000);
    await service.accept(callee, 20, call.id);
    await jest.advanceTimersByTimeAsync(6000);
    await service.connected(caller, 10, call.id);
    expect(db.call.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    await service.connected(callee, 20, call.id);
    await jest.advanceTimersByTimeAsync(40000);
    expect(db.call.update).not.toHaveBeenCalled();
    await service.end(caller, 10, call.id);
    expect(record.status).toBe('ENDED');
  });
  it('fails if media cannot connect in 30 seconds', async () => {
    const call = await start();
    await service.accept(callee, 20, call.id);
    await jest.advanceTimersByTimeAsync(30000);
    expect(record.status).toBe('FAILED');
  });
  it('rejects nonmembers, groups and malformed requests', async () => {
    await expect(
      service.start(caller, 999, { chatId: 1, mode: 'audio' }),
    ).rejects.toThrow('one-to-one');
    db.chat.findUnique.mockResolvedValue({
      id: 1,
      isGroup: true,
      participants: [{ userId: 10 }, { userId: 20 }],
    });
    await expect(start()).rejects.toThrow('one-to-one');
    await expect(
      service.start(caller, 10, { chatId: 1, mode: 'bogus' }),
    ).rejects.toThrow('Invalid');
  });
  it('reserves both users against simultaneous reverse calls', async () => {
    const results = await Promise.allSettled([
      start(),
      service.start(callee, 20, { chatId: 1, mode: 'video' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(db.call.create).toHaveBeenCalledTimes(1);
  });
  it('only the callee accepts; negotiation belongs to selected devices', async () => {
    const call = await start();
    await expect(service.accept(caller, 10, call.id)).rejects.toThrow();
    await expect(service.accept(callee, 99, call.id)).rejects.toThrow();
    await service.accept(callee, 20, call.id);
    expect(() =>
      service.signal({ id: 'other-tab' } as Socket, 20, {
        id: call.id,
        signal: { type: 'answer', sdp: 'v=0' },
      }),
    ).toThrow('another device');
    expect(() =>
      service.signal(callee, 20, {
        id: call.id,
        signal: { type: 'offer', sdp: 'v=0' },
      }),
    ).toThrow('role');
    expect(() =>
      service.signal(caller, 10, {
        id: call.id,
        signal: { type: 'offer', sdp: 'x'.repeat(70000) },
      }),
    ).toThrow('Invalid');
    service.signal(caller, 10, {
      id: call.id,
      signal: { type: 'offer', sdp: 'v=0' },
    });
    expect(emit).toHaveBeenCalledWith('call:signal', {
      id: call.id,
      signal: { type: 'offer', sdp: 'v=0' },
    });
  });
  it('rejects signals before answering; distinguishes decline from cancel', async () => {
    const call = await start();
    expect(() =>
      service.signal(caller, 10, {
        id: call.id,
        signal: { type: 'offer', sdp: 'v=0' },
      }),
    ).toThrow('not answered');
    await service.end(callee, 20, call.id);
    expect(record.status).toBe('REJECTED');
    const second = await start();
    await service.end(caller, 10, second.id);
    expect(record.status).toBe('CANCELLED');
  });
  it('ends on the selected device disconnecting, ignoring unrelated tabs', async () => {
    await start();
    service.disconnect({ id: 'unrelated-tab' } as Socket);
    expect(db.call.update).not.toHaveBeenCalled();
    service.disconnect(caller);
    await Promise.resolve();
    expect(record.status).toBe('FAILED');
    await expect(start()).resolves.toHaveProperty('id');
  });
});
