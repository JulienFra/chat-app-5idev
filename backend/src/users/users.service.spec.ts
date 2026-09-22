import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;

  // Faux PrismaService : on simule uniquement ce que UsersService utilise
  const prismaMock = {
    user: {
      findUnique: jest.fn<(args: unknown) => Promise<unknown>>(),
      create: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findByEmail cherche un utilisateur par son email', async () => {
    const user = { id: '1', email: 'a@test.com' };
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await service.findByEmail('a@test.com');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'a@test.com' },
    });
    expect(result).toEqual(user);
  });
});