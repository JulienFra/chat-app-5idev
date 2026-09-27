import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
  ) {}

  // Ce qu'on renvoie avec chaque message : l'auteur, sans email ni hash
  private readonly messageInclude = {
    author: { select: { id: true, displayName: true } },
  };

  async create(userId: string, conversationId: string, content: string) {
    await this.conversations.assertIsMember(userId, conversationId);

    return this.prisma.message.create({
      data: { content: content.trim(), authorId: userId, conversationId },
      include: this.messageInclude,
    });
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