import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MinusCircle,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  BookingStatus,
  CheckStatus,
  ConditionLevel,
  IncidentStatus,
  ResourceStatus,
} from '../lib/types';

// Accessible Status Indicator (Text + Icon + Semantic Color — never color alone)
export const StatusIndicator: React.FC<{
  kind: 'booking' | 'check' | 'resource' | 'incident' | 'condition';
  value: string;
}> = ({ kind, value }) => {
  let icon = <Clock className="w-3.5 h-3.5 shrink-0" />;
  let label = value;
  let colorClass = 'text-[var(--status-neutral)] bg-[var(--status-neutral-bg)] border-[var(--border-color)]';

  if (kind === 'check') {
    const st = value as CheckStatus;
    if (st === 'PASS') {
      icon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      label = 'Pass';
      colorClass = 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--status-success)]/30';
    } else if (st === 'FAIL') {
      icon = <XCircle className="w-3.5 h-3.5 shrink-0" />;
      label = 'Requirement not met';
      colorClass = 'text-[var(--status-danger)] bg-[var(--status-danger-bg)] border-[var(--status-danger)]/30';
    } else if (st === 'REVIEW_REQUIRED') {
      icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
      label = 'Human review required';
      colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
    } else {
      icon = <MinusCircle className="w-3.5 h-3.5 shrink-0" />;
      label = 'Not applicable';
    }
  } else if (kind === 'booking') {
    const st = value as BookingStatus;
    switch (st) {
      case 'APPROVED':
        icon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
        label = 'Approved — ready for handover';
        colorClass = 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--status-success)]/30';
        break;
      case 'CHECKED_OUT_TO_USER':
        icon = <ArrowRight className="w-3.5 h-3.5 shrink-0" />;
        label = 'Checked out to user';
        colorClass = 'text-[var(--brand-primary)] bg-[var(--brand-subtle)] border-[var(--brand-primary)]/30';
        break;
      case 'PENDING_REVIEW':
        icon = <Clock className="w-3.5 h-3.5 shrink-0" />;
        label = 'Pending manager review';
        colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
        break;
      case 'WAITLISTED':
        icon = <Clock className="w-3.5 h-3.5 shrink-0" />;
        label = 'Waitlisted (priority queue)';
        colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
        break;
      case 'RETURN_PENDING_CONFIRMATION':
        icon = <FileCheck className="w-3.5 h-3.5 shrink-0" />;
        label = 'Returned — awaiting staff confirmation';
        colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
        break;
      case 'OVERDUE':
        icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
        label = 'Overdue for return';
        colorClass = 'text-[var(--status-danger)] bg-[var(--status-danger-bg)] border-[var(--status-danger)]/30';
        break;
      case 'ELIGIBILITY_BLOCKED':
        icon = <Lock className="w-3.5 h-3.5 shrink-0" />;
        label = 'Blocked — requirement unmet';
        colorClass = 'text-[var(--status-danger)] bg-[var(--status-danger-bg)] border-[var(--status-danger)]/30';
        break;
      case 'REJECTED':
        icon = <XCircle className="w-3.5 h-3.5 shrink-0" />;
        label = 'Declined with reason';
        colorClass = 'text-[var(--status-danger)] bg-[var(--status-danger-bg)] border-[var(--status-danger)]/30';
        break;
      case 'CLOSED':
      case 'RETURNED':
        icon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
        label = st === 'CLOSED' ? 'Closed (complete)' : 'Returned';
        colorClass = 'text-[var(--status-neutral)] bg-[var(--status-neutral-bg)] border-[var(--border-color)]';
        break;
      case 'CANCELLED':
        icon = <MinusCircle className="w-3.5 h-3.5 shrink-0" />;
        label = 'Cancelled';
        colorClass = 'text-[var(--status-neutral)] bg-[var(--status-neutral-bg)] border-[var(--border-color)]';
        break;
      default:
        label = st.replace(/_/g, ' ');
    }
  } else if (kind === 'resource') {
    const st = value as ResourceStatus;
    if (st === 'PUBLISHED') {
      icon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      label = 'Published & bookable';
      colorClass = 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--status-success)]/30';
    } else if (st === 'MAINTENANCE') {
      icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
      label = 'Under maintenance';
      colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
    } else if (st === 'PAUSED') {
      icon = <Clock className="w-3.5 h-3.5 shrink-0" />;
      label = 'Paused by owner';
      colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
    } else {
      icon = <MinusCircle className="w-3.5 h-3.5 shrink-0" />;
      label = st.charAt(0) + st.slice(1).toLowerCase();
    }
  } else if (kind === 'incident') {
    const st = value as IncidentStatus;
    if (st === 'REPORTED' || st === 'UNDER_REVIEW') {
      icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
      label = st === 'REPORTED' ? 'Reported allegation (unverified)' : 'Under human review';
      colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
    } else if (st === 'AWAITING_INFO') {
      icon = <Clock className="w-3.5 h-3.5 shrink-0" />;
      label = 'Awaiting participant info';
      colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
    } else {
      icon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      label = 'Resolved by reviewer';
      colorClass = 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--status-success)]/30';
    }
  } else if (kind === 'condition') {
    const st = value as ConditionLevel;
    if (st === 'EXCELLENT' || st === 'GOOD') {
      icon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      label = st === 'EXCELLENT' ? 'Condition: Excellent' : 'Condition: Good';
      colorClass = 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--status-success)]/30';
    } else if (st === 'MINOR_WEAR') {
      icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
      label = 'Condition: Minor wear noted';
      colorClass = 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30';
    } else {
      icon = <XCircle className="w-3.5 h-3.5 shrink-0" />;
      label = 'Condition: Needs attention';
      colorClass = 'text-[var(--status-danger)] bg-[var(--status-danger-bg)] border-[var(--status-danger)]/30';
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-[6px] border whitespace-nowrap shrink-0 ${colorClass}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};

