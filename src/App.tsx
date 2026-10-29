/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { AppProvider, useApp } from './app/AppContext';
import { AppShell } from './components/AppShell';
import { Role } from './lib/types';

import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DiscoverPage } from './features/resources/DiscoverPage';
import { ResourceDetailPage } from './features/resources/ResourceDetailPage';
import { BookingRequestPage } from './features/bookings/BookingRequestPage';
import { MyBookingsPage } from './features/bookings/MyBookingsPage';
import { BookingDetailPage } from './features/bookings/BookingDetailPage';
import { CheckInPage } from './features/handover/CheckInPage';
import { ReturnPage } from './features/handover/ReturnPage';
import { StaffHandoverPage } from './features/handover/StaffHandoverPage';
import { ReviewWorkspacePage } from './features/review/ReviewWorkspacePage';
import { IncidentReportPage } from './features/incidents/IncidentReportPage';
import { IncidentsListAndDetailPage } from './features/incidents/IncidentsListAndDetailPage';
import { TrustLedgerPage } from './features/ledger/TrustLedgerPage';
import { PoliciesPage } from './features/policies/PoliciesPage';
import { OwnerResourcesPage } from './features/owner/OwnerResourcesPage';
import {
  AssetScanLandingPage,
  PrintableQrLabelSheetPage,
} from './features/assets/AssetQrAndLabelsPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import {
  AdminUsersPage,
  AdminSettingsPage,
  NotificationsPage,
  ProfilePage,
  AboutPage,
} from './features/admin/AdminAndProfilePages';

const RoleGuard: React.FC<{
  allowedRoles: Role[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user, switchUser } = useApp();
  if (!user) return null;

  const hasPermission = user.roles.some((r) => allowedRoles.includes(r));
  if (!hasPermission) {
    return (
      <div className="max-w-xl mx-auto bg-[var(--bg-surface)] border border-[var(--status-danger)]/40 rounded-[8px] p-6 space-y-4">
        <div className="flex items-center gap-2 text-[var(--status-danger)] font-semibold">
          <ShieldAlert className="w-5 h-5" />
          <span>403 Forbidden — Role permission required</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          This workspace requires one of the following roles:{' '}
          <strong className="font-mono-tech text-[var(--text-primary)]">
            {allowedRoles.join(', ')}
          </strong>
          . You are currently signed in as <strong>{user.name}</strong> with role{' '}
          <strong className="font-mono-tech">{user.roles.join(', ')}</strong>.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => switchUser('usr_ravi')}
            className="px-3.5 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] cursor-pointer"
          >
            Switch to Ravi Kulkarni (MANAGER)
          </button>
          <button
            type="button"
            onClick={() => switchUser('usr_priya')}
            className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
          >
            Switch to Priya Nair (ADMIN)
          </button>
          <Link
            to="/"
            className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const NotFoundPage: React.FC = () => (
  <div className="max-w-lg mx-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-6 space-y-3 text-center">
    <h1 className="text-xl font-bold text-[var(--text-primary)]">404 — Route not found</h1>
    <p className="text-xs text-[var(--text-secondary)]">
      The requested operational screen does not exist.
    </p>
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]"
    >
      <span>Return to Dashboard</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppShell>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/resources/:id" element={<ResourceDetailPage />} />
            <Route path="/resources/:id/request" element={<BookingRequestPage />} />
            <Route path="/bookings" element={<MyBookingsPage />} />
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
            <Route path="/bookings/:id/check-in" element={<CheckInPage />} />
            <Route path="/bookings/:id/return" element={<ReturnPage />} />
            <Route path="/bookings/:id/incident" element={<IncidentReportPage />} />

            {/* Manager / Owner Scoped Routes */}
            <Route
              path="/review"
              element={
                <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                  <ReviewWorkspacePage />
                </RoleGuard>
              }
            />
            <Route
              path="/review/:bookingId"
              element={
                <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                  <ReviewWorkspacePage />
                </RoleGuard>
              }
            />
            <Route
              path="/handover"
              element={
                <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                  <StaffHandoverPage />
                </RoleGuard>
              }
            />
            <Route
              path="/owner/resources"
              element={
                <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                  <OwnerResourcesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/owner/resources/new"
              element={
                <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                  <OwnerResourcesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/owner/resources/:id/edit"
              element={
                <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                  <OwnerResourcesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/analytics"
              element={
                <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                  <AnalyticsPage />
                </RoleGuard>
              }
            />

            {/* Incidents & Ledger */}
            <Route path="/incidents" element={<IncidentsListAndDetailPage />} />
            <Route path="/incidents/:id" element={<IncidentsListAndDetailPage />} />
            <Route path="/ledger" element={<TrustLedgerPage />} />

            {/* Assets & QR */}
            <Route path="/assets/scan/:token" element={<AssetScanLandingPage />} />
            <Route path="/labels/:resourceId" element={<PrintableQrLabelSheetPage />} />

            {/* Admin Governance */}
            <Route
              path="/admin/policies"
              element={
                <RoleGuard allowedRoles={['OWNER', 'ADMIN']}>
                  <PoliciesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/policies/:id"
              element={
                <RoleGuard allowedRoles={['OWNER', 'ADMIN']}>
                  <PoliciesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'OWNER']}>
                  <AdminUsersPage />
                </RoleGuard>
              }
            />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />

            {/* User & Info */}
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </AppProvider>
    </BrowserRouter>
  );
}
