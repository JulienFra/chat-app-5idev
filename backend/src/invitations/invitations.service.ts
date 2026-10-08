import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, Plan, TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PLAN_LIMITS, TeamsService } from '../teams/teams.service';

// Règles anti-spam
const HOUR_MS = 60 * 60 * 1000;
const INVITATION_TTL_MS = 7 * 24 * HOUR_MS; // une invitation expire après 7 jours
const DECLINE_COOLDOWN_MS = 24 * HOUR_MS; // délai avant de réinviter après un refus
const MAX_INVITES_PER_HOUR = 20; // par personne qui invite

// Ce qu'on renvoie avec chaque invitation (jamais d'email)
const invitationInclude = {
  team: { select: { id: true, name: true } },
  inviter: { select: { id: true, displayName: true } },
  invitee: { select: { id: true, displayName: true } },
} as const;

// Filtre « pas encore expirée » (calculé à la lecture, pas de tâche planifiée)
const notExpired = () => ({ gt: new Date(Date.now() - INVITATION_TTL_MS) });

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // 1. Inviter un joueur (CEO, ou coach en Premium)
  async create(inviterId: string, teamId: string, inviteeId: string) {
    const team = await this.teams.assertCanManageRoster(teamId, inviterId);

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
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: inviteeId } },
    });
    if (member) throw new ConflictException(`${name} fait déjà partie de l'équipe`);

    // Déjà une invitation en attente ?
    const pending = await this.prisma.invitation.findFirst({
      where: { teamId, inviteeId, status: InvitationStatus.PENDING, createdAt: notExpired() },
    });
    if (pending) throw new ConflictException(`${name} a déjà une invitation en attente`);

    // A refusé il y a moins de 24 h ?
    const recentDecline = await this.prisma.invitation.findFirst({
      where: {
        teamId,
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

    // Places : membres + invitations en attente ne dépassent pas la limite du plan
    const maxSlots = PLAN_LIMITS[team.owner.plan].maxSlots;
    const [memberCount, pendingCount] = await Promise.all([
      this.prisma.teamMember.count({ where: { teamId } }),
      this.prisma.invitation.count({
        where: { teamId, status: InvitationStatus.PENDING, createdAt: notExpired() },
      }),
    ]);
    if (memberCount + pendingCount >= maxSlots) {
      throw new ConflictException(
        team.owner.plan === Plan.FREE
          ? `L'équipe est complète (${maxSlots} places en Free, invitations en attente comprises). Passe en Premium pour aller jusqu'à 20.`
          : `L'équipe est complète (${maxSlots} places, invitations en attente comprises).`,
      );
    }

    const invitation = await this.prisma.invitation.create({
      data: { teamId, inviterId, inviteeId },
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

  // 3. Invitations en attente d'une équipe (CEO et coachs)
  async listForTeam(actorId: string, teamId: string) {
    await this.teams.assertCanManageRoster(teamId, actorId);
    return this.prisma.invitation.findMany({
      where: { teamId, status: InvitationStatus.PENDING, createdAt: notExpired() },
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

  // 4. Accepter : on devient joueur de l'équipe et on accède à ses salons
  async accept(userId: string, invitationId: string) {
    const invitation = await this.findPendingForInvitee(userId, invitationId);
    const team = await this.teams.getTeamWithOwner(invitation.teamId);

    // L'équipe a pu se remplir entre-temps
    const maxSlots = PLAN_LIMITS[team.owner.plan].maxSlots;
    const memberCount = await this.prisma.teamMember.count({ where: { teamId: team.id } });
    if (memberCount >= maxSlots) {
      throw new ConflictException(`L'équipe « ${team.name} » est complète`);
    }

    // Les deux écritures réussissent ensemble ou pas du tout
    await this.prisma.$transaction([
      this.prisma.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.ACCEPTED, respondedAt: new Date() },
      }),
      this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId } },
        update: {},
        create: { teamId: team.id, userId, role: TeamRole.PLAYER },
      }),
    ]);

    await this.teams.syncChannels(team.id); // accès à #général (et salons d'events)
    await this.teams.notifyTeam(team.id); // les autres membres voient le nouveau
  }

  // 5. Refuser
  async decline(userId: string, invitationId: string) {
    await this.findPendingForInvitee(userId, invitationId);
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.DECLINED, respondedAt: new Date() },
    });
  }

  // 6. Annuler une invitation envoyée (CEO et coachs)
  async cancel(actorId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation introuvable');
    }
    await this.teams.assertCanManageRoster(invitation.teamId, actorId);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.CANCELLED, respondedAt: new Date() },
    });

    // Elle disparaît en direct de « Mes invitations » chez l'invité
    this.realtime.emitToUser(invitation.inviteeId, 'invitation:removed', { id: invitationId });
  }
}