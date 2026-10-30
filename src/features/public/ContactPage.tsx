import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Building2, MapPin, Send, AlertCircle, CheckCircle2, Phone, Clock } from 'lucide-react';
import { SeoMeta } from '../../components/SeoMeta';
import { contactConfig } from '../../lib/contactConfig';
import { analytics } from '../../lib/analytics';

export const ContactPage: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [role, setRole] = useState('Lab Manager / Facilities Director');
  const [inquiryType, setInquiryType] = useState('Campus Pilot Deployment');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Please enter your full name.';
    if (!email.trim()) {
      errors.email = 'Please enter your institutional email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!institution.trim()) errors.institution = 'Please enter your institution or organisation name.';
    if (!message.trim() || message.trim().length < 15) {
      errors.message = 'Please provide details on your requirements (minimum 15 characters).';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Simulate real institutional inquiry processing
      await new Promise((resolve) => setTimeout(resolve, 800));

      analytics.track({
        eventName: 'contact_inquiry_submitted',
        properties: {
          inquiryType,
          institutionDomain: email.split('@')[1] || 'unknown',
        },
      });

      // Navigate to dedicated confirmation page
      navigate('/thank-you', {
        state: {
          submittedName: fullName,
          submittedEmail: email,
          submittedInstitution: institution,
          inquiryType,
        },
      });
    } catch {
      setGeneralError('Could not submit inquiry. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-4">
      <SeoMeta
        title="Contact & Institutional Pilot | SHARESPACE"
        description="Connect with the SHARESPACE team for institutional deployments, campus pilot integrations, security architecture audits, and general technical inquiries."
        canonicalPath="/contact"
        robots="index, follow"
      />

      {/* Header */}
      <div className="border-b border-[var(--border-color)] pb-6 space-y-2">
        <span className="text-xs font-mono-tech text-[var(--brand-primary)] uppercase tracking-wider font-semibold">
          Institutional Engagement & Technical Inquiries
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Contact SHARESPACE Institutional Directorate
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          Whether you are evaluating SHARESPACE for an engineering department, university-wide makerspace,
          or research facility, our technical team is available to assist with policy setup and security reviews.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Contact & Pilot Form */}
        <div className="lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Submit Institutional Pilot or Technical Inquiry
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Fill out the form below and an institutional coordinator will reply within 1–2 business days.
            </p>
          </div>

          {generalError && (
            <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] border border-[var(--status-danger)]/40 text-[var(--status-danger)] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="fullName" className="block text-xs font-semibold text-[var(--text-primary)]">
                  Full Name <span className="text-[var(--status-danger)]">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                  }}
                  placeholder="e.g. Dr. Ramesh Gupta"
                  className={`w-full px-3 py-2 text-xs rounded-[6px] bg-[var(--bg-app)] border text-[var(--text-primary)] ${
                    fieldErrors.fullName ? 'border-[var(--status-danger)]' : 'border-[var(--border-color)]'
                  }`}
                  required
                />
                {fieldErrors.fullName && (
                  <p className="text-[11px] text-[var(--status-danger)]">{fieldErrors.fullName}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="email" className="block text-xs font-semibold text-[var(--text-primary)]">
                  Institutional Email <span className="text-[var(--status-danger)]">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  placeholder="name@university.edu"
                  className={`w-full px-3 py-2 text-xs rounded-[6px] bg-[var(--bg-app)] border text-[var(--text-primary)] ${
                    fieldErrors.email ? 'border-[var(--status-danger)]' : 'border-[var(--border-color)]'
                  }`}
                  required
                />
                {fieldErrors.email && (
                  <p className="text-[11px] text-[var(--status-danger)]">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="institution" className="block text-xs font-semibold text-[var(--text-primary)]">
                  Institution or Organization <span className="text-[var(--status-danger)]">*</span>
                </label>
                <input
                  id="institution"
                  type="text"
                  value={institution}
                  onChange={(e) => {
                    setInstitution(e.target.value);
                    if (fieldErrors.institution) setFieldErrors((prev) => ({ ...prev, institution: '' }));
                  }}
                  placeholder="e.g. Indian Institute of Technology Madras"
                  className={`w-full px-3 py-2 text-xs rounded-[6px] bg-[var(--bg-app)] border text-[var(--text-primary)] ${
                    fieldErrors.institution ? 'border-[var(--status-danger)]' : 'border-[var(--border-color)]'
                  }`}
                  required
                />
                {fieldErrors.institution && (
                  <p className="text-[11px] text-[var(--status-danger)]">{fieldErrors.institution}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="role" className="block text-xs font-semibold text-[var(--text-primary)]">
                  Role / Designation
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer"
                >
                  <option value="Department Head / Dean">Department Head / Dean</option>
                  <option value="Lab Manager / Facilities Director">Lab Manager / Facilities Director</option>
                  <option value="Research Principal Investigator">Research Principal Investigator</option>
                  <option value="Makerspace Coordinator">Makerspace Coordinator</option>
                  <option value="IT Systems / Security Engineer">IT Systems / Security Engineer</option>
                  <option value="Student / Researcher">Student / Researcher</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="inquiryType" className="block text-xs font-semibold text-[var(--text-primary)]">
                Inquiry Category
              </label>
              <select
                id="inquiryType"
                value={inquiryType}
                onChange={(e) => setInquiryType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer"
              >
                <option value="Campus Pilot Deployment">Campus Pilot Deployment & Onboarding</option>
                <option value="Security & Compliance Audit">Security, Row-Level Security & Compliance Audit</option>
                <option value="Custom Policy & Rules Engine Integration">Custom Policy & Rules Engine Integration</option>
                <option value="Open Source Collaboration">Open Source Architecture Collaboration</option>
                <option value="General Technical Question">General Technical Question</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="message" className="block text-xs font-semibold text-[var(--text-primary)]">
                Requirements & Equipment Scope <span className="text-[var(--status-danger)]">*</span>
              </label>
              <textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (fieldErrors.message) setFieldErrors((prev) => ({ ...prev, message: '' }));
                }}
                placeholder="Briefly describe your equipment inventory, user population (e.g., 400 EE students), and desired supervision or safety rules."
                className={`w-full px-3 py-2 text-xs rounded-[6px] bg-[var(--bg-app)] border text-[var(--text-primary)] leading-relaxed ${
                  fieldErrors.message ? 'border-[var(--status-danger)]' : 'border-[var(--border-color)]'
                }`}
                required
              />
              {fieldErrors.message && (
                <p className="text-[11px] text-[var(--status-danger)]">{fieldErrors.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Inquiry...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Pilot Inquiry</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Institutional Contacts & Hours */}
        <div className="space-y-5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] p-5 space-y-4 shadow-sm text-xs">
            <div className="flex items-center gap-2 text-[var(--brand-primary)] font-bold text-sm">
              <Building2 className="w-4 h-4" />
              <span>Directorate Contacts</span>
            </div>

            <div className="space-y-3 text-[var(--text-secondary)]">
              <div>
                <strong className="text-[var(--text-primary)] block">{contactConfig.organizationName}</strong>
                <span>{contactConfig.departmentName}</span>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-[var(--text-muted)]" />
                <span>{contactConfig.postalAddress}</span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                <a href={`mailto:${contactConfig.supportEmail}`} className="text-[var(--brand-primary)] hover:underline">
                  {contactConfig.supportEmail}
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                <span>{contactConfig.phone}</span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                <span>{contactConfig.officeHours}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)] leading-relaxed">
              <strong>Notice on Contact Verification:</strong> The address and phone above represent the Nilgiri Institute of Technology
              host deployment. For enterprise SaaS licensing and external institutional federations, updates will be published prior to general availability.
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[12px] p-5 space-y-3 shadow-sm text-xs">
            <h3 className="font-bold text-[var(--text-primary)]">
              Security & Vulnerability Reporting
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              If you have discovered a security vulnerability or ledger integrity issue, please contact our security team directly:
            </p>
            <div className="font-mono-tech text-[11px] text-[var(--brand-primary)] font-semibold">
              <a href={`mailto:${contactConfig.securityEmail}`} className="hover:underline">
                {contactConfig.securityEmail}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
