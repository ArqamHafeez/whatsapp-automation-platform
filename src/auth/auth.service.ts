import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { SanitizedUser } from './auth-user.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createUserInOrg(opts: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    organizationId: string;
  }): Promise<SanitizedUser> {
    const existingUser = await this.prisma.user.findUnique({ where: { email: opts.email } });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(opts.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: opts.email,
        name: opts.name,
        passwordHash,
        role: opts.role,
        isAdmin: opts.role === UserRole.admin,
        organizationId: opts.organizationId,
      },
    });

    return this.sanitizeUser(user);
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.createSession(user.id);
    return { user: this.sanitizeUser(user), token };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { user: this.sanitizeUser(user), organization: user.organization };
  }

  async getOrg(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.organization) {
      throw new NotFoundException('Organization not found');
    }

    return { organization: user.organization };
  }

  private async createSession(userId: string) {
    const token = this.jwtService.sign({ sub: userId });
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await this.prisma.session.create({ data: { token, userId, expiresAt } });
    return token;
  }

  sanitizeUser(user: {
    id: string;
    email: string;
    name: string | null;
    role?: UserRole | null;
    isAdmin: boolean;
    organizationId: string;
    createdAt: Date;
    passwordHash?: string;
  }): SanitizedUser {
    const role = user.role ?? (user.isAdmin ? UserRole.admin : UserRole.reviewer);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      isAdmin: role === UserRole.admin || user.isAdmin,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
    };
  }
}
