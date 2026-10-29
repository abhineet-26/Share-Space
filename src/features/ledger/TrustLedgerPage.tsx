import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Download, Printer, Wrench } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { LedgerEvent, LedgerVerificationResult } from '../../lib/types';
import { downloadFile, formatDateTime } from '../../lib/utils';
import { ChainIntegrityBadge } from '../../components/Primitives';

export const TrustLedgerPage: React.FC = () => {
  const { user, organization, showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [verification, setVerification] = useState<LedgerVerificationResult | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('ALL');
  const [entityIdSearch, setEntityIdSearch] = useState<string>(searchParams.get('entity') || '');
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdminOrManager = Boolean(
    user?.roles.some((r) => ['ADMIN', 'MANAGER'].includes(r))
  );

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const [ledData, verData] = await Promise.all([
        api.getLedgerEvents({
          entityType: entityTypeFilter,
          entityId: entityIdSearch,
        }),
        api.verifyLedger(),
      ]);
      setEvents(ledData.events);
      setVerification(verData);
    } finally {
      setLoading(false);
    }
  }, [entityTypeFilter, entityIdSearch]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger, user]);

  const handleVerifyNow = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyLedger();
      setVerification(res);
      if (res.valid) {
        showToast(
          'success',
          'SHA-256 Chain Verified',
          `Recomputed ${res.checkedCount} events for ${organization?.name}; all hashes match.`
        );
      } else {
        showToast(
          'error',
          `Chain Tamper Detected at #${res.firstInvalidSeq}`,
          res.errorDetails
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    const res = await api.simulateTamper();
    const ver = await api.verifyLedger();
    setVerification(ver);
    await loadLedger();
    showToast(
      'error',
      `Simulated unauthorised edit at sequence #${res.tamperedSeq}`,
      'Notice how recomputing the SHA-256 chain immediately flags the exact sequence number.'
    );
  };

  const handleRepairChain = async () => {
    const ver = await api.repairLedger();
    setVerification(ver);
    await loadLedger();
    showToast('success', 'Demo ledger restored', 'Tampered event reverted and hash chain verified.');
  };

  const handleExportCsv = () => {
    const headers = ['seq', 'occurredAt', 'action', 'actorName', 'actorRole', 'entityType', 'entityId', 'reason', 'prevHash', 'hash'];
    const rows = events.map((e) =>
      [
        e.seq,
        e.occurredAt,
        e.action,
        `"${(e.actorName || '').replace(/"/g, '""')}"`,
        e.actorRole,
        e.entityType,
        e.entityId,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        e.prevHash,
        e.hash,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, `sharespace_ledger_${organization?.id || 'org'}.csv`, 'text/csv');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Trust Ledger — Tamper-evident audit history
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Every state change is chained to the previous event in {organization?.name} via SHA-256 (`prev_hash || canonical_json`). Events are append-only; corrections appear as new events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print view</span>
          </button>
        </div>
      </div>

      {/* Chain Integrity Verification Banner + Admin Demo Tamper Controls */}
      {verification && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <ChainIntegrityBadge
              valid={verification.valid}
              headSeq={verification.headSeq}
              verifiedAt={verification.verifiedAt}
              firstInvalidSeq={verification.firstInvalidSeq}
              onVerifyNow={handleVerifyNow}
              verifying={verifying}
            />
            {!verification.valid && (
              <p className="text-xs text-[var(--status-danger)] font-medium">
                Diagnostic: {verification.errorDetails}
              </p>
            )}
            <div className="text-[11px] font-mono-tech text-[var(--text-muted)] truncate max-w-2xl">
              Current Chain Head SHA-256: {verification.headHash}
            </div>
          </div>

          {isAdminOrManager && (
            <div className="no-print flex items-center gap-2 shrink-0">
              {verification.valid ? (
                <button
                  type="button"
                  onClick={handleSimulateTamper}
                  className="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--status-danger)]/40 text-[var(--status-danger)] bg-[var(--bg-surface)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
                >
                  Simulate tamper (Admin demo)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRepairChain}
                  className="px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] cursor-pointer"
                >
                  Restore valid chain
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="no-print bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="ledger-entity-type" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Entity type
          </label>
          <select
            id="ledger-entity-type"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
          >
            <option value="ALL">All entity types</option>
            <option value="BOOKING">Booking</option>
            <option value="CONDITION_REPORT">Condition report</option>
            <option value="INCIDENT">Incident</option>
            <option value="POLICY">Policy</option>
            <option value="RESOURCE">Resource</option>
            <option value="USER_ROLE">User role</option>
            <option value="TRAINING">Training</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="ledger-entity-id" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Filter by booking / resource / policy ID
          </label>
          <div className="flex gap-2">
            <input
              id="ledger-entity-id"
              type="text"
              value={entityIdSearch}
              onChange={(e) => {
                setEntityIdSearch(e.target.value);
                setSearchParams(e.target.value ? { entity: e.target.value } : {});
              }}
              placeholder="e.g., bkg_approved_aarav, res_oscilloscope, pol_3d_cap..."
              className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            />
            {entityIdSearch && (
              <button
                type="button"
                onClick={() => {
                  setEntityIdSearch('');
                  setSearchParams({});
                }}
                className="px-3 py-1.5 text-xs border border-[var(--border-color)] rounded-[6px] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Events Table */}
      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Loading ledger chain...</div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/60 text-xs font-semibold text-[var(--text-secondary)]">
                  <th className="py-3 px-4">Seq</th>
                  <th className="py-3 px-4">Timestamp (Local)</th>
                  <th className="py-3 px-4">Actor & Role</th>
                  <th className="py-3 px-4">Action & Target Entity</th>
                  <th className="py-3 px-4">Recorded Reason & Metadata</th>
                  <th className="py-3 px-4">SHA-256 Chain Fingerprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-xs">
                {events.map((ev) => {
                  const isBrokenSeq =
                    verification && !verification.valid && verification.firstInvalidSeq === ev.seq;
                  return (
                    <tr
                      key={ev.id}
                      className={
                        isBrokenSeq
                          ? 'bg-[var(--status-danger-bg)]'
                          : 'hover:bg-[var(--bg-secondary)]/30'
                      }
                    >
                      <td className="py-3.5 px-4 font-mono-tech font-bold text-[var(--text-primary)]">
                        #{ev.seq}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-[var(--text-secondary)] whitespace-nowrap">
                        {formatDateTime(ev.occurredAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text-primary)]">{ev.actorName}</div>
                        <div className="font-mono-tech text-[11px] text-[var(--text-secondary)]">
                          {ev.actorRole}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono-tech font-semibold text-[var(--brand-primary)]">
                          {ev.action}
                        </div>
                        <div className="font-mono-tech text-[11px] text-[var(--text-secondary)]">
                          {ev.entityType}: {ev.entityId}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-md space-y-1">
                        <div className="text-[var(--text-primary)]">{ev.reason || '—'}</div>
                        <div className="font-mono-tech text-[10px] text-[var(--text-muted)] truncate">
                          {JSON.stringify(ev.metadata)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono-tech text-[11px] text-[var(--text-secondary)]">
                        <div title={ev.hash}>hash: {ev.hash.slice(0, 16)}...</div>
                        <div className="text-[var(--text-muted)]" title={ev.prevHash}>
                          prev: {ev.prevHash.slice(0, 16)}...
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
