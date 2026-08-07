export type UserRole = 'admin' | 'reviewer';

export type NavItem = {
  name: string;
  href: string;
  roles: UserRole[];
  showDraftHint?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', roles: ['admin', 'reviewer'] },
  { name: 'Connections', href: '/dashboard/connections', roles: ['admin'] },
  { name: 'Chats & Groups', href: '/dashboard/chats', roles: ['admin'] },
  { name: 'Forwarding Rules', href: '/dashboard/rules', roles: ['admin'], showDraftHint: true },
  { name: 'AI Agents', href: '/dashboard/agents', roles: ['admin'] },
  { name: 'Review Queue', href: '/dashboard/reviews', roles: ['admin', 'reviewer'] },
  { name: 'Delivery Log', href: '/dashboard/delivery', roles: ['admin', 'reviewer'] },
  { name: 'Analytics', href: '/dashboard/analytics', roles: ['admin'] },
  { name: 'Team Users', href: '/dashboard/users', roles: ['admin'] },
];

export function isAdmin(role?: UserRole | null): boolean {
  return role === 'admin';
}

export function canAccessPath(role: UserRole | undefined | null, path: string): boolean {
  if (!role) {
    return false;
  }
  if (path === '/dashboard' || path === '/dashboard/') {
    return true;
  }
  const item = NAV_ITEMS.find((entry) => path.startsWith(entry.href) && entry.href !== '/dashboard');
  if (item) {
    return item.roles.includes(role);
  }
  return isAdmin(role);
}

export function defaultDashboardPath(role?: UserRole | null): string {
  return role === 'reviewer' ? '/dashboard/reviews' : '/dashboard';
}
