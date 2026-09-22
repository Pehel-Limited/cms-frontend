'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store';
import config from '@/config';
import apiClient from '@/lib/api-client';
import { userService, type User } from '@/services/api/userService';
import { aiKnowledgeService, type KnowledgeSource } from '@/services/api/aiKnowledgeService';
import {
  SortableHeader,
  type SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

/*
 * Every figure rendered on this page is derived from a service response or from
 * Redux auth state — there are no hardcoded counts, dates or names.
 */

const PAGE_SIZE = 100;

const USER_STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: '#10b981' },
  PENDING_ACTIVATION: { label: 'Pending activation', color: '#f59e0b' },
  INACTIVE: { label: 'Inactive', color: '#64748b' },
  SUSPENDED: { label: 'Suspended', color: '#f43f5e' },
  LOCKED: { label: 'Locked', color: '#ef4444' },
};

const USER_TYPE_LABELS: Record<string, string> = {
  BANK_USER: 'Bank staff',
  CUSTOMER: 'Customer',
};

function humanise(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

function statusMeta(status?: string): { label: string; color: string } {
  if (!status) return { label: 'Unknown', color: '#94a3b8' };
  return USER_STATUS_META[status] || { label: humanise(status), color: '#94a3b8' };
}

function userTypeLabel(userType?: string): string {
  if (!userType) return '—';
  return USER_TYPE_LABELS[userType] || humanise(userType);
}

function displayName(u: User): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.fullName || u.username || '—';
}

function initialsOf(u: User): string {
  const parts = [u.firstName, u.lastName].filter(Boolean) as string[];
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (u.username || u.email || '?').charAt(0).toUpperCase();
}

