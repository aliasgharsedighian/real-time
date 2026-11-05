import { presenceView } from './presence.service';

describe('presence privacy projection', () => {
  const now = Date.UTC(2026, 10, 5);
  const day = 86_400_000;
  const user = (age: number, showLastSeen = false) => ({
    id: 2,
    lastSeenAt: new Date(now - age),
    profile: { showLastSeen },
  });
  it('strips exact timestamps from every private bucket and online status', () => {
    for (const [age, bucket] of [
      [0, 'recently'],
      [3 * day, 'week'],
      [7 * day, 'month'],
      [50 * day, 'month'],
    ] as const) {
      expect(presenceView(user(age), false, now)).toEqual({
        userId: 2,
        online: false,
        lastSeenAt: null,
        lastSeen: bucket,
      });
    }
    expect(presenceView(user(day, true), true, now)).toEqual({
      userId: 2,
      online: true,
      lastSeenAt: null,
      lastSeen: null,
    });
  });
  it('returns an exact time only when allowed and handles accounts without history', () => {
    expect(presenceView(user(day, true), false, now).lastSeenAt).toBe(
      new Date(now - day).toISOString(),
    );
    expect(
      presenceView(
        { id: 2, profile: { showLastSeen: false }, lastSeenAt: null },
        false,
        now,
      ),
    ).toEqual({
      userId: 2,
      online: false,
      lastSeenAt: null,
      lastSeen: 'month',
    });
  });
});
