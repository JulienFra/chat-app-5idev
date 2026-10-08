import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

// Règles anti-spam
const HOUR_MS = 60 * 60 * 1000;
const INVITATION_TTL_MS = 7 * 24 * HOUR_MS; // une invitation expire après 7 jours
const DECLINE_COOLDOWN_MS = 24 * HOUR_MS; // délai avant de réinviter après un refus
const MAX_INVITES_PER_HOUR = 20; // par personne qui invite
const MAX_PENDING_PER_CONVERSATION = 20; // invitations en attente par groupe

// Ce qu'on renvoie avec chaque invitation (jamais d'email)
const invitationInclude = {
  conversation: { select: { id: true, name: true } },
  inviter: { select: { id: true, displayName: true } },
  invitee: { select: { id: true, displayName: true } },
} as const;

// Filtre « pas encore expirée » (calculé à la lecture, pas de tâche planifiée)
const notExpired = () => ({ gt: new Date(Date.now() - INVITATION_TTL_MS) });

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // 1. Inviter un joueur dans un groupe (réservé à l'ADMIN du groupe)
  async create(inviterId: string, conversationId: string, inviteeId: string) {
    await this.conversations.assertIsAdmin(inviterId, conversationId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Équipe introuvable');
    if (!conversation.isGroup) {
      throw new BadRequestException('On ne peut inviter que dans une équipe');
    }
    if (inviteeId === inviterId) {
      throw new BadRequestException('Tu ne peux pas t’inviter toi-même');
    }

    const invitee = await this.prisma.user.findUnique({
      where: { id: inviteeId },
      select: { id: true, displayName: true },
    });
    if (!invitee) throw new NotFoundException('Joueur introuvable');
    const name = invitee.displayName;

    // Déjà membre ?
    const membership = await this.prisma.membership.findUnique({
      where: { userId_conversationId: { userId: inviteeId, conversationId } },
    });
    if (membership) throw new ConflictException(`${name} fait déjà partie de l'équipe`);

    // Déjà une invitation en attente ?
    const pending = await this.prisma.invitation.findFirst({
      where: {
        conversationId,
        inviteeId,
        status: InvitationStatus.PENDING,
        createdAt: notExpired(),
      },
    });
    if (pending) throw new ConflictException(`${name} a déjà une invitation en attente`);

    // A refusé il y a moins de 24 h ?
    const recentDecline = await this.prisma.invitation.findFirst({
      where: {
        conversationId,
        inviteeId,
        status: InvitationStatus.DECLINED,
        respondedAt: { gt: new Date(Date.now() - DECLINE_COOLDOWN_MS) },
      },
      orderBy: { respondedAt: 'desc' },
    });
    if (recentDecline?.respondedAt) {
      const msLeft = recentDecline.respondedAt.getTime() + DECLINE_COOLDOWN_MS - Date.now();
      const hoursLeft = Math.max(1, Math.ceil(msLeft / HOUR_MS));
      throw new HttpException(
        `${name} a refusé ton invitation. Tu pourras réessayer dans ${hoursLeft} h.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Trop d'invitations envoyées dans la dernière heure ?
    const sentLastHour = await this.prisma.invitation.count({
      where: { inviterId, createdAt: { gt: new Date(Date.now() - HOUR_MS) } },
    });
    if (sentLastHour >= MAX_INVITES_PER_HOUR) {
      throw new HttpException(
        `Tu as envoyé trop d'invitations (${MAX_INVITES_PER_HOUR} par heure maximum). Réessaie plus tard.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Trop d'invitations en attente pour ce groupe ?
    const pendingInConversation = await this.prisma.invitation.count({
      where: { conversationId, status: InvitationStatus.PENDING, createdAt: notExpired() },
    });
    if (pendingInConversation >= MAX_PENDING_PER_CONVERSATION) {
      throw new ConflictException(
        `Trop d'invitations en attente pour cette équipe (${MAX_PENDING_PER_CONVERSATION} maximum). Annule-en ou attends des réponses.`,
      );
    }

    const invitation = await this.prisma.invitation.create({
      data: { conversationId, inviterId, inviteeId },
      include: invitationInclude,
    });

    // L'invité la reçoit en direct (toast + badge)
    this.realtime.emitToUser(inviteeId, 'invitation:new', invitation);

    return invitation;
  }

  // 2. « Mes invitations » : celles que j'ai reçues et qui attendent une réponse
  listReceived(userId: string) {
    return this.prisma.invitation.findMany({
      where: { inviteeId: userId, status: InvitationStatus.PENDING, createdAt: notExpired() },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Invitations en attente d'un groupe (pour l'ADMIN : « Invité », annuler)
  async listForConversation(adminId: string, conversationId: string) {
    await this.conversations.assertIsAdmin(adminId, conversationId);
    return this.prisma.invitation.findMany({
      where: { conversationId, status: InvitationStatus.PENDING, createdAt: notExpired() },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Une invitation que CET utilisateur peut encore accepter ou refuser
  private async findPendingForInvitee(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    const expired =
      invitation && invitation.createdAt.getTime() < Date.now() - INVITATION_TTL_MS;
    if (
      !invitation ||
      invitation.inviteeId !== userId ||
      invitation.status !== InvitationStatus.PENDING ||
      expired
    ) {
      throw new NotFoundException('Invitation introuvable ou expirée');
    }
    return invitation;
  }

  // 4. Accepter : on devient membre du groupe
  async accept(userId: string, invitationId: string) {
    const invitation = await this.findPendingForInvitee(userId, invitationId);

    // Les deux écritures réussissent ensemble ou pas du tout
    await this.prisma.$transaction([
      this.prisma.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.ACCEPTED, respondedAt: new Date() },
      }),
      this.prisma.membership.upsert({
        where: {
          userId_conversationId: { userId, conversationId: invitation.conversationId },
        },
        update: {},
        create: { userId, conversationId: invitation.conversationId, role: Role.MEMBER },
      }),
    ]);

    // Rejoint la room et voit le groupe apparaître dans sa liste
    this.realtime.addMembersToConversation([userId], invitation.conversationId);
  }

  // 5. Refuser
  async decline(userId: string, invitationId: string) {
    await this.findPendingForInvitee(userId, invitationId);
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.DECLINED, respondedAt: new Date() },
    });
  }

  // 6. Annuler une invitation envoyée (ADMIN du groupe)
  async cancel(adminId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation introuvable');
    }
    await this.conversations.assertIsAdmin(adminId, invitation.conversationId);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.CANCELLED, respondedAt: new Date() },
    });

    // Elle disparaît en direct de « Mes invitations » chez l'invité
    this.realtime.emitToUser(invitation.inviteeId, 'invitation:removed', { id: invitationId });
  }
}