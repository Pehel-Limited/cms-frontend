'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  kycService,
  type KycCase,
  type KycCaseStatus,
  type KycDashboardStats,
  type RiskTier,
  type DiligenceLevel,
} from '@/services/api/kycService';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

// ============================================================================
// Option lists (labels are humanised from the enum; colours come from the
// shared kycService helpers so there is a single source of truth).
// ============================================================================

const KYC_STATUSES: KycCaseStatus[] = [
  'DRAFT',
  'PENDING_DOCUMENTS',
  'UNDER_REVIEW',
  'PENDING_VERIFICATION',
  'PENDING_SCREENING',
  'PENDING_RISK',
  'PENDING_APPROVAL',
  'ESCALATED',
  'APPROVED',
  'REJECTED',
  'INCOMPLETE',
  'ON_HOLD',
];

const RISK_TIERS: RiskTier[] = [
  'LOW',
  'MEDIUM_LOW',
  'MEDIUM',
  'MEDIUM_HIGH',
  'HIGH',
  'PROHIBITED',
];

const DILIGENCE_LEVELS: DiligenceLevel[] = ['SDD', 'CDD', 'EDD'];

const NEXT_ACTION: Record<KycCaseStatus, string> = {
  DRAFT: 'Complete profile',
  PENDING_DOCUMENTS: 'Collect documents',
  UNDER_REVIEW: 'Review case',
  PENDING_VERIFICATION: 'Verify identity',
  PENDING_SCREENING: 'Run screening',
  PENDING_RISK: 'Assess risk',
  PENDING_APPROVAL: 'Approve or reject',
  ESCALATED: 'Senior review',
  APPROVED: 'Completed',
  REJECTED: 'Closed',
  INCOMPLETE: 'Request information',
  ON_HOLD: 'Resume case',
};

// ============================================================================
// Helpers
// ============================================================================

