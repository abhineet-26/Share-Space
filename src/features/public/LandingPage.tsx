import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Layers,
  Lock,
  CalendarClock,
  ScanLine,
  Search,
  Sparkles,
  Building2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { SeoMeta } from '../../components/SeoMeta';
import { StickyMobileCta } from '../../components/StickyMobileCta';
import { analytics } from '../../lib/analytics';

export const LandingPage: React.FC = () => {
  const handleCtaClick = (ctaName: string) => {
    analytics.track({
      eventName: 'cta_click',
      properties: { cta: ctaName },
    });
  };

  const sampleEquipment = [
    {
      id: 'res_scope',
      name: 'Keysight DSOX1204G Digital Oscilloscope',
      category: 'ELECTRONICS',
      dept: 'Electrical Engineering',
      location: 'EE Bench 4',
      badge: 'No Training Required',
      supervision: 'Self-Service',
      features: ['4-Channel 70 MHz', 'Waveform Generator', 'Probes Included'],
    },
    {
      id: 'res_3dprint',
      name: 'UltiMaker S5 Dual-Extrusion 3D Printer',
      category: 'WORKSHOP',
      dept: 'Innovation Makerspace',
      location: 'Maker Lab Bay 2',
      badge: 'AM-201 Safety Required',
      supervision: 'Staff Handover',
      features: ['Dual Extruder', 'PLA & PETG Certified', 'Heated Glass Bed'],
    },
    {
      id: 'res_camera',
      name: 'Sony FX3 Cinema Camera Kit',
      category: 'MEDIA_COMPUTING',
      dept: 'Media Studio Storage A',
      location: 'Media Cage',
      badge: 'Manager Review Required',
      supervision: 'Staff Handover',
      features: ['Full-Frame 4K 120p', '24-70mm f/2.8 GM Lens', 'Audio Handle'],
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      <SeoMeta
        title="SHARESPACE — Institutional Resource Accountability Platform"
        description="One platform. Every institutional resource. Complete accountability. Discover, request, and track spaces and equipment with transparent policies, digital handovers, and tamper-evident Trust Ledger."
        canonicalPath="/"
        robots="index, follow"
      />

      {/* Hero Section — Strong Above-The-Fold Value Proposition */}
      <section
        aria-labelledby="hero-heading"
        className="relative pt-6 sm:pt-10 pb-8 text-center sm:text-left max-w-5xl mx-auto"
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="flex-1 space-y-6 max-w-2xl">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
              <span className="font-medium text-[var(--text-primary)]">SHARESPACE</span>
              <span aria-hidden="true">·</span>
              <span>Institutional Resource Accountability</span>
            </div>

            {/* Headline Direction */}
            <h1
              id="hero-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.15]"
            >
              One platform.{' '}
              <span className="text-[var(--brand-primary)]">Every institutional resource.</span>{' '}
              Complete accountability.
            </h1>

            {/* Tagline & Supporting Copy */}
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-xl">
              Discover, request, manage, and track institutional spaces and equipment with
              transparent policies, accountable handovers, and tamper-evident cryptographic records.
            </p>

            {/* Primary & Secondary Call to Actions */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
              <Link
                to="/login"
                onClick={() => handleCtaClick('hero_explore_demo')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] shadow-md transition-all cursor-pointer"
              >
                <span>Explore Live Demo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/about"
                onClick={() => handleCtaClick('hero_how_it_works')}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
              >
                <span>How It Works</span>
              </Link>

              <Link
                to="/contact"
                onClick={() => handleCtaClick('hero_request_pilot')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 text-xs font-medium rounded-[8px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span>Request Campus Pilot →</span>
              </Link>
            </div>

            {/* Trust Anchors */}
            <div className="pt-4 flex flex-wrap items-center justify-center sm:justify-start gap-5 text-xs text-[var(--text-muted)] font-mono-tech">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                <span>Deterministic Policy Engine</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[var(--brand-primary)]" />
                <span>SHA-256 Ledger Chaining</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[var(--accent-attention)]" />
                <span>RLS Tenant Isolated</span>
              </div>
            </div>
          </div>

          {/* Right Product Graphic Mockup */}
          <div className="w-full lg:w-[420px] shrink-0">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--status-success)]" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Live Booking Verification
                  </span>
                </div>
                <span className="text-[11px] font-mono-tech text-[var(--brand-primary)]">
                  bkg_aarav_scope_approved
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Resource:</span>
                  <span className="font-semibold text-[var(--text-primary)]">Keysight DSOX1204G</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Borrower:</span>
                  <span className="font-medium text-[var(--text-primary)]">Aarav Patel (EE Student)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Handover Condition:</span>
                  <span className="font-medium text-[var(--status-success)]">EXCELLENT (4 Probes)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Policy Applied:</span>
                  <span className="font-mono-tech text-[var(--text-primary)]">pol_nit_elec_general [v1]</span>
                </div>
              </div>

              <div className="p-3 rounded-[6px] bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono-tech">
                  <span className="text-[var(--brand-primary)] font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Cryptographic Audit Proof</span>
                  </span>
                  <span className="text-[var(--status-success)] font-bold">VERIFIED</span>
                </div>
                <div className="text-[10px] font-mono-tech text-[var(--text-muted)] truncate">
                  SHA-256: 7f8a9e1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f
                </div>
              </div>

              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-[6px] bg-[var(--brand-subtle)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white transition-colors"
              >
                <span>Launch Interactive Walkthrough</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Core Differentiating Capabilities */}
      <section aria-labelledby="capabilities-heading" className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2
            id="capabilities-heading"
            className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]"
          >
            Built for Academic Rigor and Research Facilities
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Traditional booking calendars lack policy controls and handover accountability.
            SHARESPACE turns equipment sharing into an auditable institutional asset platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[10px] p-5 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--brand-subtle)] text-[var(--brand-primary)] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Deterministic Policy Enforcement
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Rules are evaluated at query time: safety certifications, department quota caps,
              fairness hours, and maintenance blackout intervals with zero ambiguous human favoritism.
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[10px] p-5 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--brand-subtle)] text-[var(--brand-primary)] flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Accountable Handover & Return
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Physical asset QR tokens confirm check-out condition. Returns log accessory checklists,
              evidence photos with SHA-256 integrity, and optional staff dual-signoff.
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[10px] p-5 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--brand-subtle)] text-[var(--brand-primary)] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Tamper-Evident Trust Ledger
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Every booking decision, check-in report, and incident note links to the previous event hash.
              Any direct database update breaks the sequence and is instantly flagged in audits.
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[10px] p-5 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--brand-subtle)] text-[var(--brand-primary)] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Multi-Tenant Row-Level Security
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Enforced directly in PostgreSQL via `tenant_id` session contexts. Institution A records
              are completely invisible to Institution B at the database connection layer.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Catalog Preview */}
      <section aria-labelledby="catalog-preview-heading" className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 id="catalog-preview-heading" className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Featured Shared Resources
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Sample equipment from the Nilgiri Institute of Technology live tenant catalog.
            </p>
          </div>
          <Link
            to="/login"
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
          >
            <span>View Full 10-Resource Catalog in Demo →</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {sampleEquipment.map((eq) => (
            <div
              key={eq.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[10px] p-5 space-y-4 flex flex-col justify-between shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono-tech text-[var(--brand-primary)] font-semibold">
                    {eq.category}
                  </span>
                  <span className="text-[11px] font-medium text-[var(--text-muted)]">{eq.supervision}</span>
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">{eq.name}</h3>
                <div className="text-xs text-[var(--text-secondary)]">
                  {eq.dept} · {eq.location}
                </div>
                <div className="pt-2">
                  <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                    {eq.badge}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-[var(--border-color)]">
                <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                  {eq.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <span>Test Request Workflow</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Institutional Pilot Callout */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] p-8 text-center sm:text-left shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Interested in Deploying SHARESPACE for Your Institution?
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              We work with university engineering departments, national research centres, and makerspaces
              to set up automated equipment policies, QR labeling, and tenant-isolated operations.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              to="/contact"
              onClick={() => handleCtaClick('callout_contact_pilot')}
              className="px-5 py-2.5 text-xs font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors text-center cursor-pointer shadow-xs"
            >
              Submit Pilot Inquiry
            </Link>
            <Link
              to="/about"
              className="px-4 py-2.5 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-center"
            >
              Read Architecture Spec
            </Link>
          </div>
        </div>
      </section>

      {/* Sticky Mobile Call to Action */}
      <StickyMobileCta />
    </div>
  );
};
