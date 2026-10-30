/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
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
import { LandingPage } from './features/public/LandingPage';
import { NotFoundPage } from './features/public/NotFoundPage';
import { PrivacyPolicyPage } from './features/public/PrivacyPolicyPage';
import { TermsOfServicePage } from './features/public/TermsOfServicePage';
import { ContactPage } from './features/public/ContactPage';
import { ThankYouPage } from './features/public/ThankYouPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useApp();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono-tech text-[var(--text-secondary)]">
          Connecting to institutional identity...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

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

const RootIndexRoute: React.FC = () => {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono-tech text-[var(--text-secondary)]">
          Connecting to institutional identity...
        </span>
      </div>
    );
  }

  if (user) {
    return <DashboardPage />;
  }

  return <LandingPage />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <AppShell>
            <Routes>
              {/* Public Informational & Legal Routes */}
              <Route path="/" element={<RootIndexRoute />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/thank-you" element={<ThankYouPage />} />
              <Route path="/login" element={<LoginPage />} />
            <Route
              path="/discover"
              element={
                <ProtectedRoute>
                  <DiscoverPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources/:id"
              element={
                <ProtectedRoute>
                  <ResourceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources/:id/request"
              element={
                <ProtectedRoute>
                  <BookingRequestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute>
                  <MyBookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings/:id"
              element={
                <ProtectedRoute>
                  <BookingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings/:id/check-in"
              element={
                <ProtectedRoute>
                  <CheckInPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings/:id/return"
              element={
                <ProtectedRoute>
                  <ReturnPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings/:id/incident"
              element={
                <ProtectedRoute>
                  <IncidentReportPage />
                </ProtectedRoute>
              }
            />

            {/* Manager / Owner Scoped Routes */}
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                    <ReviewWorkspacePage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/review/:bookingId"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                    <ReviewWorkspacePage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/handover"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                    <StaffHandoverPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/resources"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                    <OwnerResourcesPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/resources/new"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                    <OwnerResourcesPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/resources/:id/edit"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                    <OwnerResourcesPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'MANAGER', 'ADMIN']}>
                    <AnalyticsPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/* Incidents & Ledger */}
            <Route
              path="/incidents"
              element={
                <ProtectedRoute>
                  <IncidentsListAndDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidents/:id"
              element={
                <ProtectedRoute>
                  <IncidentsListAndDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ledger"
              element={
                <ProtectedRoute>
                  <TrustLedgerPage />
                </ProtectedRoute>
              }
            />

            {/* Assets & QR */}
            <Route
              path="/assets/scan/:token"
              element={
                <ProtectedRoute>
                  <AssetScanLandingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/labels/:resourceId"
              element={
                <ProtectedRoute>
                  <PrintableQrLabelSheetPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Governance */}
            <Route
              path="/admin/policies"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'ADMIN']}>
                    <PoliciesPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/policies/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['OWNER', 'ADMIN']}>
                    <PoliciesPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'OWNER']}>
                    <AdminUsersPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* User & Info */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </AppProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
}
