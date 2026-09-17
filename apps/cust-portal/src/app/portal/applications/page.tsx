'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import {
  applicationService,
  LoanApplication,
  STATUS_LABELS,
  LOAN_PURPOSE_LABELS,
  LoanPurpose,
} from '@/services/api/application-service';

/* ─── Status badge with dot indicator ───────────────────────── */

const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  SUBMITTED: 'bg-blue-500',
  PENDING_KYC: 'bg-amber-500',
  KYC_APPROVED: 'bg-teal-500',
  KYC_REJECTED: 'bg-red-400',
  PENDING_DOCUMENTS: 'bg-orange-500',
  DOCUMENTS_RECEIVED: 'bg-teal-500',
  PENDING_CREDIT_CHECK: 'bg-indigo-500',
  CREDIT_APPROVED: 'bg-indigo-600',
  CREDIT_DECLINED: 'bg-red-400',
  PENDING_UNDERWRITING: 'bg-violet-400',
  IN_UNDERWRITING: 'bg-violet-500',
  UNDERWRITING_APPROVED: 'bg-emerald-600',
  UNDERWRITING_DECLINED: 'bg-red-400',
  REFERRED_TO_SENIOR: 'bg-indigo-500',
  REFERRED_TO_UNDERWRITER: 'bg-indigo-500',
  PENDING_DECISION: 'bg-purple-500',
  APPROVED: 'bg-emerald-500',
  DECLINED: 'bg-red-500',
  PENDING_CONDITIONS: 'bg-amber-500',
  CONDITIONS_MET: 'bg-teal-500',
  OFFER_GENERATED: 'bg-cyan-500',
  OFFER_SENT: 'bg-cyan-500',
  OFFER_ACCEPTED: 'bg-emerald-500',
  OFFER_REJECTED: 'bg-red-500',
  OFFER_EXPIRED: 'bg-slate-400',
  OFFER_COUNTERED: 'bg-amber-500',
  PENDING_ESIGN: 'bg-violet-500',
  ESIGN_IN_PROGRESS: 'bg-violet-500',
  ESIGN_COMPLETED: 'bg-emerald-500',
  PENDING_BOOKING: 'bg-sky-500',
  BOOKING_IN_PROGRESS: 'bg-sky-500',
  BOOKED: 'bg-emerald-500',
  PENDING_DISBURSEMENT: 'bg-lime-500',
  DISBURSEMENT_IN_PROGRESS: 'bg-lime-500',
  DISBURSED: 'bg-emerald-600',
  RETURNED: 'bg-orange-500',
  WITHDRAWN: 'bg-slate-500',
  EXPIRED: 'bg-slate-400',
  CANCELLED: 'bg-slate-500',
  ACTIVE: 'bg-emerald-500',
  CLOSED: 'bg-slate-500',
};

