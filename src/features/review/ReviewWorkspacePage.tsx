import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Booking, Resource, User } from '../../lib/types';
import { formatDateTime, formatTimeRange, getDurationHours } from '../../lib/utils';
import { StatusIndicator } from '../../components/Primitives';

export const ReviewWorkspacePage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId?: string }>();
  const { user, showToast } = useApp();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<
    Array<
      Booking & {
        resourceName: string;
        resourceLocation: string;
        resourceSupervision: string;
        requesterName: string;
        requesterEmail: string;
        requesterDepartment: string;
      }
    >
  >([]);
  const [statusFilter, setStatusFilter] = useState<'ACTIONABLE' | 'ALL'>('ACTIONABLE');

  const [selectedDetail, setSelectedDetail] = useState<{
    booking: Booking;
    resource: Resource;
    requester: User;
    competingRequests: Array<Booking & { requesterName: string }>;
  } | null>(null);

  const [decisionReason, setDecisionReason] = useState<string>(
    'All safety trainings verified; slot allocated in accordance with Policy POL-PRI-01 v1.'
  );
  const [isPolicyOverride, setIsPolicyOverride] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await api.getAllOrganizationBookings();
      setQueue(all);

      if (bookingId) {
        const det = await api.getBookingDetail(bookingId);
        setSelectedDetail(det);
      } else {
        setSelectedDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load review queue.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue, user]);

  const handleDecision = async (
    decision: 'APPROVED' | 'REJECTED' | 'WAITLISTED' | 'NEEDS_INFORMATION'
  ) => {
    if (!selectedDetail) return;
    if (decisionReason.trim().length < 5) {
      setError('Please enter a decision reason (at least 5 characters) before recording a decision.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.decideBooking(selectedDetail.booking.id, {
        decision,
        reason: decisionReason.trim(),
        isPolicyOverride,
      });
      showToast(
        'success',
        `Decision recorded: ${decision}`,
        'Decision reason and policy version snapshot have been chained to the Trust Ledger.'
      );
      navigate('/review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredQueue = queue.filter((b) =>
    statusFilter === 'ACTIONABLE'
      ? ['PENDING_REVIEW', 'WAITLISTED', 'NEEDS_INFORMATION', 'ELIGIBILITY_BLOCKED'].includes(b.status)
      : true
  );

  // If a specific bookingId is selected, show the detailed Decision Workspace
  if (bookingId && selectedDetail) {
    const { booking, resource, requester, competingRequests } = selectedDetail;
    const durationHrs = getDurationHours(booking.start, booking.end);

    return (
      <div className="space-y-6">
        <div className="border-b border-[var(--border-color)] pb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              to="/review"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to request review queue</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Manager decision workspace — #{booking.id}
              </h1>
              <StatusIndicator kind="booking" value={booking.status} />
            </div>
          </div>
          <Link
            to={`/bookings/${booking.id}`}
            className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
          >
            Open full booking timeline →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left 2 Columns: Request & Requester Context, Eligibility Checklist, Competing Requests */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request & Limited Requester Info */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Request details & role-scoped requester summary
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-[var(--text-secondary)]">Resource requested</dt>
                  <dd className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">
                    {resource.name} ({resource.location})
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Requested window & duration</dt>
                  <dd className="font-semibold text-sm tabular-nums text-[var(--text-primary)] mt-0.5">
                    {formatTimeRange(booking.start, booking.end)} ({durationHrs}h)
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Requester identity (role-scoped)</dt>
                  <dd className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {requester.name} · {requester.department} ({requester.academicGroup || 'USER'})
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Applied policy versions</dt>
                  <dd className="font-mono-tech text-[var(--text-primary)] mt-0.5">
                    {booking.policyVersionIds.join(', ')}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--text-secondary)]">Declared project purpose</dt>
                  <dd className="text-[var(--text-primary)] mt-0.5 p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)]">
                    {booking.purpose}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Advisory Fair Allocation & Competing Requests Comparison */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Fair allocation policy comparison & competing requests ({competingRequests.length})
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Advisory order under Policy <span className="font-mono-tech">pol_priority_fairness_v1</span>:
                  1. Mandatory safety checks · 2. Capstone/Research priority · 3. Lower 7-day rolling usage · 4. Earlier request timestamp. The human reviewer makes the final decision.
                </p>
              </div>

              {booking.priorityFactors && (
                <div className="p-3 rounded-[6px] bg-[var(--brand-subtle)] border border-[var(--brand-primary)]/30 text-xs space-y-1">
                  <div className="font-semibold text-[var(--brand-primary)]">
                    This request's priority factors ({requester.name}):
                  </div>
                  <div className="text-[var(--text-primary)]">
                    Group: <strong>{booking.priorityFactors.academicPriority}</strong> · Rolling 7-day usage:{' '}
                    <strong className="tabular-nums">{booking.priorityFactors.recentHoursUsed}h</strong> ·{' '}
                    {booking.priorityFactors.explanation}
                  </div>
                </div>
              )}

              {competingRequests.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  No other active or pending requests overlap this requested time window.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {competingRequests.map((comp) => (
                    <div
                      key={comp.id}
                      className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <span>
                            Competing: {comp.requesterName} (#{comp.id})
                          </span>
                          <StatusIndicator kind="booking" value={comp.status} />
                        </div>
                        <div className="text-[var(--text-secondary)] tabular-nums">
                          {formatTimeRange(comp.start, comp.end)} ·{' '}
                          {comp.priorityFactors?.explanation || comp.purpose}
                        </div>
                      </div>
                      <Link
                        to={`/review/${comp.id}`}
                        className="px-2.5 py-1 rounded-[4px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--brand-primary)] font-medium shrink-0"
                      >
                        Switch to #{comp.id}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Deterministic Eligibility Check Breakdown */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Deterministic eligibility checks
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {booking.eligibilityChecks.map((chk) => (
                  <div
                    key={chk.key}
                    className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{chk.label}</span>
                      <StatusIndicator kind="check" value={chk.status} />
                    </div>
                    <p className="text-[var(--text-secondary)]">{chk.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Manager Decision Entry & Consequential Actions */}
          <aside className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-3">
              Record manager decision
            </h2>

            <div>
              <label
                htmlFor="decision-reason-input"
                className="block text-xs font-semibold text-[var(--text-primary)] mb-1"
              >
                Decision reason (required for audit ledger & requester notification){' '}
                <span className="text-[var(--status-danger)]">*</span>
              </label>
              <textarea
                id="decision-reason-input"
                rows={4}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
                placeholder="Explain why this request is approved, waitlisted, or rejected..."
              />
            </div>

            <label className="flex items-start gap-2 p-2.5 rounded-[6px] bg-[var(--status-warning-bg)]/60 border border-[var(--status-warning)]/30 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isPolicyOverride}
                onChange={(e) => setIsPolicyOverride(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Log as Policy Exception / Override:</strong> Check only if overriding automated queue order or an eligibility constraint with documented justification.
              </span>
            </label>

            {error && (
              <div className="p-2.5 rounded-[6px] bg-[var(--status-danger-bg)] text-xs text-[var(--status-danger)]">
                {error}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDecision('APPROVED')}
                className="w-full py-2.5 px-4 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
              >
                Approve request
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDecision('WAITLISTED')}
                className="w-full py-2 px-4 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
              >
                Place on priority waitlist
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDecision('NEEDS_INFORMATION')}
                className="w-full py-2 px-4 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Request more information
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDecision('REJECTED')}
                className="w-full py-2 px-4 text-xs font-medium rounded-[8px] border border-[var(--status-danger)]/40 text-[var(--status-danger)] bg-[var(--bg-surface)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
              >
                Reject request with reason
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Default: Manager Request Queue Table (/review)
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Manager request review queue
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Compare eligibility checks, rolling usage limits, and competing priority factors before recording an auditable decision. No bulk approve is permitted.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[8px] self-start">
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIONABLE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-[6px] cursor-pointer ${
              statusFilter === 'ACTIONABLE'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Pending & Waitlisted
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-[6px] cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            All requests ({queue.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Loading queue...</div>
      ) : error ? (
        <div className="p-6 rounded-[8px] bg-[var(--status-danger-bg)] text-sm text-[var(--status-danger)]">
          {error}
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/60 text-xs font-semibold text-[var(--text-secondary)]">
                  <th className="py-3 px-4">ID & Requester</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Requested Slot</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Eligibility & Priority Context</th>
                  <th className="py-3 px-4 text-right">Workspace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-sm">
                {filteredQueue.map((item) => {
                  const hasFail = item.eligibilityChecks.some((c) => c.status === 'FAIL');
                  return (
                    <tr key={item.id} className="hover:bg-[var(--bg-secondary)]/30">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {item.requesterName}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] font-mono-tech">
                          #{item.id} · {item.requesterDepartment}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[var(--text-primary)]">
                        {item.resourceName}
                      </td>
                      <td className="py-3.5 px-4 text-xs tabular-nums text-[var(--text-secondary)]">
                        {formatTimeRange(item.start, item.end)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusIndicator kind="booking" value={item.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)] max-w-sm">
                        <div className="mb-0.5">
                          <StatusIndicator
                            kind="check"
                            value={hasFail ? 'FAIL' : 'PASS'}
                          />
                        </div>
                        <div className="line-clamp-2">
                          {item.priorityFactors?.explanation || item.decisionReason || item.purpose}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/review/${item.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                        >
                          Open decision workspace
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
