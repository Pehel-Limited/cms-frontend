'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { kycService, type KycCase, type KycCaseStatus } from '@/services/api/kycService';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

const PAGE_SIZE = 20;

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

type Feedback = { tone: 'success' | 'error'; text: string } | null;

export default function KycCasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');

  const [cases, setCases] = useState<KycCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(filterParam === 'overdue');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

  // Inline decision flow
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await kycService.getCases({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
      });
      setCases(response.content ?? []);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : 'We could not load the cases. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Client-side filters should always return the user to the first page.
  useEffect(() => {
    setPage(0);
  }, [segmentFilter, overdueOnly, searchTerm]);

  const segmentOptions = useMemo(
    () =>
      Array.from(new Set(cases.map(c => c.customerSegment).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [cases]
  );

  const visibleCases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = cases.filter(c => {
      if (segmentFilter !== 'all' && c.customerSegment !== segmentFilter) return false;
      if (overdueOnly && !c.isOverdue) return false;
      if (term) {
        const hay = `${c.caseReference} ${c.partyDisplayName ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    return sortData(list, sortConfig);
  }, [cases, segmentFilter, overdueOnly, searchTerm, sortConfig]);

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));

  const hasFilters =
    statusFilter !== 'all' || segmentFilter !== 'all' || overdueOnly || !!searchTerm.trim();

  function resetFilters() {
    setStatusFilter('all');
    setSegmentFilter('all');
    setOverdueOnly(false);
    setSearchTerm('');
    setPage(0);
  }

  const handleApprove = async (kycCase: KycCase) => {
    setActingId(kycCase.caseId);
    setFeedback(null);
    try {
      await kycService.approveCase(kycCase.caseId);
      setConfirmApproveId(null);
      setFeedback({ tone: 'success', text: `${kycCase.caseReference} approved.` });
      await loadCases();
    } catch (e) {
      setFeedback({
        tone: 'error',
        text:
          e instanceof Error && e.message
            ? e.message
            : `We could not approve ${kycCase.caseReference}. Nothing was changed.`,
      });
    } finally {
      setActingId(null);
    }
  };

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

  return (
    <div className="space-y-6" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            KYC cases
          </h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            {loading ? (
              'Loading cases…'
            ) : (
              <>
                <span className="font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                  {totalElements}
                </span>{' '}
                cases in total
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link
            href="/dashboard/kyc"
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
          >
            KYC overview
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
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-3xl p-6"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
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
          <p className="min-w-0 flex-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
            {error}
          </p>
          <button
            onClick={loadCases}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
          >
            Try again
          </button>
        </section>
      )}

      {/* ══ Decision feedback ══ */}
      {feedback && (
        <div
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          className="flex items-start gap-3 rounded-3xl p-5"
          style={{
            backgroundColor:
              feedback.tone === 'error' ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.12)',
          }}
        >
          <p className="flex-1 text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
            {feedback.text}
          </p>
          <button
            onClick={() => setFeedback(null)}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--rm-text-secondary)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ══ Filters ══ */}
      <section
        className="rounded-3xl p-6"
        style={{ backgroundColor: 'var(--rm-card)' }}
        aria-label="Case filters"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="cases-search"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Search
            </label>
            <input
              id="cases-search"
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Reference or name"
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="cases-status"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Stage
            </label>
            <select
              id="cases-status"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            >
              <option value="all">All stages</option>
              {KYC_STATUSES.map(s => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="cases-segment"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Segment
            </label>
            <select
              id="cases-segment"
              value={segmentFilter}
              onChange={e => setSegmentFilter(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            >
              <option value="all">All segments</option>
              {segmentOptions.map(s => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setOverdueOnly(v => !v)}
              aria-pressed={overdueOnly}
              className="w-full rounded-xl px-3.5 py-2.5 text-left text-base transition-opacity hover:opacity-80"
              style={{
                backgroundColor: overdueOnly ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: overdueOnly ? 'var(--rm-accent)' : 'var(--rm-text-secondary)',
              }}
            >
              Overdue only
              <span className="ml-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {overdueOnly ? 'on' : 'off'}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm tabular-nums" role="status" style={{ color: 'var(--rm-text-muted)' }}>
            {loading
              ? 'Loading cases…'
              : `Showing ${visibleCases.length} of ${cases.length} on this page`}
          </p>
          {hasFilters && (
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

      {/* ══ Cases ══ */}
      <section
        className="overflow-hidden rounded-3xl"
        style={{ backgroundColor: 'var(--rm-card)' }}
        aria-label="Cases"
      >
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-2xl"
                style={{ backgroundColor: 'var(--rm-card-hover)' }}
              />
            ))}
            <p className="sr-only" role="status">
              Loading cases
            </p>
          </div>
        ) : error && visibleCases.length === 0 ? null : visibleCases.length === 0 ? (
          <div className="px-6 py-20 text-center">
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
              {hasFilters ? 'No cases match these filters' : 'No cases yet'}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {hasFilters
                ? 'Try a different stage, segment or search term.'
                : 'Create a case to begin an onboarding or periodic review.'}
            </p>
            {hasFilters && (
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
            className="overflow-x-auto"
            role="region"
            aria-label="KYC cases, scrollable"
            tabIndex={0}
          >
            <table className="w-full" aria-label="KYC cases">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                  <SortableHeader
                    label="Case"
                    field="caseReference"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    className={headerSortClass}
                  />
                  <SortableHeader
                    label="Customer"
                    field="partyDisplayName"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    className={headerSortClass}
                  />
                  <SortableHeader
                    label="Segment"
                    field="customerSegment"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    className={headerSortClass}
                  />
                  <SortableHeader
                    label="Type"
                    field="caseType"
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
                    label="Due"
                    field="dueDate"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    className={headerSortClass}
                  />
                  <SortableHeader
                    label="Created"
                    field="createdAt"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    className={headerSortClass}
                  />
                  <th
                    scope="col"
                    className="px-5 py-3.5 text-right text-sm font-medium whitespace-nowrap"
                    style={{ color: 'var(--rm-text-muted)' }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map(c => {
                  const busy = actingId === c.caseId;
                  return (
                    <tr
                      key={c.caseId}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--rm-border)',
                        backgroundColor: c.isOverdue ? 'rgba(239,68,68,0.05)' : undefined,
                      }}
                      onMouseEnter={e => {
                        if (!c.isOverdue) e.currentTarget.style.backgroundColor = 'rgba(127,127,127,0.06)';
                      }}
                      onMouseLeave={e => {
                        if (!c.isOverdue) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/kyc/cases/${c.caseId}`}
                          className="text-sm font-medium hover:underline"
                          style={{ color: 'var(--rm-accent)' }}
                        >
                          {c.caseReference}
                        </Link>
                        {c.requiresSeniorApproval && (
                          <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            Senior approval needed
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                          {c.partyDisplayName || 'Unknown party'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {humanize(c.customerSegment)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {humanize(c.caseType)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getStatusColor(c.status)}`}
                        >
                          {c.statusDisplay || humanize(c.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {c.riskTier ? (
                          <span className="flex items-center gap-2">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getRiskTierColor(c.riskTier)}`}
                            >
                              {humanize(c.riskTier)}
                            </span>
                            {c.riskScore !== undefined && (
                              <span
                                className="text-sm tabular-nums"
                                style={{ color: 'var(--rm-text-muted)' }}
                              >
                                {c.riskScore}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            Not assessed
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getDiligenceColor(c.requiredDiligence)}`}
                        >
                          {kycService.getDiligenceLabel(c.requiredDiligence)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className="text-sm"
                          style={{ color: c.isOverdue ? '#dc2626' : 'var(--rm-text-secondary)' }}
                        >
                          {formatDate(c.dueDate)}
                        </span>
                        {c.isOverdue && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 text-sm font-medium"
                            style={{ color: '#dc2626' }}
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
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {formatDate(c.createdAt)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {confirmApproveId === c.caseId ? (
                          <span className="flex items-center justify-end gap-2">
                            <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                              Approve {c.caseReference}?
                            </span>
                            <button
                              onClick={() => handleApprove(c)}
                              disabled={busy}
                              className="rounded-full px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: 'var(--rm-accent)' }}
                            >
                              {busy ? 'Approving…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmApproveId(null)}
                              disabled={busy}
                              className="rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--rm-input)',
                                color: 'var(--rm-text-secondary)',
                              }}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-3">
                            <Link
                              href={`/dashboard/kyc/cases/${c.caseId}`}
                              className="text-sm font-medium hover:underline"
                              style={{ color: 'var(--rm-accent)' }}
                            >
                              View
                            </Link>
                            {c.status === 'UNDER_REVIEW' && (
                              <button
                                onClick={() => {
                                  setFeedback(null);
                                  setConfirmApproveId(c.caseId);
                                }}
                                className="text-sm font-medium hover:underline"
                                style={{ color: 'var(--rm-text-secondary)' }}
                              >
                                Approve
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <nav
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            style={{ borderTop: '1px solid var(--rm-border)' }}
            aria-label="Case list pagination"
          >
            <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalElements)} of{' '}
              {totalElements}
            </span>
            <span className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
              >
                Previous
              </button>
              <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
              >
                Next
              </button>
            </span>
          </nav>
        )}
      </section>
    </div>
  );
}
