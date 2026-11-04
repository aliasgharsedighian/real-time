import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { Call } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../libs/db/prisma/prisma.service';

type LiveCall = {
  record: Call;
  callerSocket: string;
  calleeSocket?: string;
  timer: ReturnType<typeof setTimeout>;
  connected: Set<number>;
};
@Injectable()
export class CallsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallsService.name);
  private readonly calls = new Map<string, LiveCall>();
  private readonly busy = new Set<number>();
  server: Server;
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // This signaling coordinator runs in a single backend process.
    await this.prisma.call.updateMany({
      where: { status: { in: ['RINGING', 'CONNECTING', 'ACTIVE'] } },
      data: { status: 'FAILED', endedAt: new Date() },
    });
  }
  onModuleDestroy() {
    for (const call of this.calls.values()) clearTimeout(call.timer);
  }
  private later(id: string, status: string) {
    return setTimeout(() => {
      void this.finish(id, status).catch((error: unknown) =>
        this.logger.error(error),
      );
    }, 30_000);
  }
  private publish(call: Call) {
    this.server
      .to(`user:${call.callerId}`)
      .to(`user:${call.calleeId}`)
      .emit('call:updated', call);
  }
  private live(id: string, userId: number, socketId: string, ringing = false) {
    const call = this.calls.get(id);
    if (
      !call ||
      (userId !== call.record.callerId && userId !== call.record.calleeId)
    )
      throw new Error('Call unavailable.');
    if (
      userId === call.record.callerId
        ? call.callerSocket !== socketId
        : !(ringing && call.record.status === 'RINGING') &&
          call.calleeSocket !== socketId
    )
      throw new Error('This call belongs to another device.');
    return call;
  }
  async list(userId: number) {
    return this.prisma.call.findMany({
      where: {
        OR: [{ callerId: userId }, { calleeId: userId }],
        chat: { participants: { some: { userId } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  pending(userId: number) {
    for (const call of this.calls.values()) {
      if (call.record.calleeId === userId && call.record.status === 'RINGING')
        return call.record;
    }
    return null;
  }
  async start(
    client: Socket,
    userId: number,
    payload: { chatId: number; mode: string },
  ) {
    if (
      !Number.isSafeInteger(payload?.chatId) ||
      !['audio', 'video'].includes(payload?.mode)
    )
      throw new Error('Invalid call.');
    const chat = await this.prisma.chat.findUnique({
      where: { id: payload.chatId },
      include: { participants: true },
    });
    if (
      !chat ||
      chat.isGroup ||
      chat.participants.length !== 2 ||
      !chat.participants.some((p) => p.userId === userId)
    )
      throw new Error('Calls are only available in one-to-one conversations.');
    const calleeId = chat.participants.find((p) => p.userId !== userId)!.userId;
    if (this.busy.has(userId) || this.busy.has(calleeId))
      throw new Error('Already in another call.');
    // Reserve both users before the asynchronous insert, including simultaneous calls.
    this.busy.add(userId);
    this.busy.add(calleeId);
    try {
      const record = await this.prisma.call.create({
        data: {
          id: randomUUID(),
          chatId: chat.id,
          callerId: userId,
          calleeId,
          mode: payload.mode,
        },
      });
      this.calls.set(record.id, {
        record,
        callerSocket: client.id,
        timer: this.later(record.id, 'MISSED'),
        connected: new Set(),
      });
      this.publish(record);
      if (!client.connected) await this.finish(record.id, 'CANCELLED');
      return record;
    } catch (error) {
      this.busy.delete(userId);
      this.busy.delete(calleeId);
      throw error;
    }
  }
  async accept(client: Socket, userId: number, id: string) {
    const call = this.live(id, userId, client.id, true);
    if (userId !== call.record.calleeId || call.record.status !== 'RINGING')
      throw new Error('Call is no longer ringing.');
    if (Date.now() >= call.record.createdAt.getTime() + 30_000) {
      await this.finish(id, 'MISSED');
      throw new Error('Call expired.');
    }
    call.calleeSocket = client.id;
    call.record.status = 'CONNECTING';
    clearTimeout(call.timer);
    call.timer = this.later(id, 'FAILED');
    const updated = await this.prisma.call.updateMany({
      where: { id, status: 'RINGING' },
      data: { status: 'CONNECTING', answeredAt: new Date() },
    });
    if (!updated.count || !this.calls.has(id)) throw new Error('Call ended.');
    call.record.answeredAt = new Date();
    this.publish(call.record);
    this.server
      .to(call.callerSocket)
      .to(client.id)
      .emit('call:accepted', call.record);
    return call.record;
  }
  async end(client: Socket, userId: number, id: string, failed = false) {
    if (!this.calls.has(id)) return { id };
    const call = this.live(id, userId, client.id, true);
    const status = failed
      ? 'FAILED'
      : call.record.status === 'RINGING'
        ? userId === call.record.callerId
          ? 'CANCELLED'
          : 'REJECTED'
        : call.record.status === 'ACTIVE'
          ? 'ENDED'
          : 'CANCELLED';
    return this.finish(id, status);
  }
  async finish(id: string, status: string) {
    const call = this.calls.get(id);
    if (!call) return;
    this.calls.delete(id);
    clearTimeout(call.timer);
    const endedAt = new Date();
    // Announce and release even if persistence is temporarily unavailable.
    call.record = { ...call.record, status, endedAt };
    this.publish(call.record);
    try {
      await this.prisma.call.update({
        where: { id },
        data: { status, endedAt },
      });
    } finally {
      this.busy.delete(call.record.callerId);
      this.busy.delete(call.record.calleeId);
    }
    return call.record;
  }
  async connected(client: Socket, userId: number, id: string) {
    const call = this.live(id, userId, client.id);
    if (call.record.status !== 'CONNECTING') return { id };
    call.connected.add(userId);
    if (call.connected.size === 2) {
      call.record.status = 'ACTIVE';
      clearTimeout(call.timer);
      const connectedAt = new Date();
      await this.prisma.call.updateMany({
        where: { id, status: 'CONNECTING' },
        data: { status: 'ACTIVE', connectedAt },
      });
      if (this.calls.has(id)) {
        call.record.connectedAt = connectedAt;
        this.publish(call.record);
      }
    }
    return { id };
  }
  signal(
    client: Socket,
    userId: number,
    payload: { id: string; signal: unknown },
  ) {
    const call = this.live(payload?.id, userId, client.id);
    if (!['CONNECTING', 'ACTIVE'].includes(call.record.status))
      throw new Error('Call not answered.');
    const signal = payload.signal as {
      type?: string;
      sdp?: string;
      candidate?: unknown;
    };
    if (
      !signal ||
      typeof signal !== 'object' ||
      JSON.stringify(signal).length > 65_536 ||
      !(
        (['offer', 'answer'].includes(signal.type ?? '') &&
          typeof signal.sdp === 'string') ||
        (signal.type === 'ice' &&
          signal.candidate &&
          typeof signal.candidate === 'object')
      )
    )
      throw new Error('Invalid call signal.');
    if (
      (signal.type === 'offer' && userId !== call.record.callerId) ||
      (signal.type === 'answer' && userId !== call.record.calleeId)
    )
      throw new Error('Invalid negotiation role.');
    this.server
      .to(
        userId === call.record.callerId
          ? call.calleeSocket!
          : call.callerSocket,
      )
      .emit('call:signal', payload);
    return { id: payload.id };
  }
  disconnect(client: Socket) {
    for (const [id, call] of this.calls) {
      if (call.callerSocket === client.id || call.calleeSocket === client.id)
        void this.finish(id, 'FAILED').catch((error: unknown) =>
          this.logger.error(error),
        );
    }
  }
  iceServers(): { iceServers: RTCIceServerConfig[] } {
    const iceServers: RTCIceServerConfig[] = [
      { urls: 'stun:stun.l.google.com:19302' },
    ];
    const urls = process.env.WEBRTC_TURN_URLS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls?.length && process.env.WEBRTC_TURN_SECRET) {
      // Short-lived coturn REST credentials; never expose the shared secret.
      const username = `${Math.floor(Date.now() / 1000) + 86400}:batgram`;
      const credential = createHmac('sha1', process.env.WEBRTC_TURN_SECRET)
        .update(username)
        .digest('base64');
      iceServers.push({ urls, username, credential });
    }
    return { iceServers };
  }
}
type RTCIceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
