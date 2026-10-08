import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    const lower = term.toLowerCase();
    const startsWith = (name: string) => (name.toLowerCase().startsWith(lower) ? 0 : 1);
    return users.sort((a, b) => startsWith(a.displayName) - startsWith(b.displayName));
  }
}