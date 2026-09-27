import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function createContext(role?: UserRole): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : {} }),
      }),
    } as ExecutionContext;
  }

  it('allows access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext(UserRole.reviewer))).toBe(true);
  });

  it('allows admin when admin role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.admin]);
    expect(guard.canActivate(createContext(UserRole.admin))).toBe(true);
  });

  it('blocks reviewer when admin role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.admin]);
    expect(() => guard.canActivate(createContext(UserRole.reviewer))).toThrow(ForbiddenException);
  });

  it('allows reviewer on reviewer-accessible endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext(UserRole.reviewer))).toBe(true);
  });
});

describe('ROLES_KEY metadata', () => {
  it('is defined for role decorators', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});
