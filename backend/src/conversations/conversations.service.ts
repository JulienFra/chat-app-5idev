import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway, // NOUVEAU
  ) {}

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

    const conversation = await this.prisma.conversation.create({
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

    // NOUVEAU : le créateur ET les invités rejoignent la room tout de suite
    this.realtime.addMembersToConversation([userId, ...memberIds], conversation.id);

    return conversation;
  }

  // 2. Lister les conversations de l'utilisateur, avec leur nombre de non-lus
  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { memberships: { some: { userId } } },
      include: {
        ...this.conversationInclude,
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Une seule requête SQL pour compter les non-lus de toutes les conversations.
    // Non lu = message d'un AUTRE membre, envoyé après la dernière lecture
    // (ou après l'arrivée dans la conversation, si on ne l'a jamais ouverte).
    const rows = await this.prisma.$queryRaw<{ conversationId: string; count: bigint }[]>`
      SELECT m."conversationId", COUNT(msg.id) AS count
      FROM "Membership" m
      JOIN "Message" msg
        ON msg."conversationId" = m."conversationId"
       AND msg."authorId" <> m."userId"
       AND msg."createdAt" > COALESCE(m."lastReadAt", m."joinedAt")
      WHERE m."userId" = ${userId}
      GROUP BY m."conversationId"
    `;

    const unreadByConversation = new Map(
      rows.map((r) => [r.conversationId, Number(r.count)]),
    );

    return conversations.map((c) => ({
      ...c,
      unreadCount: unreadByConversation.get(c.id) ?? 0,
    }));
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

    const conversation = await this.prisma.conversation.create({
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

    // NOUVEAU : seulement à la création (une conversation existante a déjà sa room)
    this.realtime.addMembersToConversation([userId, otherUserId], conversation.id);

    return conversation;
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

    const membership = await this.prisma.membership.upsert({
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

    // NOUVEAU : le nouveau membre rejoint la room et voit le groupe apparaître
    this.realtime.addMembersToConversation([targetUser.id], conversationId);

    return membership;
  }

  // 7. Marquer une conversation comme lue (remet son compteur de non-lus à zéro)
  async markAsRead(userId: string, conversationId: string) {
    await this.assertIsMember(userId, conversationId);

    await this.prisma.membership.update({
      where: { userId_conversationId: { userId, conversationId } },
      data: { lastReadAt: new Date() },
    });
  }
}