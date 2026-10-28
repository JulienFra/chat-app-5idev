import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, EventType, Plan, Prisma, TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export const PLAN_LIMITS: Record<Plan, { maxTeams: number; maxSlots: number }> = {
  FREE: { maxTeams: 1, maxSlots: 5 },
  PREMIUM: { maxTeams: 10, maxSlots: 20 },
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_UPCOMING_EVENTS = 50; // événements à venir par équipe (anti-spam)

// Ce qu'on renvoie avec chaque équipe (jamais d'email ni de hash), événements compris
const teamInclude = {
  owner: { select: { id: true, displayName: true, plan: true } },
  members: {
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { joinedAt: 'asc' },
  },
  events: {
    orderBy: { startsAt: 'asc' },
  },
} satisfies Prisma.TeamInclude;

type TeamWithMembers = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listMyTeams(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      include: teamInclude,
      orderBy: { createdAt: 'asc' },
    });

    for (const team of teams) {
      if (team.owner.plan === Plan.PREMIUM) await this.ensureAdminChannel(team.id);
    }

    return teams.map((team) => this.present(team, userId));
  }

  async getTeam(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, include: teamInclude });
    if (!team) throw new NotFoundException('Équipe introuvable');
    if (!team.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Tu ne fais pas partie de cette équipe');
    }
    return this.present(team, userId);
  }

  private present(team: TeamWithMembers, userId: string) {
    return {
      ...team,
      myRole: team.members.find((m) => m.userId === userId)?.role ?? null,
      limits: PLAN_LIMITS[team.owner.plan],
    };
  }

  async create(userId: string, name: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const owned = await this.prisma.team.count({ where: { ownerId: userId } });
    if (owned >= PLAN_LIMITS[user.plan].maxTeams) {
      throw new ForbiddenException(
        user.plan === Plan.FREE
          ? "En Free, tu peux créer 1 équipe. Passe en Premium pour en créer jusqu'à 10."
          : 'Tu as atteint la limite de 10 équipes.',
      );
    }
    await this.assertNameAvailable(userId, name);

    const premium = user.plan === Plan.PREMIUM;
    const team = await this.prisma.team.create({
      data: {
        name,
        ownerId: userId,
        members: { create: { userId, role: TeamRole.CEO } },
        conversations: {
          create: [
            { type: ConversationType.GENERAL, isGroup: true, name: 'général' },
            ...(premium ? [{ type: ConversationType.ADMIN, isGroup: true, name: 'admin' }] : []),
          ],
        },
      },
    });

    await this.syncChannels(team.id);
    return this.getTeam(team.id, userId);
  }

  async rename(userId: string, teamId: string, name: string) {
    await this.assertOwner(teamId, userId);
    await this.assertNameAvailable(userId, name, teamId);
    await this.prisma.team.update({ where: { id: teamId }, data: { name } });
    await this.notifyTeam(teamId);
    return this.getTeam(teamId, userId);
  }

  async remove(userId: string, teamId: string) {
    await this.assertOwner(teamId, userId);

    const [members, channels] = await Promise.all([
      this.prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } }),
      this.prisma.conversation.findMany({ where: { teamId }, select: { id: true } }),
    ]);
    const memberIds = members.map((m) => m.userId);

    await this.prisma.team.delete({ where: { id: teamId } });

    for (const channel of channels) {
      this.realtime.removeMembersFromConversation(memberIds, channel.id);
    }
    this.realtime.notifyTeamsChanged(memberIds);
  }

  async changeRole(ownerId: string, teamId: string, targetUserId: string, role: TeamRole) {
    const team = await this.assertOwner(teamId, ownerId);
    if (targetUserId === ownerId) {
      throw new BadRequestException('Pour changer de CEO, transfère la propriété de l’équipe');
    }
    if (role === TeamRole.COACH && team.owner.plan === Plan.FREE) {
      throw new ForbiddenException('Les rôles (coach) sont réservés au plan Premium');
    }
    await this.getMembership(teamId, targetUserId);

    await this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      data: { role },
    });
    await this.syncChannels(teamId);
    await this.notifyTeam(teamId);
  }

  async kick(actorId: string, teamId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new BadRequestException('Pour partir, utilise « Quitter l’équipe »');
    }
    const team = await this.assertCanManageRoster(teamId, actorId);
    const actor = await this.getMembership(teamId, actorId);
    const target = await this.getMembership(teamId, targetUserId);

    if (target.role === TeamRole.CEO) {
      throw new ForbiddenException('Le CEO ne peut pas être exclu');
    }
    if (actor.role === TeamRole.COACH && target.role !== TeamRole.PLAYER) {
      throw new ForbiddenException('Un coach ne peut exclure que des joueurs');
    }

    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    await this.syncChannels(team.id);
    await this.notifyTeam(teamId, [targetUserId]);
  }

  async leave(userId: string, teamId: string) {
    const membership = await this.getMembership(teamId, userId);
    if (membership.role === TeamRole.CEO) {
      throw new BadRequestException(
        'Le CEO ne peut pas partir : transfère d’abord la propriété ou supprime l’équipe',
      );
    }
    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    await this.syncChannels(teamId);
    await this.notifyTeam(teamId, [userId]);
  }

  async transfer(ownerId: string, teamId: string, targetUserId: string) {
    const team = await this.assertOwner(teamId, ownerId);
    if (targetUserId === ownerId) throw new BadRequestException('Tu es déjà le CEO');
    await this.getMembership(teamId, targetUserId);

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { plan: true, displayName: true },
    });
    if (!target) throw new NotFoundException('Joueur introuvable');
    const owned = await this.prisma.team.count({ where: { ownerId: targetUserId } });
    if (owned >= PLAN_LIMITS[target.plan].maxTeams) {
      throw new ConflictException(
        `${target.displayName} a déjà atteint sa limite d'équipes (${PLAN_LIMITS[target.plan].maxTeams} en ${target.plan === Plan.FREE ? 'Free' : 'Premium'})`,
      );
    }
    await this.assertNameAvailable(targetUserId, team.name);

    await this.prisma.$transaction([
      this.prisma.team.update({ where: { id: teamId }, data: { ownerId: targetUserId } }),
      this.prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: targetUserId } },
        data: { role: TeamRole.CEO },
      }),
      this.prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: ownerId } },
        data: { role: TeamRole.COACH },
      }),
    ]);
    await this.syncChannels(teamId);
    await this.notifyTeam(teamId);
  }

  async getTeamWithOwner(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { owner: { select: { id: true, plan: true } } },
    });
    if (!team) throw new NotFoundException('Équipe introuvable');
    return team;
  }

  async getMembership(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new ForbiddenException('Ce joueur ne fait pas partie de l’équipe');
    return membership;
  }

  private async assertOwner(teamId: string, userId: string) {
    const team = await this.getTeamWithOwner(teamId);
    if (team.ownerId !== userId) {
      throw new ForbiddenException('Action réservée au CEO de l’équipe');
    }
    return team;
  }

  async assertCanManageRoster(teamId: string, userId: string) {
    const team = await this.getTeamWithOwner(teamId);
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new ForbiddenException('Tu ne fais pas partie de cette équipe');

    if (membership.role === TeamRole.CEO) return team;
    if (membership.role === TeamRole.COACH && team.owner.plan === Plan.PREMIUM) return team;

    throw new ForbiddenException(
      team.owner.plan === Plan.FREE
        ? 'En Free, seul le créateur de l’équipe gère les membres'
        : 'Action réservée au CEO et aux coachs',
    );
  }

  private async assertNameAvailable(ownerId: string, name: string, exceptTeamId?: string) {
    const duplicate = await this.prisma.team.findFirst({
      where: {
        ownerId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptTeamId ? { id: { not: exceptTeamId } } : {}),
      },
    });
    if (duplicate) throw new ConflictException(`Il existe déjà une équipe nommée « ${name} »`);
  }

  private async ensureAdminChannel(teamId: string) {
    const exists = await this.prisma.conversation.findFirst({
      where: { teamId, type: ConversationType.ADMIN },
    });
    if (exists) return;
    await this.prisma.conversation.create({
      data: { teamId, type: ConversationType.ADMIN, isGroup: true, name: 'admin' },
    });
    await this.syncChannels(teamId);
  }

  async syncChannels(teamId: string) {
    const [members, channels] = await Promise.all([
      this.prisma.teamMember.findMany({ where: { teamId }, select: { userId: true, role: true } }),
      this.prisma.conversation.findMany({
        where: { teamId },
        select: { id: true, type: true, memberships: { select: { userId: true } } },
      }),
    ]);

    const everyone = members.map((m) => m.userId);
    const staff = members.filter((m) => m.role !== TeamRole.PLAYER).map((m) => m.userId);

    for (const channel of channels) {
      const wanted = channel.type === ConversationType.ADMIN ? staff : everyone;
      const current = channel.memberships.map((m) => m.userId);
      const toAdd = wanted.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !wanted.includes(id));

      if (toAdd.length > 0) {
        await this.prisma.membership.createMany({
          data: toAdd.map((userId) => ({ userId, conversationId: channel.id })),
          skipDuplicates: true,
        });
        this.realtime.addMembersToConversation(toAdd, channel.id);
      }
      if (toRemove.length > 0) {
        await this.prisma.membership.deleteMany({
          where: { conversationId: channel.id, userId: { in: toRemove } },
        });
        this.realtime.removeMembersFromConversation(toRemove, channel.id);
      }
    }
  }

  async notifyTeam(teamId: string, extraUserIds: string[] = []) {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    this.realtime.notifyTeamsChanged([...members.map((m) => m.userId), ...extraUserIds]);
  }

  // ---------- Événements (scrims et matchs) ----------

  // Créer un événement.
  // - Premium : CEO et coachs ; un salon dédié est créé (ex : #scrim-vitality-27-10).
  // - Free : seul le créateur de l'équipe ; l'événement va dans le calendrier, sans salon.
  async createEvent(
    userId: string,
    teamId: string,
    type: EventType,
    opponent: string,
    startsAt: Date,
  ) {
    // Mêmes droits que pour gérer l'effectif (CEO, + coachs en Premium)
    const team = await this.assertCanManageRoster(teamId, userId);
    const premium = team.owner.plan === Plan.PREMIUM;

    // Pas d'événement dans le passé (1 h de marge), ni à plus d'un an
    const now = Date.now();
    if (startsAt.getTime() < now - HOUR_MS) {
      throw new BadRequestException("La date de l'événement est déjà passée");
    }
    if (startsAt.getTime() > now + 365 * DAY_MS) {
      throw new BadRequestException("L'événement ne peut pas être prévu à plus d'un an");
    }

    // Anti-spam : nombre d'événements à venir limité par équipe
    const upcoming = await this.prisma.event.count({
      where: { teamId, startsAt: { gt: new Date(now) } },
    });
    if (upcoming >= MAX_UPCOMING_EVENTS) {
      throw new ConflictException(
        `Cette équipe a déjà ${MAX_UPCOMING_EVENTS} événements à venir. Supprimes-en avant d'en créer un autre.`,
      );
    }

    const event = await this.prisma.$transaction(async (tx) => {
      // Salon dédié : Premium uniquement
      let conversationId: string | null = null;
      if (premium) {
        const name = await this.uniqueChannelName(tx, teamId, eventChannelBase(type, opponent, startsAt));
        const conversation = await tx.conversation.create({
          data: { teamId, type: ConversationType.EVENT, isGroup: true, name },
        });
        conversationId = conversation.id;
      }

      return tx.event.create({
        data: { type, opponent, startsAt, teamId, createdById: userId, conversationId },
      });
    });

    if (event.conversationId) await this.syncChannels(teamId); // accès au salon pour tous les membres
    await this.notifyTeam(teamId);
    return event;
  }

  // Supprimer un événement (et son salon dédié s'il en a un)
  async deleteEvent(userId: string, teamId: string, eventId: string) {
    await this.assertCanManageRoster(teamId, userId);

    const event = await this.prisma.event.findFirst({ where: { id: eventId, teamId } });
    if (!event) throw new NotFoundException('Événement introuvable');

    // On note qui avait accès au salon AVANT de le supprimer
    const channelMembers = event.conversationId
      ? await this.prisma.membership.findMany({
          where: { conversationId: event.conversationId },
          select: { userId: true },
        })
      : [];

    await this.prisma.$transaction([
      this.prisma.event.delete({ where: { id: event.id } }),
      ...(event.conversationId
        ? [this.prisma.conversation.delete({ where: { id: event.conversationId } })]
        : []),
    ]);

    if (event.conversationId) {
      this.realtime.removeMembersFromConversation(
        channelMembers.map((m) => m.userId),
        event.conversationId,
      );
    }
    await this.notifyTeam(teamId);
  }

  // « scrim-vitality-27-10 » existe déjà dans l'équipe ? → « scrim-vitality-27-10-2 », etc.
  private async uniqueChannelName(
    tx: Prisma.TransactionClient,
    teamId: string,
    base: string,
  ): Promise<string> {
    const existing = await tx.conversation.findMany({
      where: { teamId, name: { startsWith: base } },
      select: { name: true },
    });
    const taken = new Set(existing.map((c) => c.name));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
}

// ---------- Utilitaires événements ----------

// Nom du salon : type, adversaire et date (jour/mois, heure de Bruxelles)
// ex : MATCH, « Équipe Rouge », 27/10 → « match-equipe-rouge-27-10 »
export function eventChannelBase(type: EventType, opponent: string, startsAt: Date): string {
  const slug =
    opponent
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // retire les accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20)
      .replace(/-+$/g, '') || 'adversaire';

  // L'heure du serveur est en UTC : on calcule la date dans le fuseau des joueurs
  const parts = new Intl.DateTimeFormat('fr-BE', {
    timeZone: 'Europe/Brussels',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(startsAt);
  const day = parts.find((p) => p.type === 'day')?.value ?? '00';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';

  return `${type.toLowerCase()}-${slug}-${day}-${month}`;
}
