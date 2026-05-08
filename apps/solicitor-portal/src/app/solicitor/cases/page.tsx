'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { caseService } from '@/services/api/case-service';

interface CaseRow {
  id: string;
  caseReference: string;
  status: string;
  borrowerName?: string;
  propertyAddress?: string;
  loanAmount?: number;
  createdAt?: string;
  slaBreach?: boolean;
  daysActive?: number;
  assignedFirmName?: string;
}

interface PagedCases {
  content: CaseRow[];
  totalElements: number;
  totalPages: number;
  number: number;
}

const STATUS_DOT: Record<string, string> = {
  OPEN: 'bg-yellow-400',
  ISSUED_TO_SOLICITOR: 'bg-violet-500',
  DOCUMENTS_PENDING: 'bg-blue-500',
  UNDERTAKING_ISSUED: 'bg-purple-500',
  UNDERTAKING_ACCEPTED: 'bg-purple-600',
  CERTIFICATE_SUBMITTED: 'bg-indigo-500',
  CERTIFICATE_ACCEPTED: 'bg-indigo-600',
  DRAWDOWN_REQUESTED: 'bg-orange-500',
  DRAWDOWN_APPROVED: 'bg-teal-500',
  READY_FOR_DRAWDOWN: 'bg-teal-600',
  COMPLETED: 'bg-emerald-500',
  ON_HOLD: 'bg-red-500',
  CLOSED: 'bg-slate-400',
};

const STATUS_BG: Record<string, string> = {
  OPEN: 'bg-yellow-50 text-yellow-700',
  ISSUED_TO_SOLICITOR: 'bg-violet-50 text-violet-700',
  DOCUMENTS_PENDING: 'bg-blue-50 text-blue-700',
  UNDERTAKING_ISSUED: 'bg-purple-50 text-purple-700',
  UNDERTAKING_ACCEPTED: 'bg-purple-50 text-purple-800',
  CERTIFICATE_SUBMITTED: 'bg-indigo-50 text-indigo-700',
  CERTIFICATE_ACCEPTED: 'bg-indigo-50 text-indigo-800',
  DRAWDOWN_REQUESTED: 'bg-orange-50 text-orange-700',
  DRAWDOWN_APPROVED: 'bg-teal-50 text-teal-700',
  READY_FOR_DRAWDOWN: 'bg-teal-50 text-teal-800',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  ON_HOLD: 'bg-red-50 text-red-700',
  CLOSED: 'bg-slate-50 text-slate-600',
};

const STATUSES = [
  '',
  'OPEN',
  'ISSUED_TO_SOLICITOR',
  'DOCUMENTS_PENDING',
  'UNDERTAKING_ISSUED',
  'UNDERTAKING_ACCEPTED',
  'CERTIFICATE_SUBMITTED',
  'CERTIFICATE_ACCEPTED',
  'DRAWDOWN_REQUESTED',
  'DRAWDOWN_APPROVED',
  'READY_FOR_DRAWDOWN',
  'COMPLETED',
  'ON_HOLD',
  'CLOSED',
];

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const dot = STATUS_DOT[status] ?? 'bg-slate-400';
  const bg = STATUS_BG[status] ?? 'bg-slate-50 text-slate-700';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function CasesPage() {
  const [data, setData] = useState<PagedCases | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, [page, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCases = async () => {
    setLoading(true);
    try {
      const res = await caseService.getCases({
        page,
        size: 20,
        sort: 'createdAt,desc',
        ...(statusFilter ? { status: statusFilter } : {}),
      } as Parameters<typeof caseService.getCases>[0]);
      setData(res as unknown as PagedCases);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const cases = data?.content ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          {!loading && data && (
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
              {data.totalElements}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b] appearance-none cursor-pointer text-gray-700"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  {s ? s.replace(/_/g, ' ') : 'All Statuses'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-[#7f2b7b]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No cases found</p>
            <p className="text-sm text-gray-400 mt-1">
              {statusFilter
                ? 'Try a different status filter'
                : 'Cases assigned to your firm will appear here'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Borrower
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Days Active
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Loan Amount
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Firm
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cases.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/solicitor/cases/${c.id}`}
                        className="font-semibold text-[#7f2b7b] hover:text-[#5e1f5b] transition-colors"
                      >
                        {c.caseReference}
                      </Link>
                      {c.slaBreach && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase tracking-wide">
                          SLA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{c.borrowerName ?? '—'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-500 tabular-nums">{c.daysActive ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-700 tabular-nums font-medium">
                    {c.loanAmount != null ? `€${c.loanAmount.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{c.assignedFirmName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page <span className="font-medium text-gray-700">{(data.number ?? 0) + 1}</span> of{' '}
            <span className="font-medium text-gray-700">{data.totalPages}</span> ·{' '}
            {data.totalElements} total cases
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <button
              disabled={page >= data.totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
