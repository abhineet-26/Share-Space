import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  Download,
  Building2,
  Bell,
  Info,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Role, TrainingRecord, User } from '../../lib/types';
import { downloadFile, formatDateTime } from '../../lib/utils';
import { ConfirmActionDialog, StatusIndicator } from '../../components/Primitives';
import { SeoMeta } from '../../components/SeoMeta';

// 1. Admin Users, Roles & Training Verification (/admin/users)
export const AdminUsersPage: React.FC = () => {
  const { user, showToast } = useApp();
  const [directory, setDirectory] = useState<{
    users: User[];
    trainings: TrainingRecord[];
  } | null>(null);
  const [roleModal, setRoleModal] = useState<{
    open: boolean;
    targetUser: User | null;
    selectedRoles: Role[];
  }>({ open: false, targetUser: null, selectedRoles: ['USER'] });

  const loadDir = useCallback(async () => {
    const res = await api.getAdminDirectory();
    setDirectory({ users: res.users, trainings: res.trainings });
  }, []);

  useEffect(() => {
    loadDir();
  }, [loadDir, user]);

  const handleVerifyTraining = async (
    targetUserId: string,
    type: string,
    label: string,
    nextStatus: TrainingRecord['status']
  ) => {
    await api.verifyUserTraining(
      targetUserId,
      type,
      label,
      nextStatus,
      nextStatus === 'VERIFIED'
        ? `Practical checkoff verified by ${user?.name} · Cert #${Date.now().toString().slice(-4)}`
        : 'Revoked / reset for demo',
      `Admin/Manager updated ${label} status to ${nextStatus}.`
    );
    showToast(
      'success',
      `Training record ${nextStatus}`,
      `Updated "${label}" and appended verification event to the Trust Ledger.`
    );
    await loadDir();
  };

  if (!directory) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading user directory...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Users, roles & training verification
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Role assignments and safety training verifications are enforced server-side and logged in the Trust Ledger. Try verifying Diya Rao’s 3D Printer Safety Training below to immediately unlock her 3D Printer eligibility.
        </p>
      </div>

      {/* Users & Roles Table */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)]">
          Organisation directory ({directory.users.length} accounts)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)]">
                <th className="py-3 px-4">Name & Email</th>
                <th className="py-3 px-4">Department & Group</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Assigned Roles</th>
                <th className="py-3 px-4 text-right">Role Governance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {directory.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-sm text-[var(--text-primary)]">{u.name}</div>
                    <div className="text-[var(--text-secondary)]">{u.email}</div>
                  </td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">
                    {u.department} · <span className="font-mono-tech">{u.academicGroup}</span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusIndicator
                      kind="check"
                      value={u.verification === 'VERIFIED' ? 'PASS' : 'FAIL'}
                    />
                  </td>
                  <td className="py-3 px-4 font-mono-tech font-semibold text-[var(--text-primary)]">
                    {u.roles.join(', ')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {user?.roles.includes('ADMIN') && (
                      <button
                        type="button"
                        onClick={() =>
                          setRoleModal({
                            open: true,
                            targetUser: u,
                            selectedRoles: [...u.roles],
                          })
                        }
                        className="px-3 py-1.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                      >
                        Modify roles
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Training Records & One-Click Verification */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)]">
          Safety & equipment training records ({directory.trainings.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)]">
                <th className="py-3 px-4">Student / User</th>
                <th className="py-3 px-4">Training Qualification</th>
                <th className="py-3 px-4">Verification Source</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {directory.trainings.map((tr) => {
                const usr = directory.users.find((u) => u.id === tr.userId);
                return (
                  <tr key={tr.id}>
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                      {usr?.name || tr.userId}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-primary)]">{tr.label}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{tr.source}</td>
                    <td className="py-3 px-4">
                      <StatusIndicator
                        kind="check"
                        value={tr.status === 'VERIFIED' ? 'PASS' : 'FAIL'}
                      />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {tr.status !== 'VERIFIED' ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleVerifyTraining(tr.userId, tr.type, tr.label, 'VERIFIED')
                          }
                          className="px-3 py-1.5 rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] font-medium cursor-pointer"
                        >
                          Verify training
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleVerifyTraining(tr.userId, tr.type, tr.label, 'NONE')
                          }
                          className="px-3 py-1.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-pointer"
                        >
                          Mark uncompleted
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {roleModal.open && roleModal.targetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[10px] p-5 space-y-4 text-xs">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Modify roles for {roleModal.targetUser.name}
            </h2>
            <div className="space-y-2">
              {(['USER', 'OWNER', 'MANAGER', 'ADMIN'] as Role[]).map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roleModal.selectedRoles.includes(r)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...roleModal.selectedRoles, r]
                        : roleModal.selectedRoles.filter((x) => x !== r);
                      setRoleModal((prev) => ({ ...prev, selectedRoles: next }));
                    }}
                  />
                  <span className="font-mono-tech font-semibold">{r}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleModal({ open: false, targetUser: null, selectedRoles: [] })}
                className="px-3 py-1.5 rounded-[6px] border border-[var(--border-color)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!roleModal.targetUser) return;
                  await api.updateUserRoles(
                    roleModal.targetUser.id,
                    roleModal.selectedRoles,
                    `Updated roles for ${roleModal.targetUser.name} via Admin Governance.`
                  );
                  setRoleModal({ open: false, targetUser: null, selectedRoles: [] });
                  showToast('success', 'User roles updated & logged');
                  await loadDir();
                }}
                className="px-4 py-1.5 rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] font-medium cursor-pointer"
              >
                Save & log to ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 2. Organisation Settings, Tenant Boundary & Demo Controls (/admin/settings)