/** 'PENDING_DOCUMENTS' → 'Pending documents' */
function humanize(value?: string): string {
  if (!value) return '—';
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [diligenceFilter, setDiligenceFilter] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, casesRes] = await Promise.all([
        kycService.getDashboardStats(),
        kycService.getCases({ page: 0, size: 100, sort: 'createdAt,desc' }),
      ]);
      setStats(statsRes);
      setCases(casesRes.content ?? []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'We could not load the KYC/AML overview. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Segment options are derived from the loaded cases so the filter can never
  // offer a value that does not exist in the data.
  const segmentOptions = useMemo(
    () =>
      Array.from(new Set(cases.map(c => c.customerSegment).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [cases]
  );

  const sorted = useMemo(() => sortData(filtered, sortConfig), [filtered, sortConfig]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

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

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));

  const riskSegments = useMemo(
    () =>
      stats
        ? [
            { label: 'Low', value: stats.lowRiskCustomers, color: '#10b981' },
            { label: 'Medium', value: stats.mediumRiskCustomers, color: '#f59e0b' },
            { label: 'High', value: stats.highRiskCustomers, color: '#ef4444' },
            { label: 'Prohibited', value: stats.prohibitedCustomers, color: '#dc2626' },
          ]
        : [],
    [stats]
  );

  const attention = useMemo(() => buildAttention(stats), [stats]);
  const attentionMax = Math.max(1, ...attention.map(a => a.value));
  const recommendations = useMemo(
    () => (stats ? buildRecommendations(stats, router) : []),
    [stats, router]
  );

  // KPI values — every number comes straight from the dashboard stats endpoint.
  const kpis = stats
    ? [
        {
          key: 'pending-docs',
          label: 'Pending verifications',
          value: stats.pendingDocumentVerifications,
          sub: `${stats.pendingCases} cases pending`,
          tint: 'rgba(245,158,11,0.15)',
          color: '#d97706',
          icon: <DocCheckIcon />,
          pressed: statusFilter === 'PENDING_VERIFICATION',
          toggle: () =>
            setStatusFilter(statusFilter === 'PENDING_VERIFICATION' ? 'all' : 'PENDING_VERIFICATION'),
          pressedLabel: 'Filter: pending verification',
        },
        {
          key: 'high-risk',
          label: 'High-risk parties',
          value: stats.highRiskCustomers,
          sub: `${stats.prohibitedCustomers} prohibited`,
          tint: 'rgba(239,68,68,0.13)',
          color: '#dc2626',
          icon: <ShieldIcon />,
          pressed: riskFilter === 'HIGH',
          toggle: () => setRiskFilter(riskFilter === 'HIGH' ? 'all' : 'HIGH'),
          pressedLabel: 'Filter: high risk',
        },
        {
          key: 'screening',
          label: 'Screening reviews',
          value: stats.pendingScreeningReviews,
          sub: 'Sanctions and PEP',
          tint: 'rgba(139,92,246,0.15)',
          color: '#7c3aed',
          icon: <RadarIcon />,
          pressed: statusFilter === 'PENDING_SCREENING',
          toggle: () =>
            setStatusFilter(statusFilter === 'PENDING_SCREENING' ? 'all' : 'PENDING_SCREENING'),
          pressedLabel: 'Filter: pending screening',
        },
        {
          key: 'overdue',
          label: 'Overdue cases',
          value: stats.overdueCases,
          sub: `${stats.escalatedCases} escalated`,
          tint: 'rgba(244,63,94,0.14)',
          color: '#e11d48',
          icon: <ClockIcon />,
          pressed: slaFilter === 'overdue',
          toggle: () => setSlaFilter(slaFilter === 'overdue' ? 'all' : 'overdue'),
          pressedLabel: 'Filter: overdue',
        },
        {
          key: 'approved',
          label: 'Approved',
          value: stats.approvedCases,
          sub: `${stats.totalCases} total cases`,
          tint: 'rgba(16,185,129,0.14)',
          color: '#059669',
          icon: <CheckIcon />,
          pressed: statusFilter === 'APPROVED',
          toggle: () => setStatusFilter(statusFilter === 'APPROVED' ? 'all' : 'APPROVED'),
          pressedLabel: 'Filter: approved',
        },
      ]
    : [];

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

  return (
    <div className="space-y-8" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            KYC and AML
          </h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Onboarding checks, verifications and screening across your portfolio.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
              Updated{' '}
              {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Link
            href="/dashboard/kyc/cases"
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
          >
            All cases
          </Link>
          <button
            onClick={() => router.push('/dashboard/kyc/cases/new')}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            New case
          </button>
        </div>
      </header>

      {/* ══ Load error ══ */}
      {error && (
        <section
          className="flex flex-wrap items-center gap-3 rounded-3xl p-6"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
          role="alert"
        >
          <svg
            className="h-5 w-5 shrink-0"
            style={{ color: '#dc2626' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
              {error}
            </p>
          </div>
          <button
            onClick={loadData}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
          >
            Try again
          </button>
        </section>
      )}

      {/* ══ Filters ══ */}
      <section
        className="rounded-3xl p-6"
        style={{ backgroundColor: 'var(--rm-card)' }}
        aria-label="Case filters"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label
              htmlFor="kyc-search"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Search
            </label>
            <input
              id="kyc-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name or case reference"
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            />
          </div>
          <SelectControl
            id="kyc-filter-status"
            label="Stage"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All stages</option>
            {KYC_STATUSES.map(s => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </SelectControl>
          <SelectControl
            id="kyc-filter-risk"
            label="Risk tier"
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value)}
          >
            <option value="all">All tiers</option>
            {RISK_TIERS.map(r => (
              <option key={r} value={r}>
                {humanize(r)}
              </option>
            ))}
          </SelectControl>
          <SelectControl
            id="kyc-filter-diligence"
            label="Diligence"
            value={diligenceFilter}
            onChange={e => setDiligenceFilter(e.target.value)}
          >
            <option value="all">All levels</option>
            {DILIGENCE_LEVELS.map(d => (
              <option key={d} value={d}>
                {kycService.getDiligenceLabel(d)} ({d})
              </option>
            ))}
          </SelectControl>
          <SelectControl
            id="kyc-filter-segment"
            label="Segment"
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value)}
          >
            <option value="all">All segments</option>
            {segmentOptions.map(s => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </SelectControl>
          <SelectControl
            id="kyc-filter-sla"
            label="Due date"
            value={slaFilter}
            onChange={e => setSlaFilter(e.target.value)}
          >
            <option value="all">Any</option>
            <option value="overdue">Overdue</option>
            <option value="ontrack">On track</option>
          </SelectControl>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm tabular-nums" role="status" style={{ color: 'var(--rm-text-muted)' }}>
            {loading
              ? 'Loading cases…'
              : `${filtered.length} of ${cases.length} cases match`}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--rm-accent)' }}
            >
              Reset filters
            </button>
          )}
        </div>
      </section>

      {/* ══ Key numbers ══ */}
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {loading && !stats
          ? Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map(kpi => (
              <button
                key={kpi.key}
                onClick={kpi.toggle}
                aria-pressed={kpi.pressed}
                className="flex flex-col rounded-3xl p-6 text-left transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--rm-card)',
                  boxShadow: kpi.pressed ? 'inset 0 0 0 2px var(--rm-accent)' : undefined,
                }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: kpi.tint, color: kpi.color }}
                  aria-hidden="true"
                >
                  {kpi.icon}
                </span>
                <span
                  className="mt-3 text-2xl font-semibold tabular-nums"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {kpi.value.toLocaleString()}
                </span>
                <span
                  className="mt-0.5 text-base font-medium"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {kpi.label}
                </span>
                <span className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {kpi.sub}
                </span>
                <span className="sr-only">
                  {kpi.pressed ? `${kpi.pressedLabel} applied, activate to clear` : `Activate to apply ${kpi.pressedLabel}`}
                </span>
              </button>
            ))}
      </section>

      {/* ══ Queue + sidebar ══ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Review queue */}
        <section
          className="rounded-3xl xl:col-span-2"
          style={{ backgroundColor: 'var(--rm-card)' }}
          aria-label="Review queue"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3 p-6 pb-4">
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Review queue
            </h2>
            <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
              {sorted.length} cases · select a column to sort
            </p>
          </div>

          {loading ? (
            <div className="space-y-3 px-6 pb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl"
                  style={{ backgroundColor: 'var(--rm-card-hover)' }}
                />
              ))}
              <p className="sr-only" role="status">
                Loading cases
              </p>
            </div>
          ) : error && sorted.length === 0 ? null : sorted.length === 0 ? (
            <div className="px-6 pb-16 pt-6 text-center">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(127,127,127,0.14)' }}
                aria-hidden="true"
              >
                <svg
                  className="h-7 w-7"
                  style={{ color: 'var(--rm-text-muted)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                 aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                {hasActiveFilters ? 'No cases match these filters' : 'No KYC cases yet'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {hasActiveFilters
                  ? 'Try widening the search or resetting the filters.'
                  : 'Create a case to start an onboarding or periodic review.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-4 rounded-full px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div
              className="overflow-x-auto px-0"
              role="region"
              aria-label="KYC review queue, scrollable"
              tabIndex={0}
            >
              <table className="w-full" aria-label="KYC and AML review queue">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <SortableHeader
                      label="Customer"
                      field="partyDisplayName"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Case"
                      field="caseReference"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Stage"
                      field="status"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Risk"
                      field="riskScore"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Diligence"
                      field="requiredDiligence"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Documents"
                      field="documentCount"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="right"
                      className={headerSortClass}
                    />
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-sm font-medium whitespace-nowrap"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      Next action
                    </th>
                    <SortableHeader
                      label="Due"
                      field="dueDate"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                  </tr>
                </thead>
                <tbody>
                  {paged.map(c => (
                    <tr
                      key={c.caseId}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--rm-border)' }}
                      onMouseEnter={e =>
                        (e.currentTarget.style.backgroundColor = 'rgba(127,127,127,0.06)')
                      }
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => router.push(`/dashboard/kyc/cases/${c.caseId}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                            style={{
                              backgroundColor: 'var(--rm-accent-muted)',
                              color: 'var(--rm-accent)',
                            }}
                            aria-hidden="true"
                          >
                            {initials(c.partyDisplayName)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/kyc/cases/${c.caseId}`}
                              onClick={e => e.stopPropagation()}
                              className="block truncate text-base font-medium hover:underline"
                              style={{ color: 'var(--rm-text)' }}
                            >
                              {c.partyDisplayName || '—'}
                            </Link>
                            <p className="truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              {humanize(c.customerSegment)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                          {c.caseReference}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {humanize(c.caseType)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getStatusColor(c.status)}`}
                        >
                          {c.statusDisplay || humanize(c.status)}
                        </span>
                        {c.requiresSeniorApproval && (
                          <p className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            Senior approval needed
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {c.riskTier ? (
                          <span className="flex items-center gap-2">
                            <span
                              className="text-base font-semibold tabular-nums"
                              style={{ color: 'var(--rm-text)' }}
                            >
                              {c.riskScore ?? '—'}
                            </span>
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getRiskTierColor(c.riskTier)}`}
                            >
                              {humanize(c.riskTier)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            Not assessed
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getDiligenceColor(c.requiredDiligence)}`}
                        >
                          {kycService.getDiligenceLabel(c.requiredDiligence)}
                        </span>
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base font-semibold tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {c.documentCount}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {NEXT_ACTION[c.status] ?? 'Review case'}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {formatDate(c.dueDate)}
                        </p>
                        <span
                          className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium"
                          style={{ color: c.isOverdue ? '#dc2626' : '#059669' }}
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={
                                c.isOverdue
                                  ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                                  : 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                              }
                            />
                          </svg>
                          {c.isOverdue ? 'Overdue' : 'On track'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && sorted.length > PAGE_SIZE && (
            <nav
              className="flex items-center justify-between px-5 py-4"
              style={{ borderTop: '1px solid var(--rm-border)' }}
              aria-label="Review queue pagination"
            >
              <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                Page {page + 1} of {pageCount}
              </span>
              <span className="flex gap-2">
                <PagerButton disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Previous
                </PagerButton>
                <PagerButton
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </PagerButton>
              </span>
            </nav>
          )}
        </section>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compliance insight */}
          <section
            className="rounded-3xl p-6"
            style={{ backgroundColor: 'var(--rm-accent-muted)' }}
            aria-label="Compliance insight"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-accent)' }}
                aria-hidden="true"
              >
                <SparkIcon />
              </span>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                Compliance insight
              </h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {buildInsights(stats).map((line, i) => (
                <li key={i} className="flex gap-2.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  <span aria-hidden="true" style={{ color: 'var(--rm-accent)' }}>
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Risk distribution */}
          <section
            className="rounded-3xl p-6"
            style={{ backgroundColor: 'var(--rm-card)' }}
            aria-label="Risk distribution"
          >
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Risk distribution
            </h2>
            {stats ? (
              <div className="mt-5 flex items-center gap-5">
                <Donut segments={riskSegments} />
                <ul className="flex-1 space-y-2.5">
                  {riskSegments.map(s => (
                    <li key={s.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                          aria-hidden="true"
                        />
                        <span style={{ color: 'var(--rm-text-secondary)' }}>{s.label}</span>
                      </span>
                      <span
                        className="text-base font-semibold tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {s.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {loading ? 'Loading risk distribution…' : 'Risk data is unavailable.'}
              </p>
            )}
          </section>

          {/* Attention */}
          <section
            className="rounded-3xl p-6"
            style={{ backgroundColor: 'var(--rm-card)' }}
            aria-label="Items needing attention"
          >
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Items needing attention
            </h2>
            {attention.length === 0 ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {loading ? 'Loading…' : 'Nothing is waiting on you right now.'}
              </p>
            ) : (
              <ul className="mt-5 space-y-4">
                {attention.map(item => (
                  <li key={item.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--rm-text-secondary)' }}>{item.label}</span>
                      <span
                        className="text-base font-semibold tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {item.value}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 overflow-hidden rounded-full"
                      style={{ backgroundColor: 'var(--rm-card-hover)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(item.value / attentionMax) * 100}%`,
                          backgroundColor: item.color,
                        }}
                        aria-hidden="true"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recommended actions */}
          {stats && (
            <section
              className="rounded-3xl p-6"
              style={{ backgroundColor: 'var(--rm-card)' }}
              aria-label="Recommended actions"
            >
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                Recommended actions
              </h2>
              {recommendations.length === 0 ? (
                <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No outstanding actions. All clear.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {recommendations.map(rec => (
                    <li key={rec.label}>
                      <button
                        onClick={rec.onClick}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-opacity hover:opacity-80"
                        style={{ backgroundColor: 'var(--rm-card-hover)' }}
                      >
                        <span className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: rec.color }}
                            aria-hidden="true"
                          />
                          {rec.label}
                        </span>
                        <span aria-hidden="true" style={{ color: 'var(--rm-accent)' }}>
                          →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
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
    out.push(
      `${stats.overdueCases} case${stats.overdueCases > 1 ? 's are' : ' is'} past SLA and need attention first.`
    );
  if (stats.escalatedCases > 0)
    out.push(
      `${stats.escalatedCases} escalated case${stats.escalatedCases > 1 ? 's need' : ' needs'} senior compliance review.`
    );
  if (stats.pendingScreeningReviews > 0)
    out.push(
      `${stats.pendingScreeningReviews} sanctions or PEP screening result${stats.pendingScreeningReviews > 1 ? 's are' : ' is'} awaiting disposition.`
    );
  const highRisk = stats.highRiskCustomers + stats.prohibitedCustomers;
  if (highRisk > 0)
    out.push(
      `${highRisk} high-risk part${highRisk > 1 ? 'ies are' : 'y is'} in the portfolio under enhanced due diligence.`
    );
  if (out.length === 0) out.push('Nothing urgent — no overdue, escalated or high-risk items.');
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
      onClick: () => router.push('/dashboard/kyc/cases'),
    });
  if (stats.expiringDocuments > 0)
    recs.push({
      label: `Renew ${stats.expiringDocuments} expiring document${stats.expiringDocuments > 1 ? 's' : ''}`,
      color: '#f59e0b',
      onClick: () => router.push('/dashboard/kyc/cases'),
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

/**
 * Filter select with a visible, associated label.
 */
function SelectControl({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium"
        style={{ color: 'var(--rm-text-secondary)' }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl px-3.5 py-2.5 text-base"
        style={{
          backgroundColor: 'var(--rm-input)',
          border: '1px solid var(--rm-border)',
          color: 'var(--rm-text)',
        }}
      >
        {children}
      </select>
    </div>
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
      className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: 'var(--rm-input)',
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
      className="h-[168px] animate-pulse rounded-3xl"
      style={{ backgroundColor: 'var(--rm-card-hover)' }}
    />
  );
}

function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const size = 96;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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
        <span className="text-xl font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
          {total}
        </span>
        <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12 16 8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z" />
    </svg>
  );
}
