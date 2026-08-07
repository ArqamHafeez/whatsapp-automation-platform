import { UserRole } from '@prisma/client';

export type AuthUser = {
  userId: string;
  role: UserRole;
  organizationId: string;
};

export type SanitizedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isAdmin: boolean;
  organizationId: string;
  createdAt: Date;
};
