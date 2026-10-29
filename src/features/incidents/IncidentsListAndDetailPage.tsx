import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Attachment, Booking, Incident, Resource } from '../../lib/types';
import { formatDateTime } from '../../lib/utils';
import { StatusIndicator } from '../../components/Primitives';

export const IncidentsListAndDetailPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { user, showToast } = useApp();

  const [incidents, setIncidents] = useState<Array<Incident & { resourceName: string }>>([]);
  const [detail, setDetail] = useState<{
    incident: Incident;
    resource: Resource;
    booking?: Booking;
    attachments: Attachment[];
  } | null>(null);

  const [commentText, setCommentText] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<Incident['status']>('RESOLVED');
  const [resolutionOutcome, setResolutionOutcome] = useState<Incident['resolutionOutcome']>(
    'ACCESSORY_REPLACED'
  );
  const [resolutionText, setResolutionText] = useState(
    'Inspected test lead set at Desk B-101. Superficial outer silicone jacket nick from normal lab handling; replaced lead from spares. No fault or penalty assigned.'
  );
  const [markMaintenance, setMarkMaintenance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const isStaff = Boolean(user?.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r)));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getIncidents();
      setIncidents(list);
      if (id) {
        const det = await api.getIncidentDetail(id);
        setDetail(det);
        if (det.incident.resolution) {
          setResolutionText(det.incident.resolution);
        }
      } else {
        setDetail(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !commentText.trim()) return;
    setSubmitting(true);
    try {
      await api.addIncidentComment(id, commentText.trim());
      setCommentText('');
      showToast('success', 'Comment added', 'Recorded in incident timeline and Trust Ledger.');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    try {
      await api.resolveIncident(id, {
        status: resolutionStatus,
        resolutionOutcome,
        resolution: resolutionText,
        markResourceMaintenance: markMaintenance,
      });
      showToast(
        'success',
        `Incident updated (${resolutionStatus})`,
        'Human reviewer resolution has been recorded in the Trust Ledger.'
      );
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to resolve incident', err instanceof Error ? err.message : '');
    } finally {
      setSubmitting(false);
    }
  };

  if (id && detail) {
    const { incident, resource, booking, attachments } = detail;

    return (
      <div className="space-y-6">
        <div className="border-b border-[var(--border-color)] pb-4 space-y-1">
          <Link
            to="/incidents"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to incident queue</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Incident #{incident.id} — {incident.category}
            </h1>
            <StatusIndicator kind="incident" value={incident.status} />
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Resource: <strong>{resource.name}</strong> · Reported by {incident.reporterName} on{' '}
            {formatDateTime(incident.createdAt)}
          </div>
        </div>

        {/* Non-Blame Allegation Notice */}
        <div className="p-3.5 rounded-[8px] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 text-xs text-[var(--status-warning)] flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Accountability guardrail — Reported allegation, not an automated penalty:</strong>{' '}
            Discovering an issue during or after a booking never implies automatic fault. Only an authorised human reviewer can determine maintenance steps or resolution outcomes.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left 2 Columns: Incident Facts, Evidence, Comments */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Observation details & evidence
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-[var(--text-secondary)]">Discovered stage</dt>
                  <dd className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {incident.reportedStage || 'Return inspection'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Affected part</dt>
                  <dd className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {incident.affectedPart || 'Primary unit'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Linked booking</dt>
                  <dd className="font-mono-tech text-[var(--brand-primary)] mt-0.5">
                    {booking ? (
                      <Link to={`/bookings/${booking.id}`} className="hover:underline">
                        #{booking.id}
                      </Link>
                    ) : (
                      incident.bookingId
                    )}
                  </dd>
                </div>
              </dl>

              <div className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]">
                {incident.description}
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-[var(--text-secondary)]">
                    Attached evidence (SHA-256 verified in Trust Ledger):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1"
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.fileName}
                          referrerPolicy="no-referrer"
                          className="w-full h-36 object-cover rounded-[4px]"
                        />
                        <div className="text-[11px] font-medium text-[var(--text-primary)]">
                          {att.fileName}
                        </div>
                        <div className="text-[10px] font-mono-tech text-[var(--status-success)] truncate">
                          SHA-256: {att.sha256}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {incident.resolution && (
                <div className="p-4 rounded-[6px] bg-[var(--status-success-bg)] border border-[var(--status-success)]/30 text-xs space-y-1">
                  <div className="font-semibold text-[var(--status-success)]">
                    Recorded human resolution ({incident.reviewerName} ·{' '}
                    {incident.resolutionOutcome?.replace(/_/g, ' ')})
                  </div>
                  <p className="text-[var(--text-primary)]">{incident.resolution}</p>
                </div>
              )}
            </section>

            {/* Participant & Reviewer Discussion Timeline */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Clarifications & review notes ({incident.comments.length})
              </h2>

              {incident.comments.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">No additional comments yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {incident.comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {c.authorName} ({c.authorRole})
                        </span>
                        <span className="text-[var(--text-muted)] tabular-nums">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-[var(--text-secondary)]">{c.message}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddComment} className="space-y-2 pt-2">
                <label
                  htmlFor="add-inc-comment"
                  className="block text-xs font-medium text-[var(--text-primary)]"
                >
                  Add context or follow-up note
                </label>
                <div className="flex gap-2">
                  <input
                    id="add-inc-comment"
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Provide additional factual detail..."
                    className="flex-1 px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-2 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                  >
                    Post note
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* Right Column: Human Reviewer Resolution Panel */}
          <aside className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-3">
              Human reviewer resolution
            </h2>

            {!isStaff ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Only an authorised Lab Manager, Resource Owner, or Administrator can record an official incident resolution. You may add factual clarifications in the notes thread.
              </p>
            ) : (
              <form onSubmit={handleResolve} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-1">
                    Updated status
                  </label>
                  <select
                    value={resolutionStatus}
                    onChange={(e) => setResolutionStatus(e.target.value as Incident['status'])}
                    className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
                  >
                    <option value="UNDER_REVIEW">Under human review</option>
                    <option value="AWAITING_INFO">Awaiting participant information</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-1">
                    Verified outcome classification
                  </label>
                  <select
                    value={resolutionOutcome}
                    onChange={(e) =>
                      setResolutionOutcome(e.target.value as Incident['resolutionOutcome'])
                    }
                    className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
                  >
                    <option value="ACCESSORY_REPLACED">Accessory replaced from spares</option>
                    <option value="WEAR_AND_TEAR_LOGGED">Normal wear and tear logged</option>
                    <option value="MAINTENANCE_SCHEDULED">Calibration / maintenance scheduled</option>
                    <option value="TRAINING_REFRESH_RECOMMENDED">Refresher guidance recommended</option>
                    <option value="NO_ISSUE_FOUND">Inspected — no fault found</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-1">
                    Written resolution & explanation <span className="text-[var(--status-danger)]">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markMaintenance}
                    onChange={(e) => setMarkMaintenance(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Temporarily set resource status to MAINTENANCE while repairs complete</span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
                >
                  {submitting ? 'Saving resolution...' : 'Record human resolution in ledger'}
                </button>
              </form>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // Incidents Queue List (/incidents)
  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Incident reports & human resolution queue
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          All reports are treated as unverified allegations until reviewed by an authorised technician. No automated penalties or liability findings exist.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-8 text-center text-sm text-[var(--text-secondary)]">
          No incident reports on record for your scope.
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] divide-y divide-[var(--border-color)]">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--bg-secondary)]/30"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/incidents/${inc.id}`}
                    className="text-base font-semibold text-[var(--text-primary)] hover:underline"
                  >
                    {inc.resourceName} — {inc.category}
                  </Link>
                  <StatusIndicator kind="incident" value={inc.status} />
                  <span className="text-xs font-mono-tech text-[var(--text-muted)]">#{inc.id}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                  Reported by <strong>{inc.reporterName}</strong> · Stage:{' '}
                  {inc.reportedStage || 'Return'} · {formatDateTime(inc.createdAt)}
                </div>
                <p className="text-xs text-[var(--text-primary)]">{inc.description}</p>
                {inc.resolution && (
                  <div className="text-xs text-[var(--status-success)]">
                    <strong>Resolved by {inc.reviewerName}:</strong> {inc.resolution}
                  </div>
                )}
              </div>

              <Link
                to={`/incidents/${inc.id}`}
                className="px-3.5 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] self-start md:self-center shrink-0"
              >
                {inc.status === 'RESOLVED' ? 'Inspect record' : 'Review & resolve'}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
