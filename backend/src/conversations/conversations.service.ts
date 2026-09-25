import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Créer un groupe
  async createGroup(userId: string, dto: CreateConversationDto) {
    const memberIds = dto.memberIds ? Array.from(new Set(dto.memberIds.filter(id => id !== userId))) : [];

    return this.prisma.conversation.create({
      data: {
        name: dto.name,
        isGroup: true,
        memberships: {
          create: [
            // Le créateur devient ADMIN
            { userId, role: Role.ADMIN },
            // Les autres membres invités deviennent MEMBER
            ...memberIds.map(id => ({ userId: id, role: Role.MEMBER })),
          ],
        },
      },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });
  }

  // 2. Récupérer toutes les conversations de l'utilisateur connecté
  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        memberships: {
          some: { userId },
        },
      },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}