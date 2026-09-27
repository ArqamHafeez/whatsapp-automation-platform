'use client';

import { useAuth } from '@/context/AuthContext';
import { RuleDraftProvider, useRuleDraft } from '@/context/RuleDraftContext';
<<<<<<< HEAD
import { NAV_ITEMS } from '@/lib/rbac';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Smartphone, MessageSquare, Route, LogOut, User as UserIcon, Activity, Truck, ClipboardCheck, Bot, Users, BarChart3 } from 'lucide-react';
import React from 'react';

const iconByHref: Record<string, React.ComponentType<{ size?: number }>> = {
  '/dashboard': Activity,
  '/dashboard/connections': Smartphone,
  '/dashboard/chats': MessageSquare,
  '/dashboard/rules': Route,
  '/dashboard/agents': Bot,
  '/dashboard/reviews': ClipboardCheck,
  '/dashboard/delivery': Truck,
  '/dashboard/analytics': BarChart3,
  '/dashboard/users': Users,
};

=======
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Smartphone, MessageSquare, Route, LogOut, User as UserIcon, Activity, Truck, ClipboardCheck, Bot } from 'lucide-react';
import React from 'react';

>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { isDraftActive } = useRuleDraft();

<<<<<<< HEAD
  const navItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)).map((item) => ({
    ...item,
    icon: iconByHref[item.href] ?? Activity,
  }));

  const contentMaxWidth = pathname.startsWith('/dashboard/analytics') ? '1200px' : '1000px';
=======
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Activity },
    { name: 'Connections', href: '/dashboard/connections', icon: Smartphone },
    { name: 'Chats & Groups', href: '/dashboard/chats', icon: MessageSquare },
    { name: 'Forwarding Rules', href: '/dashboard/rules', icon: Route, showDraftHint: true },
    { name: 'AI Agents', href: '/dashboard/agents', icon: Bot },
    { name: 'Review Queue', href: '/dashboard/reviews', icon: ClipboardCheck },
    { name: 'Delivery Log', href: '/dashboard/delivery', icon: Truck },
  ];
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a

  return (
    <div className="page-container">
      <aside
        style={{
          width: '260px',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                stroke="white"
                strokeWidth="2"
              />
              <path d="M12 16L16 12L12 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 12H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: '1.1rem',
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-outfit), sans-serif',
            }}
          >
            AutoForward
          </span>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            const draftWaiting =
              item.showDraftHint && isDraftActive && !pathname.startsWith('/dashboard/rules');
            return (
              <Link
                key={item.name}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary)' : draftWaiting ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  fontWeight: isActive || draftWaiting ? 500 : 400,
                  transition: 'all var(--transition)',
                  border: draftWaiting ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                }}
              >
                <item.icon size={18} />
                <span style={{ flex: 1 }}>{item.name}</span>
                {draftWaiting ? (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--primary)',
                    }}
                  >
                    Draft
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserIcon size={18} color="var(--text-muted)" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
<<<<<<< HEAD
                {user?.email || 'User'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {user?.role === 'admin' ? 'Admin' : 'Reviewer'}
              </div>
=======
                {user?.email || 'Admin'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Workspace</div>
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              width: '100%',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              transition: 'all var(--transition)',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
<<<<<<< HEAD
        <div style={{ maxWidth: contentMaxWidth, margin: '0 auto' }}>{children}</div>
=======
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>{children}</div>
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RuleDraftProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </RuleDraftProvider>
  );
}
