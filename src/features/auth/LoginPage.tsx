import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Building2, ArrowRight, ShieldCheck, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { useApp } from '../../app/AppContext';

export const LoginPage: React.FC = () => {
  const {
    user,
    allDemoUsers,
    demoPersonasEnabled,
    demoResetEnabled,
    demoPersonasLoading,
    demoPersonasError,
    loadDemoPersonas,
    switchUser,
    resetDemoData,
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [signingInUserId, setSigningInUserId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const fromState = (location.state as { from?: { pathname?: string; search?: string } })?.from;
  const fromTarget = fromState ? `${fromState.pathname || '/'}${fromState.search || ''}` : null;

  useEffect(() => {
    // If an existing session is valid, redirect already-authenticated visitor away from /login to dashboard or original target
    if (user && !signingInUserId && !location.search.includes('switch=true')) {
      navigate(fromTarget || '/', { replace: true });
    }
  }, [user, navigate, fromTarget, signingInUserId, location.search]);

  const orgAUsers = allDemoUsers.filter((u) => u.organizationId === 'org_nit');
  const orgBUsers = allDemoUsers.filter((u) => u.organizationId === 'org_harbour');

  const handleSelectPersona = async (userId: string, redirectPath = '/') => {
    try {
      setSigningInUserId(userId);
      setLoginError(null);
      await switchUser(userId);
      const destination = redirectPath === '/' && fromTarget ? fromTarget : redirectPath;
      navigate(destination, { replace: true });
    } catch (err: any) {
      setLoginError(err?.message || 'Failed to authenticate demo user. Please try again.');
    } finally {
      setSigningInUserId(null);
    }
  };

  const handleReset = async () => {
    try {
      setIsResetting(true);
      setLoginError(null);
      await resetDemoData();
    } catch (err: any) {
      setLoginError(err?.message || 'Could not reset demo database.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-mono-tech text-[var(--text-secondary)]">
            DEMO AUTHENTICATION MODE · INSTITUTIONAL IDENTITY FABRIC
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
            Select an institutional demo account
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-3xl">
            SHARESPACE enforces role-based access control and PostgreSQL row-level security (RLS) tenant boundaries on every API call. Switch accounts below to inspect the platform as a student, heavy user, resource owner, lab technician, or administrator.
          </p>
        </div>
        {demoResetEnabled && (
          <button
            type="button"
            disabled={isResetting}
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] self-start cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Resetting fixtures...' : 'Reset seeded demo data'}</span>
          </button>
        )}
      </div>

      {user && (
        <div className="p-4 rounded-[8px] bg-[var(--brand-subtle)] border border-[var(--brand-primary)]/30 flex items-center justify-between text-xs">
          <span>
            You are currently signed in as <strong>{user.name}</strong> ({user.roles.join(', ')}).
          </span>
          <Link to="/" className="font-medium text-[var(--brand-primary)] hover:underline">
            Return to Dashboard &rarr;
          </Link>
        </div>
      )}

      {/* Global Login or Bootstrap Error Banner */}
      {loginError && (
        <div className="p-4 rounded-[8px] bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">Authentication failure</div>
            <div className="text-xs mt-0.5">{loginError}</div>
          </div>
          <button
            type="button"
            onClick={() => setLoginError(null)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Demo Mode Disabled Banner */}
      {!demoPersonasLoading && !demoPersonasEnabled && (
        <div className="p-6 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-[var(--brand-subtle)] text-[var(--brand-primary)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Demo Mode Disabled</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Synthetic demo authentication is disabled in this environment. Production Single Sign-On (OIDC / SAML) is required to access institutional resources.
          </p>
        </div>
      )}

      {/* Personas Loading State */}
      {demoPersonasLoading && allDemoUsers.length === 0 && (
        <div className="p-8 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-center space-y-3">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[var(--brand-primary)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Loading institutional demo personas...
          </p>
        </div>
      )}

      {/* Personas Error State */}
      {demoPersonasError && allDemoUsers.length === 0 && (
        <div className="p-6 rounded-[8px] bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-center space-y-3">
          <AlertTriangle className="w-6 h-6 mx-auto" />
          <h3 className="text-sm font-semibold">Failed to fetch demo personas</h3>
          <p className="text-xs max-w-md mx-auto">{demoPersonasError}</p>
          <button
            type="button"
            onClick={() => loadDemoPersonas()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-hover)] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Organisation A: Nilgiri Institute of Technology */}
      {orgAUsers.length > 0 && (
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
                  const isSigningIn = signingInUserId === u.id;
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
                          disabled={isSigningIn}
                          onClick={() => handleSelectPersona(u.id, '/')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors cursor-pointer disabled:opacity-50 ${
                            isCurrent
                              ? 'bg-[var(--bg-surface)] border border-[var(--brand-primary)] text-[var(--brand-primary)]'
                              : 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]'
                          }`}
                        >
                          {isSigningIn ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Signing in...</span>
                            </>
                          ) : (
                            <>
                              <span>{isCurrent ? 'Continue as ' + u.name.split(' ')[0] : 'Sign in'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Organisation B: Harbour Community Makerspace */}
      {orgBUsers.length > 0 && (
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
            {orgBUsers.map((u) => {
              const isSigningIn = signingInUserId === u.id;
              return (
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
                    disabled={isSigningIn}
                    onClick={() => handleSelectPersona(u.id, '/')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isSigningIn ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Switching...</span>
                      </>
                    ) : (
                      <span>Switch to Organisation B ({u.name})</span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </section>
      )}

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