const STATUS_BG: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  SUBMITTED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  PENDING_KYC: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  KYC_APPROVED: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  KYC_REJECTED: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  PENDING_DOCUMENTS: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  DOCUMENTS_RECEIVED: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  PENDING_CREDIT_CHECK: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  CREDIT_APPROVED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  CREDIT_DECLINED: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  PENDING_UNDERWRITING: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  IN_UNDERWRITING: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  UNDERWRITING_APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  UNDERWRITING_DECLINED: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  REFERRED_TO_SENIOR: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  REFERRED_TO_UNDERWRITER: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  PENDING_DECISION: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  DECLINED: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  PENDING_CONDITIONS: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  CONDITIONS_MET: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  OFFER_GENERATED: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  OFFER_SENT: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  OFFER_ACCEPTED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  OFFER_REJECTED: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  OFFER_EXPIRED: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400',
  OFFER_COUNTERED: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  PENDING_ESIGN: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  ESIGN_IN_PROGRESS: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  ESIGN_COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING_BOOKING: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  BOOKING_IN_PROGRESS: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  BOOKED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING_DISBURSEMENT: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  DISBURSEMENT_IN_PROGRESS: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  DISBURSED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  RETURNED: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  WITHDRAWN: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
  EXPIRED: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400',
  CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  CLOSED: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const dot = STATUS_DOT[status] || 'bg-slate-400';
  const bg = STATUS_BG[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300';
  return (
    <span className={`badge ${bg}`}>
      <span className={`badge-dot ${dot}`} />
      {label}
    </span>
  );
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

const FILTER_ICONS: Record<FilterStatus, React.ReactNode> = {
  ALL: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  ),
  DRAFT: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  ),
  ACTIVE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  COMPLETED: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
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
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
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
          LOAN_PURPOSE_LABELS[a.loanPurpose as LoanPurpose],
          a.loanPurpose,
          STATUS_LABELS[a.status],
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      )
    : byStatus;

  const counts: Record<FilterStatus, number> = {
    ALL: applications.length,
    DRAFT: applications.filter(a => FILTER_GROUPS.DRAFT?.includes(a.status)).length,
    ACTIVE: applications.filter(a => FILTER_GROUPS.ACTIVE?.includes(a.status)).length,
    COMPLETED: applications.filter(a => FILTER_GROUPS.COMPLETED?.includes(a.status)).length,
  };

  return (
    <div className="space-y-5">
      {/* ── Hero header ────────────────────────────────────── */}
      <div className="mesh-hero relative overflow-hidden rounded-3xl p-6 shadow-float sm:p-7">
        <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">My applications</h2>
            <p className="mt-1 text-sm text-white/70">
              {loading
                ? 'Loading your applications…'
                : `${counts.ACTIVE} in progress · ${counts.ALL} total`}
            </p>
          </div>
          <button
            onClick={() => router.push('/portal/applications/new')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New application
          </button>
        </div>
      </div>

      {/* ── Toolbar: filters + search ──────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="segmented no-scrollbar max-w-full overflow-x-auto" role="tablist" aria-label="Filter applications">
          {(Object.keys(FILTER_GROUPS) as FilterStatus[]).map(f => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className="segmented-item"
            >
              {FILTER_ICONS[f]}
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              <span className="ml-0.5 text-xs tabular-nums opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:max-w-xs">
          <svg
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
            className="input py-2 pl-9 pr-4 text-sm"
          />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error flex-col text-center sm:flex-row sm:text-left">
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold">Failed to load applications</p>
            <p className="mt-0.5 text-sm opacity-80">{error}</p>
          </div>
          <button onClick={loadApplications} className="btn btn-sm btn-outline shrink-0">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          {applications.length === 0 ? (
            <>
              <h3 className="empty-state-title">No applications yet</h3>
              <p className="empty-state-text">
                Start your first loan application to get going on your financial journey.
              </p>
              <button
                onClick={() => router.push('/portal/applications/new')}
                className="btn btn-primary mt-5"
              >
                Start application
              </button>
            </>
          ) : (
            <>
              <h3 className="empty-state-title">No matching applications</h3>
              <p className="empty-state-text">
                Try a different filter{q ? ' or search term' : ''} to find what you&apos;re looking for.
              </p>
              {q && (
                <button onClick={() => setQuery('')} className="btn btn-secondary btn-sm mt-4">
                  Clear search
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="stagger space-y-3">
          {filtered.map(app => (
            <button
              key={app.applicationId}
              onClick={() => router.push(`/portal/applications/${app.applicationId}`)}
              className="card card-hover group w-full p-5 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div
                    className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex"
                    style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {app.applicationNumber || 'Draft application'}
                      </h3>
                      <StatusBadge status={app.status} />
                    </div>
                    <div
                      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        {LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
                      </span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(app.requestedAmount)}
                      </span>
                      <span>{app.requestedTermMonths} months</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 space-y-1 text-right">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {app.status === 'DRAFT' ? 'Created' : 'Updated'}{' '}
                    {formatDate(app.updatedAt || app.createdAt)}
                  </p>
                  {app.approvedAmount && (
                    <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      Approved: {formatCurrency(app.approvedAmount)}
                    </p>
                  )}
                  <svg
                    className="ml-auto mt-1 h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{ color: 'var(--text-muted)' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {app.status !== 'DRAFT' && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-3 pt-3 text-xs"
                  style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}
                >
                  {app.daysInCurrentStatus !== undefined && app.daysInCurrentStatus !== null && (
                    <span className="inline-flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {app.daysInCurrentStatus} days in current status
                    </span>
                  )}
                  {app.slaBreached && (
                    <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      SLA breached
                    </span>
                  )}
                  {app.documentsPendingCount != null && app.documentsPendingCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      {app.documentsPendingCount} documents pending
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
