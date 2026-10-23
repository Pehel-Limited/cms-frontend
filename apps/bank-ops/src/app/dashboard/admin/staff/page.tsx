'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store';
import { userService, type User } from '@/services/api/userService';
import {
  SortableHeader,
  type SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

/*
 * The staff register. Moved here from /dashboard/admin when that route became the executive
 * overview; every figure comes from the user service or from Redux auth state.
 */

const PAGE_SIZE = 100;

/* The admin roster is bank staff; customer logins are reviewed under Customers. */
const STAFF_USER_TYPE = 'BANK_USER';

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
              <div className="h-3.5 w-40 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              <div
                className="h-3 w-56 max-w-full rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--rm-input)' }}
              />
            </div>
            <div className="h-6 w-24 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StaffPage() {
  const { user } = useAppSelector(state => state.auth);

  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'createdAt',
    direction: 'desc',
  });

  const loadUsers = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await userService.getUsers({
        search: term.trim() || undefined,
        userType: STAFF_USER_TYPE,
        page: 0,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
      });
      setUsers(Array.isArray(response?.content) ? response.content : []);
      setTotalUsers(typeof response?.totalElements === 'number' ? response.totalElements : null);
    } catch (err) {
      console.error('Failed to load users:', err);
      const message = err instanceof Error ? err.message : 'Please try again.';
      setError(`Could not load users. ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Debounced server-side search; also performs the initial load. */
  useEffect(() => {
    const timer = setTimeout(() => loadUsers(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, loadUsers]);

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));
  const sortedUsers = useMemo(() => sortData(users, sortConfig), [users, sortConfig]);

  const roleNames = useMemo(() => {
    const roles = user?.roles ?? [];
    return roles
      .map(r => (typeof r === 'string' ? r : (r as { roleName?: string })?.roleName))
      .filter((r): r is string => Boolean(r));
  }, [user?.roles]);

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';
  const truncated = totalUsers !== null && users.length < totalUsers;

  return (
    <div className="space-y-8" style={{ color: 'var(--rm-text)' }}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: 'var(--rm-accent)' }}
          >
            <svg className="h-4 w-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Executive overview
          </Link>
          <h1 className="serif mt-2 text-3xl font-semibold tracking-tight">Bank staff</h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            The people who can access this portal.
            {roleNames.length > 0 && (
              <>
                {' '}
                Your account holds {roleNames.length} {roleNames.length === 1 ? 'role' : 'roles'}:{' '}
                {roleNames.join(', ')}.
              </>
            )}
          </p>
        </div>
        <div>
          <label htmlFor="staff-search" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
            Search by name, username or email
          </label>
          <input
            id="staff-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bank staff"
            autoComplete="off"
            className="w-full rounded-xl px-4 py-2.5 text-base sm:w-80"
            style={{
              backgroundColor: 'var(--rm-input)',
              border: '1px solid var(--rm-border)',
              color: 'var(--rm-text)',
            }}
          />
        </div>
      </header>

      <div className="overflow-hidden rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }}>
        {error ? (
          <div className="px-6 py-10 text-center sm:px-7">
            <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
              Bank staff could not be loaded
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm" style={{ color: 'var(--rm-text-muted)' }} role="alert">
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
            <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
              {search.trim() ? 'No staff match your search' : 'No bank staff found'}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {search.trim()
                ? 'Try a different name, username or email address.'
                : 'Staff accounts appear here once they have been created for your bank.'}
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
            aria-label="Bank staff table, scrollable horizontally"
            tabIndex={0}
          >
            <table className="w-full" aria-label="Bank staff with access to this portal">
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
                  <tr key={u.userId} style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                          style={{
                            backgroundColor: 'var(--rm-accent-muted)',
                            color: 'var(--rm-accent)',
                          }}
                          aria-hidden="true"
                        >
                          {initialsOf(u)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {displayName(u)}
                          </p>
                          <p className="truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
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
                        {u.userType ? USER_TYPE_LABELS[u.userType] || humanise(u.userType) : '—'}
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
              {totalUsers !== null ? ` of ${totalUsers}` : ''} bank staff
            </span>
            {truncated && (
              <span>Only the first {users.length} are loaded — search to narrow the list.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
