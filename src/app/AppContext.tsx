import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Organization, Notification } from '../lib/types';
import { api } from '../lib/api';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface AppContextValue {
  user: User | null;
  organization: Organization | null;
  allDemoUsers: User[];
  allOrganizations: Organization[];
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  switchUser: (userId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  toasts: ToastItem[];
  showToast: (type: ToastItem['type'], title: string, message?: string) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [allDemoUsers, setAllDemoUsers] = useState<User[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('sharespace_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('sharespace_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const showToast = useCallback((type: ToastItem['type'], title: string, message?: string) => {
    const id = `tst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me.user);
      setOrganization(me.organization);
      setAllDemoUsers(me.allDemoUsers);
      setAllOrganizations(me.allOrganizations);
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const switchUser = useCallback(
    async (userId: string) => {
      const res = await api.demoLogin(userId);
      await refreshSession();
      showToast(
        'info',
        `Signed in as ${res.user.name}`,
        `Organisation: ${res.organization.name} · Roles: ${res.user.roles.join(', ')}`
      );
    },
    [refreshSession, showToast]
  );

  const resetDemoData = useCallback(async () => {
    await api.resetDemoData();
    await refreshSession();
    showToast('success', 'Demo data restored', 'Seeded bookings, policies, incidents, and ledger chain have been reset.');
  }, [refreshSession, showToast]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <AppContext.Provider
      value={{
        user,
        organization,
        allDemoUsers,
        allOrganizations,
        notifications,
        unreadCount,
        loading,
        theme,
        toggleTheme,
        switchUser,
        refreshSession,
        resetDemoData,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
