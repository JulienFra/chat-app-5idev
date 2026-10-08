import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // Ce qu'on renvoie avec chaque conversation : les membres, sans passwordHash
  private readonly conversationInclude = {
    memberships: {
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    },
  };

  // 1. Lister les conversations de l'utilisateur (messages privés + salons d'équipe
  //    auxquels il a accès), avec leur nombre de non-lus
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

  // 2. Trouver ou créer une conversation 1:1
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
        type: ConversationType.DIRECT,
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
        type: ConversationType.DIRECT,
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

    // Seulement à la création (une conversation existante a déjà sa room)
    this.realtime.addMembersToConversation([userId, otherUserId], conversation.id);

    return conversation;
  }

  // 3. Vérifier qu'un utilisateur a accès à une conversation
  //    (pour un salon d'équipe, c'est syncChannels qui gère ces accès)
  async assertIsMember(userId: string, conversationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });

    if (!membership) {
      throw new ForbiddenException('Accès refusé à cette conversation');
    }

    return membership;
  }

  // 4. Marquer une conversation comme lue (remet son compteur de non-lus à zéro)
  async markAsRead(userId: string, conversationId: string) {
    await this.assertIsMember(userId, conversationId);

    await this.prisma.membership.update({
      where: { userId_conversationId: { userId, conversationId } },
      data: { lastReadAt: new Date() },
    });
  }
}