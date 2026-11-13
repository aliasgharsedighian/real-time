import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Message } from '@prisma/client';
import { PrismaService } from '../../libs/db/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat/gateway';
import { CreateChatRequestDto } from './polling.request.dto';

const includeMembers = {
  participants: {
    include: { user: { select: { id: true, email: true, profile: true } } },
  },
} satisfies Prisma.ChatInclude;

function memberName(user: {
  id: number;
  email: string | null;
  profile: { firstname: string | null; lastname: string | null } | null;
}) {
  return (
    [user.profile?.firstname, user.profile?.lastname]
      .filter(Boolean)
      .join(' ') ||
    user.email ||
    `User #${user.id}`
  );
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
  ) {}

  async create(userId: number, dto: CreateChatRequestDto) {
    const ids = [...new Set([userId, ...dto.participant])];
    const isGroup = dto.isGroup ?? ids.length > 2;
    if (ids.length < 2 || ids.length > 100 || (!isGroup && ids.length !== 2))
      throw new BadRequestException(
        'Choose one contact for a direct chat or up to 99 for a group.',
      );
    if (isGroup && !dto.name?.trim())
      throw new BadRequestException('A group name is required.');
    const chat = await this.prisma.$transaction(async (tx) => {
      await this.validateUsers(tx, ids);
      if (!isGroup) {
        // Serialize direct-chat creation for the same pair, including reversed requests.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${Prisma.join([...ids].sort((a, b) => a - b))}) ORDER BY id FOR UPDATE`;
        const existing = await tx.chat.findFirst({
          where: {
            isGroup: false,
            savedOwnerId: null,
            AND: ids.map((id) => ({ participants: { some: { userId: id } } })),
          },
          include: includeMembers,
        });
        if (existing) return existing;
      }
      return tx.chat.create({
        data: {
          isGroup,
          name: isGroup ? dto.name!.trim() : null,
          participants: {
            create: ids.map((id) => ({
              userId: id,
              role: isGroup && id === userId ? 'OWNER' : 'MEMBER',
            })),
          },
          messages: dto.firstMessage?.trim()
            ? { create: { senderId: userId, content: dto.firstMessage.trim() } }
            : undefined,
        },
        include: includeMembers,
      });
    });
    this.gateway.notifyChatChanged(chat.id, ids);
    return { statusCode: 201, message: 'Chat ready', data: chat };
  }

  private async validateUsers(tx: Prisma.TransactionClient, ids: number[]) {
    const count = await tx.user.count({ where: { id: { in: ids } } });
    if (count !== ids.length)
      throw new BadRequestException('One or more users do not exist.');
  }

  // Lock the group row so concurrent additions, removals and ownership changes stay consistent.
  private async group(
    tx: Prisma.TransactionClient,
    chatId: number,
    userId: number,
    ownerOnly = true,
  ) {
    await tx.$queryRaw`SELECT id FROM "Chat" WHERE id = ${chatId} FOR UPDATE`;
    const chat = await tx.chat.findUnique({
      where: { id: chatId },
      include: includeMembers,
    });
    const member = chat?.participants.find((p) => p.userId === userId);
    if (!member) throw new NotFoundException('Conversation unavailable.');
    if (!chat!.isGroup) throw new BadRequestException('This is not a group.');
    if (ownerOnly && member.role !== 'OWNER')
      throw new ForbiddenException('Only the group owner can do this.');
    return chat!;
  }

  async rename(chatId: number, userId: number, name: string) {
    const chat = await this.prisma.$transaction(async (tx) => {
      await this.group(tx, chatId, userId);
      return tx.chat.update({
        where: { id: chatId },
        data: { name },
        include: includeMembers,
      });
    });
    this.gateway.notifyChatChanged(
      chatId,
      chat.participants.map((p) => p.userId),
    );
    return { data: chat, message: 'Group updated' };
  }

  async add(chatId: number, userId: number, participants: number[]) {
    const { chat, events } = await this.prisma.$transaction(async (tx) => {
      const group = await this.group(tx, chatId, userId);
      const added = [...new Set(participants)].filter(
        (id) => !group.participants.some((p) => p.userId === id),
      );
      if (group.participants.length + added.length > 100)
        throw new BadRequestException('Groups support up to 100 members.');
      await this.validateUsers(tx, added);
      await tx.chatParticipant.createMany({
        data: added.map((id) => ({ chatId, userId: id })),
      });
      const chat = await tx.chat.findUniqueOrThrow({
        where: { id: chatId },
        include: includeMembers,
      });
      const events: Message[] = [];
      for (const id of added) {
        const member = chat.participants.find((p) => p.userId === id)!;
        events.push(
          await tx.message.create({
            data: {
              chatId,
              senderId: userId,
              kind: 'MEMBER_ADDED',
              content: `${memberName(member.user)} was added to the group.`,
            },
            include: {
              sender: { select: { id: true, email: true, profile: true } },
              attachments: true,
              readStatuses: true,
            },
          }),
        );
      }
      return { chat, events };
    });
    for (const event of events) this.gateway.broadcast(event);
    this.gateway.notifyChatChanged(
      chatId,
      chat.participants.map((p) => p.userId),
    );
    return { data: chat, message: 'Members added' };
  }

  async remove(chatId: number, userId: number, targetId: number) {
    const { remaining, event } = await this.prisma.$transaction(async (tx) => {
      const group = await this.group(tx, chatId, userId, userId !== targetId);
      const target = group.participants.find((p) => p.userId === targetId);
      if (!target) throw new NotFoundException('Member not found.');
      if (target.role === 'OWNER' && userId !== targetId)
        throw new ForbiddenException('The owner cannot be removed.');
      const others = group.participants
        .filter((p) => p.userId !== targetId)
        .sort((a, b) => a.id - b.id);
      if (target.role === 'OWNER' && others.length) {
        await tx.chatParticipant.update({
          where: { id: others[0].id },
          data: { role: 'OWNER' },
        });
      }
      await tx.chatParticipant.delete({ where: { id: target.id } });
      const actor = group.participants.find((p) => p.userId === userId)!;
      const left = userId === targetId;
      const event = await tx.message.create({
        data: {
          chatId,
          senderId: userId,
          kind: left ? 'MEMBER_LEFT' : 'MEMBER_REMOVED',
          content: left
            ? `${memberName(target.user)} left the group.`
            : `${memberName(actor.user)} removed ${memberName(target.user)} from the group.`,
        },
        include: {
          sender: { select: { id: true, email: true, profile: true } },
          attachments: true,
          readStatuses: true,
        },
      });
      return { remaining: others.map((p) => p.userId), event };
    });
    this.gateway.removeChatMember(chatId, targetId);
    this.gateway.broadcast(event);
    this.gateway.notifyChatChanged(chatId, remaining);
    return { data: null, message: 'Member left the group' };
  }

  async transfer(chatId: number, userId: number, targetId: number) {
    const chat = await this.prisma.$transaction(async (tx) => {
      const group = await this.group(tx, chatId, userId);
      if (!group.participants.some((p) => p.userId === targetId))
        throw new BadRequestException('Choose an existing member.');
      await tx.chatParticipant.updateMany({
        where: { chatId },
        data: { role: 'MEMBER' },
      });
      await tx.chatParticipant.update({
        where: { userId_chatId: { userId: targetId, chatId } },
        data: { role: 'OWNER' },
      });
      return tx.chat.findUniqueOrThrow({
        where: { id: chatId },
        include: includeMembers,
      });
    });
    this.gateway.notifyChatChanged(
      chatId,
      chat.participants.map((p) => p.userId),
    );
    return { data: chat, message: 'Ownership transferred' };
  }
}
