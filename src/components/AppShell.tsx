import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  CalendarClock,
  ClipboardCheck,
  ArrowLeftRight,
  AlertTriangle,
  ShieldCheck,
  Sliders,
  BarChart3,
  Users,
  Bell,
  UserCircle,
  QrCode,
  Sun,
  Moon,
  Menu,
  X,
  Building2,
  LogOut,
  Info,
  Wrench,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { Role } from '../lib/types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Role[];
  group: 'USER' | 'OPERATIONS' | 'GOVERNANCE';
  badge?: number;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    organization,
    allDemoUsers,
    unreadCount,
    theme,
    toggleTheme,
    switchUser,
    toasts,
    dismissToast,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user || !organization) {
    return <div className="min-h-screen bg-[var(--bg-app)]">{children}</div>;
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'USER',
    },
    {
      label: 'Discover resources',
      path: '/discover',
      icon: <Search className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'USER',
    },
    {
      label: 'My bookings',
      path: '/bookings',
      icon: <CalendarClock className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'USER',
    },
    {
      label: 'Scan asset QR',
      path: '/assets/scan/qr_nit_osc_001_9f8a7b',
      icon: <QrCode className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'USER',
    },
    {
      label: 'Notifications',
      path: '/notifications',
      icon: <Bell className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'USER',
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Profile & training',
      path: '/profile',
      icon: <UserCircle className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'USER',
    },
    // Owner / Manager Operations
    {
      label: 'Request review queue',
      path: '/review',
      icon: <ClipboardCheck className="w-4 h-4" />,
      roles: ['OWNER', 'MANAGER', 'ADMIN'],
      group: 'OPERATIONS',
    },
    {
      label: 'Handover & return',
      path: '/handover',
      icon: <ArrowLeftRight className="w-4 h-4" />,
      roles: ['OWNER', 'MANAGER', 'ADMIN'],
      group: 'OPERATIONS',
    },
    {
      label: 'Incident queue',
      path: '/incidents',
      icon: <AlertTriangle className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'OPERATIONS',
    },
    {
      label: 'Manage resources',
      path: '/owner/resources',
      icon: <Wrench className="w-4 h-4" />,
      roles: ['OWNER', 'MANAGER', 'ADMIN'],
      group: 'OPERATIONS',
    },
    {
      label: 'Trust Ledger',
      path: '/ledger',
      icon: <ShieldCheck className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'OPERATIONS',
    },
    {
      label: 'Utilisation & fairness',
      path: '/analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      roles: ['OWNER', 'MANAGER', 'ADMIN'],
      group: 'OPERATIONS',
    },
    // Admin Governance
    {
      label: 'Policies & rules',
      path: '/admin/policies',
      icon: <Sliders className="w-4 h-4" />,
      roles: ['OWNER', 'ADMIN'],
      group: 'GOVERNANCE',
    },
    {
      label: 'Users, roles & training',
      path: '/admin/users',
      icon: <Users className="w-4 h-4" />,
      roles: ['ADMIN', 'MANAGER'],
      group: 'GOVERNANCE',
    },
    {
      label: 'Organisation & demo',
      path: '/admin/settings',
      icon: <Building2 className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'GOVERNANCE',
    },
    {
      label: 'System architecture',
      path: '/about',
      icon: <Info className="w-4 h-4" />,
      roles: ['USER', 'OWNER', 'MANAGER', 'ADMIN'],
      group: 'GOVERNANCE',
    },
  ];

  const allowedNav = navItems.filter((item) =>
    item.roles.some((r) => user.roles.includes(r))
  );

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    const base = path.split('/').slice(0, 3).join('/');
    return location.pathname.startsWith(base);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Desktop Left Sidebar Rail (246px) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="no-print hidden lg:flex lg:flex-col lg:w-[248px] lg:shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-color)] select-none"
      >
        {/* Wordmark */}
        <div className="h-[64px] px-5 flex items-center justify-between border-b border-[var(--border-color)]">
          <Link
            to="/"
            className="text-base font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2 whitespace-nowrap"
          >
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--brand-primary)] inline-block" />
            <span>SHARESPACE</span>
          </Link>
          <span className="text-[11px] font-mono-tech text-[var(--text-muted)]">
            {organization.departmentCode || 'CAMPUS'}
          </span>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {(['USER', 'OPERATIONS', 'GOVERNANCE'] as const).map((groupKey) => {
            const groupItems = allowedNav.filter((i) => i.group === groupKey);
            if (groupItems.length === 0) return null;
            const groupTitle =
              groupKey === 'USER'
                ? 'Workspace'
                : groupKey === 'OPERATIONS'
                ? 'Operations & Accountability'
                : 'Governance & Demo';
            return (
              <div key={groupKey}>
                <div className="px-2.5 mb-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                  {groupTitle}
                </div>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-[6px] text-sm transition-colors ${
                            active
                              ? 'bg-[var(--brand-subtle)] text-[var(--brand-primary)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 truncate">
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge !== undefined && (
                            <span className="px-1.5 py-0.2 text-[11px] font-mono-tech rounded-[4px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Bottom Organisation & Persona Switcher */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50 space-y-2.5">
          <div>
            <label
              htmlFor="sidebar-persona-select"
              className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Demo account / role switcher
            </label>
            <select
              id="sidebar-persona-select"
              value={user.id}
              onChange={(e) => switchUser(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)] font-medium cursor-pointer"
            >
              {allDemoUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roles[0]} · {u.organizationId === 'org_nit' ? 'NIT' : 'Harbour'})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1">
            <span className="truncate font-medium" title={organization.name}>
              {organization.name}
            </span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline shrink-0 ml-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Accounts</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Three-zone contract on desktop, compact on mobile) */}
        <header className="no-print h-[62px] bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Zone 1: Brand / Mobile Trigger + Tenant Context */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-[6px] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/"
              className="lg:hidden font-bold text-sm tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              SHARESPACE
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-secondary)] truncate">
              <Building2 className="w-3.5 h-3.5 shrink-0 text-[var(--brand-primary)]" />
              <span className="font-medium text-[var(--text-primary)] truncate">
                {organization.name}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tech text-[11px]">RLS Tenant Isolated</span>
            </div>
          </div>

          {/* Zone 2: Quick Role & User Context */}
          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>Signed in as</span>
            <strong className="text-[var(--text-primary)] font-semibold">{user.name}</strong>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tech">{user.roles.join(' / ')}</span>
          </div>

          {/* Zone 3: Theme, Notifications & Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <Link
              to="/notifications"
              className="relative p-2 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
              aria-label={`Notifications (${unreadCount} unread)`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[10px] font-mono-tech font-bold rounded-[4px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]">
                  {unreadCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="px-3.5 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Find equipment
            </button>
          </div>
        </header>

        {/* Organisation B Tenant Isolation Notice Banner when switched to Harbour */}
        {organization.id === 'org_harbour' && (
          <div className="no-print bg-[var(--status-warning-bg)] border-b border-[var(--status-warning)]/30 px-4 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--status-warning)]">
            <div>
              <strong>Tenant Isolation Active:</strong> Viewing{' '}
              <span className="underline">{organization.name}</span> (`org_harbour`). All records from
              Nilgiri Institute of Technology (`org_nit`) are isolated at the database row-level security boundary.
            </div>
            <button
              type="button"
              onClick={() => switchUser('usr_aarav')}
              className="px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] font-medium cursor-pointer"
            >
              Switch back to Nilgiri Institute (Aarav)
            </button>
          </div>
        )}

        {/* Page Viewport */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (375px optimized, max 4 destinations + Menu) */}
        <nav
          aria-label="Mobile bottom navigation"
          className="no-print lg:hidden fixed bottom-0 inset-x-0 h-[56px] bg-[var(--bg-surface)] border-t border-[var(--border-color)] grid grid-cols-5 z-30"
        >
          <Link
            to="/"
            className={`flex flex-col items-center justify-center text-[11px] ${
              location.pathname === '/' ? 'text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-secondary)]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Home</span>
          </Link>
          <Link
            to="/discover"
            className={`flex flex-col items-center justify-center text-[11px] ${
              location.pathname.startsWith('/discover') ? 'text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Search className="w-4 h-4 mb-0.5" />
            <span>Discover</span>
          </Link>
          <Link
            to="/bookings"
            className={`flex flex-col items-center justify-center text-[11px] ${
              location.pathname.startsWith('/bookings') ? 'text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-secondary)]'
            }`}
          >
            <CalendarClock className="w-4 h-4 mb-0.5" />
            <span>Bookings</span>
          </Link>
          <Link
            to="/ledger"
            className={`flex flex-col items-center justify-center text-[11px] ${
              location.pathname.startsWith('/ledger') ? 'text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-secondary)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 mb-0.5" />
            <span>Ledger</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center text-[11px] text-[var(--text-secondary)]"
          >
            <Menu className="w-4 h-4 mb-0.5" />
            <span>Menu</span>
          </button>
        </nav>
      </div>

      {/* Mobile Drawer Sheet */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-[280px] max-w-[85vw] bg-[var(--bg-surface)] h-full flex flex-col border-r border-[var(--border-color)] z-10">
            <div className="h-[60px] px-4 flex items-center justify-between border-b border-[var(--border-color)]">
              <span className="font-bold text-base">SHARESPACE</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-[6px] text-[var(--text-secondary)]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <label
                htmlFor="mobile-persona-select"
                className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1"
              >
                Switch demo account
              </label>
              <select
                id="mobile-persona-select"
                value={user.id}
                onChange={(e) => {
                  switchUser(e.target.value);
                  setMobileMenuOpen(false);
                }}
                className="w-full px-2.5 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[6px]"
              >
                {allDemoUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.roles[0]})
                  </option>
                ))}
              </select>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {allowedNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-[6px] text-sm ${
                    isActive(item.path)
                      ? 'bg-[var(--brand-subtle)] text-[var(--brand-primary)] font-semibold'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 text-xs font-mono-tech bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] rounded-[4px]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Accessible Live Region Toast Stack */}
      <div
        aria-live="polite"
        className="no-print fixed bottom-16 lg:bottom-5 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--text-primary)]">{t.title}</div>
              {t.message && (
                <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{t.message}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
