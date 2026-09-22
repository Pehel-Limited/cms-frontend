'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';

interface User {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  status: string;
  createdAt: string;
  bankId: string;
}

interface PageResponse {
  content: User[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

const PAGE_SIZE = 10;

function errorOf(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || fallback;
}

function fullName(user: User): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || 'this user';
}

function initialsOf(user: User): string {
  const first = user.firstName?.[0] ?? '';
  const last = user.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || (user.username ?? '?').charAt(0).toUpperCase();
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanise(value?: string): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

export default function PendingUsersPage() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  /* Scoped per-row failure — the list and any open confirmation stay on screen. */
  const [actionError, setActionError] = useState<{ userId: string; message: string } | null>(null);
  const [confirmingReject, setConfirmingReject] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchPendingUsers = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<PageResponse>('/api/v1/admin/users/pending', {
          params: { page, size: PAGE_SIZE, sort: 'createdAt,desc' },
        });
        const content = Array.isArray(response.data?.content) ? response.data.content : [];
        setPendingUsers(content);
        setTotalPages(response.data?.totalPages ?? 0);
        setTotalElements(response.data?.totalElements ?? content.length);
        /* Last item on a non-first page was actioned — step back a page. */
        if (content.length === 0 && page > 0) setPage(p => Math.max(0, p - 1));
      } catch (err) {
        console.error('Failed to load pending users:', err);
        setError(errorOf(err, 'Pending activations could not be loaded.'));
      } finally {
        setLoading(false);
      }
    },
    [page]
  );

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  const runAction = async (user: User, kind: 'activate' | 'reject') => {
    setActionLoading(user.userId);
    setActionError(null);
    setNotice(null);
    try {
      await apiClient.put(
        `/api/v1/admin/users/${user.userId}/${kind === 'activate' ? 'activate' : 'deactivate'}`
      );
      setConfirmingReject(null);
      setNotice(
        kind === 'activate'
          ? `${fullName(user)} was activated and can now sign in.`
          : `${fullName(user)} was rejected and their account was deactivated.`
      );
      await fetchPendingUsers({ silent: true });
    } catch (err) {
      console.error(`Failed to ${kind} user:`, err);
      setActionError({
        userId: user.userId,
        message: errorOf(err, `Could not ${kind} ${fullName(user)}.`),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingLabel =
    totalElements === 1 ? '1 account waiting for review' : `${totalElements} accounts waiting for review`;

  return (
    <div className="space-y-8" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Pending activations</h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Review registration requests, then activate or reject each account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchPendingUsers()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
        >
          <svg
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </header>

      {/* ══ Outcome of the last action ══ */}
      {notice && (
        <p
          role="status"
          className="rounded-2xl px-5 py-4 text-sm"
          style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#059669' }}
        >
          {notice}
        </p>
      )}

      {/* ══ List ══ */}
      <section className="space-y-5" aria-labelledby="pending-users-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="pending-users-heading"
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            Registration requests
          </h2>
          <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
            {loading ? 'Loading requests…' : pendingLabel} · newest first
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }}>
          {error ? (
            <div className="px-6 py-12 text-center sm:px-7">
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                Requests could not be loaded
              </p>
              <p
                role="alert"
                className="mx-auto mt-1.5 max-w-md text-sm"
                style={{ color: 'var(--rm-text-muted)' }}
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() => fetchPendingUsers()}
                className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                Try again
              </button>
            </div>
          ) : loading && pendingUsers.length === 0 ? (
            <div className="px-5 py-5" aria-hidden="true">
              <div className="space-y-4">
                {[0, 1, 2, 3].map(row => (
                  <div key={row} className="flex items-center gap-4">
                    <div
                      className="h-10 w-10 shrink-0 rounded-full animate-pulse"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                    />
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-3.5 w-40 rounded-full animate-pulse"
                        style={{ backgroundColor: 'var(--rm-input)' }}
                      />
                      <div
                        className="h-3 w-56 max-w-full rounded-full animate-pulse"
                        style={{ backgroundColor: 'var(--rm-input)' }}
                      />
                    </div>
                    <div
                      className="h-9 w-28 rounded-full animate-pulse"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="px-6 py-16 text-center sm:px-7">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(16,185,129,0.14)' }}
              >
                <svg
                  className="h-7 w-7"
                  style={{ color: '#10b981' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                Nothing waiting for review
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Every registration request has been actioned.
              </p>
            </div>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Registration requests, scrollable horizontally"
              tabIndex={0}
            >
              <table className="w-full" aria-label="Pending user activations">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-sm font-medium"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      User
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-sm font-medium"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-sm font-medium"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-sm font-medium"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-left text-sm font-medium"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      Registered
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right text-sm font-medium"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(user => {
                    const busy = actionLoading === user.userId;
                    const rowError = actionError?.userId === user.userId ? actionError.message : null;
                    const confirming = confirmingReject === user.userId;
                    return (
                      <tr
                        key={user.userId}
                        className="align-top hover:bg-slate-50"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                              style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}
                              aria-hidden="true"
                            >
                              {initialsOf(user)}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="truncate text-base font-medium"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {fullName(user)}
                              </p>
                              <p className="truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                                @{user.username}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                            {user.email || 'No email provided'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                            {humanise(user.userType)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                            style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706' }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: '#f59e0b' }}
                            />
                            {humanise(user.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                            {formatDate(user.createdAt)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {confirming ? (
                            <div
                              className="flex flex-wrap items-center justify-end gap-2"
                              role="group"
                              aria-label={`Confirm rejection for ${fullName(user)}`}
                            >
                              <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                                Reject @{user.username}? Their account will be deactivated.
                              </span>
                              <button
                                type="button"
                                onClick={() => runAction(user, 'reject')}
                                disabled={busy}
                                className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ backgroundColor: '#ef4444' }}
                              >
                                {busy ? 'Rejecting…' : 'Confirm reject'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingReject(null)}
                                disabled={busy}
                                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--rm-input)',
                                  color: 'var(--rm-text-secondary)',
                                  border: '1px solid var(--rm-border)',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => runAction(user, 'activate')}
                                disabled={busy}
                                aria-label={`Activate ${fullName(user)}, @${user.username}`}
                                className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ backgroundColor: 'var(--rm-accent)' }}
                              >
                                {busy ? 'Working…' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setConfirmingReject(user.userId);
                                }}
                                disabled={busy}
                                aria-label={`Reject ${fullName(user)}, @${user.username}`}
                                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  backgroundColor: 'rgba(239,68,68,0.12)',
                                  color: '#dc2626',
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {rowError && (
                            <p
                              role="alert"
                              className="mt-2 text-right text-sm"
                              style={{ color: '#dc2626' }}
                            >
                              {rowError}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ Pagination ══ */}
          {!error && totalPages > 1 && (
            <nav
              aria-label="Pending activations pagination"
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              style={{ borderTop: '1px solid var(--rm-border)' }}
            >
              <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                Page {page + 1} of {totalPages} · {totalElements} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--rm-input)',
                    color: 'var(--rm-text-secondary)',
                    border: '1px solid var(--rm-border)',
                  }}
                >
                  Previous page
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--rm-input)',
                    color: 'var(--rm-text-secondary)',
                    border: '1px solid var(--rm-border)',
                  }}
                >
                  Next page
                </button>
              </div>
            </nav>
          )}
        </div>
      </section>

      {loading && pendingUsers.length > 0 && (
        <p className="sr-only" role="status">
          Refreshing pending activations
        </p>
      )}
    </div>
  );
}
