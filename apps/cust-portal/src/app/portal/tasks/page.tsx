'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  taskService,
  CustomerTask,
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  isPending,
  dueDateLabel,
  isOverdue,
} from '@/services/api/task-service';

type TabFilter = 'PENDING' | 'DONE' | 'ALL';

/* ─── Skeleton loader ──────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<CustomerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('PENDING');
  const [completing, setCompleting] = useState<string | null>(null);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab === 'ALL' ? undefined : activeTab;
      const data = await taskService.listTasks(statusParam);
      setTasks(data);
    } catch (err: unknown) {
      console.error('Failed to load tasks', err);
      setError('Unable to load your tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    setConfirmTaskId(null);
    try {
      await taskService.completeTask(taskId);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to complete task', err);
    } finally {
      setCompleting(null);
    }
  };

  const tabs: { key: TabFilter; label: string; icon: React.ReactNode }[] = [
    {
      key: 'PENDING',
      label: 'Pending',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      key: 'DONE',
      label: 'Completed',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      key: 'ALL',
      label: 'All',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Hero header ────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />

        <div className="relative">
          <h1 className="text-2xl font-bold text-white">My Tasks</h1>
          <p className="mt-1 text-sm text-white/70">
            Action items that need your attention — upload documents, review offers, and more.
          </p>
        </div>

        {/* Filter pills */}
        <div className="relative mt-6 flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-[#7f2b7b] shadow-md'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/10'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`ml-1 text-xs tabular-nums ${
                  activeTab === tab.key ? 'text-[#7f2b7b]/60' : 'text-white/50'
                }`}
              >
                {tab.key === 'ALL'
                  ? tasks.length
                  : tasks.filter(t => (tab.key === 'PENDING' ? isPending(t) : t.status === 'DONE'))
                      .length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-3 w-96" />
                  <div className="flex gap-4 pt-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-9 w-24 rounded-xl" />
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
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={fetchTasks}
            className="mt-4 text-sm font-medium text-red-700 hover:text-red-800 underline decoration-red-300 underline-offset-4 hover:decoration-red-500"
          >
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              completing={completing === task.id}
              showConfirm={confirmTaskId === task.id}
              onRequestComplete={() => setConfirmTaskId(task.id)}
              onCancelComplete={() => setConfirmTaskId(null)}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}

      {/* ── Confirm modal (backdrop-blur) ──────────────────── */}
      {confirmTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Mark task as complete?</h3>
            <p className="mt-1 text-sm text-slate-500">This action cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmTaskId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleComplete(confirmTaskId)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Task Card ─────────────────────────────────────────────── */

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-red-500',
  URGENT: 'bg-red-600',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-slate-400',
  NORMAL: 'bg-blue-500',
};

const PRIORITY_BG: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700',
  URGENT: 'bg-red-50 text-red-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  LOW: 'bg-slate-50 text-slate-600',
  NORMAL: 'bg-blue-50 text-blue-700',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-amber-500',
  DONE: 'bg-emerald-500',
  IN_PROGRESS: 'bg-blue-500',
};

const STATUS_BG: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  DONE: 'bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
};

function TaskCard({
  task,
  completing,
  showConfirm,
  onRequestComplete,
  onCancelComplete,
  onComplete,
}: {
  task: CustomerTask;
  completing: boolean;
  showConfirm: boolean;
  onRequestComplete: () => void;
  onCancelComplete: () => void;
  onComplete: (id: string) => void;
}) {
  const overdue = isOverdue(task);
  const pending = isPending(task);
  const dueLabel = dueDateLabel(task.slaDueAt);
  const priorityDot = PRIORITY_DOT[task.priority] || 'bg-slate-400';
  const priorityBg = PRIORITY_BG[task.priority] || 'bg-slate-50 text-slate-600';
  const statusLabel = TASK_STATUS_LABELS[task.status] || task.status;
  const statusDot = STATUS_DOT[task.status] || 'bg-slate-400';
  const statusBg = STATUS_BG[task.status] || 'bg-slate-50 text-slate-600';

  return (
    <div
      className={`rounded-2xl border p-5 transition-all hover:shadow-md ${
        overdue ? 'border-red-200/80 bg-red-50/40' : 'border-slate-200/80 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{task.title}</h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
          </div>

          {task.description && (
            <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{task.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
            {/* Priority */}
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${priorityBg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${priorityDot}`} />
              {TASK_PRIORITY_LABELS[task.priority] || task.priority}
            </span>

            {/* Type */}
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
              {TASK_TYPE_LABELS[task.taskType] || task.taskType}
            </span>

            {/* Due date */}
            {dueLabel && (
              <span
                className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-red-600' : ''}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {dueLabel}
              </span>
            )}

            {/* Application link */}
            {task.applicationId && (
              <Link
                href={`/portal/applications/${task.applicationId}`}
                className="text-[#7f2b7b] hover:text-[#6b2568] font-medium"
                onClick={e => e.stopPropagation()}
              >
                View Application →
              </Link>
            )}
          </div>
        </div>

        {/* Right: action */}
        {pending && (
          <button
            onClick={onRequestComplete}
            disabled={completing}
            className="shrink-0 rounded-xl bg-[#7f2b7b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#6b2568] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {completing ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Completing…
              </span>
            ) : (
              'Mark Done'
            )}
          </button>
        )}

        {task.status === 'DONE' && (
          <span className="shrink-0 flex items-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-xl">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Done
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Empty state ───────────────────────────────────────────── */

function EmptyState({ activeTab }: { activeTab: TabFilter }) {
  const messages: Record<TabFilter, { title: string; sub: string }> = {
    PENDING: {
      title: 'All caught up!',
      sub: "You have no pending tasks right now. We'll notify you when something needs your attention.",
    },
    DONE: {
      title: 'No completed tasks yet',
      sub: 'Tasks you complete will appear here for your records.',
    },
    ALL: {
      title: 'No tasks',
      sub: 'Tasks will appear here when your application progresses.',
    },
  };

  const { title, sub } = messages[activeTab];

  return (
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{sub}</p>
    </div>
  );
}
