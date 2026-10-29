import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Booking, Incident, Resource } from '../../lib/types';
import { sha256Hex } from '../../lib/utils';

export const IncidentReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);

  const [rawNotes, setRawNotes] = useState<string>(
    'While disconnecting Channel 1 probe after my measurement, I noticed the BNC locking collar felt slightly loose and the plastic insulation sleeve had a small hairline crack.'
  );
  const [category, setCategory] = useState<Incident['category']>('Damage / suspected damage');
  const [reportedStage, setReportedStage] = useState<string>('Return inspection');
  const [affectedPart, setAffectedPart] = useState<string>('Channel 1 BNC probe collar');
  const [description, setDescription] = useState<string>(
    'Channel 1 BNC probe locking collar felt loose with a hairline crack on the outer plastic sleeve during return inspection.'
  );

  const [draftPreview, setDraftPreview] = useState<{
    category: Incident['category'];
    reportedStage: string;
    affectedPart: string;
    structuredDescription: string;
    suggestedCheckpoints: string[];
    source: string;
  } | null>(null);
  const [assistedDraftConfirmed, setAssistedDraftConfirmed] = useState(false);
  const [structuring, setStructuring] = useState(false);

  const [photos, setPhotos] = useState<
    Array<{ fileName: string; mimeType: string; dataUrl: string; sha256: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return;
      try {
        const detail = await api.getBookingDetail(id);
        if (!active) return;
        setBooking(detail.booking);
        setResource(detail.resource);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load booking.');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleStructureReport = async () => {
    if (!rawNotes.trim() || !resource) return;
    setStructuring(true);
    try {
      const res = await api.structureIncidentDraft(rawNotes, resource.name);
      setDraftPreview(res);
      setAssistedDraftConfirmed(false);
    } finally {
      setStructuring(false);
    }
  };

  const handleApplyStructuredDraft = () => {
    if (!draftPreview) return;
    setCategory(draftPreview.category);
    setReportedStage(draftPreview.reportedStage);
    setAffectedPart(draftPreview.affectedPart);
    setDescription(draftPreview.structuredDescription);
    setAssistedDraftConfirmed(true);
    showToast(
      'info',
      'Structured draft applied',
      'Please review the fields below before submitting.'
    );
  };

  const handleCaptureEvidence = async () => {
    if (!resource || photos.length >= 4) return;
    const fileName = `incident_evidence_${resource.id}_${photos.length + 1}.svg`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200"><rect width="360" height="200" fill="#F6EFE2"/><rect x="20" y="20" width="320" height="160" rx="6" fill="#FFFFFF" stroke="#8A5B12" stroke-width="2"/><text x="36" y="56" fill="#202923" font-family="sans-serif" font-weight="bold" font-size="13">INCIDENT EVIDENCE · ${resource.name.slice(0, 26)}</text><text x="36" y="84" fill="#8A5B12" font-family="monospace" font-size="12">Part: ${affectedPart.slice(0, 36)}</text><text x="36" y="112" fill="#626D65" font-family="monospace" font-size="11">Stage: ${reportedStage}</text><text x="36" y="156" fill="#626D65" font-family="monospace" font-size="10">SHA-256 Bound · ${new Date().toISOString()}</text></svg>`;
    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    const sha256 = await sha256Hex(dataUrl + fileName);
    setPhotos((prev) => [...prev, { fileName, mimeType: 'image/svg+xml', dataUrl, sha256 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      const created = await api.createIncident(id, {
        category,
        reportedStage,
        affectedPart,
        description,
        assistedDraftUsed: assistedDraftConfirmed,
        photos,
      });
      showToast(
        'success',
        `Incident #${created.id} logged for human review`,
        'Recorded as an unverified allegation in the Trust Ledger.'
      );
      navigate(`/incidents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit incident.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking || !resource) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">{error || 'Loading incident form...'}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4 space-y-1">
        <Link
          to={`/bookings/${booking.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to booking #{booking.id}</span>
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Report an operational issue or incident
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Resource: <strong>{resource.name}</strong> · Booking #{booking.id}. Incident reports are treated as unverified observations until reviewed by an authorised technician. No automatic blame or penalty is ever applied.
        </p>
      </div>

      {/* Assistive Draft Structurer Panel */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Optional assistive report structurer
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Write rough observation notes below and click "Structure my report" to draft neutral, factual fields. You must review and confirm before submitting.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStructureReport}
            disabled={structuring}
            className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--brand-primary)] bg-[var(--brand-subtle)] text-[var(--brand-primary)] hover:opacity-90 cursor-pointer shrink-0"
          >
            {structuring ? 'Structuring report...' : 'Structure my report'}
          </button>
        </div>

        <textarea
          rows={2}
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          placeholder="Describe in plain words what you noticed..."
          aria-label="Raw observation notes for assistive structuring"
          className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
        />

        {draftPreview && (
          <div className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--brand-primary)]/40 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-[var(--brand-primary)]">
                Proposed structured fields ({draftPreview.source})
              </strong>
              <span className="font-mono-tech text-[11px] text-[var(--status-warning)]">
                requiresHumanReview = true
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-[var(--text-secondary)]">Category:</span>{' '}
                <strong>{draftPreview.category}</strong>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Stage:</span>{' '}
                <strong>{draftPreview.reportedStage}</strong>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Affected part:</span>{' '}
                <strong>{draftPreview.affectedPart}</strong>
              </div>
            </div>
            <p className="text-[var(--text-primary)]">{draftPreview.structuredDescription}</p>
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleApplyStructuredDraft}
                className="px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] cursor-pointer"
              >
                Confirm & copy into form below
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Incident Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="inc-cat"
              className="block text-xs font-semibold text-[var(--text-primary)] mb-1"
            >
              Incident category
            </label>
            <select
              id="inc-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as Incident['category'])}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            >
              <option value="Damage / suspected damage">Damage / suspected damage</option>
              <option value="Missing accessory">Missing accessory</option>
              <option value="Late return">Late return</option>
              <option value="Safety concern">Safety concern</option>
              <option value="Booking conflict">Booking conflict</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="inc-stage"
              className="block text-xs font-semibold text-[var(--text-primary)] mb-1"
            >
              When discovered
            </label>
            <select
              id="inc-stage"
              value={reportedStage}
              onChange={(e) => setReportedStage(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            >
              <option value="Pre-use check-in">Pre-use check-in</option>
              <option value="During operation">During operation</option>
              <option value="Return inspection">Return inspection</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="inc-part"
              className="block text-xs font-semibold text-[var(--text-primary)] mb-1"
            >
              Affected part / accessory
            </label>
            <input
              id="inc-part"
              type="text"
              value={affectedPart}
              onChange={(e) => setAffectedPart(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="inc-desc"
            className="block text-xs font-semibold text-[var(--text-primary)] mb-1"
          >
            Factual description <span className="text-[var(--status-danger)]">*</span>
          </label>
          <textarea
            id="inc-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
          />
        </div>

        {/* Evidence Photo Capture */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Evidence attachments ({photos.length}/4 · SHA-256 bound to ledger)
            </span>
            <button
              type="button"
              onClick={handleCaptureEvidence}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Attach evidence photo</span>
            </button>
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {photos.map((ph, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1"
                >
                  <img
                    src={ph.dataUrl}
                    alt={ph.fileName}
                    referrerPolicy="no-referrer"
                    className="w-full h-24 object-cover rounded-[4px]"
                  />
                  <div className="text-[10px] font-mono-tech text-[var(--status-success)] truncate">
                    SHA-256: {ph.sha256}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] text-xs text-[var(--status-danger)]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to={`/bookings/${booking.id}`}
            className="px-4 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
          >
            {submitting ? 'Submitting report...' : 'Submit incident report'}
          </button>
        </div>
      </form>
    </div>
  );
};