export const AdminSettingsPage: React.FC = () => {
  const { user, organization, switchUser, resetDemoData } = useApp();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Organisation settings, RLS tenancy & demo controls
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Inspect multi-tenant isolation between Organisation A (Nilgiri Institute of Technology) and Organisation B (Harbour Community Makerspace), transactional outbox delivery state, and demo data reset.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tenant Boundary Card */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Active tenant boundary (Row-Level Security)
            </h2>
            <span className="font-mono-tech text-[var(--brand-primary)]">
              {organization?.id}
            </span>
          </div>

          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Organisation name:</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{organization?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Verified email domain:</dt>
              <dd className="font-mono-tech text-[var(--text-primary)]">{organization?.domain}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Audit ledger retention:</dt>
              <dd className="tabular-nums text-[var(--text-primary)]">
                {organization?.retentionDays || 365} days
              </dd>
            </div>
          </dl>

          <div className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-2">
            <div className="font-semibold text-[var(--text-primary)]">
              Cross-organisation isolation demonstration (Step 11)
            </div>
            <p className="text-[var(--text-secondary)]">
              Switch between Organisation A and Organisation B below. Notice that zero resources, bookings, incidents, policies, or ledger events from Organisation A are visible or accessible in Organisation B.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => switchUser('usr_priya')}
                className={`px-3 py-1.5 rounded-[6px] font-medium cursor-pointer ${
                  organization?.id === 'org_nit'
                    ? 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]'
                    : 'border border-[var(--border-color)] bg-[var(--bg-surface)]'
                }`}
              >
                Org A: Nilgiri Institute (Priya Nair)
              </button>
              <button
                type="button"
                onClick={() => switchUser('usr_rohan')}
                className={`px-3 py-1.5 rounded-[6px] font-medium cursor-pointer ${
                  organization?.id === 'org_harbour'
                    ? 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]'
                    : 'border border-[var(--border-color)] bg-[var(--bg-surface)]'
                }`}
              >
                Org B: Harbour Makerspace (Rohan Deshmukh)
              </button>
            </div>
          </div>
        </section>

        {/* Demo Reset & Outbox Status */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4 text-xs">
          <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-3">
            Transactional outbox & demo state reset
          </h2>

          <div className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1">
            <div className="font-semibold text-[var(--text-primary)]">
              Outbox Worker Status (Simulated local demo data)
            </div>
            <p className="text-[var(--text-secondary)]">
              Side-effect notifications and reminders are written to `outbox_events` in the same transaction as the state change so notification delivery never blocks or corrupts a booking decision.
            </p>
          </div>

          <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)]/50 border border-[var(--status-danger)]/30 space-y-2">
            <div className="font-semibold text-[var(--text-primary)]">
              Reset local demo database to initial seeded state
            </div>
            <p className="text-[var(--text-secondary)]">
              Restores all 10 Nilgiri Institute resources, 2 Harbour Makerspace resources, competing Camera Kit bookings, pending requests, incidents, and valid SHA-256 ledger chains so you can rerun the 11-step evaluation journey from scratch.
            </p>
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] bg-[var(--status-danger)] text-white font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset demo data</span>
            </button>
          </div>
        </section>
      </div>

      <ConfirmActionDialog
        open={resetConfirmOpen}
        title="Reset all demo data to initial seed?"
        description="This clears local changes in localStorage and restores the clean seeded scenarios for both organisations."
        confirmLabel="Reset demo database"
        variant="danger"
        onConfirm={async () => {
          await resetDemoData();
        }}
        onClose={() => setResetConfirmOpen(false)}
      />
    </div>
  );
};

