import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  List,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { api } from '../../lib/api';
import { EligibilityEvaluationResult, Resource } from '../../lib/types';
import { ResourceIllustration } from '../../components/ResourceIllustration';
import { StatusIndicator } from '../../components/Primitives';

export const DiscoverPage: React.FC = () => {
  const { user } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [resources, setResources] = useState<Resource[]>([]);
  const [eligibilityByRes, setEligibilityByRes] = useState<Record<string, EligibilityEvaluationResult>>({});
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [assistedMode, setAssistedMode] = useState(false);
  const [assistedResult, setAssistedResult] = useState<{
    category: string;
    keywords: string[];
    matches: Array<{ resourceId: string; reason: string }>;
    reasoningSummary: string;
    source: string;
  } | null>(null);
  const [parsingQuery, setParsingQuery] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [supervisionFilter, setSupervisionFilter] = useState<string>('ALL');
  const [trainingFilter, setTrainingFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const list = await api.getResources();
        if (!active) return;
        setResources(list);

        // Compute deterministic eligibility preview for a standard 2h tomorrow window
        const start = new Date(Date.now() + 26 * 3600 * 1000).toISOString();
        const end = new Date(Date.now() + 28 * 3600 * 1000).toISOString();
        const eligMap: Record<string, EligibilityEvaluationResult> = {};
        for (const r of list) {
          const ev = await api.checkEligibilityPreview({
            resourceId: r.id,
            start,
            end,
          });
          eligMap[r.id] = ev;
        }
        if (active) setEligibilityByRes(eligMap);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user]);

  const handleRunAssistedSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) {
      setAssistedResult(null);
      return;
    }
    if (assistedMode) {
      setParsingQuery(true);
      try {
        const res = await api.parseNaturalLanguageQuery(searchText, resources);
        setAssistedResult(res);
        if (res.category && res.category !== 'ALL') {
          setCategoryFilter(res.category);
        }
      } finally {
        setParsingQuery(false);
      }
    } else {
      setAssistedResult(null);
      setSearchParams(searchText.trim() ? { q: searchText.trim() } : {});
    }
  };

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (supervisionFilter !== 'ALL' && r.supervision !== supervisionFilter) return false;
      if (trainingFilter === 'REQUIRED' && !r.requirements.some((req) => req.type === 'TRAINING')) {
        return false;
      }
      if (trainingFilter === 'NONE' && r.requirements.some((req) => req.type === 'TRAINING')) {
        return false;
      }
      if (assistedResult && assistedResult.matches.length > 0) {
        return assistedResult.matches.some((m) => m.resourceId === r.id);
      }
      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const hay = `${r.name} ${r.description} ${r.location} ${r.department} ${r.modelNumber || ''}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [resources, categoryFilter, supervisionFilter, trainingFilter, searchText, assistedResult]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Discover institutional resources
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Visibility does not imply automatic booking permission. Review deterministic eligibility and supervision rules before submitting a request.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[8px] self-start">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-4">
        <form onSubmit={handleRunAssistedSearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  if (!e.target.value.trim()) setAssistedResult(null);
                }}
                placeholder={
                  assistedMode
                    ? 'Describe what you need (e.g., "measure voltage and current on a buck converter" or "film prototype demo")...'
                    : 'Search by equipment name, model number, location, or capability...'
                }
                aria-label="Search resources"
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setAssistedMode((v) => !v);
                setAssistedResult(null);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-[6px] border transition-colors cursor-pointer whitespace-nowrap ${
                assistedMode
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-subtle)] text-[var(--brand-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              Assisted search: {assistedMode ? 'ON' : 'OFF'}
            </button>

            <button
              type="submit"
              disabled={parsingQuery}
              className="px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] cursor-pointer whitespace-nowrap"
            >
              {parsingQuery ? 'Parsing technical intent...' : assistedMode ? 'Match need' : 'Filter'}
            </button>
          </div>

          {assistedMode && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>Try example queries:</span>
              {[
                'Measure PWM voltage and current ringing',
                'Print a heat-resistant enclosure prototype',
                'Record high-res video and studio lighting',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setSearchText(sample)}
                  className="underline hover:text-[var(--text-primary)] cursor-pointer"
                >
                  "{sample}"
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Assisted Search Explanation Banner */}
        {assistedResult && (
          <div className="p-3 rounded-[6px] bg-[var(--brand-subtle)] border border-[var(--brand-primary)]/30 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-[var(--brand-primary)]">
                Assisted Search Interpretation ({assistedResult.source})
              </strong>
              <button
                type="button"
                onClick={() => setAssistedResult(null)}
                className="underline text-[var(--text-secondary)] cursor-pointer"
              >
                Clear assisted match
              </button>
            </div>
            <p className="text-[var(--text-primary)]">{assistedResult.reasoningSummary}</p>
            <p className="text-[var(--text-secondary)]">
              Guardrail: Assisted search only translates technical intent into catalog filters. Final availability and eligibility are enforced deterministically below.
            </p>
          </div>
        )}

        {/* Structured Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border-color)]">
          <div>
            <label htmlFor="filter-cat" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Category
            </label>
            <select
              id="filter-cat"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            >
              <option value="ALL">All categories</option>
              <option value="ELECTRONICS">Electronics & Fabrication</option>
              <option value="MEDIA_COMPUTING">Media & Computing</option>
              <option value="SPACE">Project & Seminar Spaces</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-sup" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Supervision requirement
            </label>
            <select
              id="filter-sup"
              value={supervisionFilter}
              onChange={(e) => setSupervisionFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            >
              <option value="ALL">Any supervision level</option>
              <option value="NONE">Self-service check-in</option>
              <option value="STAFF_CONFIRMATION">Technician handover confirmation</option>
              <option value="STAFF_PRESENT">Staff supervision present</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-trn" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Training requirement
            </label>
            <select
              id="filter-trn"
              value={trainingFilter}
              onChange={(e) => setTrainingFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)]"
            >
              <option value="ALL">All resources</option>
              <option value="REQUIRED">Requires verified training certificate</option>
              <option value="NONE">No specialized training required</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results List / Grid */}
      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
          Loading catalog and evaluating your eligibility...
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-8 text-center space-y-3">
          <p className="text-base font-semibold text-[var(--text-primary)]">
            No resources match the current filters
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Try clearing the search query or selecting "All categories".
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchText('');
              setCategoryFilter('ALL');
              setSupervisionFilter('ALL');
              setTrainingFilter('ALL');
              setAssistedResult(null);
            }}
            className="px-3.5 py-2 text-xs font-medium rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredResources.map((res) => {
            const elig = eligibilityByRes[res.id];
            const failedCheck = elig?.checks.find((c) => c.status === 'FAIL');
            const matchNote = assistedResult?.matches.find((m) => m.resourceId === res.id)?.reason;

            return (
              <article
                key={res.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
              >
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 min-w-0">
                  <ResourceIllustration
                    type={res.illustrationType}
                    className="w-full sm:w-40 h-28 shrink-0"
                  />
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/resources/${res.id}`}
                        className="text-base font-semibold text-[var(--text-primary)] hover:underline"
                      >
                        {res.name}
                      </Link>
                      <StatusIndicator kind="resource" value={res.status} />
                    </div>

                    <div className="text-xs text-[var(--text-secondary)]">
                      <span>{res.category.replace('_', ' & ')}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{res.location}</span>
                      <span aria-hidden="true"> · </span>
                      <span>Owner: {res.ownerName}</span>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {res.description}
                    </p>

                    {matchNote && (
                      <div className="text-xs text-[var(--brand-primary)] font-medium">
                        Why this matched: {matchNote}
                      </div>
                    )}

                    {/* Unboxed Requirement Summary */}
                    <div className="text-xs text-[var(--text-secondary)] pt-0.5">
                      <strong className="text-[var(--text-primary)]">Requirements:</strong>{' '}
                      {res.requirements.map((r) => r.label).join(' · ')}
                      {res.supervision !== 'NONE' && ` · Supervision: ${res.supervision.replace('_', ' ')}`}
                    </div>
                  </div>
                </div>

                {/* Right-side Live Eligibility Preview + View Details CTA */}
                <div className="w-full md:w-64 shrink-0 border-t md:border-t-0 md:border-l border-[var(--border-color)] pt-3 md:pt-0 md:pl-4 flex flex-col justify-between gap-2.5">
                  {elig && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-[var(--text-secondary)]">
                        Your eligibility preview:
                      </div>
                      {elig.eligible ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--status-success)]">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {elig.overallStatus === 'REVIEW_REQUIRED'
                              ? 'Eligible (Manager approval required)'
                              : 'You are eligible to request'}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--status-danger)]">
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span>Training / requirement needed</span>
                          </div>
                          {failedCheck && (
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              {failedCheck.label}: {failedCheck.reason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 w-full">
                    {elig?.eligible && res.status === 'PUBLISHED' && (
                      <Link
                        to={`/resources/${res.id}/request`}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
                      >
                        <span>Request booking</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    <Link
                      to={`/resources/${res.id}`}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[8px] transition-colors ${
                        elig?.eligible && res.status === 'PUBLISHED'
                          ? 'border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                          : 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]'
                      }`}
                    >
                      <span>{elig?.eligible ? 'View details' : 'View requirements & details'}</span>
                      {(!elig?.eligible || res.status !== 'PUBLISHED') && <ArrowRight className="w-3.5 h-3.5" />}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((res) => {
            const elig = eligibilityByRes[res.id];
            return (
              <article
                key={res.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <ResourceIllustration type={res.illustrationType} className="w-full h-32" />
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--text-secondary)]">
                      {res.category.replace('_', ' & ')} · {res.location}
                    </div>
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">
                      <Link to={`/resources/${res.id}`} className="hover:underline">
                        {res.name}
                      </Link>
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {res.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-color)] space-y-2.5">
                  {elig && (
                    <div className="text-xs flex items-center gap-1.5">
                      {elig.eligible ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0" />
                          <span className="text-[var(--status-success)] font-medium">
                            {elig.overallStatus === 'REVIEW_REQUIRED'
                              ? 'Eligible · Approval required'
                              : 'Eligible to request'}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-[var(--status-danger)] shrink-0" />
                          <span className="text-[var(--status-danger)] font-medium">
                            Training / policy requirement needed
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 w-full">
                    {elig?.eligible && res.status === 'PUBLISHED' && (
                      <Link
                        to={`/resources/${res.id}/request`}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[8px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
                      >
                        <span>Request booking</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    <Link
                      to={`/resources/${res.id}`}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[8px] transition-colors ${
                        elig?.eligible && res.status === 'PUBLISHED'
                          ? 'border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                          : 'bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)]'
                      }`}
                    >
                      <span>{elig?.eligible ? 'View details' : 'View requirements & details'}</span>
                      {(!elig?.eligible || res.status !== 'PUBLISHED') && <ArrowRight className="w-3.5 h-3.5" />}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
