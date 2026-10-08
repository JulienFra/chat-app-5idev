import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, Plan, Prisma, TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

// Limites par plan (le plan est celui du propriétaire de l'équipe)
export const PLAN_LIMITS: Record<Plan, { maxTeams: number; maxSlots: number }> = {
  FREE: { maxTeams: 1, maxSlots: 5 },
  PREMIUM: { maxTeams: 10, maxSlots: 20 },
};

// Ce qu'on renvoie avec chaque équipe (jamais d'email ni de hash)
const teamInclude = {
  owner: { select: { id: true, displayName: true, plan: true } },
  members: {
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { joinedAt: 'asc' },
  },
} satisfies Prisma.TeamInclude;

type TeamWithMembers = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ---------- Lecture ----------

  // Mes équipes, avec membres, rôles et limites
  async listMyTeams(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      include: teamInclude,
      orderBy: { createdAt: 'asc' },
    });

    // Premium : #admin est créé à la volée s'il manque (ex : on vient de passer Premium)
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

  // Ajoute mon rôle et les limites du plan
  private present(team: TeamWithMembers, userId: string) {
    return {
      ...team,
      myRole: team.members.find((m) => m.userId === userId)?.role ?? null,
      limits: PLAN_LIMITS[team.owner.plan],
    };
  }

  // ---------- Création, renommage, suppression ----------

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

    // On note qui était dedans AVANT de supprimer, pour les prévenir ensuite
    const [members, channels] = await Promise.all([
      this.prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } }),
      this.prisma.conversation.findMany({ where: { teamId }, select: { id: true } }),
    ]);
    const memberIds = members.map((m) => m.userId);

    // Supprime en cascade : membres, salons, messages, invitations, events
    await this.prisma.team.delete({ where: { id: teamId } });

    for (const channel of channels) {
      this.realtime.removeMembersFromConversation(memberIds, channel.id);
    }
    this.realtime.notifyTeamsChanged(memberIds);
  }

  // ---------- Membres et rôles ----------

  // Le CEO change le rôle d'un membre (COACH ou PLAYER)
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

  // Exclure : le CEO exclut n'importe qui, un coach exclut seulement des joueurs (Premium)
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

  // Transférer la propriété : la cible devient CEO, l'ancien CEO devient coach
  async transfer(ownerId: string, teamId: string, targetUserId: string) {
    const team = await this.assertOwner(teamId, ownerId);
    if (targetUserId === ownerId) throw new BadRequestException('Tu es déjà le CEO');
    await this.getMembership(teamId, targetUserId);

    // Le nouveau propriétaire doit avoir de la place dans SES limites
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

  // ---------- Vérifications (utilisées aussi par les invitations) ----------

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

  // Qui peut gérer l'effectif (inviter, exclure) : le CEO, et les coachs en Premium
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

  // ---------- Salons ----------

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

  // Remet les accès aux salons en ordre selon les rôles :
  // #général et salons d'events = tous les membres, #admin = CEO + coachs
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

  // Prévient tous les membres (et d'éventuels anciens membres) que l'équipe a changé
  async notifyTeam(teamId: string, extraUserIds: string[] = []) {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    this.realtime.notifyTeamsChanged([...members.map((m) => m.userId), ...extraUserIds]);
  }
}