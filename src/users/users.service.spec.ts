jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService RBAC', () => {
  const authService = {
    createUserInOrg: jest.fn(),
    sanitizeUser: jest.fn((user) => user),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as any, authService as any);
  });

  it('rejects non-admin listing users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: UserRole.reviewer,
      organizationId: 'org1',
    });

    await expect(service.listUsers('u1')).rejects.toThrow(ForbiddenException);
  });

  it('allows admin to list org users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin1',
      role: UserRole.admin,
      organizationId: 'org1',
    });
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin1', email: 'admin@demo.com', role: UserRole.admin, isAdmin: true, organizationId: 'org1', name: 'Admin', createdAt: new Date() },
    ]);

    const users = await service.listUsers('admin1');
    expect(users).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('allows admin to create reviewer', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin1',
      role: UserRole.admin,
      organizationId: 'org1',
    });
    authService.createUserInOrg.mockResolvedValue({
      id: 'rev1',
      email: 'reviewer@demo.com',
      role: UserRole.reviewer,
    });

    const created = await service.createUser('admin1', {
      email: 'reviewer@demo.com',
      password: 'reviewer123',
      name: 'Reviewer',
      role: UserRole.reviewer,
    });

    expect(created.role).toBe(UserRole.reviewer);
    expect(authService.createUserInOrg).toHaveBeenCalledWith({
      email: 'reviewer@demo.com',
      password: 'reviewer123',
      name: 'Reviewer',
      role: UserRole.reviewer,
      organizationId: 'org1',
    });
  });
});