function formatDateTime(value?: string): string {
  if (!value) return 'No sign-in recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusPill({ status }: { status?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

function Tile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
        >
          {icon}
        </span>
        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {label}
        </p>
      </div>
      <p
        className="mt-4 text-2xl font-semibold tabular-nums"
        style={{ color: 'var(--rm-text)' }}
      >
        {value}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {sub}
      </p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="px-5 py-4" aria-hidden="true">
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map(row => (
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
              className="h-6 w-24 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--rm-input)' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAppSelector(state => state.auth);

  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'createdAt',
    direction: 'desc',
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const getBankId = useCallback((): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(config.auth.userKey);
      if (raw) {
        try {
          return JSON.parse(raw).bankId || config.bank.defaultBankId;
        } catch {
          return config.bank.defaultBankId;
        }
      }
    }
    return config.bank.defaultBankId;
  }, [user?.bankId]);

  const loadUsers = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await userService.getUsers({
        search: term.trim() || undefined,
        page: 0,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
      });
      setUsers(Array.isArray(response?.content) ? response.content : []);
      setTotalUsers(
        typeof response?.totalElements === 'number' ? response.totalElements : null
      );
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load users:', err);
      const message = err instanceof Error ? err.message : 'Please try again.';
      setError(`Could not load users. ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Secondary counts load independently so a failure never blanks the user list. */
  const loadSecondary = useCallback(() => {
    apiClient
      .get<{ totalElements?: number }>('/api/v1/admin/users/pending', {
        params: { page: 0, size: 1 },
      })
      .then(res =>
        setPendingCount(
          typeof res.data?.totalElements === 'number' ? res.data.totalElements : null
        )
      )
      .catch(err => {
        console.warn('Pending activation count unavailable:', err);
        setPendingCount(null);
      })
      .finally(() => setSecondaryLoaded(true));

    aiKnowledgeService
      .listSources(getBankId())
      .then(data => setSources(Array.isArray(data) ? data : []))
      .catch(err => {
        console.warn('Knowledge source count unavailable:', err);
        setSources(null);
      });
  }, [getBankId]);

  /* Debounced server-side search; also performs the initial load. */
  useEffect(() => {
    const timer = setTimeout(() => loadUsers(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, loadUsers]);

  useEffect(() => {
    loadSecondary();
  }, [loadSecondary]);

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));
  const sortedUsers = useMemo(() => sortData(users, sortConfig), [users, sortConfig]);

  const activeSources = useMemo(
    () => (sources ? sources.filter(s => s.status === 'ACTIVE').length : null),
    [sources]
  );
  const draftSources = useMemo(
    () => (sources ? sources.filter(s => s.status === 'DRAFT').length : null),
    [sources]
  );

  const roleNames = useMemo(() => {
    const roles = user?.roles ?? [];
    return roles
      .map(r => (typeof r === 'string' ? r : r?.roleName))
      .filter((r): r is string => Boolean(r));
  }, [user?.roles]);

  const refresh = () => {
    loadUsers(search);
    loadSecondary();
  };

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';
  const truncated = totalUsers !== null && users.length < totalUsers;

  return (
    <div className="space-y-8" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Review the people who can access this portal and the knowledge base used for AI
            answers.
          </p>
          {lastUpdated && (
            <p className="mt-2 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
              Updated{' '}
              {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
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

      {/* ══ Counts ══ */}
      <section aria-label="Administration counts" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Users"
          value={totalUsers === null ? '—' : totalUsers.toLocaleString()}
          sub={
            totalUsers === null
              ? 'Unavailable right now'
              : search.trim()
                ? `Matching “${search.trim()}”`
                : 'Registered for your bank'
          }
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <Tile
          label="Pending activations"
          value={pendingCount === null ? '—' : pendingCount.toLocaleString()}
          sub={
            pendingCount === null
              ? secondaryLoaded
                ? 'Unavailable right now'
                : 'Loading…'
              : pendingCount === 1
                ? 'Account waiting for review'
                : 'Accounts waiting for review'
          }
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <Tile
          label="Knowledge sources"
          value={sources === null ? '—' : sources.length.toLocaleString()}
          sub={
            sources === null
              ? 'Unavailable right now'
              : `${activeSources ?? 0} active · ${draftSources ?? 0} draft`
          }
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
        <Tile
          label="Your access"
          value={userTypeLabel(user?.userType)}
          sub={
            roleNames.length > 0
              ? `${roleNames.length} ${roleNames.length === 1 ? 'role' : 'roles'}: ${roleNames.join(', ')}`
              : 'No roles returned for your account'
          }
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          }
        />
      </section>

      {/* ══ Users ══ */}
      <section className="space-y-5" aria-labelledby="admin-users-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="admin-users-heading"
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Users
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {loading
                ? 'Loading users…'
                : `${sortedUsers.length} shown${totalUsers !== null ? ` of ${totalUsers} registered` : ''} · select a column heading to sort`}
            </p>
          </div>
          <div>
            <label
              htmlFor="admin-user-search"
              className="mb-1.5 block text-sm"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Search by name, username or email
            </label>
            <input
              id="admin-user-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users"
              autoComplete="off"
              className="w-full rounded-xl px-4 py-2.5 text-base sm:w-80"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }}>
          {error ? (
            <div className="px-6 py-10 text-center sm:px-7">
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                Users could not be loaded
              </p>
              <p
                className="mx-auto mt-1.5 max-w-md text-sm"
                style={{ color: 'var(--rm-text-muted)' }}
                role="alert"
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() => loadUsers(search)}
                className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                Try again
              </button>
            </div>
          ) : loading && users.length === 0 ? (
            <TableSkeleton />
          ) : sortedUsers.length === 0 ? (
            <div className="px-6 py-16 text-center sm:px-7">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--rm-accent-muted)' }}
              >
                <svg
                  className="h-7 w-7"
                  style={{ color: 'var(--rm-accent)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                {search.trim() ? 'No users match your search' : 'No users found'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {search.trim()
                  ? 'Try a different name, username or email address.'
                  : 'Users appear here once accounts have been created for your bank.'}
              </p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--rm-input)',
                    color: 'var(--rm-text)',
                    border: '1px solid var(--rm-border)',
                  }}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Users table, scrollable horizontally"
              tabIndex={0}
            >
              <table className="w-full" aria-label="Users registered for your bank">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <SortableHeader
                      label="User"
                      field="firstName"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Username"
                      field="username"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Type"
                      field="userType"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Last sign-in"
                      field="lastLoginAt"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map(u => (
                    <tr
                      key={u.userId}
                      className="hover:bg-slate-50"
                      style={{ borderBottom: '1px solid var(--rm-border)' }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                            style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}
                            aria-hidden="true"
                          >
                            {initialsOf(u)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="truncate text-base font-medium"
                              style={{ color: 'var(--rm-text)' }}
                            >
                              {displayName(u)}
                            </p>
                            <p
                              className="truncate text-sm"
                              style={{ color: 'var(--rm-text-muted)' }}
                            >
                              {u.email || 'No email on file'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {u.username ? `@${u.username}` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {userTypeLabel(u.userType)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={u.status} />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                          {formatDateTime(u.lastLoginAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!error && sortedUsers.length > 0 && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm"
              style={{ borderTop: '1px solid var(--rm-border)', color: 'var(--rm-text-muted)' }}
            >
              <span className="tabular-nums">
                Showing {sortedUsers.length}
                {totalUsers !== null ? ` of ${totalUsers}` : ''} users
              </span>
              {truncated && (
                <span>
                  Only the first {users.length} are loaded — search to narrow the list.
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ══ Admin areas ══ */}
      <section className="space-y-5" aria-labelledby="admin-areas-heading">
        <h2
          id="admin-areas-heading"
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          Admin areas
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/dashboard/admin/pending-users"
            className="group rounded-3xl bg-[color:var(--rm-card)] p-6 transition-colors hover:bg-[color:var(--rm-card-hover)]"
          >
            <div className="flex items-start gap-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706' }}
                aria-hidden="true"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                  Review pending activations
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {pendingCount === null
                    ? 'Approve or reject accounts waiting for access.'
                    : pendingCount === 0
                      ? 'No accounts are waiting for review.'
                      : `${pendingCount} ${pendingCount === 1 ? 'account' : 'accounts'} waiting for review.`}
                </p>
                <span
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium group-hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  Open pending activations
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/admin/ai-knowledge"
            className="group rounded-3xl bg-[color:var(--rm-card)] p-6 transition-colors hover:bg-[color:var(--rm-card-hover)]"
          >
            <div className="flex items-start gap-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                aria-hidden="true"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                  Manage the AI knowledge base
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {sources === null
                    ? 'Register policy documents and test cited search.'
                    : sources.length === 0
                      ? 'No sources registered yet.'
                      : `${sources.length} ${sources.length === 1 ? 'source' : 'sources'} registered · ${activeSources ?? 0} active.`}
                </p>
                <span
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium group-hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  Open AI knowledge base
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
