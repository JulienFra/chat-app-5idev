import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

// Ce qu'on renvoie pour le profil : jamais le hash du mot de passe
const profileSelect = {
  id: true,
  email: true,
  displayName: true,
  plan: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Recherche insensible à la casse : « nouveau » trouve « Nouveau »
  async findByDisplayName(displayName: string) {
    return this.prisma.user.findFirst({
      where: { displayName: { equals: displayName, mode: 'insensitive' } },
    });
  }

  async create(email: string, passwordHash: string, displayName: string) {
    return this.prisma.user.create({
      data: { email, passwordHash, displayName },
    });
  }

  // Recherche par morceau de pseudo, pour inviter quelqu'un.
  // Ne renvoie jamais l'email ni le hash, et exclut l'utilisateur connecté.
  async search(query: string, currentUserId: string) {
    const term = query.trim();
    if (term.length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        displayName: { contains: term, mode: 'insensitive' },
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 10,
    });

    // Les pseudos qui COMMENCENT par la recherche passent en premier
    const lower = term.toLowerCase();
    const startsWith = (name: string) => (name.toLowerCase().startsWith(lower) ? 0 : 1);
    return users.sort((a, b) => startsWith(a.displayName) - startsWith(b.displayName));
  }

  // Profil de l'utilisateur connecté
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // Changer son mot de passe : il faut connaître l'actuel
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // 400 et pas 401 : un 401 déconnecterait l'utilisateur côté frontend
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Mot de passe actuel incorrect');

    if (currentPassword === newPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
  }

  // Interrupteur de démo : dans un vrai SaaS, c'est le paiement qui changerait le plan
  async setPlan(userId: string, plan: Plan) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { plan },
      select: profileSelect,
    });
  }
}