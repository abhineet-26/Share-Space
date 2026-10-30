import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, X, Check } from 'lucide-react';
import { consentManager, ConsentPreferences } from '../lib/consentManager';

export const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);

  useEffect(() => {
    const existing = consentManager.getPreferences();
    if (!existing) {
      // Show banner after brief delay so initial load is smooth
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleOpenSettings = () => {
      const existing = consentManager.getPreferences();
      setAnalyticsOptIn(existing?.analytics || false);
      setModalOpen(true);
    };

    window.addEventListener('sharespace:open_cookie_settings', handleOpenSettings);
    return () => {
      window.removeEventListener('sharespace:open_cookie_settings', handleOpenSettings);
    };
  }, []);

  const handleAcceptAll = () => {
    consentManager.acceptAll();
    setVisible(false);
    setModalOpen(false);
  };

  const handleRejectNonEssential = () => {
    consentManager.rejectNonEssential();
    setVisible(false);
    setModalOpen(false);
  };

  const handleSaveCustom = () => {
    consentManager.savePreferences({ analytics: analyticsOptIn });
    setVisible(false);
    setModalOpen(false);
  };

  if (!visible && !modalOpen) return null;

  return (
    <>
      {/* Bottom Sticky Banner for First-Time Visitors */}
      {visible && !modalOpen && (
        <aside
          role="region"
          aria-label="Privacy and cookie consent"
          className="fixed bottom-0 inset-x-0 z-50 p-4 bg-[var(--bg-surface)] border-t border-[var(--border-color)] shadow-2xl transition-all"
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-[8px] bg-[var(--brand-subtle)] text-[var(--brand-primary)] shrink-0 mt-0.5">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <span>Privacy & Institutional Data Governance</span>
                  <span className="text-[11px] font-mono-tech px-1.5 py-0.2 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                    Transparent Consent
                  </span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  SHARESPACE uses strictly necessary cookies to maintain tenant-isolated sessions and authentication.
                  Optional anonymous analytics help us understand resource utilization. We never deploy commercial marketing trackers
                  or share operational records with third parties.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={() => {
                  const existing = consentManager.getPreferences();
                  setAnalyticsOptIn(existing?.analytics || false);
                  setModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Customise
              </button>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-4 py-1.5 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors cursor-pointer"
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Modal Dialog for Granular Preferences Customisation */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[var(--brand-primary)]" />
                <h2 id="cookie-modal-title" className="text-base font-bold text-[var(--text-primary)]">
                  Cookie & Privacy Preferences
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                aria-label="Close preferences modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Manage how SHARESPACE stores data on your device. Changes take effect immediately and are saved to your browser session.
            </p>

            <div className="space-y-3.5">
              {/* Category 1: Strictly Necessary */}
              <div className="p-3.5 rounded-[8px] bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-2">
                    <span>Strictly Necessary (Always Active)</span>
                    <span className="text-[10px] font-mono-tech px-1.5 py-0.2 rounded bg-[var(--status-success-bg)] text-[var(--status-success)] font-medium">
                      Required
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] font-mono-tech">Enabled</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Essential for secure login, multi-tenant database row-level security (RLS), session restoration, and CSRF protection.
                  The application cannot function without these cookies.
                </p>
              </div>

              {/* Category 2: Anonymous Analytics */}
              <div className="p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="analytics-opt-in" className="font-semibold text-xs text-[var(--text-primary)] cursor-pointer">
                    Anonymous Usage Analytics
                  </label>
                  <input
                    id="analytics-opt-in"
                    type="checkbox"
                    checked={analyticsOptIn}
                    onChange={(e) => setAnalyticsOptIn(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--brand-primary)] accent-[var(--brand-primary)] cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Collects aggregated, non-sensitive page view counts and navigation clicks to help improve equipment discoverability.
                  No user identities, email addresses, or booking descriptions are ever recorded.
                </p>
              </div>

              {/* Category 3: Commercial Marketing (Inactive) */}
              <div className="p-3.5 rounded-[8px] bg-[var(--bg-secondary)]/30 border border-[var(--border-color)]/60 space-y-1.5 opacity-75">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[var(--text-muted)]">
                    Marketing & Third-Party Trackers
                  </span>
                  <span className="text-[10px] font-mono-tech px-1.5 py-0.2 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                    Not Used
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  SHARESPACE is strictly an institutional platform. We do not use third-party advertising or cross-site commercial profiling.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] text-xs">
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="px-3 py-1.5 rounded-[6px] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Reject Non-Essential
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="px-4 py-1.5 font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
