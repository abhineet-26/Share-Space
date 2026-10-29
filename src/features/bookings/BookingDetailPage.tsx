import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  FileCheck,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import {
  Attachment,
  Booking,
  ConditionReport,
  Incident,
  LedgerEvent,
  Resource,
  User,
} from '../../lib/types';
import { formatDateTime, formatTimeRange } from '../../lib/utils';
import {
  BookingLifecycleStepper,
  ConfirmActionDialog,
  StatusIndicator,
} from '../../components/Primitives';

export const BookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, showToast } = useApp();
  const navigate = useNavigate();

  const [data, setData] = useState<{
    booking: Booking;
    resource: Resource;
    requester: User;
    conditionReports: ConditionReport[];
    incidents: Incident[];
    ledgerEvents: LedgerEvent[];
    attachments: Attachment[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getBookingDetail(id);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load booking.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail, user]);

  const handleConfirmCancel = async (reason: string) => {
    if (!id) return;
    await api.cancelBooking(id, reason);
    showToast('info', 'Booking cancelled', 'Any waitlisted request for this slot has been automatically promoted.');
    await loadDetail();
  };

  if (loading) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading booking transaction record...</div>;
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-6 space-y-3">
        <h1 className="text-lg font-semibold text-[var(--status-danger)]">Access or record error</h1>
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        <Link to="/bookings" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
          ← Back to My bookings
        </Link>
      </div>
    );
  }

  const { booking, resource, requester, conditionReports, incidents, ledgerEvents, attachments } = data;
  const isStaff = Boolean(user?.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r)));
  const canCancel = ['REQUESTED', 'PENDING_REVIEW', 'WAITLISTED', 'APPROVED', 'ELIGIBILITY_BLOCKED'].includes(
    booking.status
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div className="space-y-1">
          <Link
            to="/bookings"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to bookings</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{resource.name}</h1>
            <StatusIndicator kind="booking" value={booking.status} />
          </div>
          <div className="text-xs text-[var(--text-secondary)] tabular-nums">
            Booking ID: <span className="font-mono-tech">{booking.id}</span> · Requester:{' '}
            <strong>{requester.name}</strong> ({requester.department}) · Window:{' '}
            {formatTimeRange(booking.start, booking.end)}
          </div>
        </div>

        {/* Context-Appropriate Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {booking.status === 'APPROVED' && (
            <Link
              to={`/bookings/${booking.id}/check-in`}
              className="px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
            >
              Check in & record initial condition
            </Link>
          )}

          {['CHECKED_OUT_TO_USER', 'OVERDUE'].includes(booking.status) && (
            <Link
              to={`/bookings/${booking.id}/return`}
              className="px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
            >
              Submit return report
            </Link>
          )}

          {isStaff && ['PENDING_REVIEW', 'WAITLISTED'].includes(booking.status) && (
            <Link
              to={`/review/${booking.id}`}
              className="px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
            >
              Open Manager Decision Workspace
            </Link>
          )}

          {isStaff && booking.status === 'RETURN_PENDING_CONFIRMATION' && (
            <Link
              to="/handover"
              className="px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
            >
              Confirm return in Staff Handover
            </Link>
          )}

          <Link
            to={`/bookings/${booking.id}/incident`}
            className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            Report an issue
          </Link>

          {canCancel && (
            <button
              type="button"
              onClick={() => setCancelDialogOpen(true)}
              className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--status-danger)]/40 text-[var(--status-danger)] bg-[var(--bg-surface)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
            >
              Cancel booking
            </button>
          )}
        </div>
      </div>

      {/* Lifecycle Stepper */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] px-4 py-2">
        <BookingLifecycleStepper status={booking.status} />
      </div>

      {/* Waitlist or Decision Explanation Banner */}
      {booking.status === 'WAITLISTED' && (
        <div className="p-4 rounded-[8px] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 text-xs space-y-1">
          <div className="font-semibold text-[var(--status-warning)]">
            Waitlist Position #{booking.waitlistPosition || 1} — Your request remains active
          </div>
          <p className="text-[var(--text-primary)]">{booking.waitlistReason}</p>
        </div>
      )}

      {booking.decisionReason && booking.status !== 'WAITLISTED' && (
        <div className="p-4 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs space-y-1">
          <div className="font-semibold text-[var(--text-primary)]">
            Recorded decision & policy explanation
          </div>
          <p className="text-[var(--text-secondary)]">{booking.decisionReason}</p>
          <div className="text-[11px] font-mono-tech text-[var(--text-muted)] pt-1">
            Decided under policy versions: {booking.policyVersionIds.join(', ')}
            {booking.decidedAt ? ` · Timestamp: ${formatDateTime(booking.decidedAt)}` : ''}
          </div>
        </div>
      )}

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Condition Reports (Before vs After), Incidents, Trust Ledger Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Before & After Condition Reports */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Handover & return condition records ({conditionReports.length})
            </h2>

            {conditionReports.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                No check-in or return condition reports have been recorded yet for this booking.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {conditionReports.map((cr) => {
                  const reportAttachments = attachments.filter((a) =>
                    cr.attachmentIds.includes(a.id)
                  );
                  return (
                    <div
                      key={cr.id}
                      className="p-4 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {cr.stage === 'CHECK_IN'
                            ? 'Initial Check-In Report'
                            : 'Final Return Report'}
                        </span>
                        <StatusIndicator kind="condition" value={cr.condition} />
                      </div>
                      <div className="text-[var(--text-secondary)] tabular-nums">
                        By {cr.reporterName} · {formatDateTime(cr.actualTimestamp)}
                      </div>
                      <p className="text-[var(--text-primary)]">{cr.notes}</p>
                      <div className="space-y-1 pt-1">
                        <div className="font-medium text-[var(--text-secondary)]">
                          Accessories verified:
                        </div>
                        {cr.accessories.map((acc) => (
                          <div key={acc.name} className="flex items-center justify-between">
                            <span className="truncate pr-2">{acc.name}</span>
                            <span
                              className={
                                acc.present
                                  ? 'text-[var(--status-success)] font-medium'
                                  : 'text-[var(--status-danger)] font-semibold'
                              }
                            >
                              {acc.present ? 'Present' : 'Missing'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {reportAttachments.length > 0 && (
                        <div className="pt-2 border-t border-[var(--border-color)] space-y-1.5">
                          <div className="font-medium text-[var(--text-secondary)]">
                            Evidence bound to ledger by SHA-256:
                          </div>
                          {reportAttachments.map((att) => (
                            <div key={att.id} className="space-y-1">
                              <img
                                src={att.dataUrl}
                                alt={att.fileName}
                                referrerPolicy="no-referrer"
                                className="w-full h-28 object-cover rounded-[4px] border border-[var(--border-color)]"
                              />
                              <div className="text-[10px] font-mono-tech text-[var(--text-muted)] truncate">
                                SHA-256: {att.sha256}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Linked Incident Reports */}
          {incidents.length > 0 && (
            <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Linked incident reports ({incidents.length})
              </h2>
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/incidents/${inc.id}`}
                      className="font-semibold text-sm text-[var(--text-primary)] hover:underline"
                    >
                      {inc.category} (#{inc.id})
                    </Link>
                    <StatusIndicator kind="incident" value={inc.status} />
                  </div>
                  <p className="text-[var(--text-secondary)]">{inc.description}</p>
                  {inc.resolution && (
                    <div className="p-2 rounded-[4px] bg-[var(--status-success-bg)] text-[var(--status-success)]">
                      <strong>Human resolution ({inc.reviewerName}):</strong> {inc.resolution}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Booking Chronological Trust Ledger */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Booking Trust Ledger timeline (tamper-evident history)
              </h2>
              <Link
                to={`/ledger?entity=${booking.id}`}
                className="text-xs text-[var(--brand-primary)] hover:underline"
              >
                Inspect in full ledger →
              </Link>
            </div>

            <ol className="space-y-3 border-l-2 border-[var(--border-color)] ml-2 pl-4">
              {ledgerEvents.map((ev) => (
                <li key={ev.id} className="text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">
                      #{ev.seq} · {ev.action}
                    </span>
                    <span className="tabular-nums text-[var(--text-secondary)]">
                      {formatDateTime(ev.occurredAt)}
                    </span>
                  </div>
                  <div className="text-[var(--text-secondary)]">
                    Actor: <strong>{ev.actorName}</strong> ({ev.actorRole})
                    {ev.reason ? ` — "${ev.reason}"` : ''}
                  </div>
                  <div className="text-[11px] font-mono-tech text-[var(--text-muted)] truncate">
                    Hash: {ev.hash.slice(0, 24)}... (prev: {ev.prevHash.slice(0, 14)}...)
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right Column: Recorded Eligibility Evaluation Snapshot */}
        <aside className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
          <div className="border-b border-[var(--border-color)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Recorded eligibility evaluation
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Policy versions applied at request time:{' '}
              <span className="font-mono-tech text-[var(--text-primary)]">
                {booking.policyVersionIds.join(', ')}
              </span>
            </p>
          </div>

          <div className="space-y-2.5">
            {booking.eligibilityChecks.map((chk) => (
              <div
                key={chk.key}
                className="p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{chk.label}</span>
                  <StatusIndicator kind="check" value={chk.status} />
                </div>
                <p className="text-[var(--text-secondary)]">{chk.reason}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <ConfirmActionDialog
        open={cancelDialogOpen}
        title="Cancel this booking?"
        description="Cancelling releases your slot and automatically promotes the #1 eligible waitlisted request if applicable."
        confirmLabel="Confirm cancellation"
        variant="danger"
        requireReason={true}
        reasonLabel="Cancellation reason"
        reasonPlaceholder="e.g., PCB parts delayed; releasing bench slot for other teams."
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelDialogOpen(false)}
      />
    </div>
  );
};
