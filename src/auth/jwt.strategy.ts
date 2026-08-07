import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from './auth-user.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: { headers?: { authorization?: string }; query?: { access_token?: string } }, payload: { sub?: string }): Promise<AuthUser> {
    const authHeader = req.headers?.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token && typeof req.query?.access_token === 'string') {
      token = req.query.access_token;
    }

    if (!token) {
      throw new UnauthorizedException('Bearer token missing');
    }

    const session = await this.prisma.session.findUnique({ where: { token } });
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };
  }
}
