import React, { useEffect, useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileCheck,
  CalendarClock,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import {
  Booking,
  Incident,
  LedgerVerificationResult,
  Resource,
  TrainingRecord,
} from '../../lib/types';
import { formatDateTime, formatTimeRange } from '../../lib/utils';
import { ChainIntegrityBadge, StatusIndicator } from '../../components/Primitives';

export const DashboardPage: React.FC = () => {
  const { user, organization, showToast } = useApp();
  const navigate = useNavigate();

  const [myBookings, setMyBookings] = useState<
    Array<Booking & { resourceName: string; resourceLocation: string; resourceSupervision: string }>
  >([]);
  const [orgBookings, setOrgBookings] = useState<
    Array<
      Booking & {
        resourceName: string;
        resourceLocation: string;
        resourceSupervision: string;
        requesterName: string;
      }
    >
  >([]);
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [incidents, setIncidents] = useState<Array<Incident & { resourceName: string }>>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [chainResult, setChainResult] = useState<LedgerVerificationResult | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const isStaff = Boolean(
    user?.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r))
  );
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [mine, resList, incList, profData, verifyData] = await Promise.all([
          api.getMyBookings(),
          api.getResources(),
          api.getIncidents(),
          api.getMyProfileData(),
          api.verifyLedger(),
        ]);
        if (!active) return;
        setMyBookings(mine);
        setResources(resList);
        setIncidents(incList);
        setTrainings(profData.trainings);
        setChainResult(verifyData);

        if (isStaff) {
          const allB = await api.getAllOrganizationBookings();
          if (active) setOrgBookings(allB);
        } else {
          setOrgBookings([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user, isStaff]);

  const handleVerifyNow = async () => {
    setVerifyingChain(true);
    try {
      const res = await api.verifyLedger();
      setChainResult(res);
      if (res.valid) {
        showToast('success', 'Trust Ledger verified', `All ${res.checkedCount} SHA-256 events verified through head #${res.headSeq}.`);
      } else {
        showToast('error', 'Ledger mismatch detected', res.errorDetails);
      }
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/discover${searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ''}`);
  };

  if (!user || !organization) {
    return <Navigate to="/login" replace />;
  }

  // Next actionable booking for User
  const nextActionableBooking = myBookings.find((b) =>
    ['APPROVED', 'CHECKED_OUT_TO_USER', 'OVERDUE', 'RETURN_PENDING_CONFIRMATION'].includes(b.status)
  );

  // Manager / Owner operational counts
  const pendingReviewList = orgBookings.filter((b) => b.status === 'PENDING_REVIEW');
  const dueForHandoverList = orgBookings.filter((b) => b.status === 'APPROVED');
  const pendingReturnConfirmList = orgBookings.filter(
    (b) => b.status === 'RETURN_PENDING_CONFIRMATION'
  );
  const overdueList = orgBookings.filter((b) => b.status === 'OVERDUE');
  const openIncidentsList = incidents.filter((i) => i.status !== 'RESOLVED');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs text-[var(--text-secondary)]">
            {organization.name} · Operational Workspace ({user.roles.join(', ')})
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">
            {isAdmin
              ? 'Institutional Oversight & Governance'
              : isStaff
              ? 'Operations & Request Review Workspace'
              : `Operations Overview — ${user.name}`}
          </h1>
        </div>

        {chainResult && (
          <ChainIntegrityBadge
            valid={chainResult.valid}
            headSeq={chainResult.headSeq}
            verifiedAt={chainResult.verifiedAt}
            firstInvalidSeq={chainResult.firstInvalidSeq}
            onVerifyNow={handleVerifyNow}
            verifying={verifyingChain}
          />
        )}
      </div>

      {/* Restrained Equipment Discovery Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find a resource for your project (e.g., oscilloscope, 3D printer, camera kit, measure PWM voltage)..."
            aria-label="Search institutional equipment and spaces"
            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors cursor-pointer shrink-0"
        >
          Browse catalog ({resources.length})
        </button>
      </form>

      {/* STAFF / MANAGER / OWNER VIEW */}
      {isStaff && (
        <section aria-labelledby="ops-strip-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="ops-strip-heading" className="text-base font-semibold text-[var(--text-primary)]">
              Actionable operations queue
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <Link to="/review" className="text-[var(--brand-primary)] font-medium hover:underline">
                Open decision workspace →
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/handover" className="text-[var(--brand-primary)] font-medium hover:underline">
                Handover & return desk →
              </Link>
            </div>
          </div>

          {/* Compact Operational Count Strip */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)]">
            <Link
              to="/review"
              className="p-3.5 hover:bg-[var(--bg-secondary)]/50 transition-colors block"
            >
              <div className="text-xs text-[var(--text-secondary)]">Pending requests</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {pendingReviewList.length}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--status-warning)]">
                Requires human decision
              </div>
            </Link>

            <Link
              to="/handover"
              className="p-3.5 hover:bg-[var(--bg-secondary)]/50 transition-colors block"
            >
              <div className="text-xs text-[var(--text-secondary)]">Handovers due</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {dueForHandoverList.length}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                Approved & ready
              </div>
            </Link>

            <Link
              to="/handover"
              className="p-3.5 hover:bg-[var(--bg-secondary)]/50 transition-colors block"
            >
              <div className="text-xs text-[var(--text-secondary)]">Returns awaiting confirm</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {pendingReturnConfirmList.length}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--status-warning)]">
                Verify condition report
              </div>
            </Link>

            <Link
              to="/handover"
              className="p-3.5 hover:bg-[var(--bg-secondary)]/50 transition-colors block"
            >
              <div className="text-xs text-[var(--text-secondary)]">Overdue items</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-[var(--status-danger)]">
                {overdueList.length}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--status-danger)]">
                Past return deadline
              </div>
            </Link>

            <Link
              to="/incidents"
              className="p-3.5 hover:bg-[var(--bg-secondary)]/50 transition-colors block col-span-2 sm:col-span-1"
            >
              <div className="text-xs text-[var(--text-secondary)]">Open incidents</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {openIncidentsList.length}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--status-warning)]">
                Allegations under review
              </div>
            </Link>
          </div>

          {/* Manager Actionable Request Queue Table */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Requests awaiting manager review ({pendingReviewList.length})
              </h3>
              <Link to="/review" className="text-xs text-[var(--brand-primary)] hover:underline">
                View full review queue
              </Link>
            </div>
            {pendingReviewList.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-secondary)]">
                All pending requests have been reviewed.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-xs font-semibold text-[var(--text-secondary)]">
                      <th className="py-2.5 px-4">Requester</th>
                      <th className="py-2.5 px-4">Resource</th>
                      <th className="py-2.5 px-4">Requested Window</th>
                      <th className="py-2.5 px-4">Priority & Usage Context</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] text-sm">
                    {pendingReviewList.map((req) => (
                      <tr key={req.id} className="hover:bg-[var(--bg-secondary)]/30">
                        <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                          {req.requesterName}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-primary)]">{req.resourceName}</td>
                        <td className="py-3 px-4 text-xs tabular-nums text-[var(--text-secondary)]">
                          {formatTimeRange(req.start, req.end)}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)] max-w-xs">
                          {req.priorityFactors?.explanation || req.purpose}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Link
                            to={`/review/${req.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                          >
                            <span>Review & decide</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* USER FOCUSED WORKSPACE: Next Required Action + My Bookings + Training Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Next Action + Active/Pending Bookings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next Required Action Banner */}
          {nextActionableBooking && (
            <section
              aria-labelledby="next-action-heading"
              className="bg-[var(--bg-surface)] border border-[var(--brand-primary)] rounded-[8px] p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  id="next-action-heading"
                  className="text-xs font-semibold text-[var(--brand-primary)] flex items-center gap-1.5"
                >
                  <CalendarClock className="w-4 h-4" />
                  <span>Next required operational step</span>
                </span>
                <StatusIndicator kind="booking" value={nextActionableBooking.status} />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {nextActionableBooking.resourceName}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
                    {formatTimeRange(nextActionableBooking.start, nextActionableBooking.end)} ·{' '}
                    {nextActionableBooking.resourceLocation}
                  </p>
                  {nextActionableBooking.decisionReason && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                      <strong>Decision note:</strong> {nextActionableBooking.decisionReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {nextActionableBooking.status === 'APPROVED' && (
                    <Link
                      to={`/bookings/${nextActionableBooking.id}/check-in`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                    >
                      <span>Check in & record condition</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {['CHECKED_OUT_TO_USER', 'OVERDUE'].includes(nextActionableBooking.status) && (
                    <Link
                      to={`/bookings/${nextActionableBooking.id}/return`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                    >
                      <span>Submit return report</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  <Link
                    to={`/bookings/${nextActionableBooking.id}`}
                    className="px-3 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  >
                    Timeline
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* My Bookings & Requests Table */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                My bookings & requests ({myBookings.length})
              </h2>
              <Link to="/bookings" className="text-xs text-[var(--brand-primary)] hover:underline">
                View all bookings →
              </Link>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-[var(--text-secondary)]">Loading bookings...</div>
            ) : myBookings.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  You have no active or historical bookings in {organization.name}.
                </p>
                <Link
                  to="/discover"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"
                >
                  <span>Discover institutional resources</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)]">
                {myBookings.slice(0, 6).map((b) => (
                  <div
                    key={b.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-secondary)]/30"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/bookings/${b.id}`}
                          className="font-semibold text-sm text-[var(--text-primary)] hover:underline"
                        >
                          {b.resourceName}
                        </Link>
                        <StatusIndicator kind="booking" value={b.status} />
                        {b.waitlistPosition !== undefined && (
                          <span className="text-xs font-mono-tech text-[var(--status-warning)]">
                            Queue #{b.waitlistPosition}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                        {formatTimeRange(b.start, b.end)} · Policy:{' '}
                        <span className="font-mono-tech">{b.policyVersionIds.join(', ')}</span>
                      </div>
                      {(b.decisionReason || b.waitlistReason) && (
                        <div className="text-xs text-[var(--text-secondary)]">
                          <strong>Reason:</strong> {b.waitlistReason || b.decisionReason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {b.status === 'APPROVED' && (
                        <Link
                          to={`/bookings/${b.id}/check-in`}
                          className="px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]"
                        >
                          Check in
                        </Link>
                      )}
                      {['CHECKED_OUT_TO_USER', 'OVERDUE'].includes(b.status) && (
                        <Link
                          to={`/bookings/${b.id}/return`}
                          className="px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]"
                        >
                          Return
                        </Link>
                      )}
                      <Link
                        to={`/bookings/${b.id}`}
                        className="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Training & Eligibility Readiness + Governance Quick Links */}
        <div className="space-y-6">
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2.5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                My qualification & safety clearance
              </h2>
              <Link to="/profile" className="text-xs text-[var(--brand-primary)] hover:underline">
                Profile →
              </Link>
            </div>

            <div className="text-xs text-[var(--text-secondary)]">
              Account status: <strong className="text-[var(--text-primary)]">{user.verification}</strong> ·{' '}
              {user.department}
            </div>

            {trainings.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                No individual student training records needed for your staff profile.
              </p>
            ) : (
              <ul className="space-y-2.5 pt-1">
                {trainings.map((tr) => (
                  <li
                    key={tr.id}
                    className="p-2.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-app)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{tr.label}</span>
                      <StatusIndicator
                        kind="check"
                        value={tr.status === 'VERIFIED' ? 'PASS' : 'FAIL'}
                      />
                    </div>
                    <div className="text-[var(--text-secondary)]">{tr.source}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Incident & Accountability Summary */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2.5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Recent incident reports
              </h2>
              <Link to="/incidents" className="text-xs text-[var(--brand-primary)] hover:underline">
                All incidents →
              </Link>
            </div>

            {incidents.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">No incident allegations on record.</p>
            ) : (
              <ul className="space-y-2.5">
                {incidents.slice(0, 3).map((inc) => (
                  <li
                    key={inc.id}
                    className="p-2.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-app)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="font-semibold text-[var(--text-primary)] hover:underline truncate"
                      >
                        {inc.resourceName}
                      </Link>
                      <StatusIndicator kind="incident" value={inc.status} />
                    </div>
                    <p className="text-[var(--text-secondary)] line-clamp-2">{inc.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