// 3. Notifications Inbox (/notifications)
export const NotificationsPage: React.FC = () => {
  const { notifications, refreshSession } = useApp();

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id);
    await refreshSession();
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    await refreshSession();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            In-app notifications (Transactional Outbox)
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Simulated notifications delivered via transactional outbox. Previews exclude sensitive personal data.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          className="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
        >
          Mark all read
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-8 text-center text-sm text-[var(--text-secondary)]">
          No notifications for your account.
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] divide-y divide-[var(--border-color)]">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 text-xs ${
                !n.readAt ? 'bg-[var(--brand-subtle)]/30' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono-tech text-[11px] text-[var(--brand-primary)]">
                    [{n.type}]
                  </span>
                  <strong className="text-sm text-[var(--text-primary)]">{n.title}</strong>
                  {!n.readAt && (
                    <span className="px-1.5 py-0.2 rounded-[4px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] text-[10px]">
                      Unread
                    </span>
                  )}
                </div>
                <p className="text-[var(--text-secondary)]">{n.message}</p>
                <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  {formatDateTime(n.createdAt)} · Outbox status: {n.outboxStatus}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {n.relatedPath && (
                  <Link
                    to={n.relatedPath}
                    onClick={() => !n.readAt && handleMarkRead(n.id)}
                    className="px-3 py-1.5 rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] font-medium"
                  >
                    Open
                  </Link>
                )}
                {!n.readAt && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className="px-2.5 py-1.5 rounded-[6px] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 4. User Profile, Training & Data Export (/profile)
export const ProfilePage: React.FC = () => {
  const { user } = useApp();
  const [profileData, setProfileData] = useState<{
    user: User;
    trainings: TrainingRecord[];
    usageByResource: Array<{ resourceId: string; resourceName: string; hoursUsed7d: number }>;
  } | null>(null);

  useEffect(() => {
    api.getMyProfileData().then(setProfileData);
  }, [user]);

  const handleExportOwnData = async () => {
    const bookings = await api.getMyBookings();
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: profileData?.user,
      trainingRecords: profileData?.trainings,
      rolling7dUsage: profileData?.usageByResource,
      bookings,
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `sharespace_profile_export_${user?.id || 'user'}.json`,
      'application/json'
    );
  };

  if (!profileData) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Profile, verified trainings & rolling usage
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Privacy by default: only fields required for institutional resource eligibility and accountability are stored.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportOwnData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export my data (JSON)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-3 text-xs">
          <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2.5">
            Institutional identity
          </h2>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Full name:</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{profileData.user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Email:</dt>
              <dd className="font-mono-tech text-[var(--text-primary)]">{profileData.user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Department:</dt>
              <dd className="text-[var(--text-primary)]">{profileData.user.department}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Assigned roles:</dt>
              <dd className="font-mono-tech font-semibold text-[var(--text-primary)]">
                {profileData.user.roles.join(', ')}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">Verification status:</dt>
              <dd className="font-semibold text-[var(--status-success)]">
                {profileData.user.verification} (Demo verification)
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-3 text-xs">
          <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2.5">
            Rolling 7-day usage hours per resource
          </h2>
          <div className="space-y-2">
            {profileData.usageByResource.map((u) => (
              <div
                key={u.resourceId}
                className="flex items-center justify-between p-2 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)]"
              >
                <span className="truncate pr-2">{u.resourceName}</span>
                <span className="font-mono-tech font-semibold tabular-nums">
                  {u.hoursUsed7d}h used
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-3 text-xs">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Training & safety qualification certificates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {profileData.trainings.map((tr) => (
            <div
              key={tr.id}
              className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--text-primary)]">{tr.label}</span>
                <StatusIndicator
                  kind="check"
                  value={tr.status === 'VERIFIED' ? 'PASS' : 'FAIL'}
                />
              </div>
              <div className="text-[var(--text-secondary)]">{tr.source}</div>
              {tr.expiresAt && (
                <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  Expires: {formatDateTime(tr.expiresAt)}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// 5. About & Architecture Honesty Page (/about)
export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SeoMeta
        title="Architecture & Trust | SHARESPACE"
        description="Detailed system architecture, verified capabilities, and technical honesty report for the SHARESPACE platform."
        canonicalPath="/about"
        robots="index, follow"
      />
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          SHARESPACE — Implementation status, honesty & API architecture
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          "Access more. Waste less. Build together." Accountability infrastructure for shared institutional assets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-2">
          <div className="font-mono-tech font-bold text-[var(--status-success)]">
            IMPLEMENTED & VERIFIED
          </div>
          <ul className="space-y-1.5 text-[var(--text-secondary)] list-disc pl-4">
            <li>End-to-end lifecycle: listing, discovery, request, eligibility, manager review, check-in, return, staff confirmation, incident resolution.</li>
            <li>Deterministic eligibility engine evaluating verified status, trainings, conflicts, and rolling 7-day usage caps.</li>
            <li>Versioned policies (`Policy` + `PolicyVersion`) with dry-run sample preview and live activation while preserving historical `policyVersionIds`.</li>
            <li>SHA-256 hash-chained tamper-evident Trust Ledger (`prev_hash || canonical_json`) with verification and tamper detection.</li>
            <li>Strict multi-tenant isolation (`org_nit` vs `org_harbour`) and server-enforced RBAC (`USER`, `OWNER`, `MANAGER`, `ADMIN`).</li>
            <li>Waitlist ordering and automatic promotion on slot cancellation.</li>
          </ul>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-2">
          <div className="font-mono-tech font-bold text-[var(--status-warning)]">
            LOCAL DEMO SIMULATIONS
          </div>
          <ul className="space-y-1.5 text-[var(--text-secondary)] list-disc pl-4">
            <li><strong>Demo authentication:</strong> One-click persona switcher in mock mode (`VITE_API_MODE=mock`) persisted in `localStorage`.</li>
            <li><strong>Evidence storage:</strong> Captures local SVG/DataURL evidence and binds the real SHA-256 digest into the Trust Ledger without requiring external S3 credentials.</li>
            <li><strong>Transactional outbox:</strong> Simulated in-app notification worker (`outboxStatus: DELIVERED`).</li>
            <li><strong>Assistive AI:</strong> Server-side `gemini-4-argon` with `ThinkingLevel.HIGH` (`server.ts`) with automatic deterministic fallback when no paid API key is attached.</li>
          </ul>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-2">
          <div className="font-mono-tech font-bold text-[var(--text-primary)]">
            PILOT & SCALE ROADMAP (TIER 3)
          </div>
          <ul className="space-y-1.5 text-[var(--text-secondary)] list-disc pl-4">
            <li>Institutional OIDC (authorization code + PKCE) with campus identity provider.</li>
            <li>External write-once anchoring of the nightly Trust Ledger chain head hash.</li>
            <li>Cross-institution sharing agreement objects.</li>
            <li>External calendar sync (ICS / Google / Microsoft) and email outbox worker.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
