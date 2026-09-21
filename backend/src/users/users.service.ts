import 'dotenv/config'; // Force Node à lire le .env immédiatement
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

@Injectable()
export class UsersService {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async create(email: string, passwordHash: string, displayName: string) {
    return prisma.user.create({
      data: { 
        email, 
        passwordHash,
        displayName 
      },
    });
  }
}