import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Camera, AlertTriangle } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import {
  Booking,
  ConditionLevel,
  ConditionReport,
  Incident,
  Resource,
} from '../../lib/types';
import { formatTimeRange, sha256Hex } from '../../lib/utils';
import { StatusIndicator } from '../../components/Primitives';

export const ReturnPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [initialReport, setInitialReport] = useState<ConditionReport | null>(null);

  const [finalCondition, setFinalCondition] = useState<ConditionLevel>('EXCELLENT');
  const [accessories, setAccessories] = useState<{ name: string; present: boolean }[]>([]);
  const [notes, setNotes] = useState<string>(
    'Outputs zeroed, probes coiled cleanly, and returned to designated bench station.'
  );
  const [photos, setPhotos] = useState<
    Array<{ fileName: string; mimeType: string; dataUrl: string; sha256: string }>
  >([]);

  const [reportIssueToggle, setReportIssueToggle] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState<Incident['category']>(
    'Damage / suspected damage'
  );
  const [incidentDescription, setIncidentDescription] = useState('');

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
        const checkInRep =
          detail.conditionReports.find((cr) => cr.stage === 'CHECK_IN') || null;
        setInitialReport(checkInRep);
        setFinalCondition(checkInRep?.condition || detail.resource.condition);
        setAccessories(
          detail.resource.accessories.map((name) => ({ name, present: true }))
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load booking.');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const conditionDiffered =
    (initialReport && initialReport.condition !== finalCondition) ||
    accessories.some((a) => !a.present);

  const handleAddReturnPhoto = async () => {
    if (!resource || photos.length >= 4) return;
    const idx = photos.length + 1;
    const fileName = `return_evidence_${resource.id}_${idx}.svg`;
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220"><rect width="360" height="220" fill="#EEF0E9"/><rect x="20" y="24" width="320" height="172" rx="6" fill="#FFFFFF" stroke="#285443" stroke-width="2"/><text x="36" y="60" fill="#202923" font-family="sans-serif" font-weight="bold" font-size="13">RETURN INSPECTION · ${resource.name.slice(0, 26)}</text><text x="36" y="88" fill="#285443" font-family="monospace" font-size="12">FINAL CONDITION: ${finalCondition}</text><text x="36" y="114" fill="#626D65" font-family="monospace" font-size="11">Returned accessories: ${accessories.filter((a) => a.present).length}/${accessories.length}</text><text x="36" y="168" fill="#626D65" font-family="monospace" font-size="10">Timestamp: ${new Date().toISOString()}</text></svg>`;
    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent);
    const hash = await sha256Hex(dataUrl + fileName);
    setPhotos((prev) => [...prev, { fileName, mimeType: 'image/svg+xml', dataUrl, sha256: hash }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.submitReturn(id, {
        condition: finalCondition,
        accessories,
        notes,
        photos,
        openIncidentCategory: reportIssueToggle ? incidentCategory : undefined,
        openIncidentDescription: reportIssueToggle ? incidentDescription : undefined,
      });

      if (res.incident) {
        showToast(
          'warning',
          'Return report & incident allegation recorded',
          'Incident is logged as an allegation for human review. No automatic penalty applies.'
        );
      } else {
        showToast(
          'success',
          res.booking.status === 'RETURN_PENDING_CONFIRMATION'
            ? 'Return initiated — awaiting staff confirmation'
            : 'Return complete & booking closed',
          'Final condition report has been recorded in the Trust Ledger.'
        );
      }
      navigate(`/bookings/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit return.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking || !resource) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">{error || 'Loading return form...'}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4 space-y-1">
        <Link
          to={`/bookings/${booking.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to booking #{booking.id}</span>
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Return resource & final condition report
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          {resource.name} · {formatTimeRange(booking.start, booking.end)}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-5"
      >
        {/* 1. Final Condition Selector */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
            1. Final condition on return
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['EXCELLENT', 'GOOD', 'MINOR_WEAR', 'NEEDS_ATTENTION'] as ConditionLevel[]).map(
              (lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFinalCondition(lvl)}
                  className={`py-2.5 px-3 text-xs font-medium rounded-[6px] border text-center cursor-pointer min-h-[44px] ${
                    finalCondition === lvl
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-subtle)] text-[var(--text-primary)] font-semibold'
                      : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)]'
                  }`}
                >
                  {lvl.replace('_', ' ')}
                </button>
              )
            )}
          </div>
        </div>

        {/* Before vs After Comparison Prompt when condition differs */}
        {conditionDiffered && (
          <div className="p-3.5 rounded-[6px] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 text-xs space-y-2">
            <div className="font-semibold text-[var(--status-warning)] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Before vs. After condition change detected</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-[4px] bg-[var(--bg-surface)] border border-[var(--border-color)]">
              <div>
                <div className="text-[11px] text-[var(--text-secondary)]">Check-in condition:</div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {initialReport?.condition || 'EXCELLENT'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-secondary)]">Return condition:</div>
                <div className="font-semibold text-[var(--status-warning)]">{finalCondition}</div>
              </div>
            </div>
            <p className="text-[var(--text-primary)]">
              Reporting wear or an issue opens a factual incident record for technician inspection. Never worry about automatic penalties—all incident reports are reviewed by a human.
            </p>
            {!reportIssueToggle && (
              <button
                type="button"
                onClick={() => {
                  setReportIssueToggle(true);
                  setIncidentDescription(
                    `Condition changed from ${initialReport?.condition || 'EXCELLENT'} to ${finalCondition} during return check.`
                  );
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer"
              >
                Attach structured incident report to this return
              </button>
            )}
          </div>
        )}

        {/* 2. Accessories Returned Checklist */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
            2. Accessories returned checklist ({accessories.filter((a) => a.present).length}/
            {accessories.length} returned)
          </label>
          <div className="space-y-2">
            {accessories.map((acc, idx) => (
              <label
                key={acc.name}
                className="flex items-center justify-between p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs cursor-pointer min-h-[44px]"
              >
                <span className="text-[var(--text-primary)] font-medium">{acc.name}</span>
                <div className="flex items-center gap-2">
                  {!acc.present && (
                    <span className="text-[11px] font-semibold text-[var(--status-danger)]">
                      Flagged missing
                    </span>
                  )}
                  <input
                    type="checkbox"
                    checked={acc.present}
                    onChange={(e) => {
                      const next = [...accessories];
                      next[idx] = { ...acc, present: e.target.checked };
                      setAccessories(next);
                    }}
                    className="w-4 h-4"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 3. Return Notes */}
        <div>
          <label
            htmlFor="return-notes"
            className="block text-xs font-semibold text-[var(--text-primary)] mb-1"
          >
            3. Final condition & return notes
          </label>
          <textarea
            id="return-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
          />
        </div>

        {/* 4. Photo Evidence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              4. Return photo evidence ({photos.length}/4 · SHA-256 recorded)
            </span>
            <button
              type="button"
              onClick={handleAddReturnPhoto}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture return photo</span>
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

        {/* 5. Optional Issue / Incident Report Toggle */}
        <div className="pt-2 border-t border-[var(--border-color)] space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={reportIssueToggle}
              onChange={(e) => setReportIssueToggle(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Report an issue or suspected damage with this return</span>
          </label>

          {reportIssueToggle && (
            <div className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Incident category
                </label>
                <select
                  value={incidentCategory}
                  onChange={(e) => setIncidentCategory(e.target.value as Incident['category'])}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[6px]"
                >
                  <option value="Damage / suspected damage">Damage / suspected damage</option>
                  <option value="Missing accessory">Missing accessory</option>
                  <option value="Late return">Late return</option>
                  <option value="Safety concern">Safety concern</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Factual observation (reviewed by human technician)
                </label>
                <textarea
                  rows={2}
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  placeholder="Describe the issue observed..."
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[6px]"
                />
              </div>
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
            className="px-4 py-2.5 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer min-h-[44px]"
          >
            {submitting ? 'Submitting return...' : 'Submit return report'}
          </button>
        </div>
      </form>
    </div>
  );
};
