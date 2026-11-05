import { WindowsFirebaseTransport } from './windows-firebase-transport';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';
import {
  App,
  cert,
  deleteApp,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

@Injectable()
export class FirebasePushService implements OnModuleDestroy {
  private readonly logger = new Logger(FirebasePushService.name);
  private app?: App;
  private windowsTransport?: WindowsFirebaseTransport;
  private unavailableUntil = 0;
  private pending = 0;
  private readonly agent = new Agent({ timeout: 5000 });

  constructor() {
    // Missing/malformed push credentials must never prevent Nest or chat starting.
    if (process.env.FIREBASE_NOTIFICATIONS_ENABLED !== 'true') return;
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const email = process.env.FIREBASE_CLIENT_EMAIL;
      const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const serviceAccount = path
        ? (JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount)
        : email && key && projectId
          ? { projectId, clientEmail: email, privateKey: key }
          : undefined;
      const credential = serviceAccount
        ? cert(serviceAccount, this.agent)
        : undefined;
      const transport = process.env.FIREBASE_TRANSPORT || 'direct';
      if (transport !== 'direct' && transport !== 'windows')
        throw new Error('Invalid Firebase transport');
      if (transport === 'windows' && serviceAccount)
        this.windowsTransport = new WindowsFirebaseTransport(serviceAccount);
      if (!credential) throw new Error('Missing notification credentials');
      this.app = initializeApp(
        { credential, projectId, httpAgent: this.agent },
        'batgram-push',
      );
      if (this.windowsTransport)
        this.logger.log(
          'Firebase delivery uses Windows networking for local WSL development.',
        );
    } catch {
      this.logger.warn(
        'Firebase push is unavailable. Chat and in-app notifications remain enabled.',
      );
    }
  }
  get configured() {
    return !!this.app;
  }
  async send(message: MulticastMessage) {
    if (!this.app || Date.now() < this.unavailableUntil || this.pending >= 4)
      return null;
    this.pending++;
    // Track the real operation, including after timeout, to bound outstanding work.
    const operation = (
      this.windowsTransport
        ? this.windowsTransport.send(message)
        : getMessaging(this.app).sendEachForMulticast(message)
    ).finally(() => {
      this.pending--;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                Object.assign(new Error('Push timeout'), {
                  code: 'push/timeout',
                }),
              ),
            8000,
          );
          timer.unref();
        }),
      ]);
      if (result.successCount > 0)
        this.logger.debug(
          `Firebase accepted ${result.successCount} notification(s).`,
        );
      const rejected = result.responses.find((response) => !response.success)
        ?.error?.code;
      if (rejected)
        this.logger.warn(`Firebase rejected a notification (${rejected}).`);
      return result;
    } catch (error: unknown) {
      const code =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[a-zA-Z0-9_/-]{1,100}$/.test(error.code)
          ? error.code
          : 'push/transport-error';
      this.unavailableUntil = Date.now() + 60_000;
      this.logger.warn(
        `Firebase push failed (${code}); pausing delivery for 60 seconds.`,
      );
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async onModuleDestroy() {
    this.windowsTransport?.close();
    this.agent.destroy();
    if (this.app) await deleteApp(this.app);
  }
}
