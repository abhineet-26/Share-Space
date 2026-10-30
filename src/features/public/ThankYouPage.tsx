import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Home, CalendarClock, Building2 } from 'lucide-react';
import { SeoMeta } from '../../components/SeoMeta';

interface LocationState {
  submittedName?: string;
  submittedEmail?: string;
  submittedInstitution?: string;
  inquiryType?: string;
}

export const ThankYouPage: React.FC = () => {
  const location = useLocation();
  const state = (location.state as LocationState) || {};

  return (
    <div className="min-h-[55vh] flex items-center justify-center py-10 px-4">
      <SeoMeta
        title="Inquiry Received | SHARESPACE"
        description="Thank you for contacting SHARESPACE. Your institutional pilot or technical inquiry has been recorded and our team will be in touch shortly."
        canonicalPath="/thank-you"
        robots="noindex, follow"
      />

      <div className="max-w-lg w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] p-8 shadow-xl text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono-tech uppercase tracking-wider text-[var(--status-success)] font-semibold">
            Submission Confirmed
          </span>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
            Thank You for Contacting SHARESPACE
          </h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {state.submittedName
              ? `Thank you, ${state.submittedName}. We have received your inquiry on behalf of ${
                  state.submittedInstitution || 'your institution'
                }.`
              : 'Your institutional pilot and technical inquiry has been successfully transmitted to our facilities team.'}
          </p>
        </div>

        {/* Expected Next Steps Box */}
        <div className="p-4 rounded-[8px] bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] text-xs text-left space-y-2.5">
          <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[var(--brand-primary)]" />
            <span>Next Steps in the Evaluation Process</span>
          </div>
          <ul className="space-y-1.5 text-[var(--text-secondary)] text-[11px] leading-relaxed">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[var(--brand-primary)]">1.</span>
              <span>Our team will review your institution’s equipment requirements and training prerequisites.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[var(--brand-primary)]">2.</span>
              <span>
                A deployment coordinator will follow up at{' '}
                <strong className="text-[var(--text-primary)]">{state.submittedEmail || 'your institutional email'}</strong>{' '}
                within 1–2 business days.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[var(--brand-primary)]">3.</span>
              <span>
                In the meantime, you can explore the working demo personas and test the live Trust Ledger.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
          >
            <span>Explore Live Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
