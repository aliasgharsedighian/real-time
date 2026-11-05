import { WindowsFirebaseTransport } from './windows-firebase-transport';
import { Logger } from '@nestjs/common';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { FirebasePushService } from './firebase-push.service';

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(() => ({})),
  initializeApp: jest.fn(() => ({})),
  deleteApp: jest.fn(async () => {}),
}));
jest.mock('./windows-firebase-transport', () => ({
  WindowsFirebaseTransport: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => ({ getMessaging: jest.fn() }));

describe('optional Firebase transport isolation', () => {
  const original = { ...process.env };
  const send = jest.fn();
  let service: FirebasePushService;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'true';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@example.invalid';
    process.env.FIREBASE_PRIVATE_KEY = 'test-only';
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    delete process.env.FIREBASE_TRANSPORT;
    delete process.env.FIREBASE_WINDOWS_NODE_PATH;
    jest
      .mocked(getMessaging)
      .mockReturnValue({ sendEachForMulticast: send } as never);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    send.mockReset();
  });
  afterEach(async () => {
    await service?.onModuleDestroy();
    process.env = { ...original };
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  const message = { tokens: ['test-token'], data: { type: 'test' } };
  it('starts normally with notifications disabled or credentials unavailable', async () => {
    process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'false';
    service = new FirebasePushService();
    expect(service.configured).toBe(false);
    expect(await service.send(message)).toBeNull();
    expect(initializeApp).not.toHaveBeenCalled();
    process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'true';
    jest.mocked(cert).mockImplementationOnce(() => {
      throw new Error('Bad PEM');
    });
    await service.onModuleDestroy();
    service = new FirebasePushService();
    expect(service.configured).toBe(false);
  });
  it('contains Google errors and opens a one-minute circuit breaker', async () => {
    send.mockRejectedValue(new Error('Google unreachable'));
    service = new FirebasePushService();
    expect(await service.send(message)).toBeNull();
    expect(await service.send(message)).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60001);
    send.mockResolvedValue({ responses: [{ success: true }] });
    await expect(service.send(message)).resolves.toHaveProperty('responses');
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('uses Windows networking only when explicitly selected and closes the local child transport', async () => {
    const windowsSend = jest.fn().mockResolvedValue({
      responses: [{ success: true }],
      successCount: 1,
      failureCount: 0,
    });
    const close = jest.fn();
    jest
      .mocked(WindowsFirebaseTransport)
      .mockImplementationOnce(() => ({ send: windowsSend, close }) as never);
    process.env.FIREBASE_TRANSPORT = 'windows';
    service = new FirebasePushService();
    expect(service.configured).toBe(true);
    expect(await service.send(message)).toHaveProperty('successCount', 1);
    expect(windowsSend).toHaveBeenCalledWith(message);
    expect(getMessaging).not.toHaveBeenCalled();
    await service.onModuleDestroy();
    expect(close).toHaveBeenCalled();
  });
  it('times out after eight seconds and bounds requests still pending in the SDK', async () => {
    send.mockImplementation(() => new Promise(() => {}));
    service = new FirebasePushService();
    for (let count = 0; count < 4; count++) {
      const result = service.send(message);
      await jest.advanceTimersByTimeAsync(8001);
      expect(await result).toBeNull();
      await jest.advanceTimersByTimeAsync(60001);
    }
    expect(await service.send(message)).toBeNull();
    expect(send).toHaveBeenCalledTimes(4);
  });
});
