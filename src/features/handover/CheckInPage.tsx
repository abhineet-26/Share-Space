import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { Booking, ConditionLevel, Resource } from '../../lib/types';
import { formatTimeRange, sha256Hex } from '../../lib/utils';

export const CheckInPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [condition, setCondition] = useState<ConditionLevel>('EXCELLENT');
  const [accessories, setAccessories] = useState<{ name: string; present: boolean }[]>([]);
  const [notes, setNotes] = useState<string>(
    'Verified instrument self-test and inspected all probes/cables prior to use.'
  );
  const [acknowledgedRules, setAcknowledgedRules] = useState<boolean>(true);
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

  const handleAddSampleEvidencePhoto = async () => {
    if (!resource || photos.length >= 4) return;
    const idx = photos.length + 1;
    const fileName = `checkin_evidence_${resource.id}_${idx}.svg`;
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220"><rect width="360" height="220" fill="#EEF0E9"/><rect x="20" y="24" width="320" height="172" rx="6" fill="#FFFFFF" stroke="#285443" stroke-width="2"/><text x="36" y="60" fill="#202923" font-family="sans-serif" font-weight="bold" font-size="13">${resource.name.slice(0, 34)}</text><text x="36" y="88" fill="#2F6B4F" font-family="monospace" font-size="12">INITIAL CONDITION: ${condition}</text><text x="36" y="114" fill="#626D65" font-family="monospace" font-size="11">Accessories verified: ${accessories.filter((a) => a.present).length}/${accessories.length}</text><text x="36" y="168" fill="#626D65" font-family="monospace" font-size="10">Captured ${new Date().toISOString()}</text></svg>`;
    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent);
    const hash = await sha256Hex(dataUrl + fileName);
    setPhotos((prev) => [...prev, { fileName, mimeType: 'image/svg+xml', dataUrl, sha256: hash }]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 4) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const hash = await sha256Hex(dataUrl + file.name);
      setPhotos((prev) => [
        ...prev,
        { fileName: file.name, mimeType: file.type || 'image/jpeg', dataUrl, sha256: hash },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      await api.submitCheckIn(id, {
        condition,
        accessories,
        notes,
        acknowledgedRules,
        photos,
      });
      showToast(
        'success',
        'Check-in recorded in Trust Ledger',
        'Initial condition report and SHA-256 photo evidence hashes have been chained.'
      );
      navigate(`/bookings/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking || !resource) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">{error || 'Loading check-in form...'}</div>;
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
          Check in & initial condition report
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          {resource.name} · {formatTimeRange(booking.start, booking.end)}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-5"
      >
        {resource.supervision !== 'NONE' && (
          <div className="p-3 rounded-[6px] bg-[var(--brand-subtle)] border border-[var(--brand-primary)]/30 text-xs text-[var(--brand-primary)]">
            <strong>Supervision rule ({resource.supervision.replace('_', ' ')}):</strong> Your check-in report is recorded immediately; staff can co-sign handover in the Handover workspace.
          </div>
        )}

        {/* 1. Initial Condition Selector */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
            1. Observed initial condition prior to use
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['EXCELLENT', 'GOOD', 'MINOR_WEAR', 'NEEDS_ATTENTION'] as ConditionLevel[]).map(
              (lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCondition(lvl)}
                  className={`py-2.5 px-3 text-xs font-medium rounded-[6px] border text-center cursor-pointer min-h-[44px] ${
                    condition === lvl
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

        {/* 2. Included Accessories Checklist */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
            2. Verify included accessories ({accessories.filter((a) => a.present).length}/
            {accessories.length} present)
          </label>
          <div className="space-y-2">
            {accessories.map((acc, idx) => (
              <label
                key={acc.name}
                className="flex items-center justify-between p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs cursor-pointer min-h-[44px]"
              >
                <span className="text-[var(--text-primary)] font-medium">{acc.name}</span>
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
              </label>
            ))}
          </div>
        </div>

        {/* 3. Notes */}
        <div>
          <label
            htmlFor="checkin-notes"
            className="block text-xs font-semibold text-[var(--text-primary)] mb-1"
          >
            3. Pre-use condition notes
          </label>
          <textarea
            id="checkin-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            placeholder="Note any pre-existing wear, calibration state, or missing caps..."
          />
        </div>

        {/* 4. Evidence Capture (bound by SHA-256) */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              4. Condition photo evidence ({photos.length}/4 · SHA-256 bound to ledger)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSampleEvidencePhoto}
                disabled={photos.length >= 4}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Capture bench photo</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <span>Upload file</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {photos.map((ph, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-1.5"
                >
                  <img
                    src={ph.dataUrl}
                    alt={ph.fileName}
                    referrerPolicy="no-referrer"
                    className="w-full h-28 object-cover rounded-[4px]"
                  />
                  <div className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                    {ph.fileName}
                  </div>
                  <div className="text-[10px] font-mono-tech text-[var(--status-success)] truncate">
                    SHA-256: {ph.sha256}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Acknowledge Rules */}
        <label className="flex items-start gap-2.5 p-3 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledgedRules}
            onChange={(e) => setAcknowledgedRules(e.target.checked)}
            className="mt-0.5 w-4 h-4"
          />
          <span>
            I confirm this initial condition record is accurate and I will operate the resource in accordance with{' '}
            <strong>{resource.usageRules}</strong>
          </span>
        </label>

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
            {submitting ? 'Recording check-in...' : 'Confirm check-in & record to ledger'}
          </button>
        </div>
      </form>
    </div>
  );
};
