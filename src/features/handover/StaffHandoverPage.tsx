import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Booking, ConditionReport } from '../../lib/types';
import { formatDateTime, formatTimeRange } from '../../lib/utils';
import { ConfirmActionDialog, StatusIndicator } from '../../components/Primitives';

type HandoverTab = 'RETURN_PENDING' | 'DUE_HANDOVER' | 'WITH_USERS' | 'OVERDUE';

export const StaffHandoverPage: React.FC = () => {
  const { user, showToast } = useApp();
  const [bookings, setBookings] = useState<
    Array<
      Booking & {
        resourceName: string;
        resourceLocation: string;
        resourceSupervision: string;
        requesterName: string;
      }
    >
  >([]);
  const [reportsByBooking, setReportsByBooking] = useState<Record<string, ConditionReport[]>>({});
  const [activeTab, setActiveTab] = useState<HandoverTab>('RETURN_PENDING');
  const [loading, setLoading] = useState(true);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    bookingId: string;
    stage: 'HANDOVER' | 'RETURN';
    title: string;
  }>({ open: false, bookingId: '', stage: 'RETURN', title: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getAllOrganizationBookings();
      setBookings(list);

      const relevant = list.filter((b) =>
        ['APPROVED', 'CHECKED_OUT_TO_USER', 'RETURN_PENDING_CONFIRMATION', 'OVERDUE'].includes(
          b.status
        )
      );
      const repMap: Record<string, ConditionReport[]> = {};
      for (const b of relevant) {
        const det = await api.getBookingDetail(b.id);
        repMap[b.id] = det.conditionReports;
      }
      setReportsByBooking(repMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  const handleStaffConfirm = async (notes: string) => {
    await api.confirmStaffHandoverOrReturn(
      confirmModal.bookingId,
      confirmModal.stage,
      notes || 'Verified by technician at desk.'
    );
    showToast(
      'success',
      confirmModal.stage === 'RETURN'
        ? 'Return confirmed & booking closed'
        : 'Supervised handover confirmed',
      'Staff confirmation event has been appended to the Trust Ledger.'
    );
    await loadData();
  };

  const filtered = bookings.filter((b) => {
    if (activeTab === 'RETURN_PENDING') return b.status === 'RETURN_PENDING_CONFIRMATION';
    if (activeTab === 'DUE_HANDOVER') return b.status === 'APPROVED';
    if (activeTab === 'WITH_USERS') return b.status === 'CHECKED_OUT_TO_USER';
    if (activeTab === 'OVERDUE') return b.status === 'OVERDUE';
    return false;
  });

  const counts = {
    RETURN_PENDING: bookings.filter((b) => b.status === 'RETURN_PENDING_CONFIRMATION').length,
    DUE_HANDOVER: bookings.filter((b) => b.status === 'APPROVED').length,
    WITH_USERS: bookings.filter((b) => b.status === 'CHECKED_OUT_TO_USER').length,
    OVERDUE: bookings.filter((b) => b.status === 'OVERDUE').length,
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Staff handover & return verification
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Inspect user-submitted check-in and return condition reports side by side, confirm supervised returns, or escalate discrepancies to an incident report.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[8px]">
        {[
          { key: 'RETURN_PENDING', label: `Return pending confirmation (${counts.RETURN_PENDING})` },
          { key: 'DUE_HANDOVER', label: `Due for handover (${counts.DUE_HANDOVER})` },
          { key: 'WITH_USERS', label: `With users (${counts.WITH_USERS})` },
          { key: 'OVERDUE', label: `Overdue (${counts.OVERDUE})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as HandoverTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-[6px] cursor-pointer whitespace-nowrap ${
              activeTab === t.key
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
          Loading handover & return records...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-8 text-center text-sm text-[var(--text-secondary)]">
          No bookings currently in this handover/return stage.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const reports = reportsByBooking[b.id] || [];
            const checkInRep = reports.find((r) => r.stage === 'CHECK_IN');
            const returnRep = reports.find((r) => r.stage === 'RETURN');

            return (
              <div
                key={b.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/bookings/${b.id}`}
                        className="text-base font-semibold text-[var(--text-primary)] hover:underline"
                      >
                        {b.resourceName}
                      </Link>
                      <StatusIndicator kind="booking" value={b.status} />
                      <span className="text-xs font-mono-tech text-[var(--text-muted)]">#{b.id}</span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
                      User: <strong>{b.requesterName}</strong> · Window:{' '}
                      {formatTimeRange(b.start, b.end)} · Supervision: {b.resourceSupervision}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {b.status === 'RETURN_PENDING_CONFIRMATION' && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({
                            open: true,
                            bookingId: b.id,
                            stage: 'RETURN',
                            title: `Confirm return receipt for ${b.resourceName}`,
                          })
                        }
                        className="px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
                      >
                        Confirm return & close booking
                      </button>
                    )}

                    {b.status === 'APPROVED' && (
                      <Link
                        to={`/bookings/${b.id}/check-in`}
                        className="px-3.5 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                      >
                        Assist check-in & handover
                      </Link>
                    )}

                    {['CHECKED_OUT_TO_USER', 'OVERDUE'].includes(b.status) && (
                      <Link
                        to={`/bookings/${b.id}/return`}
                        className="px-3.5 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                      >
                        Record return inspection
                      </Link>
                    )}

                    <Link
                      to={`/bookings/${b.id}/incident`}
                      className="px-3 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                    >
                      Open incident
                    </Link>
                  </div>
                </div>

                {/* Side-by-Side Before vs After Condition Comparison */}
                {(checkInRep || returnRep) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-color)] text-xs">
                    <div className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--text-primary)]">
                          Before (Initial Check-In)
                        </span>
                        {checkInRep && (
                          <StatusIndicator kind="condition" value={checkInRep.condition} />
                        )}
                      </div>
                      {checkInRep ? (
                        <>
                          <p className="text-[var(--text-secondary)]">{checkInRep.notes}</p>
                          <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            Recorded {formatDateTime(checkInRep.actualTimestamp)} by{' '}
                            {checkInRep.reporterName}
                          </div>
                        </>
                      ) : (
                        <p className="text-[var(--text-muted)]">Not yet recorded.</p>
                      )}
                    </div>

                    <div className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--text-primary)]">
                          After (Final Return Report)
                        </span>
                        {returnRep && (
                          <StatusIndicator kind="condition" value={returnRep.condition} />
                        )}
                      </div>
                      {returnRep ? (
                        <>
                          <p className="text-[var(--text-secondary)]">{returnRep.notes}</p>
                          <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            Recorded {formatDateTime(returnRep.actualTimestamp)} by{' '}
                            {returnRep.reporterName}
                          </div>
                        </>
                      ) : (
                        <p className="text-[var(--text-muted)]">Awaiting return report.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmActionDialog
        open={confirmModal.open}
        title={confirmModal.title}
        description="Verify physical condition and accessory return before closing the transaction in the Trust Ledger."
        confirmLabel="Confirm & record in ledger"
        requireReason={true}
        reasonLabel="Technician verification note"
        reasonPlaceholder="e.g., Inspected meter and leads at Desk B-101; unit returned to locker."
        onConfirm={handleStaffConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
