'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import {
  applicationService,
  LoanApplication,
  ApplicationStatus,
  STATUS_LABELS,
  LOAN_PURPOSE_LABELS,
  LoanPurpose,
} from '@/services/api/application-service';

/* ─── Status badge with dot indicator ───────────────────────── */

const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  SUBMITTED: 'bg-blue-500',
  UNDER_REVIEW: 'bg-amber-500',
  DOCUMENTS_PENDING: 'bg-orange-500',
  DOCUMENTS_RECEIVED: 'bg-teal-500',
  CREDIT_CHECK_INITIATED: 'bg-indigo-500',
  CREDIT_CHECK_COMPLETED: 'bg-indigo-600',
  UNDER_UNDERWRITING: 'bg-violet-500',
  PENDING_APPROVAL: 'bg-purple-500',
  ON_HOLD: 'bg-amber-600',
  APPROVED: 'bg-emerald-500',
  CONDITIONALLY_APPROVED: 'bg-emerald-400',
  UNDERWRITING_APPROVED: 'bg-emerald-600',
  REJECTED: 'bg-red-500',
  UNDERWRITING_REJECTED: 'bg-red-400',
  WITHDRAWN: 'bg-slate-500',
  EXPIRED: 'bg-slate-400',
  CANCELLED: 'bg-slate-500',
};

const STATUS_BG: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700',
  DOCUMENTS_PENDING: 'bg-orange-50 text-orange-700',
  DOCUMENTS_RECEIVED: 'bg-teal-50 text-teal-700',
  CREDIT_CHECK_INITIATED: 'bg-indigo-50 text-indigo-700',
  CREDIT_CHECK_COMPLETED: 'bg-indigo-50 text-indigo-700',
  UNDER_UNDERWRITING: 'bg-violet-50 text-violet-700',
  PENDING_APPROVAL: 'bg-purple-50 text-purple-700',
  ON_HOLD: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  CONDITIONALLY_APPROVED: 'bg-emerald-50 text-emerald-700',
  UNDERWRITING_APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  UNDERWRITING_REJECTED: 'bg-red-50 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-600',
  EXPIRED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const label = STATUS_LABELS[status] || status;
  const dot = STATUS_DOT[status] || 'bg-slate-400';
  const bg = STATUS_BG[status] || 'bg-slate-50 text-slate-700';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
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

const FILTER_GROUPS: Record<FilterStatus, ApplicationStatus[] | null> = {
  ALL: null,
  DRAFT: ['DRAFT'],
  ACTIVE: [
    'SUBMITTED',
    'UNDER_REVIEW',
    'DOCUMENTS_PENDING',
    'DOCUMENTS_RECEIVED',
    'CREDIT_CHECK_INITIATED',
    'CREDIT_CHECK_COMPLETED',
    'UNDER_UNDERWRITING',
    'PENDING_APPROVAL',
    'ON_HOLD',
  ],
  COMPLETED: [
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
    'EXPIRED',
    'CANCELLED',
    'CONDITIONALLY_APPROVED',
    'UNDERWRITING_APPROVED',
    'UNDERWRITING_REJECTED',
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
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

/* ─── Main ──────────────────────────────────────────────────── */

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

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

  const filtered =
    filter === 'ALL'
      ? applications
      : applications.filter(a => FILTER_GROUPS[filter]?.includes(a.status));

  const counts: Record<FilterStatus, number> = {
    ALL: applications.length,
    DRAFT: applications.filter(a => FILTER_GROUPS.DRAFT?.includes(a.status)).length,
    ACTIVE: applications.filter(a => FILTER_GROUPS.ACTIVE?.includes(a.status)).length,
    COMPLETED: applications.filter(a => FILTER_GROUPS.COMPLETED?.includes(a.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* ── Hero header ────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">My Applications</h1>
            <p className="mt-1 text-sm text-white/70">Track and manage your loan applications</p>
          </div>
          <button
            onClick={() => router.push('/portal/applications/new')}
            className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/25 transition-all border border-white/20 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Application
          </button>
        </div>

        {/* Filter pills */}
        <div className="relative mt-6 flex flex-wrap gap-2">
          {(Object.keys(FILTER_GROUPS) as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-white text-[#7f2b7b] shadow-md'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/10'
              }`}
            >
              {FILTER_ICONS[f]}
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              <span
                className={`ml-1 text-xs tabular-nums ${filter === f ? 'text-[#7f2b7b]/60' : 'text-white/50'}`}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
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
        <div className="bg-red-50 border border-red-200/60 rounded-2xl p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-red-700 font-medium">Failed to load applications</p>
          <p className="text-sm text-red-500 mt-1">{error}</p>
          <button
            onClick={loadApplications}
            className="mt-4 text-sm font-medium text-red-700 underline decoration-red-300 underline-offset-4"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-[#7f2b7b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          {applications.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold text-slate-900">No applications yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Start your first loan application to get started on your financial journey.
              </p>
              <button
                onClick={() => router.push('/portal/applications/new')}
                className="mt-5 bg-[#7f2b7b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#6b2568] transition-colors shadow-sm"
              >
                Start Application
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">No matching applications</h3>
              <p className="text-sm text-slate-500 mt-1">Try changing the filter above.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <button
              key={app.applicationId}
              onClick={() => router.push(`/portal/applications/${app.applicationId}`)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-[#7f2b7b]/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 items-center justify-center">
                    <svg
                      className="w-5 h-5 text-[#7f2b7b]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#7f2b7b] transition-colors">
                        {app.applicationNumber || 'Draft Application'}
                      </h3>
                      <StatusBadge status={app.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        {LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
                      </span>
                      <span className="font-medium text-slate-700 tabular-nums">
                        {formatCurrency(app.requestedAmount)}
                      </span>
                      <span>{app.requestedTermMonths} months</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs text-slate-400">
                    {app.status === 'DRAFT' ? 'Created' : 'Updated'}{' '}
                    {formatDate(app.updatedAt || app.createdAt)}
                  </p>
                  {app.approvedAmount && (
                    <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                      Approved: {formatCurrency(app.approvedAmount)}
                    </p>
                  )}
                  <svg
                    className="w-5 h-5 text-slate-300 group-hover:text-[#7f2b7b] transition-colors ml-auto mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>

              {app.status !== 'DRAFT' && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
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
