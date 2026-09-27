import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  private async getAdminOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.admin) {
      throw new ForbiddenException('Admin access required');
    }
    return user.organizationId;
  }

  async listUsers(adminUserId: string) {
    const orgId = await this.getAdminOrgId(adminUserId);
    const users = await this.prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => this.authService.sanitizeUser(user));
  }

  async createUser(adminUserId: string, dto: CreateUserDto) {
    const orgId = await this.getAdminOrgId(adminUserId);
    return this.authService.createUserInOrg({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      role: dto.role,
      organizationId: orgId,
    });
  }

  async updateUser(adminUserId: string, targetUserId: string, dto: UpdateUserDto) {
    const orgId = await this.getAdminOrgId(adminUserId);
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: orgId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === adminUserId && dto.role && dto.role !== UserRole.admin) {
      throw new ForbiddenException('You cannot remove your own admin role');
    }

    const data: {
      name?: string;
      role?: UserRole;
      isAdmin?: boolean;
      passwordHash?: string;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.role !== undefined) {
      data.role = dto.role;
      data.isAdmin = dto.role === UserRole.admin;
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data,
    });

    return this.authService.sanitizeUser(updated);
  }
}
