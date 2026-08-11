'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  kycService,
  type KycCase,
  type KycCaseStatus,
  type KycDashboardStats,
  type RiskTier,
  type DiligenceLevel,
} from '@/services/api/kycService';

// ============================================================================
// Meta maps (theme-aware hex colours for dual light/dark support)
// ============================================================================

const STATUS_META: Record<KycCaseStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: '#64748b' },
  PENDING_DOCUMENTS: { label: 'Pending Documents', color: '#f59e0b' },
  UNDER_REVIEW: { label: 'Under Review', color: '#3b82f6' },
  PENDING_VERIFICATION: { label: 'Pending Verification', color: '#8b5cf6' },
  PENDING_SCREENING: { label: 'Pending Screening', color: '#6366f1' },
  PENDING_RISK: { label: 'Pending Risk', color: '#f97316' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: '#06b6d4' },
  ESCALATED: { label: 'Escalated', color: '#ef4444' },
  APPROVED: { label: 'Approved', color: '#10b981' },
  REJECTED: { label: 'Rejected', color: '#ef4444' },
  INCOMPLETE: { label: 'Incomplete', color: '#64748b' },
  ON_HOLD: { label: 'On Hold', color: '#64748b' },
};

const RISK_META: Record<RiskTier, { label: string; color: string }> = {
  LOW: { label: 'Low', color: '#10b981' },
  MEDIUM_LOW: { label: 'Medium-Low', color: '#84cc16' },
  MEDIUM: { label: 'Medium', color: '#f59e0b' },
  MEDIUM_HIGH: { label: 'Medium-High', color: '#f97316' },
  HIGH: { label: 'High', color: '#ef4444' },
  PROHIBITED: { label: 'Prohibited', color: '#dc2626' },
};

const DILIGENCE_META: Record<DiligenceLevel, { label: string; color: string }> = {
  SDD: { label: 'SDD · Simplified', color: '#0ea5e9' },
  CDD: { label: 'CDD · Standard', color: '#6366f1' },
  EDD: { label: 'EDD · Enhanced', color: '#8b5cf6' },
};

const NEXT_ACTION: Record<KycCaseStatus, string> = {
  DRAFT: 'Complete profile',
  PENDING_DOCUMENTS: 'Collect documents',
  UNDER_REVIEW: 'Review case',
  PENDING_VERIFICATION: 'Verify identity',
  PENDING_SCREENING: 'Run screening',
  PENDING_RISK: 'Assess risk',
  PENDING_APPROVAL: 'Approve / reject',
  ESCALATED: 'Senior review',
  APPROVED: 'Completed',
  REJECTED: 'Closed',
  INCOMPLETE: 'Request info',
  ON_HOLD: 'Resume case',
};

const CASE_TYPE_LABEL: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  PERIODIC_REVIEW: 'Periodic Review',
  EVENT_DRIVEN: 'Event Driven',
  REMEDIATION: 'Remediation',
};

const SEGMENT_OPTIONS = [
  'RETAIL',
  'MASS_AFFLUENT',
  'HIGH_NET_WORTH',
  'SME',
  'CORPORATE',
  'INSTITUTIONAL',
];

// ============================================================================
// Helpers
// ============================================================================

