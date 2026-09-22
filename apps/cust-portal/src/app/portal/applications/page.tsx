'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import {
  applicationService,
  LoanApplication,
  STATUS_LABELS,
  STATUS_COLORS,
  LOAN_PURPOSE_LABELS,
  LoanPurpose,
} from '@/services/api/application-service';

/* ─── Status badge — labels and colours come from application-service ─── */

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || 'badge-neutral';
  return <span className={`badge ${color}`}>{label}</span>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ─── Filter config ─────────────────────────────────────────── */

type FilterStatus = 'ALL' | 'DRAFT' | 'ACTIVE' | 'COMPLETED';

const FILTER_LABELS: Record<FilterStatus, string> = {
  ALL: 'All',
  DRAFT: 'Draft',
  ACTIVE: 'In progress',
  COMPLETED: 'Completed',
};

const FILTER_GROUPS: Record<FilterStatus, string[] | null> = {
  ALL: null,
  DRAFT: ['DRAFT'],
  ACTIVE: [
    'SUBMITTED',
    'PENDING_KYC',
    'KYC_APPROVED',
    'PENDING_DOCUMENTS',
    'DOCUMENTS_RECEIVED',
    'PENDING_CREDIT_CHECK',
    'CREDIT_APPROVED',
    'PENDING_UNDERWRITING',
    'IN_UNDERWRITING',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'PENDING_DECISION',
    'PENDING_CONDITIONS',
    'CONDITIONS_MET',
    'OFFER_GENERATED',
    'OFFER_SENT',
    'OFFER_COUNTERED',
    'PENDING_ESIGN',
    'ESIGN_IN_PROGRESS',
    'ESIGN_COMPLETED',
    'PENDING_BOOKING',
    'BOOKING_IN_PROGRESS',
    'RETURNED',
  ],
  COMPLETED: [
    'APPROVED',
    'DECLINED',
    'OFFER_ACCEPTED',
    'OFFER_REJECTED',
    'OFFER_EXPIRED',
    'BOOKED',
    'PENDING_DISBURSEMENT',
    'DISBURSEMENT_IN_PROGRESS',
    'DISBURSED',
    'WITHDRAWN',
    'EXPIRED',
    'CANCELLED',
    'KYC_REJECTED',
    'CREDIT_DECLINED',
    'UNDERWRITING_APPROVED',
    'UNDERWRITING_DECLINED',
    'ACTIVE',
    'CLOSED',
  ],
};

