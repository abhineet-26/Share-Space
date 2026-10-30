import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Mail, MapPin, ExternalLink, Settings, Building2 } from 'lucide-react';
import { contactConfig } from '../lib/contactConfig';
import { consentManager } from '../lib/consentManager';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="no-print mt-auto bg-[var(--bg-surface)] border-t border-[var(--border-color)] text-[var(--text-secondary)] text-xs select-none">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand & Institutional Mission */}
          <div className="space-y-3">
            <Link
              to="/"
              className="text-base font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2"
            >
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--brand-primary)] inline-block" />
              <span>SHARESPACE</span>
            </Link>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Institutional Resource Accountability Platform. Policy-governed equipment discovery,
              eligibility verification, handover audits, and tamper-evident SHA-256 ledger chaining for research labs and makerspaces.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono-tech text-[var(--brand-primary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--status-success)] inline-block animate-pulse" />
              <span>RLS Tenant Isolation Active</span>
            </div>
          </div>

          {/* Column 2: Platform & Evaluation Workflows */}
          <div className="space-y-3">
            <div className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
              Platform & Demos
            </div>
            <ul className="space-y-2">
              <li>
                <Link to="/login" className="hover:text-[var(--text-primary)] transition-colors">
                  Explore Demo Personas
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[var(--text-primary)] transition-colors">
                  Architecture & Trust Honesty
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[var(--text-primary)] transition-colors">
                  Request Institutional Pilot
                </Link>
              </li>
              <li>
                <a
                  href="https://sharespace-backend-noab.onrender.com/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                >
                  <span>OpenAPI Swagger Specification</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://sharespace-backend-noab.onrender.com/redoc"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                >
                  <span>ReDoc API Documentation</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Governance, Privacy & Compliance */}
          <div className="space-y-3">
            <div className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
              Trust & Legal
            </div>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="hover:text-[var(--text-primary)] transition-colors">
                  Privacy Policy & Data Processing
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[var(--text-primary)] transition-colors">
                  Terms of Service & Account Rules
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => consentManager.openSettings()}
                  className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors cursor-pointer text-left"
                >
                  <Settings className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>Cookie & Consent Settings</span>
                </button>
              </li>
              <li>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Zero Automated Penalties on Incidents
                </span>
              </li>
              <li>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Cryptographic Ledger Append Only
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Institutional Contact Details */}
          <div className="space-y-3">
            <div className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
              <span>Host Institution</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
              <div className="font-medium text-[var(--text-primary)]">
                {contactConfig.organizationName}
              </div>
              <div>{contactConfig.departmentName}</div>
              <div className="flex items-start gap-1.5 pt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--text-muted)]" />
                <span>{contactConfig.postalAddress}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <Mail className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                <a
                  href={`mailto:${contactConfig.supportEmail}`}
                  className="text-[var(--brand-primary)] hover:underline"
                >
                  {contactConfig.supportEmail}
                </a>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] pt-1">
                Central Desk Hours: {contactConfig.officeHours}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Institutional Notice */}
        <div className="pt-6 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
          <div>
            © {new Date().getFullYear()} {contactConfig.organizationName}. Built on SHARESPACE open accountability framework.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            <span>·</span>
            <Link to="/terms" className="hover:underline">
              Terms
            </Link>
            <span>·</span>
            <Link to="/contact" className="hover:underline">
              Contact
            </Link>
            <span>·</span>
            <button
              type="button"
              onClick={() => consentManager.openSettings()}
              className="hover:underline cursor-pointer"
            >
              Cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
