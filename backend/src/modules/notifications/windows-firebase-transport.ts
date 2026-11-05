import {
  spawn,
  execFileSync,
  ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { resolve, isAbsolute } from 'node:path';
import type { ServiceAccount } from 'firebase-admin/app';
import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';

// Optional WSL development transport. No listener/proxy is opened. Windows Node
// uses the same installed Admin SDK over its working network. Secrets travel only
// through this local child's stdin, never through command arguments or temp files.
const WINDOWS_SENDER = String.raw`
const { createRequire } = require('node:module');
const req = createRequire(process.argv[1]);
setTimeout(() => {
  process.stdout.write(JSON.stringify({ errorCode: 'push/windows-timeout' }));
  process.exit(1);
}, 6500);
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  let app;
  try {
    const { serviceAccount, message } = JSON.parse(input);
    input = '';
    const { cert, initializeApp, deleteApp } = req('firebase-admin/app');
    const { getMessaging } = req('firebase-admin/messaging');
    app = initializeApp({ credential: cert(serviceAccount) });
    const result = await getMessaging(app).sendEachForMulticast(message);
    process.stdout.write(JSON.stringify({ result: {
      successCount: result.successCount, failureCount: result.failureCount,
      responses: result.responses.map(r => ({ success: r.success,
        ...(r.messageId ? { messageId: r.messageId } : {}),
        ...(r.error ? { error: { code: r.error.code } } : {})
      }))
    }}));
    await deleteApp(app);
    process.exit(0);
  } catch (error) {
    const code = typeof error?.code === 'string' && /^[a-zA-Z0-9_/-]{1,100}$/.test(error.code)
      ? error.code : 'push/windows-delivery-failed';
    process.stdout.write(JSON.stringify({ errorCode: code }));
    process.exit(1);
  }
});
`;

function failure(code: string) {
  return Object.assign(new Error('Firebase Windows transport failed'), {
    code,
  });
}

export class WindowsFirebaseTransport {
  private readonly nodePath: string;
  private readonly packagePath: string;
  private readonly children = new Set<ChildProcessWithoutNullStreams>();

  constructor(private readonly serviceAccount: ServiceAccount) {
    this.nodePath = process.env.FIREBASE_WINDOWS_NODE_PATH || '';
    if (process.platform !== 'linux' || !isAbsolute(this.nodePath))
      throw failure('push/windows-transport-not-configured');
    this.packagePath = execFileSync(
      'wslpath',
      ['-w', resolve(__dirname, '../../../package.json')],
      { encoding: 'utf8', timeout: 1000 },
    ).trim();
  }

  send(message: MulticastMessage): Promise<BatchResponse> {
    return new Promise((resolveResult, reject) => {
      const child = spawn(
        this.nodePath,
        ['-e', WINDOWS_SENDER, this.packagePath],
        {
          stdio: 'pipe',
          windowsHide: true,
        },
      );
      this.children.add(child);
      let output = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(failure('push/windows-timeout'));
      }, 7000);
      timer.unref();
      const cleanup = () => {
        clearTimeout(timer);
        this.children.delete(child);
      };
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        output += chunk;
        if (output.length > 1024 * 1024) {
          child.kill();
          reject(failure('push/windows-invalid-response'));
        }
      });
      // Never forward child stderr: it can contain transport/vendor diagnostics.
      child.stderr.resume();
      child.once('error', () => {
        cleanup();
        reject(failure('push/windows-launch-failed'));
      });
      child.once('close', () => {
        cleanup();
        try {
          const payload: unknown = JSON.parse(output);
          if (!payload || typeof payload !== 'object') throw new Error();
          const response = payload as {
            errorCode?: unknown;
            result?: BatchResponse;
          };
          if (
            typeof response.errorCode === 'string' &&
            /^[a-zA-Z0-9_/-]{1,100}$/.test(response.errorCode)
          ) {
            reject(failure(response.errorCode));
            return;
          }
          const result = response.result;
          if (
            !result ||
            !Array.isArray(result.responses) ||
            result.responses.length !== message.tokens.length ||
            result.responses.some((r) => typeof r.success !== 'boolean')
          )
            throw new Error();
          resolveResult(result);
        } catch {
          reject(failure('push/windows-invalid-response'));
        }
      });
      child.stdin.on('error', () => {});
      child.stdin.end(
        JSON.stringify({ serviceAccount: this.serviceAccount, message }),
      );
    });
  }
  close() {
    for (const child of this.children) child.kill();
    this.children.clear();
  }
}
