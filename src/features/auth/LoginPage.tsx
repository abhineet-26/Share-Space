import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, CheckCircle2, ArrowRight, ShieldCheck, RotateCcw } from 'lucide-react';
import { useApp } from '../../app/AppContext';

export const LoginPage: React.FC = () => {
  const { user, allDemoUsers, switchUser, resetDemoData } = useApp();
  const navigate = useNavigate();

  const orgAUsers = allDemoUsers.filter((u) => u.organizationId === 'org_nit');
  const orgBUsers = allDemoUsers.filter((u) => u.organizationId === 'org_harbour');

  const handleSelectPersona = async (userId: string, redirectPath = '/') => {
    await switchUser(userId);
    navigate(redirectPath);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-mono-tech text-[var(--text-secondary)]">
            DEMO AUTHENTICATION MODE · LOCAL DETERMINISTIC ENGINE
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
            Select a fictional demo account
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-3xl">
            SHARESPACE enforces role-based access control and PostgreSQL row-level security (RLS) tenant boundaries on every API call. Switch accounts below to inspect the platform as a student, heavy user, resource owner, lab technician, or administrator.
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetDemoData()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] self-start cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset seeded demo data</span>
        </button>
      </div>

      {/* Organisation A: Nilgiri Institute of Technology */}
      <section aria-labelledby="org-a-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--brand-primary)]" />
            <h2 id="org-a-heading" className="text-lg font-semibold text-[var(--text-primary)]">
              Organisation A — Nilgiri Institute of Technology (Primary Demo)
            </h2>
          </div>
          <span className="text-xs font-mono-tech text-[var(--text-secondary)]">
            Tenant ID: org_nit · 10 Resources
          </span>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/60 text-xs font-semibold text-[var(--text-secondary)]">
                <th className="py-3 px-4">Account & Identity</th>
                <th className="py-3 px-4">Assigned Roles</th>
                <th className="py-3 px-4 hidden md:table-cell">Seeded Demo Scenario & Training State</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] text-sm">
              {orgAUsers.map((u) => {
                const isCurrent = user?.id === u.id;
                return (
                  <tr
                    key={u.id}
                    className={isCurrent ? 'bg-[var(--brand-subtle)]/50' : 'hover:bg-[var(--bg-secondary)]/40'}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span>{u.name}</span>
                        {isCurrent && (
                          <span className="text-[11px] font-mono-tech text-[var(--brand-primary)]">
                            [Active]
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {u.email} · {u.department}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tech text-xs text-[var(--text-primary)]">
                      {u.roles.join(', ')}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)] hidden md:table-cell">
                      {u.demoPersonaNote}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSelectPersona(u.id, '/')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[var(--bg-surface)] border border-[var(--brand-primary)] text-[var(--brand-primary)]'
                            : 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]'
                        }`}
                      >
                        <span>{isCurrent ? 'Continue as ' + u.name.split(' ')[0] : 'Sign in'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Organisation B: Harbour Community Makerspace */}
      <section aria-labelledby="org-b-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--brand-primary)]" />
            <h2 id="org-b-heading" className="text-lg font-semibold text-[var(--text-primary)]">
              Organisation B — Harbour Community Makerspace (Tenant Isolation Proof)
            </h2>
          </div>
          <span className="text-xs font-mono-tech text-[var(--text-secondary)]">
            Tenant ID: org_harbour · 2 Resources
          </span>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {orgBUsers.map((u) => (
            <React.Fragment key={u.id}>
              <div>
                <div className="font-semibold text-sm text-[var(--text-primary)]">
                  {u.name} · <span className="font-mono-tech text-xs">{u.roles.join(', ')}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {u.email} — {u.demoPersonaNote}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSelectPersona(u.id, '/')}
                className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] shrink-0 cursor-pointer"
              >
                Switch to Organisation B ({u.name})
              </button>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Guided 11-Step Judge Journey Quick-Launch Strip */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Reproducible 11-step evaluation journey shortcuts
          </h2>
          <Link to="/about" className="text-xs text-[var(--brand-primary)] hover:underline">
            View implementation status & API contract →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <button
            type="button"
            onClick={() => handleSelectPersona('usr_diya', '/resources/res_3dprinter')}
            className="text-left p-3 rounded-[6px] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <div className="font-semibold text-[var(--text-primary)]">1. Diya → 3D Printer (Blocked)</div>
            <div className="text-[var(--text-secondary)] mt-0.5">
              Inspect missing AM-201 safety training check and remediation step.
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPersona('usr_aarav', '/resources/res_oscilloscope/request')}
            className="text-left p-3 rounded-[6px] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <div className="font-semibold text-[var(--text-primary)]">2. Aarav → Request Oscilloscope</div>
            <div className="text-[var(--text-secondary)] mt-0.5">
              See all eligibility checks PASS with applied policy version IDs.
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPersona('usr_ravi', '/review')}
            className="text-left p-3 rounded-[6px] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <div className="font-semibold text-[var(--text-primary)]">3. Ravi (Manager) → Review Queue</div>
            <div className="text-[var(--text-secondary)] mt-0.5">
              Compare competing Camera Kit requests, priority factors, and approve with reason.
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPersona('usr_aarav', '/bookings/bkg_approved_aarav/check-in')}
            className="text-left p-3 rounded-[6px] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <div className="font-semibold text-[var(--text-primary)]">4 & 5. Aarav → Check-in & Return</div>
            <div className="text-[var(--text-secondary)] mt-0.5">
              Record initial condition, accessories checklist, and evidence photo SHA-256.
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPersona('usr_priya', '/admin/policies')}
            className="text-left p-3 rounded-[6px] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <div className="font-semibold text-[var(--text-primary)]">6 & 8. Priya (Admin) → Live Policy Cap</div>
            <div className="text-[var(--text-secondary)] mt-0.5">
              Preview changing 3D Printer cap from 6h to 2h against Kabir Shah and activate live.
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPersona('usr_ravi', '/incidents/inc_open_01')}
            className="text-left p-3 rounded-[6px] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <div className="font-semibold text-[var(--text-primary)]">9 & 10. Incident Review & Ledger</div>
            <div className="text-[var(--text-secondary)] mt-0.5">
              Review Diya’s reported allegation on Multimeter lead and verify the SHA-256 ledger.
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
