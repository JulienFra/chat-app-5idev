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

  // 1. Créer un groupe
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

  // 2. Lister les conversations de l'utilisateur
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

  // 5. Vérifier que l'utilisateur est ADMIN du salon (Permissions S4)
  async assertIsAdmin(userId: string, conversationId: string) {
    const membership = await this.assertIsMember(userId, conversationId);

    if (membership.role !== Role.ADMIN) {
      throw new ForbiddenException('Action réservée aux administrateurs du salon');
    }

    return membership;
  }

  // 6. Ajouter un membre (par UUID ou par email) - réservé à l'ADMIN
  async addMember(adminUserId: string, conversationId: string, identifier: string) {
    await this.assertIsAdmin(adminUserId, conversationId);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Salon introuvable');
    if (!conv.isGroup) {
      throw new BadRequestException('Impossible d’ajouter un membre à une discussion privée');
    }

    // Recherche par email ou par ID
    const targetUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { id: identifier },
        ],
      },
    });
    if (!targetUser) {
      throw new NotFoundException(`Aucun utilisateur trouvé pour "${identifier}"`);
    }

    return this.prisma.membership.upsert({
      where: {
        userId_conversationId: { userId: targetUser.id, conversationId },
      },
      update: {},
      create: {
        userId: targetUser.id,
        conversationId,
        role: Role.MEMBER,
      },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
  }
}