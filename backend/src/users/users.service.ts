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
}