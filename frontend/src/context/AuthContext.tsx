'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiBaseUrl } from '@/lib/api';
<<<<<<< HEAD
import { canAccessPath, defaultDashboardPath, type UserRole } from '@/lib/rbac';
import { useRouter, usePathname } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  isAdmin?: boolean;
=======
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  organizationId: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
<<<<<<< HEAD
  isAdmin: boolean;
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

<<<<<<< HEAD
function normalizeUser(raw: Partial<User> & { id: string; email: string; organizationId: string }): User {
  const role: UserRole = raw.role === 'reviewer' ? 'reviewer' : 'admin';
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name ?? null,
    role,
    isAdmin: raw.isAdmin ?? role === 'admin',
    organizationId: raw.organizationId,
  };
}

=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Session invalid');
        }
        return res.json();
      })
      .then((data) => {
<<<<<<< HEAD
        const nextUser = normalizeUser(data.user);
        setUser(nextUser);
        localStorage.setItem('user', JSON.stringify(nextUser));
=======
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
<<<<<<< HEAD
    if (isLoading) {
      return;
    }

    if (!token && !pathname.startsWith('/login')) {
      router.push('/login');
      return;
    }

    if (token && pathname === '/login') {
      router.push(defaultDashboardPath(user?.role));
      return;
    }

    if (token && user && pathname.startsWith('/dashboard') && !canAccessPath(user.role, pathname)) {
      router.push(defaultDashboardPath(user.role));
    }
  }, [token, user, isLoading, pathname, router]);

  const login = (newToken: string, newUser: User) => {
    const normalized = normalizeUser(newUser);
    setToken(newToken);
    setUser(normalized);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(normalized));
    router.push(defaultDashboardPath(normalized.role));
=======
    if (!isLoading) {
      if (!token && !pathname.startsWith('/login')) {
        router.push('/login');
      } else if (token && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [token, isLoading, pathname, router]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    router.push('/dashboard');
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
<<<<<<< HEAD
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        isLoading,
        isAdmin: user?.role === 'admin',
      }}
    >
=======
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, isLoading }}>
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
