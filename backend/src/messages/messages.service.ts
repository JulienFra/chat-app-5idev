import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private readonly messageInclude = {
    author: { select: { id: true, displayName: true } },
  };

  async create(userId: string, conversationId: string, content: string) {
    await this.conversations.assertIsMember(userId, conversationId);

    // 1. Enregistrer en base
    const message = await this.prisma.message.create({
      data: { content: content.trim(), authorId: userId, conversationId },
      include: this.messageInclude,
    });

    // 2. Puis diffuser aux membres connectés
    this.realtime.emitNewMessage(message);

    return message;
  }

  async findForConversation(userId: string, conversationId: string) {
    await this.conversations.assertIsMember(userId, conversationId);

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: this.messageInclude,
    });
  }
}