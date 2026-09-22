'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

const TAB_LABELS: Record<TabFilter, string> = {
  PENDING: 'To do',
  DONE: 'Completed',
  ALL: 'All',
};

/* ─── Skeleton loader ──────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<CustomerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('PENDING');
  const [completing, setCompleting] = useState<string | null>(null);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const completeButtonRef = useRef<HTMLButtonElement>(null);

  /* One fetch of the full list keeps the per-tab counts honest — filtering
     server-side and then counting the result would misreport the other tabs. */
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taskService.listTasks();
      setTasks(data);
    } catch (err: unknown) {
      console.error('Failed to load tasks', err);
      setError(err instanceof Error ? err.message : 'Unable to load your tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const counts = useMemo(
    () => ({
      PENDING: tasks.filter(isPending).length,
      DONE: tasks.filter(t => t.status === 'DONE').length,
      ALL: tasks.length,
    }),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    const filtered =
      activeTab === 'PENDING'
        ? tasks.filter(isPending)
        : activeTab === 'DONE'
          ? tasks.filter(t => t.status === 'DONE')
          : tasks;
    /* Overdue first, then soonest due — the order the customer actually cares about. */
    return [...filtered].sort((a, b) => {
      const aDue = a.slaDueAt ? new Date(a.slaDueAt).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.slaDueAt ? new Date(b.slaDueAt).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });
  }, [tasks, activeTab]);

  const confirmedTask = tasks.find(t => t.id === confirmTaskId) ?? null;

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    setConfirmTaskId(null);
    setActionError(null);
    try {
      await taskService.completeTask(taskId);
      await fetchTasks();
    } catch (err: unknown) {
      console.error('Failed to complete task', err);
      setActionError(
        err instanceof Error ? err.message : 'We couldn’t mark this task as done. Please try again.'
      );
    } finally {
      setCompleting(null);
    }
  };

  /* Return focus to the confirm action when the dialog opens */
  useEffect(() => {
    if (confirmTaskId) completeButtonRef.current?.focus();
  }, [confirmTaskId]);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mesh-hero relative overflow-hidden rounded-3xl p-6 shadow-float sm:p-7">
        <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-2xl" />

        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">My tasks</h1>
          <p className="mt-1.5 text-sm text-white/75">
            {loading
              ? 'Loading your tasks…'
              : counts.PENDING > 0
                ? `${counts.PENDING} ${counts.PENDING === 1 ? 'task needs' : 'tasks need'} your attention`
                : 'Nothing needs your attention right now'}
          </p>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div
        className="segmented no-scrollbar max-w-full overflow-x-auto"
        role="group"
        aria-label="Filter tasks"
        tabIndex={0}
      >
        {(Object.keys(TAB_LABELS) as TabFilter[]).map(key => (
          <button
            key={key}
            type="button"
            aria-pressed={activeTab === key}
            data-active={activeTab === key ? 'true' : undefined}
            onClick={() => setActiveTab(key)}
            className="segmented-item"
          >
            {TAB_LABELS[key]}
            <span className="ml-0.5 text-xs tabular-nums opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {actionError && (
        <div className="alert alert-error flex-col sm:flex-row sm:items-center" role="alert">
          <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p className="flex-1">{actionError}</p>
          <button onClick={fetchTasks} className="btn btn-sm btn-outline shrink-0">
            Reload tasks
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" role="status">Loading your tasks…</p>
          {[1, 2, 3].map(i => (
            <div key={i} className="panel px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3.5 w-full max-w-md" />
                  <div className="flex gap-4 pt-1">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                </div>
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error flex-col items-center text-center" role="alert">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div>
            <p className="font-semibold">We couldn&apos;t load your tasks</p>
            <p className="mt-0.5 text-sm opacity-80">{error}</p>
          </div>
          <button onClick={fetchTasks} className="btn btn-sm btn-outline">
            Try again
          </button>
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <ul className="space-y-3">
          {visibleTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              completing={completing === task.id}
              onRequestComplete={() => setConfirmTaskId(task.id)}
            />
          ))}
        </ul>
      )}

      {/* ── Confirm dialog ─────────────────────────────────── */}
      {confirmTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-task-title"
          aria-describedby="confirm-task-desc"
          onKeyDown={e => {
            if (e.key === 'Escape') setConfirmTaskId(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-6 text-center"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--surface-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2
              id="confirm-task-title"
              className="text-lg font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Mark this task as done?
            </h2>
            <p id="confirm-task-desc" className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {confirmedTask?.title ?? 'This action cannot be undone.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setConfirmTaskId(null)} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                ref={completeButtonRef}
                onClick={() => handleComplete(confirmTaskId)}
                className="btn btn-primary flex-1"
              >
                Mark as done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Task Card ─────────────────────────────────────────────── */

function TaskCard({
  task,
  completing,
  onRequestComplete,
}: {
  task: CustomerTask;
  completing: boolean;
  onRequestComplete: () => void;
}) {
  const overdue = isOverdue(task);
  const pending = isPending(task);
  const dueLabel = dueDateLabel(task.slaDueAt);
  const statusLabel = TASK_STATUS_LABELS[task.status] || task.status;
  const statusColor = TASK_STATUS_COLORS[task.status] || 'badge-neutral';
  const priorityLabel = TASK_PRIORITY_LABELS[task.priority] || task.priority;
  const priorityColor = TASK_PRIORITY_COLORS[task.priority] || '';

  return (
    <li>
      <div
        className="panel px-5 py-4"
        style={
          overdue
            ? { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.05)' }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {task.title}
              </h2>
              <span className={`badge ${statusColor}`}>{statusLabel}</span>
              {overdue && (
                <span className="badge badge-error">
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Overdue
                </span>
              )}
            </div>

            {task.description && (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {task.description}
              </p>
            )}

            <div
              className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className={`inline-flex items-center font-medium ${priorityColor}`}>
                {priorityLabel} priority
              </span>

              <span className="inline-flex items-center gap-1.5">
                <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                {TASK_TYPE_LABELS[task.taskType] || task.taskType}
              </span>

              {dueLabel && !overdue && (
                <span className="inline-flex items-center gap-1.5">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              {task.applicationId && (
                <Link
                  href={`/portal/applications/${task.applicationId}`}
                  className="link-arrow"
                  onClick={e => e.stopPropagation()}
                >
                  View application <span data-arrow aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {pending && (
              <button
                type="button"
                onClick={onRequestComplete}
                disabled={completing}
                className="btn btn-primary btn-sm"
              >
                {completing ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                    Saving…
                  </span>
                ) : (
                  'Mark as done'
                )}
              </button>
            )}

            {task.status === 'DONE' && (
              <span className="badge badge-success">
                <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Completed
                {task.completedAt ? ` ${new Date(task.completedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/* ─── Empty state ───────────────────────────────────────────── */

function EmptyState({ activeTab }: { activeTab: TabFilter }) {
  const messages: Record<TabFilter, { title: string; sub: string }> = {
    PENDING: {
      title: 'No tasks to do',
      sub: 'Nothing needs your attention right now. We’ll let you know when your application needs something from you.',
    },
    DONE: {
      title: 'No completed tasks yet',
      sub: 'Tasks you complete will be listed here for your records.',
    },
    ALL: {
      title: 'No tasks yet',
      sub: 'Tasks appear here when your application needs a document, a signature or a decision from you.',
    },
  };

  const { title, sub } = messages[activeTab];

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      </div>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-text">{sub}</p>
      <Link href="/portal/applications" className="btn btn-secondary btn-sm mt-5">
        View your applications
      </Link>
    </div>
  );
}
