import React from 'react';
import { ShieldCheck, Lock, FileText, Database, Key, Eye, HelpCircle } from 'lucide-react';
import { SeoMeta } from '../../components/SeoMeta';
import { contactConfig } from '../../lib/contactConfig';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <SeoMeta
        title="Privacy Policy | SHARESPACE"
        description="Comprehensive privacy policy explaining how SHARESPACE collects, stores, processes, and protects institutional user data, equipment records, and Trust Ledger audit events."
        canonicalPath="/privacy"
        robots="index, follow"
      />

      <div className="border-b border-[var(--border-color)] pb-6 space-y-2">
        <span className="text-xs font-mono-tech text-[var(--brand-primary)] uppercase tracking-wider font-semibold">
          Data Governance & Privacy Transparency
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          SHARESPACE Privacy Policy
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Effective Date: October 30, 2026 · Version 1.0.0
        </p>
      </div>

      {/* Legal Review Warning Callout */}
      <div className="p-4 rounded-[8px] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 text-xs text-[var(--status-warning)] space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>Notice on Institutional Review & Governance</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          This document describes the actual data processing mechanisms, database row-level security boundaries,
          and cryptographic ledger practices implemented in the SHARESPACE software codebase. Prior to live deployment
          at your institution, this policy must be reviewed and aligned with your university or research center's official
          statutory data protection counsel (e.g., GDPR, DPDP Act, FERPA, or local institutional guidelines).
        </p>
      </div>

      <div className="space-y-8 text-xs text-[var(--text-secondary)] leading-relaxed">
        {/* Section 1: Overview & Scope */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">1. Scope of This Policy</h2>
          <p>
            SHARESPACE ("the Platform") is an institutional resource accountability system engineered for universities,
            research institutions, makerspaces, and shared laboratories. This Privacy Policy explains how information is
            collected, stored, isolated, and audited when students, researchers, faculty, and administrators access equipment
            and workspaces through the platform.
          </p>
        </section>

        {/* Section 2: Data Collected & Processing Purposes */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-[var(--text-primary)]">2. Information We Collect and Process</h2>
          <p>
            SHARESPACE operates on a principle of data minimization, collecting only operational data strictly required
            to enforce safety policies, verify eligibility, track physical handovers, and maintain institutional accountability:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1.5">
              <h3 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                <Key className="w-4 h-4 text-[var(--brand-primary)]" />
                <span>Identity & Access Context</span>
              </h3>
              <p className="text-[11px]">
                Name, institutional email address, department code, assigned roles (USER, OWNER, MANAGER, ADMIN),
                and active session tokens. Used solely for identity verification and multi-tenant authorization.
              </p>
            </div>

            <div className="p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1.5">
              <h3 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[var(--brand-primary)]" />
                <span>Qualifications & Training Records</span>
              </h3>
              <p className="text-[11px]">
                Safety induction badges and equipment certificates (e.g. ELEC_SAFETY_101, 3D_PRINTER_CERT) and expiration dates.
                Required to determine deterministic booking eligibility before equipment use.
              </p>
            </div>

            <div className="p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1.5">
              <h3 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[var(--brand-primary)]" />
                <span>Booking & Handover Records</span>
              </h3>
              <p className="text-[11px]">
                Requested reservation intervals, project purpose notes, applied policy rule versions,
                manager review reasons, check-in condition reports, accessories checklists, and photographic evidence SHA-256 hashes.
              </p>
            </div>

            <div className="p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1.5">
              <h3 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[var(--brand-primary)]" />
                <span>Cryptographic Trust Ledger Logs</span>
              </h3>
              <p className="text-[11px]">
                Sequence numbers, actor IDs, event actions, entity references, and SHA-256 hash chains.
                Maintained as an immutable audit record to prevent silent administrative tampering.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Row-Level Security Tenant Isolation */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">3. Database Row-Level Security (RLS) Isolation</h2>
          <p>
            SHARESPACE enforces tenant isolation directly inside the PostgreSQL database engine via Row-Level Security (RLS).
            Every query executed on behalf of an authenticated actor sets an ambient session parameter{' '}
            <code className="font-mono-tech text-[var(--text-primary)]">app.current_tenant_id</code>.
            Records belonging to Institution A cannot be read, queried, updated, or deleted by users from Institution B,
            even in the event of an application logic bug or query injection.
          </p>
        </section>

        {/* Section 4: Incident Reports & Zero Automated Penalty */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">4. Incident Allegations & Fairness Protections</h2>
          <p>
            When equipment is returned damaged or overdue, condition reports allow logging an incident. In accordance with
            SHARESPACE core architecture, <strong>zero automated financial penalties or access bans are levied algorithmically</strong>.
            All incident records remain pending human review by designated institutional managers to protect students and staff
            from unfair automated blacklisting.
          </p>
        </section>

        {/* Section 5: Cookies & Storage */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">5. Cookies and Local Storage</h2>
          <p>
            We use strictly necessary session cookies and localStorage tokens for authentication and tenant context.
            Optional anonymous usage analytics may be enabled only with your explicit consent via our Cookie Preferences modal.
            We do not sell data, deploy commercial advertising networks, or utilize cross-site tracking pixels.
          </p>
        </section>

        {/* Section 6: Data Retention & User Rights */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">6. Data Retention and Deletion Rights</h2>
          <p>
            Operational booking and condition records are retained according to host institutional facilities policies
            (typically for the duration of the academic semester or calendar year). Users may request access to their personal
            booking history, training credentials, and condition reports by contacting their campus facilities administrator.
          </p>
        </section>

        {/* Section 7: Contact Information */}
        <section className="space-y-2 pt-2 border-t border-[var(--border-color)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">7. Institutional Contact for Privacy Inquiries</h2>
          <p>
            For privacy questions, access requests, or security audit notifications concerning this deployment, please contact:
          </p>
          <div className="p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1">
            <div className="font-semibold text-[var(--text-primary)]">{contactConfig.organizationName}</div>
            <div>{contactConfig.departmentName}</div>
            <div>Email: <a href={`mailto:${contactConfig.securityEmail}`} className="text-[var(--brand-primary)] hover:underline">{contactConfig.securityEmail}</a></div>
            <div>Address: {contactConfig.postalAddress}</div>
          </div>
        </section>
      </div>
    </div>
  );
};