// Booking Lifecycle Stepper
export const BookingLifecycleStepper: React.FC<{ status: BookingStatus }> = ({ status }) => {
  const steps = [
    { key: 'REQUESTED', label: '1. Requested' },
    { key: 'REVIEW', label: '2. Eligibility & Review' },
    { key: 'APPROVED', label: '3. Approved' },
    { key: 'CHECKED_OUT', label: '4. Checked out' },
    { key: 'RETURNED', label: '5. Returned' },
    { key: 'CLOSED', label: '6. Closed' },
  ];

  let activeIdx = 0;
  if (['PENDING_REVIEW', 'WAITLISTED', 'NEEDS_INFORMATION', 'ELIGIBILITY_BLOCKED', 'REJECTED'].includes(status)) {
    activeIdx = 1;
  } else if (status === 'APPROVED') {
    activeIdx = 2;
  } else if (['CHECKED_OUT_TO_USER', 'OVERDUE'].includes(status)) {
    activeIdx = 3;
  } else if (['RETURN_PENDING_CONFIRMATION', 'RETURNED'].includes(status)) {
    activeIdx = 4;
  } else if (status === 'CLOSED') {
    activeIdx = 5;
  }

  const isFailed = ['REJECTED', 'ELIGIBILITY_BLOCKED', 'CANCELLED'].includes(status);

  return (
    <div className="w-full py-3" aria-label="Booking lifecycle progress">
      <ol className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {steps.map((step, idx) => {
          const isCompleted = !isFailed && idx < activeIdx;
          const isCurrent = idx === activeIdx;
          return (
            <li
              key={step.key}
              className={`flex items-center gap-2 p-2 rounded-[6px] border text-xs ${
                isCurrent
                  ? isFailed
                    ? 'border-[var(--status-danger)] bg-[var(--status-danger-bg)] text-[var(--status-danger)] font-semibold'
                    : 'border-[var(--brand-primary)] bg-[var(--brand-subtle)] text-[var(--text-primary)] font-semibold'
                  : isCompleted
                  ? 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--status-success)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--text-muted)]'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[var(--status-success)]" />
              ) : isCurrent && isFailed ? (
                <XCircle className="w-3.5 h-3.5 shrink-0 text-[var(--status-danger)]" />
              ) : (
                <span className="w-4 h-4 rounded-[4px] border border-current flex items-center justify-center text-[11px] tabular-nums shrink-0">
                  {idx + 1}
                </span>
              )}
              <span className="truncate">{step.label.split('. ')[1]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

// Tamper-Evident Hash Chain Verification Badge
export const ChainIntegrityBadge: React.FC<{
  valid: boolean;
  headSeq: number;
  verifiedAt?: string;
  firstInvalidSeq?: number;
  onVerifyNow?: () => void;
  verifying?: boolean;
}> = ({ valid, headSeq, verifiedAt, firstInvalidSeq, onVerifyNow, verifying }) => {
  const timeStr = verifiedAt
    ? new Date(verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Now';

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-[6px] border text-xs ${
        valid
          ? 'bg-[var(--status-success-bg)] border-[var(--status-success)]/30 text-[var(--status-success)]'
          : 'bg-[var(--status-danger-bg)] border-[var(--status-danger)]/40 text-[var(--status-danger)]'
      }`}
    >
      {valid ? (
        <>
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            Tamper-evident chain verified at {timeStr} · Head #{headSeq}
          </span>
        </>
      ) : (
        <>
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="font-semibold">
            Chain mismatch detected at sequence #{firstInvalidSeq} — tamper-evident alert active
          </span>
        </>
      )}
      {onVerifyNow && (
        <button
          type="button"
          onClick={onVerifyNow}
          disabled={verifying}
          className="ml-1 px-2 py-0.5 rounded-[4px] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] font-medium transition-colors cursor-pointer"
        >
          {verifying ? 'Verifying SHA-256...' : 'Verify now'}
        </button>
      )}
    </div>
  );
};

// Accessible Confirm Dialog with optional mandatory reason input
export const ConfirmActionDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'primary' | 'danger' | 'warning';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}> = ({
  open,
  title,
  description,
  confirmLabel,
  variant = 'primary',
  requireReason = false,
  reasonLabel = 'Recorded reason (stored in Trust Ledger)',
  reasonPlaceholder = 'Provide a factual reason for this decision...',
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
      setSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && reason.trim().length < 5) {
      setError('Please enter a reason of at least 5 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[10px] p-5 shadow-sm">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{description}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {requireReason && (
            <div>
              <label
                htmlFor="confirm-reason-input"
                className="block text-xs font-medium text-[var(--text-primary)] mb-1"
              >
                {reasonLabel} <span className="text-[var(--status-danger)]">*</span>
              </label>
              <textarea
                id="confirm-reason-input"
                ref={inputRef}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 text-xs text-[var(--status-danger)] bg-[var(--status-danger-bg)] border border-[var(--status-danger)]/30 rounded-[6px]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-3.5 py-2 text-sm font-medium bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 text-sm font-medium rounded-[8px] transition-colors cursor-pointer ${
                variant === 'danger'
                  ? 'bg-[var(--status-danger)] text-white hover:opacity-90'
                  : 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]'
              }`}
            >
              {submitting ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
