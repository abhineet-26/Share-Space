import React from 'react';
import { ShieldCheck, BookOpen, Clock, AlertTriangle, CheckSquare, HelpCircle } from 'lucide-react';
import { SeoMeta } from '../../components/SeoMeta';
import { contactConfig } from '../../lib/contactConfig';

export const TermsOfServicePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <SeoMeta
        title="Terms of Service | SHARESPACE"
        description="Operational terms of service governing institutional resource discovery, eligibility verification, handover inspections, and Trust Ledger accountability."
        canonicalPath="/terms"
        robots="index, follow"
      />

      <div className="border-b border-[var(--border-color)] pb-6 space-y-2">
        <span className="text-xs font-mono-tech text-[var(--brand-primary)] uppercase tracking-wider font-semibold">
          Institutional Governance & User Agreement
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          SHARESPACE Terms of Service
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Effective Date: October 30, 2026 · Version 1.0.0
        </p>
      </div>

      {/* Institutional Legal Disclaimer */}
      <div className="p-4 rounded-[8px] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 text-xs text-[var(--status-warning)] space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>Notice on Institutional Adoption & Local Rules</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          These Terms of Service govern operational interactions with shared institutional equipment and spaces
          managed by SHARESPACE. Individual universities, research laboratories, and makerspaces may adopt supplementary
          safety bylaws, local lab manuals, and departmental regulations which take precedence in physical facilities.
        </p>
      </div>

      <div className="space-y-8 text-xs text-[var(--text-secondary)] leading-relaxed">
        {/* Section 1: Acceptance & Accounts */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">1. Acceptance & Authorized Access</h2>
          <p>
            By accessing or requesting resources through SHARESPACE, you agree to comply with these Terms of Service.
            Access is restricted to authorized students, researchers, faculty, and administrative staff members of
            participating tenant institutions. Users must maintain the security of their institutional credentials.
          </p>
        </section>

        {/* Section 2: Policy-Driven Eligibility */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-[var(--text-primary)]">2. Deterministic Eligibility & Policies</h2>
          <p>
            Resource availability and reservation requests are governed by institutional policy rules encoded into the system:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[11px]">
            <li>
              <strong>Mandatory Safety Certifications:</strong> Equipment marked as requiring specialized training
              (such as laser cutters, high-voltage equipment, and 3D printers) will reject requests unless verified training records exist.
            </li>
            <li>
              <strong>Fairness & Quota Caps:</strong> Rolling weekly hour limits prevent resource monopolization and promote equitable access across departments.
            </li>
            <li>
              <strong>Maintenance Blackouts:</strong> Scheduled equipment service windows automatically block reservation slots.
            </li>
          </ul>
        </section>

        {/* Section 3: Handover & Inspection Responsibilities */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-[var(--text-primary)]">3. Handover and Physical Return Responsibilities</h2>
          <p>
            To prevent disputes over pre-existing damage, users must adhere to the digital check-in and return workflow:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[11px]">
            <li>
              <strong>Check-In Verification:</strong> Borrowers must scan the physical asset QR token at handover and verify
              accessories and initial condition.
            </li>
            <li>
              <strong>Timely Return:</strong> Equipment must be returned to its designated location before the scheduled booking interval concludes.
            </li>
            <li>
              <strong>Supervised Dual-Signoff:</strong> High-value assets with staff supervision require confirmation by a lab manager
              before the booking is officially marked closed.
            </li>
            <li>
              <strong>Condition Integrity:</strong> If damage occurs during use, borrowers are required to honestly record condition notes and photo hashes upon return.
            </li>
          </ul>
        </section>

        {/* Section 4: Incident Review & No Automated Penalties */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">4. Incident Allegations and Human Review</h2>
          <p>
            Incident reports logged through the system are classified as allegations until investigated by designated lab managers.
            SHARESPACE enforces a strict policy of <strong>zero automated financial fines or algorithmic bans</strong>.
            Borrowers have the right to provide explanatory statements during review before any administrative action is taken.
          </p>
        </section>

        {/* Section 5: Trust Ledger Auditability */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">5. Cryptographic Trust Ledger Auditability</h2>
          <p>
            All critical lifecycle actions—including booking creations, cancellations, manager approvals, condition reports,
            and policy alterations—are appended to a cryptographic SHA-256 ledger. Neither users nor system administrators
            may tamper with historical records. Any retroactive database modification breaks the hash chain and triggers automated audit alerts.
          </p>
        </section>

        {/* Section 6: Limitation of Liability */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">6. Service Availability & Limitations</h2>
          <p>
            SHARESPACE is provided as institutional workflow infrastructure. The software does not guarantee physical equipment
            functionality or laboratory availability during unexpected facilities disruptions (e.g., power outages or physical lab closures).
            Users must follow all physical laboratory safety manuals and posted equipment operating procedures.
          </p>
        </section>

        {/* Section 7: Inquiries */}
        <section className="space-y-2 pt-2 border-t border-[var(--border-color)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">7. Institutional Administration</h2>
          <p>
            For questions regarding resource allocation rules, appeals against policy decisions, or facilities inquiries, contact:
          </p>
          <div className="p-3.5 rounded-[8px] bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1">
            <div className="font-semibold text-[var(--text-primary)]">{contactConfig.organizationName}</div>
            <div>{contactConfig.departmentName}</div>
            <div>Support Desk: <a href={`mailto:${contactConfig.supportEmail}`} className="text-[var(--brand-primary)] hover:underline">{contactConfig.supportEmail}</a></div>
            <div>Postal: {contactConfig.postalAddress}</div>
          </div>
        </section>
      </div>
    </div>
  );
};
