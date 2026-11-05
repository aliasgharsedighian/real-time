import { Server } from 'socket.io';
import { ChatTypingService } from './chat-typing.service';

describe('typing lifecycle', () => {
  const emit = jest.fn();
  let service: ChatTypingService;
  beforeEach(() => {
    jest.useFakeTimers();
    emit.mockClear();
    service = new ChatTypingService();
    service.server = { to: () => ({ emit }) } as unknown as Server;
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });
  it('keeps typing while another tab types and stops after the final tab disconnects', () => {
    service.start('one', 7, 2, 'Alice');
    service.start('two', 7, 2, 'Alice');
    emit.mockClear();
    service.remove('one');
    expect(emit).not.toHaveBeenCalled();
    service.remove('two');
    expect(emit).toHaveBeenCalledWith('typing:stop', {
      chatId: 7,
      userId: 2,
      username: 'Alice',
    });
  });
  it('keeps typing through idle until the draft is explicitly cleared', () => {
    service.start('one', 7, 2, 'Alice');
    emit.mockClear();
    jest.advanceTimersByTime(60_000);
    expect(emit).not.toHaveBeenCalled();
    expect(service.snapshot(7)).toEqual([
      { chatId: 7, userId: 2, username: 'Alice' },
    ]);
    service.stop('one', 7);
    expect(emit).toHaveBeenCalledWith(
      'typing:stop',
      expect.objectContaining({ userId: 2 }),
    );
  });
  it('restores all current typists for joining observers without duplicating tabs', () => {
    service.start('one', 7, 2, 'Alice');
    service.start('two', 7, 2, 'Alice');
    service.start('three', 7, 3, 'Bob');
    service.start('other', 8, 4, 'Carol');
    expect(service.snapshot(7)).toEqual([
      { chatId: 7, userId: 2, username: 'Alice' },
      { chatId: 7, userId: 3, username: 'Bob' },
    ]);
    service.removeMember(2, 7);
    expect(service.snapshot(7)).toEqual([
      { chatId: 7, userId: 3, username: 'Bob' },
    ]);
  });
});
