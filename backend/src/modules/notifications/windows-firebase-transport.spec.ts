import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { execFileSync, spawn } from 'node:child_process';
import { WindowsFirebaseTransport } from './windows-firebase-transport';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
  execFileSync: jest.fn(),
}));

describe('local Windows Firebase transport', () => {
  const originalPath = process.env.FIREBASE_WINDOWS_NODE_PATH;
  const account = {
    projectId: 'project',
    clientEmail: 'test@example.invalid',
    privateKey: 'TEST_PRIVATE_KEY',
  };
  const message = { tokens: ['TEST_DEVICE_TOKEN'], data: { type: 'test' } };
  let child: EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    kill: jest.Mock;
  };
  let transport: WindowsFirebaseTransport;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    process.env.FIREBASE_WINDOWS_NODE_PATH = '/windows/node.exe';
    jest.mocked(execFileSync).mockReturnValue('C:\\app\\backend\\package.json');
    child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: jest.fn(),
    });
    jest.mocked(spawn).mockReturnValue(child as never);
    transport = new WindowsFirebaseTransport(account);
  });
  afterEach(() => {
    transport.close();
    jest.useRealTimers();
    if (originalPath === undefined)
      delete process.env.FIREBASE_WINDOWS_NODE_PATH;
    else process.env.FIREBASE_WINDOWS_NODE_PATH = originalPath;
  });
  it('sends credentials and tokens through stdin, with no secrets in arguments', async () => {
    let input = '';
    child.stdin.on('data', (data: Buffer) => {
      input += data.toString();
    });
    const result = transport.send(message);
    expect(JSON.parse(input)).toEqual({ serviceAccount: account, message });
    const args = JSON.stringify(jest.mocked(spawn).mock.calls[0]);
    expect(args).not.toContain('TEST_PRIVATE_KEY');
    expect(args).not.toContain('TEST_DEVICE_TOKEN');
    child.stdout.write(
      JSON.stringify({
        result: {
          successCount: 1,
          failureCount: 0,
          responses: [{ success: true }],
        },
      }),
    );
    child.emit('close', 0);
    await expect(result).resolves.toHaveProperty('successCount', 1);
  });
  it('rejects a malformed child response without exposing its contents', async () => {
    const result = transport.send(message);
    const check = expect(result).rejects.toMatchObject({
      code: 'push/windows-invalid-response',
    });
    child.stdout.write('TEST_PRIVATE_KEY is not a protocol response');
    child.emit('close', 1);
    await check;
  });
  it('preserves safe Firebase failure codes', async () => {
    const result = transport.send(message);
    const check = expect(result).rejects.toMatchObject({
      code: 'messaging/authentication-error',
    });
    child.stdout.write(
      JSON.stringify({ errorCode: 'messaging/authentication-error' }),
    );
    child.emit('close', 1);
    await check;
  });
  it('contains process launch failures', async () => {
    const result = transport.send(message);
    const check = expect(result).rejects.toMatchObject({
      code: 'push/windows-launch-failed',
    });
    child.emit('error', new Error('Cannot launch'));
    await check;
  });
  it('terminates a stalled child within seven seconds', async () => {
    const result = transport.send(message);
    const check = expect(result).rejects.toMatchObject({
      code: 'push/windows-timeout',
    });
    await jest.advanceTimersByTimeAsync(7001);
    expect(child.kill).toHaveBeenCalled();
    await check;
    child.emit('close', null);
  });
});
