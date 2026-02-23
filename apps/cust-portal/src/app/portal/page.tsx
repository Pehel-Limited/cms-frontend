'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { formatCurrency } from '@/lib/format';
import {
  taskService,
  type TaskCountResponse,
  type CustomerTask,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_COLORS,
  dueDateLabel,
  isPending,
} from '@/services/api/task-service';
import {
  applicationService,
  type LoanApplication,
  STATUS_LABELS,
  STATUS_COLORS,
  LOAN_PURPOSE_LABELS,
  type ApplicationStatus,
  type LoanPurpose,
} from '@/services/api/application-service';
import {
  messagingService,
  type Conversation,
  formatMessageTime,
} from '@/services/api/messaging-service';

/* ─── helpers ───────────────────────────────────────────────── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function statusCategory(s: string): 'active' | 'approved' | 'declined' | 'other' {
  const approved = new Set(['APPROVED', 'CONDITIONALLY_APPROVED', 'UNDERWRITING_APPROVED']);
  const declined = new Set([
    'REJECTED',
    'WITHDRAWN',
    'CANCELLED',
    'EXPIRED',
    'UNDERWRITING_REJECTED',
  ]);
  if (approved.has(s)) return 'approved';
  if (declined.has(s)) return 'declined';
  if (s === 'DRAFT') return 'other';
  return 'active';
}

/* ─── skeleton ──────────────────────────────────────────────── */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

/* ─── donut chart (pure SVG) ────────────────────────────────── */

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
            const pct = seg.value / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
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
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-currentOffset}
                className="transition-all duration-700"
                style={{ transformOrigin: '70px 70px', transform: 'rotate(-90deg)' }}
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

/* ─── main component ────────────────────────────────────────── */

