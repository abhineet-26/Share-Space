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
  demoPersonasEnabled: boolean;
  demoResetEnabled: boolean;
  demoPersonasLoading: boolean;
  demoPersonasError: string | null;
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  switchUser: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  loadDemoPersonas: () => Promise<void>;
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
  const [demoPersonasEnabled, setDemoPersonasEnabled] = useState<boolean>(true);
  const [demoResetEnabled, setDemoResetEnabled] = useState<boolean>(false);
  const [demoPersonasLoading, setDemoPersonasLoading] = useState<boolean>(true);
  const [demoPersonasError, setDemoPersonasError] = useState<string | null>(null);
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

  const loadDemoPersonas = useCallback(async () => {
    setDemoPersonasLoading(true);
    setDemoPersonasError(null);
    try {
      const res = await api.getDemoPersonas();
      setDemoPersonasEnabled(res.enabled);
      setDemoResetEnabled(res.resetEnabled);
      if (res.personas && res.personas.length > 0) {
        setAllDemoUsers(res.personas);
      }
      if (res.organizations && res.organizations.length > 0) {
        setAllOrganizations(res.organizations);
      }
    } catch (err: any) {
      setDemoPersonasError(err?.message || 'Failed to load demo accounts');
    } finally {
      setDemoPersonasLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me.user);
      setOrganization(me.organization);
      if (me.allDemoUsers && me.allDemoUsers.length > 0) {
        setAllDemoUsers(me.allDemoUsers);
      }
      if (me.allOrganizations && me.allOrganizations.length > 0) {
        setAllOrganizations(me.allOrganizations);
      }
      const notifs = await api.getNotifications().catch(() => []);
      setNotifications(notifs);
    } catch (err: any) {
      // 401 indicates normal unauthenticated session state
      setUser(null);
      setOrganization(null);
      setNotifications([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sharespace_token');
      }
      if (
        err?.status !== 401 &&
        err?.statusCode !== 401 &&
        err?.code !== 'HTTP_401' &&
        err?.code !== 'UNAUTHORIZED' &&
        err?.code !== 'UNAUTHENTICATED'
      ) {
        console.warn('Session refresh:', err?.message || err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemoPersonas();
    refreshSession();
  }, [loadDemoPersonas, refreshSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setOrganization(null);
      setNotifications([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sharespace_token');
      }
    };
    window.addEventListener('sharespace:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('sharespace:unauthorized', handleUnauthorized);
    };
  }, []);

  const switchUser = useCallback(
    async (userId: string) => {
      try {
        const res = await api.demoLogin(userId);
        setUser(res.user);
        setOrganization(res.organization);
        await refreshSession();
        showToast(
          'info',
          `Signed in as ${res.user.name}`,
          `Organisation: ${res.organization.name} · Roles: ${res.user.roles.join(', ')}`
        );
      } catch (err: any) {
        showToast('error', 'Sign-in failed', err?.message || 'Could not authenticate demo user');
        throw err;
      }
    },
    [refreshSession, showToast]
  );

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setOrganization(null);
    setNotifications([]);
    showToast('info', 'Signed out', 'Session cleared successfully.');
  }, [showToast]);

  const resetDemoData = useCallback(async () => {
    try {
      await api.resetDemoData();
      await refreshSession();
      await loadDemoPersonas();
      showToast('success', 'Demo data restored', 'Seeded bookings, policies, incidents, and ledger chain have been reset.');
    } catch (err: any) {
      showToast('error', 'Reset failed', err?.message || 'Could not reset demo database');
      throw err;
    }
  }, [loadDemoPersonas, refreshSession, showToast]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <AppContext.Provider
      value={{
        user,
        organization,
        allDemoUsers,
        allOrganizations,
        demoPersonasEnabled,
        demoResetEnabled,
        demoPersonasLoading,
        demoPersonasError,
        notifications,
        unreadCount,
        loading,
        theme,
        toggleTheme,
        switchUser,
        signOut,
        refreshSession,
        loadDemoPersonas,
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