/* ─── Skeleton ──────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─── Main ──────────────────────────────────────────────────── */

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const [query, setQuery] = useState('');

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    try {
      setLoading(true);
      setError(null);
      const data = await applicationService.list();
      setApplications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  const byStatus =
    filter === 'ALL'
      ? applications
      : applications.filter(a => FILTER_GROUPS[filter]?.includes(a.status));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? byStatus.filter(a =>
        [
          a.applicationNumber,
          a.product?.productName,
          LOAN_PURPOSE_LABELS[a.loanPurpose as LoanPurpose],
          a.loanPurpose,
          STATUS_LABELS[a.status],
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      )
    : byStatus;

  /* Every count is derived from the applications the service actually returned. */
  const counts: Record<FilterStatus, number> = {
    ALL: applications.length,
    DRAFT: applications.filter(a => FILTER_GROUPS.DRAFT?.includes(a.status)).length,
    ACTIVE: applications.filter(a => FILTER_GROUPS.ACTIVE?.includes(a.status)).length,
    COMPLETED: applications.filter(a => FILTER_GROUPS.COMPLETED?.includes(a.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mesh-hero relative overflow-hidden rounded-3xl p-6 shadow-float sm:p-7">
        <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              My applications
            </h1>
            <p className="mt-1.5 text-sm text-white/75">
              {loading
                ? 'Loading your applications…'
                : `${counts.ACTIVE} in progress · ${counts.ALL} total`}
            </p>
          </div>
          <button
            onClick={() => router.push('/portal/applications/new')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New application
          </button>
        </div>
      </div>

      {/* ── Toolbar: filters + search ──────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="segmented no-scrollbar max-w-full overflow-x-auto"
          role="group"
          aria-label="Filter applications by status"
          tabIndex={0}
        >
          {(Object.keys(FILTER_GROUPS) as FilterStatus[]).map(f => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              data-active={filter === f ? 'true' : undefined}
              onClick={() => setFilter(f)}
              className="segmented-item"
            >
              {FILTER_LABELS[f]}
              <span className="ml-0.5 text-xs tabular-nums opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:max-w-xs">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by reference, purpose or status"
            aria-label="Search applications"
            className="input py-2 pl-9 pr-4"
          />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" role="status">Loading your applications…</p>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="panel px-5 py-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3.5 w-72" />
                </div>
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error flex-col text-center sm:flex-row sm:text-left" role="alert">
          <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold">We couldn&apos;t load your applications</p>
            <p className="mt-0.5 text-sm opacity-80">{error}</p>
          </div>
          <button onClick={loadApplications} className="btn btn-sm btn-outline shrink-0">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          {applications.length === 0 ? (
            <>
              <h2 className="empty-state-title">No applications yet</h2>
              <p className="empty-state-text">
                When you apply for a loan or credit product, you&apos;ll be able to track its
                progress here.
              </p>
              <button
                onClick={() => router.push('/portal/applications/new')}
                className="btn btn-primary mt-5"
              >
                Start an application
              </button>
            </>
          ) : (
            <>
              <h2 className="empty-state-title">No matching applications</h2>
              <p className="empty-state-text">
                {q
                  ? `Nothing matches “${query.trim()}”. Try a different reference, purpose or status.`
                  : 'No applications have this status yet.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {q && (
                  <button onClick={() => setQuery('')} className="btn btn-secondary btn-sm">
                    Clear search
                  </button>
                )}
                {filter !== 'ALL' && (
                  <button onClick={() => setFilter('ALL')} className="btn btn-ghost btn-sm">
                    Show all applications
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className="stagger space-y-3">
          {filtered.map(app => {
            const purpose =
              app.product?.productName ||
              LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] ||
              app.loanPurpose;
            const hasFooter =
              app.status !== 'DRAFT' &&
              (app.daysInCurrentStatus != null ||
                app.slaBreached ||
                (app.documentsPendingCount != null && app.documentsPendingCount > 0));

            return (
              <li key={app.applicationId}>
                <button
                  type="button"
                  onClick={() => router.push(`/portal/applications/${app.applicationId}`)}
                  className="panel group w-full px-5 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex"
                      style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                    >
                      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {purpose || 'Draft application'}
                        </p>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {app.applicationNumber || 'No reference yet'} · {app.requestedTermMonths}{' '}
                        months · {app.status === 'DRAFT' ? 'Created' : 'Updated'}{' '}
                        {formatDate(app.updatedAt || app.createdAt)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className="text-base font-semibold tabular-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatCurrency(app.requestedAmount)}
                      </p>
                      {app.approvedAmount != null && (
                        <p className="mt-0.5 text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          Approved {formatCurrency(app.approvedAmount)}
                        </p>
                      )}
                    </div>

                    <svg
                      aria-hidden="true"
                      className="mt-1 h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                      style={{ color: 'var(--text-muted)' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {hasFooter && (
                    <div
                      className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm"
                      style={{ borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}
                    >
                      {app.daysInCurrentStatus != null && (
                        <span className="inline-flex items-center gap-1.5">
                          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {app.daysInCurrentStatus} {app.daysInCurrentStatus === 1 ? 'day' : 'days'} in
                          this status
                        </span>
                      )}
                      {app.slaBreached && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-red-600 dark:text-red-300">
                          <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Taking longer than expected
                        </span>
                      )}
                      {app.documentsPendingCount != null && app.documentsPendingCount > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          {app.documentsPendingCount}{' '}
                          {app.documentsPendingCount === 1 ? 'document' : 'documents'} still needed
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
