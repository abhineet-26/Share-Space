import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  Shield,
  Calendar,
  Wrench,
  Clock,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import {
  Asset,
  Booking,
  EligibilityEvaluationResult,
  Policy,
  PolicyVersion,
  Resource,
} from '../../lib/types';
import { formatTimeRange } from '../../lib/utils';
import { ResourceIllustration } from '../../components/ResourceIllustration';
import { StatusIndicator } from '../../components/Primitives';

export const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, showToast } = useApp();
  const navigate = useNavigate();

  const [resource, setResource] = useState<Resource | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activePolicies, setActivePolicies] = useState<{ policy: Policy; version?: PolicyVersion }[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityEvaluationResult | null>(null);
  const [selectedSlotOffsetHours, setSelectedSlotOffsetHours] = useState<number>(26);
  const [selectedDurationHours, setSelectedDurationHours] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestingTraining, setRequestingTraining] = useState(false);

  const isStaff = Boolean(
    user?.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r))
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const [detail, avail] = await Promise.all([
          api.getResource(id),
          api.getResourceAvailability(id),
        ]);
        if (!active) return;
        setResource(detail.resource);
        setAssets(detail.assets);
        setActivePolicies(detail.activePolicies);
        setWaitlistCount(detail.waitlistCount);
        setExistingBookings(avail.bookings);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Resource not found.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id, user]);

  useEffect(() => {
    let active = true;
    const checkElig = async () => {
      if (!resource) return;
      const base = new Date();
      base.setMinutes(0, 0, 0);
      const start = new Date(base.getTime() + selectedSlotOffsetHours * 3600 * 1000).toISOString();
      const end = new Date(
        base.getTime() + (selectedSlotOffsetHours + selectedDurationHours) * 3600 * 1000
      ).toISOString();
      const ev = await api.checkEligibilityPreview({
        resourceId: resource.id,
        start,
        end,
      });
      if (active) setEligibility(ev);
    };
    checkElig();
    return () => {
      active = false;
    };
  }, [resource, selectedSlotOffsetHours, selectedDurationHours, user]);

  const handleRequestTraining = async (trainingKey: string, label: string) => {
    setRequestingTraining(true);
    try {
      await api.requestTrainingEnrollment(trainingKey, label);
      showToast(
        'success',
        'Training session requested',
        `Your request for "${label}" is now PENDING verification. An administrator or lab manager can verify it in Users & Trainings.`
      );
    } catch (err) {
      showToast('error', 'Failed to request training', err instanceof Error ? err.message : '');
    } finally {
      setRequestingTraining(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading resource specifications...</div>;
  }

  if (error || !resource) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-6 space-y-3">
        <h1 className="text-lg font-semibold text-[var(--status-danger)]">Resource unavailable</h1>
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        <Link to="/discover" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
          ← Return to resource discovery
        </Link>
      </div>
    );
  }

  const slotPresets = [
    { label: 'Tomorrow Morning (10:00–12:00)', offset: 26, duration: 2 },
    { label: 'Tomorrow Afternoon (14:00–17:00)', offset: 30, duration: 3 },
    { label: 'In 2 Days Morning (09:00–11:00)', offset: 50, duration: 2 },
    { label: 'In 2 Days Afternoon (15:00–17:00)', offset: 56, duration: 2 },
  ];

  const hasApprovedAccess = existingBookings.some(
    (b) => b.userId === user?.id && ['APPROVED', 'CHECKED_OUT_TO_USER'].includes(b.status)
  );

  const failedTrainingReq = resource.requirements.find(
    (req) =>
      req.type === 'TRAINING' &&
      eligibility?.checks.some((c) => c.key === req.key && c.status === 'FAIL')
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div className="space-y-1">
          <Link
            to="/discover"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Discover</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{resource.name}</h1>
            <StatusIndicator kind="resource" value={resource.status} />
            <StatusIndicator kind="condition" value={resource.condition} />
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            <span>{resource.category.replace('_', ' & ')}</span>
            <span aria-hidden="true"> · </span>
            <span>Model: {resource.modelNumber || 'Standard'}</span>
            <span aria-hidden="true"> · </span>
            <span>Owner: {resource.ownerName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/labels/${resource.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Printable QR labels ({assets.length})</span>
          </Link>
          {isStaff && (
            <Link
              to={`/owner/resources/${resource.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Edit resource</span>
            </Link>
          )}
        </div>
      </div>

      {/* Two-Column Desktop Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Technical Specs, Availability Slot Picker, Accessories, Rules */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery Frame with Local Schematic Illustration & Factual Caption */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-3">
            <ResourceIllustration type={resource.illustrationType} className="w-full h-44" />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
              <span>
                Category schematic diagram ({resource.illustrationType}) · Registered assets:{' '}
                <strong className="font-mono-tech text-[var(--text-primary)]">
                  {assets.map((a) => a.assetTag).join(', ') || 'NIT-ASSET'}
                </strong>
              </span>
              <span>Supervision: {resource.supervision.replace('_', ' ')}</span>
            </div>
            <p className="text-sm text-[var(--text-primary)] pt-1">{resource.description}</p>
          </div>

          {/* Interactive Weekly Slot Picker & Schedule */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Availability & slot selection
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Published hours:{' '}
                  {resource.availability.map((a) => `${a.dayOfWeek} ${a.start}–${a.end}`).join(', ')}.
                  Select a slot below to prefill your booking request and preview eligibility.
                </p>
              </div>
              {waitlistCount > 0 && (
                <span className="text-xs font-mono-tech text-[var(--status-warning)]">
                  {waitlistCount} request(s) currently on waitlist
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {slotPresets.map((slot) => {
                const selected =
                  selectedSlotOffsetHours === slot.offset &&
                  selectedDurationHours === slot.duration;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => {
                      setSelectedSlotOffsetHours(slot.offset);
                      setSelectedDurationHours(slot.duration);
                    }}
                    className={`text-left p-3 rounded-[6px] border text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-subtle)] text-[var(--text-primary)] font-semibold'
                        : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div>{slot.label}</div>
                    <div className="text-[11px] font-mono-tech mt-0.5">
                      Duration: {slot.duration}.0 hours
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active / Upcoming Reservations on this Resource */}
            <div className="pt-3 border-t border-[var(--border-color)] space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
                Current scheduled & competing activity on this resource ({existingBookings.length})
              </h3>
              {existingBookings.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  No active or upcoming bookings currently occupy this resource.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {existingBookings.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs"
                    >
                      <span className="tabular-nums text-[var(--text-primary)]">
                        {formatTimeRange(b.start, b.end)}
                      </span>
                      <StatusIndicator kind="booking" value={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Location, Included Accessories, Return & Usage Rules */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Location & access conditions
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  <strong>Location:</strong> {resource.location}
                </p>
                <div className="mt-2 p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs">
                  {hasApprovedAccess || isStaff ? (
                    <span>
                      <strong>Access instructions:</strong> {resource.accessInstructions}
                    </span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">
                      Detailed cabinet/keycard access instructions are unlocked after your booking request is approved.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Included accessories checklist ({resource.accessories.length})
                </h3>
                <ul className="mt-1.5 space-y-1 text-xs text-[var(--text-secondary)]">
                  {resource.accessories.map((acc) => (
                    <li key={acc} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                      <span>{acc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[var(--border-color)] text-xs">
              <div>
                <strong className="block text-[var(--text-primary)] mb-1">Safety & usage rules</strong>
                <p className="text-[var(--text-secondary)]">{resource.usageRules}</p>
              </div>
              <div>
                <strong className="block text-[var(--text-primary)] mb-1">Return & inspection rules</strong>
                <p className="text-[var(--text-secondary)]">{resource.returnRules}</p>
              </div>
              <div>
                <strong className="block text-[var(--text-primary)] mb-1">Cancellation policy</strong>
                <p className="text-[var(--text-secondary)]">{resource.cancellationPolicy}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Prominent Eligibility & Policy Panel + Request Action */}
        <div className="space-y-5">
          <section
            aria-labelledby="elig-panel-heading"
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4"
          >
            <div className="border-b border-[var(--border-color)] pb-3">
              <div className="text-xs font-mono-tech text-[var(--text-secondary)]">
                DETERMINISTIC ELIGIBILITY PREVIEW
              </div>
              <h2 id="elig-panel-heading" className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                Requirements for {user?.name}
              </h2>
            </div>

            {eligibility && (
              <>
                <div className="space-y-2.5">
                  {eligibility.checks.map((chk) => (
                    <div
                      key={chk.key}
                      className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--text-primary)]">{chk.label}</span>
                        <StatusIndicator kind="check" value={chk.status} />
                      </div>
                      <p className="text-[var(--text-secondary)]">{chk.reason}</p>
                      {chk.nextStep && (
                        <p className="text-[var(--brand-primary)] font-medium pt-0.5">
                          Next step: {chk.nextStep}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Published Allocation Policy Summary */}
                <div className="p-3 rounded-[6px] bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] text-xs space-y-1.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Published allocation & usage policy
                  </div>
                  {activePolicies.map(({ policy, version }) => (
                    <div key={policy.id} className="text-[var(--text-secondary)]">
                      <span className="font-mono-tech text-[11px] text-[var(--text-primary)]">
                        [{policy.id} v{version?.version || 1}]
                      </span>{' '}
                      {version?.definition.plainSummary || policy.description}
                    </div>
                  ))}
                  <div className="text-[11px] text-[var(--text-secondary)] pt-1 tabular-nums">
                    Your rolling 7-day usage on this resource:{' '}
                    <strong>
                      {eligibility.usageHoursInWindow}h used of {eligibility.maxHoursAllowed}h limit
                    </strong>
                  </div>
                </div>

                {/* Primary Request Action or Remediation */}
                {eligibility.eligible ? (
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/resources/${resource.id}/request?offset=${selectedSlotOffsetHours}&duration=${selectedDurationHours}`
                        )
                      }
                      className="w-full py-2.5 px-4 text-sm font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Request this resource</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-[11px] text-[var(--text-secondary)] text-center">
                      Submitting a request routes it to the authorised manager for review.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] border border-[var(--status-danger)]/30 text-xs text-[var(--status-danger)]">
                      <strong>Mandatory requirement unmet:</strong> You cannot confirm a booking until the failed requirement above is resolved.
                    </div>

                    {failedTrainingReq && (
                      <button
                        type="button"
                        disabled={requestingTraining}
                        onClick={() =>
                          handleRequestTraining(failedTrainingReq.value, failedTrainingReq.label)
                        }
                        className="w-full py-2 px-3 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
                      >
                        {requestingTraining
                          ? 'Submitting training request...'
                          : `Request training: ${failedTrainingReq.label}`}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/resources/${resource.id}/request?offset=${selectedSlotOffsetHours}&duration=${selectedDurationHours}`
                        )
                      }
                      className="w-full py-2 px-3 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      Open request form to inspect full policy check
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
