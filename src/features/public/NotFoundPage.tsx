import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Search, Compass, ShieldAlert } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { SeoMeta } from '../../components/SeoMeta';

export const NotFoundPage: React.FC = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <SeoMeta
        title="Page Not Found (404) | SHARESPACE"
        description="The requested page or resource could not be found on SHARESPACE. Return to the homepage or explore available equipment in the catalog."
        robots="noindex, follow"
      />

      <div className="max-w-lg w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] p-8 shadow-xl text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-[var(--bg-secondary)] text-[var(--brand-primary)] mx-auto flex items-center justify-center">
          <Compass className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono-tech uppercase tracking-wider text-[var(--brand-primary)] font-semibold">
            HTTP 404 — Routing Error
          </span>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
            Page Not Found
          </h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            The screen, resource record, or operational workflow you requested does not exist
            or has been relocated.
          </p>
        </div>

        <div className="p-3.5 rounded-[8px] bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] text-xs text-[var(--text-secondary)] text-left space-y-1">
          <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Frontend vs API Diagnostic Notice</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            If you were seeking programmatic backend endpoints or health probes, please query{' '}
            <code className="font-mono-tech text-[var(--text-primary)]">/healthz</code>,{' '}
            <code className="font-mono-tech text-[var(--text-primary)]">/readyz</code>, or{' '}
            <code className="font-mono-tech text-[var(--text-primary)]">/docs</code> directly on the API server.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>

          {user ? (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return to Dashboard</span>
            </Link>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Go to Homepage</span>
            </Link>
          )}

          <Link
            to={user ? '/discover' : '/login'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{user ? 'Browse Equipment' : 'Open Demo Personas'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
