'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { UserRole } from '@/lib/rbac';

export function RoleGate({
  roles,
  children,
  fallbackPath = '/dashboard/reviews',
}: {
  roles: UserRole[];
  children: React.ReactNode;
  fallbackPath?: string;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(fallbackPath);
    }
  }, [user, isLoading, roles, router, fallbackPath]);

  if (isLoading || !user || !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
