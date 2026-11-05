import { NotificationPresenceService } from './notification-presence.service';
import { messagePreview } from './notification.types';

describe('notification destinations', () => {
  let presence: NotificationPresenceService;
  beforeEach(() => {
    jest.useFakeTimers();
    presence = new NotificationPresenceService();
  });
  afterEach(() => jest.useRealTimers());
  const entry = (active: boolean, chatId: number | null) => ({
    userId: 2,
    active,
    chatId,
    expiresAt: Date.now() + 3600000,
  });
  it('pushes when there are no connections or only background connections', () => {
    expect(presence.destination(2, 7).mode).toBe('push');
    presence.update('hidden', entry(false, 7));
    expect(presence.destination(2, 7).mode).toBe('push');
  });
  it('targets just one active tab for another conversation', () => {
    presence.update('first', entry(true, 3));
    jest.advanceTimersByTime(1);
    presence.update('second', entry(true, null));
    expect(presence.destination(2, 7)).toEqual({
      mode: 'in-app',
      socketId: 'second',
    });
    expect(presence.destination(3, 7).mode).toBe('push');
  });
  it('silences every tab and push when any active tab has the conversation open', () => {
    presence.update('reader', entry(true, 7));
    presence.update('other', entry(true, null));
    expect(presence.destination(2, 7).mode).toBe('silent');
    presence.remove('reader');
    expect(presence.destination(2, 7).mode).toBe('in-app');
  });
  it('expires stale presence and expired authenticated sessions', () => {
    presence.update('frozen', entry(true, 7));
    jest.advanceTimersByTime(60001);
    expect(presence.destination(2, 7).mode).toBe('push');
    presence.update('expired', {
      ...entry(true, 7),
      expiresAt: Date.now() - 1,
    });
    expect(presence.destination(2, 7).mode).toBe('push');
  });
  it.each([
    ['IMAGE', 'Photo'],
    ['VIDEO', 'Video'],
    ['AUDIO', 'Voice message'],
  ])('describes %s with an optional caption', (kind, label) => {
    expect(messagePreview({ content: '', attachments: [{ kind }] })).toContain(
      label,
    );
    expect(
      messagePreview({ content: ' Caption\nhello ', attachments: [{ kind }] }),
    ).toContain(`${label} · Caption hello`);
  });
  it('bounds unicode previews without exposing media IDs or URLs', () => {
    const preview = messagePreview({
      content: '😀'.repeat(500),
      attachments: [],
    });
    expect(Array.from(preview)).toHaveLength(180);
  });
});
