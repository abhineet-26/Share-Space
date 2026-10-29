import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { EligibilityEvaluationResult, Resource } from '../../lib/types';
import { formatTimeRange } from '../../lib/utils';
import { StatusIndicator } from '../../components/Primitives';

export const BookingRequestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, showToast } = useApp();

  const initialOffset = Number(searchParams.get('offset')) || 26;
  const initialDuration = Number(searchParams.get('duration')) || 2;

  const [resource, setResource] = useState<Resource | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [offsetHours, setOffsetHours] = useState<number>(initialOffset);
  const [durationHours, setDurationHours] = useState<number>(initialDuration);
  const [purpose, setPurpose] = useState<string>(
    'Characterise switching regulator output ripple and thermal stability for EE-402 project milestone.'
  );
  const [projectCode, setProjectCode] = useState<string>('EE402-CAPSTONE');
  const [teamMembersInput, setTeamMembersInput] = useState<string>('');
  const [acknowledgedTerms, setAcknowledgedTerms] = useState<boolean>(true);
  const [joinWaitlistIfConflict, setJoinWaitlistIfConflict] = useState<boolean>(true);
  const [idempotencyKey] = useState<string>(() => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  const [eligibility, setEligibility] = useState<EligibilityEvaluationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const computeStartEnd = (off: number, dur: number) => {
    const base = new Date();
    base.setMinutes(0, 0, 0);
    const s = new Date(base.getTime() + off * 3600 * 1000).toISOString();
    const e = new Date(base.getTime() + (off + dur) * 3600 * 1000).toISOString();
    return { start: s, end: e };
  };

  const { start, end } = computeStartEnd(offsetHours, durationHours);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return;
      try {
        const res = await api.getResource(id);
        if (active) setResource(res.resource);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load resource');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    const runCheck = async () => {
      if (!id) return;
      try {
        const ev = await api.checkEligibilityPreview({
          resourceId: id,
          start,
          end,
        });
        if (active) setEligibility(ev);
      } catch {
        // ignore
      }
    };
    runCheck();
    return () => {
      active = false;
    };
  }, [id, start, end, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (purpose.trim().length < 8) {
      setError('Please enter a project purpose of at least 8 characters.');
      return;
    }
    if (!acknowledgedTerms) {
      setError('Please confirm that you understand the supervision and return conditions.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const booking = await api.createBooking({
        resourceId: id,
        start,
        end,
        purpose: purpose.trim(),
        projectCode: projectCode.trim() || undefined,
        teamMembers: teamMembersInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        idempotencyKey,
        joinWaitlistIfConflict,
      });

      if (booking.status === 'ELIGIBILITY_BLOCKED') {
        showToast(
          'warning',
          'Request saved as Eligibility Blocked',
          'A mandatory requirement failed; see remediation steps on the booking detail page.'
        );
      } else if (booking.status === 'WAITLISTED') {
        showToast(
          'info',
          `Added to Waitlist (#${booking.waitlistPosition})`,
          'Your request is queued under the published fair allocation policy.'
        );
      } else {
        showToast(
          'success',
          'Booking request submitted',
          'Request is now PENDING_REVIEW in the manager queue. Submission is not approval.'
        );
      }

      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!resource) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading request form...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-4 space-y-1">
        <Link
          to={`/resources/${resource.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to {resource.name}</span>
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Request resource — {resource.name}
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Eligibility and owner approval are separate. Submitting this request records a deterministic policy snapshot and routes it for review.
        </p>
      </div>

      {/* Stepper Header */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { num: 1, label: '1. Select time window' },
          { num: 2, label: '2. Purpose & project details' },
          { num: 3, label: '3. Eligibility & policy review' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStep(s.num as 1 | 2 | 3)}
            className={`p-2.5 rounded-[6px] border text-left text-xs font-medium cursor-pointer ${
              step === s.num
                ? 'border-[var(--brand-primary)] bg-[var(--brand-subtle)] text-[var(--text-primary)] font-semibold'
                : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Form Area (3 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-5"
        >
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Step 1: Choose start time and session duration
              </h2>

              <div>
                <label
                  htmlFor="slot-offset-select"
                  className="block text-xs font-medium text-[var(--text-primary)] mb-1"
                >
                  Start window
                </label>
                <select
                  id="slot-offset-select"
                  value={offsetHours}
                  onChange={(e) => setOffsetHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
                >
                  <option value={4}>Today (+4 hours from now)</option>
                  <option value={24}>Tomorrow 08:00 window (+24h — overlaps competing Camera slot)</option>
                  <option value={26}>Tomorrow 10:00 window (+26h — conflict-free)</option>
                  <option value={30}>Tomorrow 14:00 window (+30h)</option>
                  <option value={50}>In 2 days Morning (+50h)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="duration-select"
                  className="block text-xs font-medium text-[var(--text-primary)] mb-1"
                >
                  Requested duration (hours)
                </label>
                <select
                  id="duration-select"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
                >
                  <option value={1}>1.0 hour</option>
                  <option value={1.5}>1.5 hours</option>
                  <option value={2}>2.0 hours</option>
                  <option value={3}>3.0 hours</option>
                  <option value={4}>4.0 hours (Standard cap limit)</option>
                  <option value={6}>6.0 hours (Test session duration policy check)</option>
                </select>
              </div>

              <div className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1">
                <div className="font-semibold text-[var(--text-primary)]">Selected reservation window</div>
                <div className="tabular-nums text-[var(--text-secondary)]">
                  {formatTimeRange(start, end)} ({durationHours} hours)
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
                >
                  <span>Continue to purpose</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Step 2: Academic / project purpose
              </h2>

              <div>
                <label
                  htmlFor="purpose-textarea"
                  className="block text-xs font-medium text-[var(--text-primary)] mb-1"
                >
                  Purpose and experiment/project description <span className="text-[var(--status-danger)]">*</span>
                </label>
                <textarea
                  id="purpose-textarea"
                  rows={4}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
                  placeholder="Describe what you will measure, fabricate, or test..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="project-code-input"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1"
                  >
                    Course or project code
                  </label>
                  <input
                    id="project-code-input"
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="team-members-input"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1"
                  >
                    Team members (optional, comma-separated)
                  </label>
                  <input
                    id="team-members-input"
                    type="text"
                    value={teamMembersInput}
                    onChange={(e) => setTeamMembersInput(e.target.value)}
                    placeholder="e.g., Vikram S., Ananya K."
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
                >
                  <span>Review eligibility & submit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Step 3: Review & confirm request submission
              </h2>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs">
                <div>
                  <dt className="text-[var(--text-secondary)]">Resource</dt>
                  <dd className="font-semibold text-[var(--text-primary)] mt-0.5">{resource.name}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Requester</dt>
                  <dd className="font-semibold text-[var(--text-primary)] mt-0.5">{user?.name}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--text-secondary)]">Requested time window</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                    {formatTimeRange(start, end)} ({durationHours} hours)
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--text-secondary)]">Purpose</dt>
                  <dd className="text-[var(--text-primary)] mt-0.5">{purpose}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--text-secondary)]">Applied policy version IDs</dt>
                  <dd className="font-mono-tech text-[var(--text-primary)] mt-0.5">
                    {eligibility?.appliedPolicyVersionIds.join(', ')}
                  </dd>
                </div>
              </dl>

              <label className="flex items-start gap-2.5 text-xs text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgedTerms}
                  onChange={(e) => setAcknowledgedTerms(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm that I will record initial and final condition reports, follow{' '}
                  <strong>{resource.supervision.replace('_', ' ')}</strong> handover rules, and return all{' '}
                  {resource.accessories.length} accessories on time.
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={joinWaitlistIfConflict}
                  onChange={(e) => setJoinWaitlistIfConflict(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  If this slot overlaps an existing confirmed booking, automatically place my request on the priority waitlist.
                </span>
              </label>

              {error && (
                <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] border border-[var(--status-danger)]/30 text-xs text-[var(--status-danger)]">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
                >
                  {submitting ? 'Submitting request...' : 'Submit request'}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Live Eligibility Result Panel (2 cols) */}
        <aside className="lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Live eligibility check
            </h2>
            {eligibility && (
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-[4px] ${
                  eligibility.eligible
                    ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                    : 'bg-[var(--status-danger-bg)] text-[var(--status-danger)]'
                }`}
              >
                {eligibility.overallStatus.replace('_', ' ')}
              </span>
            )}
          </div>

          {eligibility && (
            <>
              <div className="p-2.5 rounded-[6px] bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)]">
                <strong>Important:</strong> Passing eligibility checks means your request satisfies institutional rules; an authorised manager still reviews and approves requests.
              </div>

              <div className="space-y-2.5">
                {eligibility.checks.map((c) => (
                  <div
                    key={c.key}
                    className="p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{c.label}</span>
                      <StatusIndicator kind="check" value={c.status} />
                    </div>
                    <div className="text-[var(--text-secondary)]">{c.reason}</div>
                    {c.nextStep && (
                      <div className="text-[var(--brand-primary)] font-medium">{c.nextStep}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="text-[11px] font-mono-tech text-[var(--text-muted)] pt-1">
                Idempotency key: {idempotencyKey}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};