function formatSegment(segment?: string): string {
  if (!segment) return '—';
  return segment
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatCaseType(type?: string): string {
  if (!type) return '—';
  return CASE_TYPE_LABEL[type] ?? formatSegment(type);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
];

function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

const PAGE_SIZE = 10;

// ============================================================================
// Page
// ============================================================================

export default function KycAmlPage() {
  const router = useRouter();

  const [stats, setStats] = useState<KycDashboardStats | null>(null);
  const [cases, setCases] = useState<KycCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [diligenceFilter, setDiligenceFilter] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const asOf = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, casesRes] = await Promise.all([
          kycService.getDashboardStats(),
          kycService.getCases({ page: 0, size: 100, sort: 'createdAt,desc' }),
        ]);
        if (cancelled) return;
        setStats(statsRes);
        setCases(casesRes.content ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load KYC/AML data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, riskFilter, diligenceFilter, segmentFilter, slaFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cases.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (riskFilter !== 'all' && c.riskTier !== riskFilter) return false;
      if (diligenceFilter !== 'all' && c.requiredDiligence !== diligenceFilter) return false;
      if (segmentFilter !== 'all' && c.customerSegment !== segmentFilter) return false;
      if (slaFilter === 'overdue' && !c.isOverdue) return false;
      if (slaFilter === 'ontrack' && c.isOverdue) return false;
      if (term) {
        const hay = `${c.caseReference} ${c.partyDisplayName}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [cases, search, statusFilter, riskFilter, diligenceFilter, segmentFilter, slaFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const hasActiveFilters =
    !!search ||
    statusFilter !== 'all' ||
    riskFilter !== 'all' ||
    diligenceFilter !== 'all' ||
    segmentFilter !== 'all' ||
    slaFilter !== 'all';

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setRiskFilter('all');
    setDiligenceFilter('all');
    setSegmentFilter('all');
    setSlaFilter('all');
  }

  // KPI values (all real, from stats)
  const kpis = stats
    ? [
        {
          key: 'pending-docs',
          label: 'Pending Verifications',
          value: stats.pendingDocumentVerifications,
          sub: `${stats.pendingCases} cases pending`,
          color: '#f59e0b',
          icon: DocCheckIcon,
          onClick: () => setStatusFilter('PENDING_VERIFICATION'),
        },
        {
          key: 'high-risk',
          label: 'High-Risk Reviews',
          value: stats.highRiskCustomers,
          sub: `${stats.prohibitedCustomers} prohibited`,
          color: '#ef4444',
          icon: ShieldIcon,
          onClick: () => setRiskFilter('HIGH'),
        },
        {
          key: 'screening',
          label: 'Screening Reviews',
          value: stats.pendingScreeningReviews,
          sub: 'Sanctions / PEP',
          color: '#8b5cf6',
          icon: RadarIcon,
          onClick: () => setStatusFilter('PENDING_SCREENING'),
        },
        {
          key: 'overdue',
          label: 'Overdue Cases',
          value: stats.overdueCases,
          sub: `${stats.escalatedCases} escalated`,
          color: '#f43f5e',
          icon: ClockIcon,
          onClick: () => setSlaFilter('overdue'),
        },
        {
          key: 'approved',
          label: 'Approved',
          value: stats.approvedCases,
          sub: `${stats.totalCases} total cases`,
          color: '#10b981',
          icon: CheckIcon,
          onClick: () => setStatusFilter('APPROVED'),
        },
      ]
    : [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
      <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              KYC / AML
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              Monitor onboarding, KYC verifications and AML screening across your portfolio.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden text-xs font-medium sm:inline"
              style={{ color: 'var(--rm-text-muted)' }}
            >
              As of {asOf}
            </span>
            <button
              onClick={() => router.push('/dashboard/kyc/cases')}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors"
              style={{
                color: 'var(--rm-text-secondary)',
                border: '1px solid var(--rm-border)',
                backgroundColor: 'var(--rm-card)',
              }}
            >
              All Cases
            </button>
            <button
              onClick={() => router.push('/dashboard/kyc/cases/new')}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              + New Case
            </button>
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'rgba(239,68,68,0.10)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.30)',
            }}
          >
            {error}
          </div>
        )}

        {/* Filter bar */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-1">
              <FilterLabel>Search</FilterLabel>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name or case ref…"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--rm-input)',
                  border: '1px solid var(--rm-border)',
                  color: 'var(--rm-text)',
                }}
              />
            </div>
            <div>
              <FilterLabel>Verification Status</FilterLabel>
              <FilterSelect value={statusFilter} onChange={setStatusFilter}>
                <option value="all">All statuses</option>
                {(Object.keys(STATUS_META) as KycCaseStatus[]).map(s => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div>
              <FilterLabel>Risk Level</FilterLabel>
              <FilterSelect value={riskFilter} onChange={setRiskFilter}>
                <option value="all">All risk</option>
                {(Object.keys(RISK_META) as RiskTier[]).map(r => (
                  <option key={r} value={r}>
                    {RISK_META[r].label}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div>
              <FilterLabel>Diligence</FilterLabel>
              <FilterSelect value={diligenceFilter} onChange={setDiligenceFilter}>
                <option value="all">All levels</option>
                {(Object.keys(DILIGENCE_META) as DiligenceLevel[]).map(d => (
                  <option key={d} value={d}>
                    {DILIGENCE_META[d].label}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div>
              <FilterLabel>Segment</FilterLabel>
              <FilterSelect value={segmentFilter} onChange={setSegmentFilter}>
                <option value="all">All segments</option>
                {SEGMENT_OPTIONS.map(s => (
                  <option key={s} value={s}>
                    {formatSegment(s)}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div>
              <FilterLabel>SLA</FilterLabel>
              <FilterSelect value={slaFilter} onChange={setSlaFilter}>
                <option value="all">All</option>
                <option value="overdue">Overdue</option>
                <option value="ontrack">On track</option>
              </FilterSelect>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                {filtered.length} of {cases.length} cases match
              </span>
              <button
                onClick={resetFilters}
                className="text-xs font-semibold"
                style={{ color: 'var(--rm-accent)' }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {loading && !stats
            ? Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
            : kpis.map(kpi => {
                const Icon = kpi.icon;
                return (
                  <button
                    key={kpi.key}
                    onClick={kpi.onClick}
                    className="group flex flex-col rounded-xl p-4 text-left transition-shadow hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--rm-card)',
                      border: '1px solid var(--rm-border)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${kpi.color}1f`,
                          color: kpi.color,
                        }}
                      >
                        <Icon />
                      </span>
                    </div>
                    <p
                      className="mt-3 text-2xl font-bold tabular-nums"
                      style={{ color: 'var(--rm-text)' }}
                    >
                      {kpi.value.toLocaleString()}
                    </p>
                    <p
                      className="mt-0.5 text-sm font-medium"
                      style={{ color: 'var(--rm-text-secondary)' }}
                    >
                      {kpi.label}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                      {kpi.sub}
                    </p>
                  </button>
                );
              })}
        </div>

        {/* Main grid: queue + sidebar */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Review queue */}
          <div
            className="rounded-xl xl:col-span-2"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--rm-border)' }}
            >
              <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                KYC / AML Review Queue
              </h2>
              <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                {filtered.length} cases
              </span>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg"
                    style={{ backgroundColor: 'var(--rm-card-hover)' }}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No cases match the current filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                      <Th>Customer / Entity</Th>
                      <Th>Case Ref</Th>
                      <Th>KYC Stage</Th>
                      <Th>AML Risk</Th>
                      <Th>Diligence</Th>
                      <Th className="text-center">Docs</Th>
                      <Th>Next Action</Th>
                      <Th>SLA / Due</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(c => {
                      const status = STATUS_META[c.status];
                      const risk = c.riskTier ? RISK_META[c.riskTier] : null;
                      const dil = DILIGENCE_META[c.requiredDiligence];
                      return (
                        <tr
                          key={c.caseId}
                          onClick={() => router.push(`/dashboard/kyc/cases/${c.caseId}`)}
                          className="cursor-pointer transition-colors"
                          style={{ borderBottom: '1px solid var(--rm-border)' }}
                          onMouseEnter={e =>
                            (e.currentTarget.style.backgroundColor = 'var(--rm-card-hover)')
                          }
                          onMouseLeave={e =>
                            (e.currentTarget.style.backgroundColor = 'transparent')
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ background: avatarGradient(c.partyDisplayName) }}
                              >
                                {initials(c.partyDisplayName)}
                              </span>
                              <div className="min-w-0">
                                <p
                                  className="truncate font-medium"
                                  style={{ color: 'var(--rm-text)' }}
                                >
                                  {c.partyDisplayName}
                                </p>
                                <p
                                  className="truncate text-xs"
                                  style={{ color: 'var(--rm-text-muted)' }}
                                >
                                  {formatSegment(c.customerSegment)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium" style={{ color: 'var(--rm-text)' }}>
                              {c.caseReference}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                              {formatCaseType(c.caseType)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge color={status.color}>{c.statusDisplay || status.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {risk ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-sm font-bold tabular-nums"
                                  style={{ color: risk.color }}
                                >
                                  {c.riskScore ?? '—'}
                                </span>
                                <Badge color={risk.color}>{risk.label}</Badge>
                              </div>
                            ) : (
                              <span
                                className="text-xs"
                                style={{ color: 'var(--rm-text-muted)' }}
                              >
                                Not assessed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge color={dil.color}>{c.requiredDiligence}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="text-sm font-semibold tabular-nums"
                              style={{ color: 'var(--rm-text)' }}
                            >
                              {c.documentCount}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-medium"
                              style={{ color: 'var(--rm-text-secondary)' }}
                            >
                              {NEXT_ACTION[c.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className="text-xs font-medium"
                              style={{ color: 'var(--rm-text-secondary)' }}
                            >
                              {formatDate(c.dueDate)}
                            </p>
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: c.isOverdue ? '#ef4444' : '#10b981' }}
                            >
                              {c.isOverdue ? 'Overdue' : 'On track'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && filtered.length > PAGE_SIZE && (
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: '1px solid var(--rm-border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  Page {page + 1} of {pageCount}
                </span>
                <div className="flex gap-2">
                  <PagerButton disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </PagerButton>
                  <PagerButton
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </PagerButton>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AI Compliance Insight */}
            <div
              className="rounded-xl p-5"
              style={{
                background:
                  'linear-gradient(135deg, var(--rm-accent-muted), transparent)',
                border: '1px solid var(--rm-border)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                >
                  <SparkIcon />
                </span>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  AI Compliance Insight
                </h3>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                >
                  BETA
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-xs" style={{ color: 'var(--rm-text-secondary)' }}>
                {buildInsights(stats).map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span style={{ color: 'var(--rm-accent)' }}>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risk Distribution */}
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Risk Distribution
              </h3>
              <div className="mt-4 flex items-center gap-5">
                <Donut
                  segments={
                    stats
                      ? [
                          { label: 'Low', value: stats.lowRiskCustomers, color: '#10b981' },
                          { label: 'Medium', value: stats.mediumRiskCustomers, color: '#f59e0b' },
                          { label: 'High', value: stats.highRiskCustomers, color: '#ef4444' },
                          {
                            label: 'Prohibited',
                            value: stats.prohibitedCustomers,
                            color: '#dc2626',
                          },
                        ]
                      : []
                  }
                />
                <div className="flex-1 space-y-2">
                  {stats &&
                    [
                      { label: 'Low', value: stats.lowRiskCustomers, color: '#10b981' },
                      { label: 'Medium', value: stats.mediumRiskCustomers, color: '#f59e0b' },
                      { label: 'High', value: stats.highRiskCustomers, color: '#ef4444' },
                      { label: 'Prohibited', value: stats.prohibitedCustomers, color: '#dc2626' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span style={{ color: 'var(--rm-text-secondary)' }}>{s.label}</span>
                        </span>
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {s.value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Attention Breakdown */}
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Items Needing Attention
              </h3>
              <div className="mt-4 space-y-3">
                {buildAttention(stats).map(item => {
                  const max = Math.max(1, ...buildAttention(stats).map(a => a.value));
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--rm-text-secondary)' }}>{item.label}</span>
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {item.value}
                        </span>
                      </div>
                      <div
                        className="mt-1 h-2 overflow-hidden rounded-full"
                        style={{ backgroundColor: 'var(--rm-card-hover)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(item.value / max) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommended Actions */}
            {stats && (
              <div
                className="rounded-xl p-5"
                style={{
                  backgroundColor: 'var(--rm-card)',
                  border: '1px solid var(--rm-border)',
                }}
              >
                <h3 className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  Recommended Actions
                </h3>
                <div className="mt-3 space-y-2">
                  {buildRecommendations(stats, router).map((rec, i) => (
                    <button
                      key={i}
                      onClick={rec.onClick}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors"
                      style={{
                        backgroundColor: 'var(--rm-card-hover)',
                        border: '1px solid var(--rm-border)',
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: rec.color }}
                        />
                        <span style={{ color: 'var(--rm-text-secondary)' }}>{rec.label}</span>
                      </span>
                      <span style={{ color: 'var(--rm-accent)' }}>→</span>
                    </button>
                  ))}
                  {buildRecommendations(stats, router).length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                      No outstanding actions. All clear.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Derived content builders
// ============================================================================

function buildInsights(stats: KycDashboardStats | null): string[] {
  if (!stats) return ['Loading portfolio insights…'];
  const out: string[] = [];
  if (stats.overdueCases > 0)
    out.push(`${stats.overdueCases} case${stats.overdueCases > 1 ? 's are' : ' is'} past SLA and require immediate attention.`);
  if (stats.escalatedCases > 0)
    out.push(`${stats.escalatedCases} escalated case${stats.escalatedCases > 1 ? 's need' : ' needs'} senior compliance review.`);
  if (stats.pendingScreeningReviews > 0)
    out.push(`${stats.pendingScreeningReviews} sanctions/PEP screening result${stats.pendingScreeningReviews > 1 ? 's' : ''} awaiting disposition.`);
  if (stats.highRiskCustomers + stats.prohibitedCustomers > 0)
    out.push(`${stats.highRiskCustomers + stats.prohibitedCustomers} high-risk part${stats.highRiskCustomers + stats.prohibitedCustomers > 1 ? 'ies' : 'y'} in portfolio under enhanced due diligence.`);
  if (out.length === 0) out.push('Portfolio is healthy — no urgent compliance items detected.');
  return out;
}

function buildAttention(
  stats: KycDashboardStats | null
): { label: string; value: number; color: string }[] {
  if (!stats) return [];
  return [
    { label: 'Screening reviews', value: stats.pendingScreeningReviews, color: '#8b5cf6' },
    { label: 'Document verifications', value: stats.pendingDocumentVerifications, color: '#0ea5e9' },
    { label: 'Expiring documents', value: stats.expiringDocuments, color: '#f59e0b' },
    { label: 'Expired documents', value: stats.expiredDocuments, color: '#ef4444' },
    { label: 'Periodic reviews due', value: stats.casesForPeriodicReview, color: '#6366f1' },
  ];
}

function buildRecommendations(
  stats: KycDashboardStats,
  router: ReturnType<typeof useRouter>
): { label: string; color: string; onClick: () => void }[] {
  const recs: { label: string; color: string; onClick: () => void }[] = [];
  if (stats.escalatedCases > 0)
    recs.push({
      label: `Review ${stats.escalatedCases} escalated case${stats.escalatedCases > 1 ? 's' : ''}`,
      color: '#ef4444',
      onClick: () => router.push('/dashboard/kyc/cases'),
    });
  if (stats.pendingScreeningReviews > 0)
    recs.push({
      label: `Disposition ${stats.pendingScreeningReviews} screening hit${stats.pendingScreeningReviews > 1 ? 's' : ''}`,
      color: '#8b5cf6',
      onClick: () => router.push('/dashboard/kyc/cases'),
    });
  if (stats.pendingDocumentVerifications > 0)
    recs.push({
      label: `Verify ${stats.pendingDocumentVerifications} pending document${stats.pendingDocumentVerifications > 1 ? 's' : ''}`,
      color: '#0ea5e9',
      onClick: () => router.push('/dashboard/kyc/documents'),
    });
  if (stats.expiringDocuments > 0)
    recs.push({
      label: `Renew ${stats.expiringDocuments} expiring document${stats.expiringDocuments > 1 ? 's' : ''}`,
      color: '#f59e0b',
      onClick: () => router.push('/dashboard/kyc/documents'),
    });
  if (stats.casesForPeriodicReview > 0)
    recs.push({
      label: `Run ${stats.casesForPeriodicReview} periodic review${stats.casesForPeriodicReview > 1 ? 's' : ''}`,
      color: '#6366f1',
      onClick: () => router.push('/dashboard/kyc/cases'),
    });
  return recs;
}

// ============================================================================
// Sub-components
// ============================================================================

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: 'var(--rm-text-muted)' }}
    >
      {children}
    </label>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
      style={{
        backgroundColor: 'var(--rm-input)',
        border: '1px solid var(--rm-border)',
        color: 'var(--rm-text)',
      }}
    >
      {children}
    </select>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide ${className}`}
      style={{ color: 'var(--rm-text-muted)' }}
    >
      {children}
    </th>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {children}
    </span>
  );
}

function PagerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
      style={{
        backgroundColor: 'var(--rm-card)',
        border: '1px solid var(--rm-border)',
        color: 'var(--rm-text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function KpiSkeleton() {
  return (
    <div
      className="h-[124px] animate-pulse rounded-xl"
      style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}
    />
  );
}

function Donut({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const size = 96;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--rm-card-hover)"
          strokeWidth={stroke}
        />
        {total > 0 &&
          segments
            .filter(s => s.value > 0)
            .map((seg, i) => {
              const len = (seg.value / total) * circumference;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${circumference - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--rm-text)' }}>
          {total}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>
          parties
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function DocCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12 16 8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z" />
    </svg>
  );
}
