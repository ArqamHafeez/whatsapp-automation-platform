import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string, organizationSlug: string) {
    try {
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      let organization = await this.prisma.organization.findUnique({ where: { slug: organizationSlug } });
      if (!organization) {
        organization = await this.prisma.organization.create({
          data: { name: organizationSlug, slug: organizationSlug },
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await this.prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          organizationId: organization.id,
          isAdmin: true,
        },
      });

      const token = await this.createSession(user.id);
      return { user: this.sanitizeUser(user), token };
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
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

  private sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
