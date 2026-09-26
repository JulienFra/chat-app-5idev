import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Ce qu'on renvoie avec chaque conversation : les membres, sans passwordHash
  private readonly conversationInclude = {
    memberships: {
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    },
  };

  // 1. Créer un groupe (Florentin)
  async createGroup(userId: string, dto: CreateConversationDto) {
    const memberIds = dto.memberIds
      ? Array.from(new Set(dto.memberIds.filter((id) => id !== userId)))
      : [];

    return this.prisma.conversation.create({
      data: {
        name: dto.name,
        isGroup: true,
        memberships: {
          create: [
            { userId, role: Role.ADMIN },
            ...memberIds.map((id) => ({ userId: id, role: Role.MEMBER })),
          ],
        },
      },
      include: this.conversationInclude,
    });
  }

  // 2. Lister les conversations de l'utilisateur (Florentin)
  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { memberships: { some: { userId } } },
      include: {
        ...this.conversationInclude,
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Trouver ou créer une conversation 1:1
  async findOrCreateDirect(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException(
        'Impossible de créer une conversation avec soi-même',
      );
    }

    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
    });
    if (!otherUser) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Une conversation 1:1 qui contient A ET B
    const existing = await this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { memberships: { some: { userId } } },
          { memberships: { some: { userId: otherUserId } } },
        ],
      },
      include: this.conversationInclude,
    });

    if (existing) {
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        isGroup: false,
        memberships: {
          create: [
            { userId, role: Role.MEMBER },
            { userId: otherUserId, role: Role.MEMBER },
          ],
        },
      },
      include: this.conversationInclude,
    });
  }

  // 4. Vérifier qu'un utilisateur est membre d'une conversation
  async assertIsMember(userId: string, conversationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });

    if (!membership) {
      throw new ForbiddenException('Accès refusé à cette conversation');
    }

    return membership;
  }
}