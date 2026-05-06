'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store/hooks';
import { caseService } from '@/services/api/case-service';

interface CaseSummary {
  id: string;
  caseReference: string;
  status: string;
  borrowerName?: string;
  propertyAddress?: string;
  createdAt?: string;
  slaBreach?: boolean;
  daysActive?: number;
}

interface PagedCases {
  content: CaseSummary[];
  totalElements: number;
  number: number;
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  ISSUED_TO_SOLICITOR: 'bg-violet-100 text-violet-800',
  DOCUMENTS_PENDING: 'bg-blue-100 text-blue-800',
  UNDERTAKING_ISSUED: 'bg-purple-100 text-purple-800',
  CERTIFICATE_SUBMITTED: 'bg-indigo-100 text-indigo-800',
  DRAWDOWN_REQUESTED: 'bg-orange-100 text-orange-800',
  READY_FOR_DRAWDOWN: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  ON_HOLD: 'bg-red-100 text-red-800',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0)
    return (
      <div className="flex items-center justify-center h-[140px] text-sm text-gray-400">
        No data yet
      </div>
    );
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
        {segments
          .filter(s => s.value > 0)
          .map((seg, i) => {
            const dash = (seg.value / total) * circumference;
            const currentOffset = offset;
            offset += dash;
            return (
              <circle
                key={i}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="20"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
                style={{ transformOrigin: '70px 70px', transform: 'rotate(-90deg)' }}
                className="transition-all duration-700"
              />
            );
          })}
        <text x="70" y="66" textAnchor="middle" className="fill-gray-900 text-xl font-bold">
          {total}
        </text>
        <text x="70" y="82" textAnchor="middle" className="fill-gray-500 text-[10px]">
          Total
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {segments
          .filter(s => s.value > 0)
          .map((seg, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: seg.color }}
              />
              <span className="text-gray-600">{seg.label}</span>
              <span className="font-semibold text-gray-900 ml-auto">{seg.value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAppSelector(s => s.auth.user);
  const [data, setData] = useState<PagedCases | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    caseService
      .getCases({ page: 0, size: 20, sort: 'createdAt,desc' })
      .then(res => setData(res as unknown as PagedCases))
      .catch(() => {
        /* silent — data stays null */
      })
      .finally(() => setLoading(false));
  }, []);

  const cases = data?.content ?? [];
  const recentCases = useMemo(() => cases.slice(0, 5), [cases]);

  const active = useMemo(
    () => cases.filter(c => !['COMPLETED', 'CLOSED'].includes(c.status)).length,
    [cases]
  );
  const breaches = useMemo(() => cases.filter(c => c.slaBreach).length, [cases]);

  const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = useMemo(
    () => cases.filter(c => c.createdAt && new Date(c.createdAt).getTime() > oneWeekAgo).length,
    [cases, oneWeekAgo]
  );

  const statusBreakdown = useMemo(() => {
    const open = cases.filter(c =>
      ['OPEN', 'ISSUED_TO_SOLICITOR', 'DOCUMENTS_PENDING'].includes(c.status)
    ).length;
    const inProgress = cases.filter(c =>
      [
        'UNDERTAKING_ISSUED',
        'CERTIFICATE_SUBMITTED',
        'DRAWDOWN_REQUESTED',
        'READY_FOR_DRAWDOWN',
      ].includes(c.status)
    ).length;
    const done = cases.filter(c => c.status === 'COMPLETED').length;
    const onHold = cases.filter(c => c.status === 'ON_HOLD').length;
    return [
      { value: open, color: '#7f2b7b', label: 'Open / Issued' },
      { value: inProgress, color: '#6366f1', label: 'In Progress' },
      { value: done, color: '#10b981', label: 'Completed' },
      { value: onHold, color: '#f59e0b', label: 'On Hold' },
    ];
  }, [cases]);

  return (
    <div className="space-y-6">
      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b] p-6 md:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 top-16 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute left-1/2 -bottom-12 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-purple-200 text-sm font-medium">{getGreeting()},</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">
              {user ? `${user.firstName} ${user.lastName}` : 'Welcome back'}
            </h1>
            <p className="text-purple-200/80 text-sm mt-2 max-w-md">
              Here&apos;s a quick overview of your active cases and pending items.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/solicitor/cases"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-white border border-white/20 hover:bg-white/25 transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              View Cases
            </Link>
            <Link
              href="/solicitor/firm"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-white border border-white/20 hover:bg-white/25 transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Firm Profile
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Cases"
          loading={loading}
          value={data?.totalElements ?? 0}
          iconBg="from-purple-500/20 to-purple-600/10"
          iconColor="text-[#7f2b7b]"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          }
        />
        <KpiCard
          label="Active Cases"
          loading={loading}
          value={active}
          iconBg="from-emerald-500/20 to-emerald-600/10"
          iconColor="text-emerald-600"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          }
        />
        <KpiCard
          label="SLA Breaches"
          loading={loading}
          value={breaches}
          iconBg="from-red-500/20 to-red-600/10"
          iconColor="text-red-600"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          }
        />
        <KpiCard
          label="Cases This Week"
          loading={loading}
          value={thisWeek}
          iconBg="from-blue-500/20 to-blue-600/10"
          iconColor="text-blue-600"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          }
        />
      </div>

      {/* ── Main 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Recent Cases */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-gray-900">Recent Cases</h3>
              <Link
                href="/solicitor/cases"
                className="text-xs font-medium text-[#7f2b7b] hover:text-[#5e1f5b] transition-colors"
              >
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="px-6 pb-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentCases.length === 0 ? (
              <div className="px-6 pb-10 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mb-3 mt-6">
                  <svg
                    className="w-6 h-6 text-[#7f2b7b]"
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
                <p className="text-sm text-gray-500">No cases assigned yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentCases.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <Link
                          href={`/solicitor/cases/${c.id}`}
                          className="font-medium text-[#7f2b7b] hover:text-[#5e1f5b] transition-colors"
                        >
                          {c.caseReference}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{c.borrowerName ?? '—'}</td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {c.status.replace(/_/g, ' ')}
                        </span>
                        {c.slaBreach && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase">
                            SLA
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 tabular-nums">
                        {c.daysActive ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT: Chart + Quick Actions */}
        <div className="space-y-6">
          {/* Case Overview donut */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Case Overview</h3>
            {loading ? (
              <div className="flex gap-4 items-center">
                <Skeleton className="w-[140px] h-[140px] rounded-full" />
                <div className="flex-1 space-y-2">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <DonutChart segments={statusBreakdown} />
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction
                href="/solicitor/cases"
                label="Cases"
                color="bg-[#7f2b7b]"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                }
              />
              <QuickAction
                href="/solicitor/firm"
                label="Firm"
                color="bg-indigo-600"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                }
              />
              <QuickAction
                href="/solicitor/notifications"
                label="Notifications"
                color="bg-emerald-600"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                }
              />
              <QuickAction
                href="/solicitor/firm/users"
                label="Team"
                color="bg-amber-600"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  loading,
  value,
  iconBg,
  iconColor,
  icon,
}: {
  label: string;
  loading: boolean;
  value: number;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center`}
        >
          <svg
            className={`w-5 h-5 ${iconColor}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {icon}
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          {loading ? (
            <div className="animate-pulse rounded-lg bg-gray-200 h-7 w-12 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  color,
  icon,
}: {
  href: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
    >
      <div
        className={`w-10 h-10 rounded-full ${color} flex items-center justify-center shadow group-hover:scale-110 transition-transform`}
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {icon}
        </svg>
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </Link>
  );
}