export default function PortalDashboard() {
  const user = useSelector((s: RootState) => s.auth.user);

  /* data states */
  const [taskCount, setTaskCount] = useState<number>(0);
  const [recentTasks, setRecentTasks] = useState<CustomerTask[]>([]);
  const [taskLoading, setTaskLoading] = useState(true);

  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [appLoading, setAppLoading] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);

  /* derived */
  const appCount = apps.length;
  const terminalStatuses = useMemo(
    () =>
      new Set([
        'COMPLETED',
        'WITHDRAWN',
        'CANCELLED',
        'DECLINED',
        'REJECTED',
        'EXPIRED',
        'UNDERWRITING_REJECTED',
      ]),
    []
  );
  const appActive = useMemo(
    () => apps.filter(a => !terminalStatuses.has(a.status)).length,
    [apps, terminalStatuses]
  );
  const totalRequested = useMemo(
    () => apps.reduce((s, a) => s + (a.requestedAmount || 0), 0),
    [apps]
  );
  const recentApps = useMemo(
    () =>
      [...apps]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [apps]
  );

  const msgTotal = conversations.length;
  const msgUnread = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return conversations.filter(
      c => c.lastMessageAt && new Date(c.lastMessageAt).getTime() > weekAgo
    ).length;
  }, [conversations]);

  /* status breakdown for donut chart */
  const statusBreakdown = useMemo(() => {
    const counts = { active: 0, approved: 0, declined: 0, other: 0 };
    apps.forEach(a => {
      counts[statusCategory(a.status)]++;
    });
    return [
      { value: counts.active, color: '#7f2b7b', label: 'In Progress' },
      { value: counts.approved, color: '#10b981', label: 'Approved' },
      { value: counts.declined, color: '#ef4444', label: 'Declined' },
      { value: counts.other, color: '#94a3b8', label: 'Draft / Other' },
    ];
  }, [apps]);

  /* ─── load data ──────────────────────────────────────────── */

  useEffect(() => {
    taskService
      .countPending()
      .then((res: TaskCountResponse) => setTaskCount(res.pendingCount))
      .catch(() => setTaskCount(0));

    taskService
      .listTasks('PENDING')
      .then((tasks: CustomerTask[]) => setRecentTasks(tasks.slice(0, 4)))
      .catch(() => setRecentTasks([]))
      .finally(() => setTaskLoading(false));

    applicationService
      .list(0, 100)
      .then((list: LoanApplication[]) => setApps(list))
      .catch(() => setApps([]))
      .finally(() => setAppLoading(false));

    messagingService
      .listConversations()
      .then((c: Conversation[]) => setConversations(c))
      .catch(() => setConversations([]))
      .finally(() => setMsgLoading(false));
  }, []);

  /* ─── render ─────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ─── Welcome banner ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b] p-6 md:p-8 text-white shadow-xl">
        {/* decorative circles */}
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
              Here&apos;s a quick overview of your banking activity and pending items.
            </p>
          </div>

          {/* quick action buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/portal/products"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-white border border-white/20 hover:bg-white/25 transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Application
            </Link>
            <Link
              href="/portal/documents"
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Upload Documents
            </Link>
          </div>
        </div>
      </div>

      {/* ─── KPI strip ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total applications */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-[#7f2b7b]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Applications</p>
              {appLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{appCount}</p>
              )}
            </div>
          </div>
        </div>

        {/* Active */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Active</p>
              {appLoading ? (
                <Skeleton className="h-7 w-10 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{appActive}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pending tasks */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Pending Tasks</p>
              {taskLoading ? (
                <Skeleton className="h-7 w-8 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{taskCount}</p>
              )}
            </div>
          </div>
        </div>

        {/* Total requested */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Total Requested</p>
              {appLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <p className="text-xl font-bold text-gray-900">
                  {totalRequested > 0 ? formatCurrency(totalRequested) : '—'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main content: 2 columns ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── LEFT: 2/3 width ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Applications */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-gray-900">My Applications</h3>
              <Link
                href="/portal/applications"
                className="text-xs font-medium text-[#7f2b7b] hover:text-[#5e1f5b] transition-colors"
              >
                See all →
              </Link>
            </div>

            {appLoading ? (
              <div className="px-6 pb-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentApps.length === 0 ? (
              <div className="px-6 pb-8 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mb-3">
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
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m12-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-3">No applications yet</p>
                <Link
                  href="/portal/products"
                  className="text-sm font-medium text-[#7f2b7b] hover:underline"
                >
                  Browse products →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentApps.map(app => (
                  <Link
                    key={app.applicationId}
                    href={`/portal/applications/${app.applicationId}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors group"
                  >
                    {/* icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f2b7b]/10 to-purple-100 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-[#7f2b7b]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                        />
                      </svg>
                    </div>
                    {/* info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {app.product?.productName ||
                            LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] ||
                            app.loanPurpose}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {app.applicationNumber} · {formatCurrency(app.requestedAmount)}
                      </p>
                    </div>
                    {/* arrow */}
                    <svg
                      className="w-4 h-4 text-gray-300 group-hover:text-[#7f2b7b] transition-colors flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pending Tasks */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-gray-900">Pending Tasks</h3>
              <Link
                href="/portal/tasks"
                className="text-xs font-medium text-[#7f2b7b] hover:text-[#5e1f5b] transition-colors"
              >
                See all →
              </Link>
            </div>

            {taskLoading ? (
              <div className="px-6 pb-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="px-6 pb-8 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <svg
                    className="w-6 h-6 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">All caught up!</p>
                <p className="text-xs text-gray-500 mt-1">No pending tasks at the moment</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentTasks.map(task => {
                  const due = dueDateLabel(task.slaDueAt);
                  const isOverdue = due === 'Overdue';
                  return (
                    <Link
                      key={task.id}
                      href={`/portal/tasks`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors group"
                    >
                      {/* priority indicator */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isOverdue ? 'bg-red-50' : 'bg-amber-50'}`}
                      >
                        <svg
                          className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          {isOverdue ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75"
                            />
                          )}
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {task.title || TASK_TYPE_LABELS[task.taskType] || task.taskType}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {due && (
                            <span
                              className={`text-[10px] font-semibold ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}
                            >
                              {due}
                            </span>
                          )}
                          <span
                            className={`text-[10px] ${TASK_PRIORITY_COLORS[task.priority] || 'text-gray-500'}`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-4 h-4 text-gray-300 group-hover:text-[#7f2b7b] transition-colors flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: 1/3 width ──────────────────────────────── */}
        <div className="space-y-6">
          {/* Application Overview donut */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Application Overview</h3>
            {appLoading ? (
              <Skeleton className="h-[140px] w-full" />
            ) : (
              <DonutChart segments={statusBreakdown} />
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  href: '/portal/products',
                  icon: (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                  ),
                  label: 'Apply Now',
                  color: 'from-[#7f2b7b] to-[#a0369b]',
                },
                {
                  href: '/portal/documents',
                  icon: (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                  ),
                  label: 'Upload Docs',
                  color: 'from-blue-500 to-blue-600',
                },
                {
                  href: '/portal/messages',
                  icon: (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                      />
                    </svg>
                  ),
                  label: 'Messages',
                  color: 'from-emerald-500 to-emerald-600',
                },
                {
                  href: '/portal/profile',
                  icon: (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  ),
                  label: 'Profile',
                  color: 'from-violet-500 to-violet-600',
                },
              ].map((action, idx) => (
                <Link
                  key={idx}
                  href={action.href}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 hover:border-purple-200 hover:shadow-md transition-all group"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
                  >
                    {action.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-700 group-hover:text-[#7f2b7b] transition-colors">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Messages */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-gray-900">Messages</h3>
              {msgUnread > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#7f2b7b]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7f2b7b]">
                  {msgUnread} new
                </span>
              )}
            </div>

            {msgLoading ? (
              <div className="px-6 pb-5 space-y-3">
                {[1, 2].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 pb-6 text-center">
                <p className="text-sm text-gray-500">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {conversations.slice(0, 3).map(conv => (
                  <Link
                    key={conv.id}
                    href="/portal/messages"
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#7f2b7b] to-purple-400 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{conv.subject}</p>
                      <p className="text-[10px] text-gray-500">
                        {conv.lastMessageAt ? formatMessageTime(conv.lastMessageAt) : 'No messages'}{' '}
                        · {conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {conversations.length > 3 && (
              <Link
                href="/portal/messages"
                className="block text-center py-3 border-t border-gray-50 text-xs font-medium text-[#7f2b7b] hover:bg-purple-50/30 transition-colors"
              >
                View all messages →
              </Link>
            )}
          </div>

          {/* Promotional banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#a0369b] to-[#c561b9] p-6 text-white shadow-lg">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute right-8 top-4 w-10 h-10 rounded-full bg-white/10" />
            <div className="relative z-10">
              <p className="text-3xl font-extrabold">100%</p>
              <p className="text-sm font-semibold mt-1">Paperless Digital Loan</p>
              <p className="text-xs text-purple-200 mt-2">
                Get instant and quick approval
                <br />
                with minimal documentation
              </p>
              <Link
                href="/portal/products"
                className="inline-block mt-4 rounded-lg bg-white text-[#7f2b7b] px-4 py-2 text-xs font-bold hover:bg-purple-50 transition-colors shadow-sm"
              >
                Apply now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
