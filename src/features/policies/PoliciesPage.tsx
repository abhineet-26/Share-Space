import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sliders, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import {
  EligibilityEvaluationResult,
  Policy,
  PolicyVersion,
  Resource,
  User,
} from '../../lib/types';
import { formatDateTime } from '../../lib/utils';
import { StatusIndicator } from '../../components/Primitives';

export const PoliciesPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { user, allDemoUsers, showToast } = useApp();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>(id || 'pol_3d_cap');

  // Editor state for creating/activating a new policy version
  const [windowDays, setWindowDays] = useState<number>(7);
  const [maxHoursPerUser, setMaxHoursPerUser] = useState<number>(2);
  const [maxBookingDurationHours, setMaxBookingDurationHours] = useState<number>(4);
  const [plainSummary, setPlainSummary] = useState<string>(
    'Maximum 2 hours per user per rolling 7 days during peak capstone fabrication week.'
  );
  const [activationReason, setActivationReason] = useState<string>(
    'Tighten weekly 3D printer usage cap from 6h to 2h for mid-semester project sprint so more students can print.'
  );

  // Sample Preview State
  const [sampleUserId, setSampleUserId] = useState<string>('usr_kabir');
  const [sampleResourceId, setSampleResourceId] = useState<string>('res_3dprinter');
  const [sampleDurationHours, setSampleDurationHours] = useState<number>(1.5);
  const [previewResult, setPreviewResult] = useState<{
    beforeResult: EligibilityEvaluationResult;
    afterResult: EligibilityEvaluationResult;
    sampleUser: User;
    sampleResource: Resource;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPolicies = useCallback(async () => {
    const [polData, resList] = await Promise.all([api.getPolicies(), api.getResources()]);
    setPolicies(polData.policies);
    setVersions(polData.versions);
    setResources(resList);
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies, user]);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) || policies[0];
  const policyVersions = versions
    .filter((v) => v.policyId === selectedPolicy?.id)
    .sort((a, b) => b.version - a.version);

  const handleRunPreview = useCallback(async () => {
    if (!selectedPolicy) return;
    try {
      const res = await api.previewPolicyOutcome({
        policyId: selectedPolicy.id,
        draftDefinition: {
          windowDays,
          maxHoursPerUser,
          maxBookingDurationHours,
          appliesToRoles: ['USER'],
          plainSummary,
        },
        sampleUserId,
        sampleResourceId:
          selectedPolicy.scope.type === 'RESOURCE' && selectedPolicy.scope.id
            ? selectedPolicy.scope.id
            : sampleResourceId,
        sampleDurationHours,
      });
      setPreviewResult(res);
    } catch (err) {
      console.error(err);
    }
  }, [
    selectedPolicy,
    windowDays,
    maxHoursPerUser,
    maxBookingDurationHours,
    plainSummary,
    sampleUserId,
    sampleResourceId,
    sampleDurationHours,
  ]);

  useEffect(() => {
    if (selectedPolicy) {
      handleRunPreview();
    }
  }, [selectedPolicy, handleRunPreview]);

  const handleActivateNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    setSubmitting(true);
    try {
      const res = await api.createPolicyVersionAndActivate(selectedPolicy.id, {
        definition: {
          windowDays,
          maxHoursPerUser,
          maxBookingDurationHours,
          appliesToRoles: ['USER'],
          plainSummary,
        },
        reason: activationReason,
        activateImmediately: true,
      });
      showToast(
        'success',
        `Activated ${res.policy.id} v${res.version.version}`,
        'New requests now evaluate against this version; historical bookings retain their original policy version IDs.'
      );
      await loadPolicies();
      await handleRunPreview();
    } catch (err) {
      showToast('error', 'Failed to activate policy version', err instanceof Error ? err.message : '');
    } finally {
      setSubmitting(false);
    }
  };

  const orgUsers = allDemoUsers.filter((u) => u.organizationId === user?.organizationId);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Declarative policy engine & version governance
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Policies are versioned data, never hardcoded rules. Preview a draft policy version against a sample user before activating it. Past bookings retain the `policyVersionIds` they were decided under.
        </p>
      </div>

      {/* Policies Table */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-xs font-semibold text-[var(--text-secondary)]">
          Active institutional & resource policies ({policies.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
                <th className="py-2.5 px-4">Policy ID & Name</th>
                <th className="py-2.5 px-4">Scope</th>
                <th className="py-2.5 px-4">Kind</th>
                <th className="py-2.5 px-4">Active Version</th>
                <th className="py-2.5 px-4 text-right">Select</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] text-xs">
              {policies.map((pol) => {
                const isSelected = selectedPolicy?.id === pol.id;
                const activeVer = versions.find(
                  (v) => v.policyId === pol.id && v.version === pol.activeVersion
                );
                return (
                  <tr
                    key={pol.id}
                    className={
                      isSelected ? 'bg-[var(--brand-subtle)]/50' : 'hover:bg-[var(--bg-secondary)]/30'
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-sm text-[var(--text-primary)]">
                        {pol.name}
                      </div>
                      <div className="font-mono-tech text-[11px] text-[var(--text-secondary)]">
                        {pol.id} · {activeVer?.definition.plainSummary}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{pol.scope.label}</td>
                    <td className="py-3 px-4 font-mono-tech text-[var(--text-primary)]">
                      {pol.kind}
                    </td>
                    <td className="py-3 px-4 font-mono-tech font-semibold text-[var(--brand-primary)]">
                      v{pol.activeVersion || 1} ({pol.status})
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPolicyId(pol.id)}
                        className={`px-3 py-1.5 rounded-[6px] font-medium cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]'
                            : 'border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                        }`}
                      >
                        {isSelected ? 'Editing' : 'Configure & preview'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPolicy && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Create New Policy Version Form */}
          <form
            onSubmit={handleActivateNewVersion}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4"
          >
            <div className="border-b border-[var(--border-color)] pb-3">
              <div className="text-xs font-mono-tech text-[var(--text-secondary)]">
                DRAFT NEW VERSION FOR {selectedPolicy.id.toUpperCase()}
              </div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                {selectedPolicy.name} (Next: v{(selectedPolicy.activeVersion || 1) + 1})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-1">
                  Rolling window (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-1">
                  Max hours per user
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={40}
                  value={maxHoursPerUser}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaxHoursPerUser(val);
                    setPlainSummary(
                      `Maximum ${val} hours per user per rolling ${windowDays} days (max ${maxBookingDurationHours}h per session).`
                    );
                  }}
                  className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-1">
                  Max single session (hrs)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={12}
                  value={maxBookingDurationHours}
                  onChange={(e) => setMaxBookingDurationHours(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Plain-language policy summary (shown on resource pages)
              </label>
              <input
                type="text"
                value={plainSummary}
                onChange={(e) => setPlainSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Governance activation reason (recorded in Trust Ledger){' '}
                <span className="text-[var(--status-danger)]">*</span>
              </label>
              <textarea
                rows={2}
                value={activationReason}
                onChange={(e) => setActivationReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer"
            >
              {submitting
                ? 'Activating version...'
                : `Publish & activate v${(selectedPolicy.activeVersion || 1) + 1} now`}
            </button>

            {/* Version History */}
            <div className="pt-4 border-t border-[var(--border-color)] space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
                Version history ({policyVersions.length})
              </h3>
              {policyVersions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-2.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech font-semibold text-[var(--text-primary)]">
                      {ver.id} {selectedPolicy.activeVersion === ver.version ? '(ACTIVE)' : '(HISTORICAL)'}
                    </span>
                    <span className="text-[var(--text-muted)] tabular-nums">
                      Effective {formatDateTime(ver.effectiveFrom)}
                    </span>
                  </div>
                  <div className="text-[var(--text-secondary)]">{ver.definition.plainSummary}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Author: {ver.createdByName} — "{ver.reason}"
                  </div>
                </div>
              ))}
            </div>
          </form>

          {/* Right Column: Live Dry-Run Policy Preview Against Sample Request */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-4">
            <div className="border-b border-[var(--border-color)] pb-3">
              <div className="text-xs font-mono-tech text-[var(--brand-primary)]">
                DRY-RUN POLICY SIMULATOR (NO DATABASE MUTATION)
              </div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                Preview draft policy against a sample user & booking
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Sample user
                </label>
                <select
                  value={sampleUserId}
                  onChange={(e) => setSampleUserId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
                >
                  {orgUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.id === 'usr_kabir' ? '4.0h used on 3D Printer' : u.roles[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Sample requested duration
                </label>
                <select
                  value={sampleDurationHours}
                  onChange={(e) => setSampleDurationHours(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px]"
                >
                  <option value={1}>1.0 hour</option>
                  <option value={1.5}>1.5 hours</option>
                  <option value={2}>2.0 hours</option>
                  <option value={3}>3.0 hours</option>
                </select>
              </div>
            </div>

            {previewResult && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Current Active Policy Outcome */}
                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] space-y-2">
                    <div className="font-semibold text-[var(--text-secondary)]">
                      Current Active Policy (v{selectedPolicy.activeVersion || 1})
                    </div>
                    <StatusIndicator
                      kind="check"
                      value={previewResult.beforeResult.eligible ? 'PASS' : 'FAIL'}
                    />
                    <p className="text-[var(--text-secondary)]">
                      {
                        previewResult.beforeResult.checks.find((c) => c.key === 'usage_limit')
                          ?.reason
                      }
                    </p>
                  </div>

                  {/* Draft Policy Outcome */}
                  <div className="p-3.5 rounded-[6px] bg-[var(--brand-subtle)]/50 border border-[var(--brand-primary)]/40 space-y-2">
                    <div className="font-semibold text-[var(--text-primary)]">
                      Draft Policy Preview ({maxHoursPerUser}h cap)
                    </div>
                    <StatusIndicator
                      kind="check"
                      value={previewResult.afterResult.eligible ? 'PASS' : 'FAIL'}
                    />
                    <p className="text-[var(--text-primary)]">
                      {
                        previewResult.afterResult.checks.find((c) => c.key === 'usage_limit')
                          ?.reason
                      }
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)]">
                  <strong>Demo verification tip:</strong> Kabir Shah currently has{' '}
                  <strong className="tabular-nums">4.0h</strong> used on the 3D Printer in the last 7 days.
                  With the cap set to <strong>2h</strong> above, clicking "Publish & activate" immediately blocks Kabir’s next 3D Printer request while keeping his earlier booking (`bkg_3d_kabir_past`) bound to `pol_3d_cap_v1`.
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
