import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Booking } from '../../lib/types';
import { formatTimeRange } from '../../lib/utils';
import { StatusIndicator } from '../../components/Primitives';

type TabKey = 'ALL' | 'UPCOMING' | 'PENDING' | 'WAITLISTED' | 'ACTIVE' | 'PAST' | 'CANCELLED';

export const MyBookingsPage: React.FC = () => {
  const { user } = useApp();
  const [bookings, setBookings] = useState<
    Array<Booking & { resourceName: string; resourceLocation: string; resourceSupervision: string }>
  >([]);
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const list = await api.getMyBookings();
        if (active) setBookings(list);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'UPCOMING') return b.status === 'APPROVED';
      if (activeTab === 'PENDING') return ['PENDING_REVIEW', 'REQUESTED', 'NEEDS_INFORMATION'].includes(b.status);
      if (activeTab === 'WAITLISTED') return b.status === 'WAITLISTED';
      if (activeTab === 'ACTIVE') return ['CHECKED_OUT_TO_USER', 'OVERDUE', 'RETURN_PENDING_CONFIRMATION'].includes(b.status);
      if (activeTab === 'PAST') return ['CLOSED', 'RETURNED'].includes(b.status);
      if (activeTab === 'CANCELLED') return ['CANCELLED', 'REJECTED', 'ELIGIBILITY_BLOCKED'].includes(b.status);
      return true;
    });
  }, [bookings, activeTab]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'ALL', label: `All (${bookings.length})` },
    { key: 'UPCOMING', label: 'Upcoming / Approved' },
    { key: 'ACTIVE', label: 'Active / Checked out' },
    { key: 'PENDING', label: 'Pending review' },
    { key: 'WAITLISTED', label: 'Waitlisted' },
    { key: 'PAST', label: 'Past / Closed' },
    { key: 'CANCELLED', label: 'Blocked / Declined' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My bookings & requests</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Track request review status, waitlist queue position, handover check-ins, return confirmations, and policy snapshots.
          </p>
        </div>
        <Link
          to="/discover"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] self-start"
        >
          <span>Request a resource</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Segmented Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[8px]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === t.key
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Loading bookings...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-8 text-center space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No bookings in this status category
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Switch tabs above or browse the institutional catalog to submit a new request.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] divide-y divide-[var(--border-color)]">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[var(--bg-secondary)]/30"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
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

                <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                  {formatTimeRange(b.start, b.end)} · {b.resourceLocation} · Applied policies:{' '}
                  <span className="font-mono-tech">{b.policyVersionIds.join(', ')}</span>
                </div>

                <p className="text-xs text-[var(--text-primary)]">
                  <strong>Purpose:</strong> {b.purpose}
                </p>

                {b.status === 'WAITLISTED' && (
                  <div className="p-2.5 rounded-[6px] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 text-xs text-[var(--status-warning)]">
                    <strong>Waitlist Position #{b.waitlistPosition || 1} (Your request remains active):</strong>{' '}
                    {b.waitlistReason}
                  </div>
                )}

                {b.decisionReason && b.status !== 'WAITLISTED' && (
                  <div className="text-xs text-[var(--text-secondary)]">
                    <strong>Decision / status reason:</strong> {b.decisionReason}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {b.status === 'APPROVED' && (
                  <Link
                    to={`/bookings/${b.id}/check-in`}
                    className="px-3.5 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                  >
                    Check in & record condition
                  </Link>
                )}
                {['CHECKED_OUT_TO_USER', 'OVERDUE'].includes(b.status) && (
                  <Link
                    to={`/bookings/${b.id}/return`}
                    className="px-3.5 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]"
                  >
                    Submit return report
                  </Link>
                )}
                <Link
                  to={`/bookings/${b.id}`}
                  className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                  Open timeline & ledger
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
