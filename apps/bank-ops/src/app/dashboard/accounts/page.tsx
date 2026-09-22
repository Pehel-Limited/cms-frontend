'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  accountService,
  type AccountSummaryResponse,
  type AccountCategory,
  type AccountStatus,
  type AccountStatsResponse,
  accountCategoryLabels,
  accountStatusLabels,
  accountTypeLabels,
  formatCurrency,
} from '@/services/api/accountService';
import { useAppSelector } from '@/store';
import config from '@/config';
import {
  SortableHeader,
  type SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

type StatusFilter = 'all' | AccountStatus;
type CategoryFilter = 'all' | AccountCategory;

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All categories' },
  ...(Object.keys(accountCategoryLabels) as AccountCategory[]).map(c => ({
    value: c as CategoryFilter,
    label: `${accountCategoryLabels[c]} accounts`,
  })),
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...(Object.keys(accountStatusLabels) as AccountStatus[]).map(s => ({
    value: s as StatusFilter,
    label: accountStatusLabels[s],
  })),
];

/* ------------------------------------------------------------------ */
/* Tones — every chip carries its text label, colour is never the only  */
/* signal. Backgrounds use translucent rgba() so both themes work.      */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';

const TONE_BG: Record<Tone, string> = {
  neutral: 'rgba(127,127,127,0.12)',
  positive: 'rgba(16,185,129,0.14)',
  warning: 'rgba(245,158,11,0.16)',
  negative: 'rgba(239,68,68,0.14)',
  accent: 'var(--rm-accent-muted)',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'var(--rm-text-muted)',
  positive: '#10b981',
  warning: '#f59e0b',
  negative: '#ef4444',
  accent: 'var(--rm-accent)',
};

const statusTone = (s: string): Tone => {
  switch ((s || '').toUpperCase()) {
    case 'ACTIVE':
      return 'positive';
    case 'PENDING':
    case 'DORMANT':
      return 'warning';
    case 'FROZEN':
      return 'accent';
    case 'CLOSED':
    case 'BLOCKED':
      return 'negative';
    default:
      return 'neutral';
  }
};

const categoryTone = (c: string): Tone => {
  switch ((c || '').toUpperCase()) {
    case 'DEPOSIT':
      return 'positive';
    case 'CREDIT':
      return 'accent';
    default:
      return 'neutral';
  }
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
      style={{ backgroundColor: TONE_BG[tone], color: 'var(--rm-text)' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: TONE_DOT[tone] }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

/** Amounts are shown in full — no lossy abbreviations of real balances. */
function money(n: number, currency?: string): string {
  return formatCurrency(n, currency);
}

/* Row view-model so the shared sorter can address derived values. */
type AccountRow = AccountSummaryResponse & {
  rowHolder: string;
  rowAccountName: string;
  rowType: string;
  rowStatus: string;
  rowBalance: number;
};

const SORT_CLASS = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AccountsPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [accounts, setAccounts] = useState<AccountSummaryResponse[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountSummaryResponse[]>([]);
  const [stats, setStats] = useState<AccountStatsResponse | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AccountSummaryResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'rowBalance',
    direction: 'desc',
  });

  const getBankId = useCallback((): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          return JSON.parse(userDataStr).bankId || config.bank.defaultBankId;
        } catch {
          return config.bank.defaultBankId;
        }
      }
    }
    return config.bank.defaultBankId;
  }, [user?.bankId]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bankId = getBankId();
      const response = searchTerm
        ? await accountService.searchAccounts(bankId, searchTerm, page, PAGE_SIZE)
        : statusFilter !== 'all'
          ? await accountService.getAccountsByStatus(statusFilter, bankId, page, PAGE_SIZE)
          : categoryFilter !== 'all'
            ? await accountService.getAccountsByCategory(categoryFilter, bankId, page, PAGE_SIZE)
            : await accountService.getAccounts(bankId, page, PAGE_SIZE);

      setAccounts(response.content || []);
      setTotalPages(response.totalPages || 0);
      setTotalElements(response.totalElements || 0);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError('We could not load the accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getBankId, page, searchTerm, statusFilter, categoryFilter]);

  /* Secondary loads — a failure here must never blank the page. */
  const loadStats = useCallback(async () => {
    try {
      setStats(await accountService.getAccountStats(getBankId()));
      setStatsUnavailable(false);
    } catch (err) {
      console.error('Failed to load account stats:', err);
      setStats(null);
      setStatsUnavailable(true);
    }
  }, [getBankId]);

  const loadAggregate = useCallback(async () => {
    try {
      const res = await accountService.getAccounts(getBankId(), 0, 500);
      setAllAccounts(res.content || []);
      setStatsUnavailable(false);
    } catch (err) {
      console.error('Failed to load aggregate accounts:', err);
      setAllAccounts([]);
      setStatsUnavailable(true);
    }
  }, [getBankId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadStats();
    loadAggregate();
  }, [loadStats, loadAggregate]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, categoryFilter, searchTerm]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await accountService.deleteAccount(deleteTarget.accountId);
      setAccounts(prev => prev.filter(a => a.accountId !== deleteTarget.accountId));
      setDeleteTarget(null);
      loadStats();
      loadAggregate();
    } catch (err) {
      console.error('Failed to delete account:', err);
      setDeleteError('We could not delete this account. Nothing was changed — please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const isBankSuperAdmin =
    user?.roles?.some(role => {
      const roleType = typeof role === 'string' ? role : role.roleType;
      return roleType === 'BANK_SUPER_ADMIN' || roleType === 'Bank Super Admin';
    }) ?? false;

  const currency = allAccounts[0]?.currency;

  /* Financial aggregates derived from the real account records. */
  const agg = useMemo(() => {
    const deposits = allAccounts.filter(a => a.accountCategory === 'DEPOSIT');
    const credits = allAccounts.filter(a => a.accountCategory === 'CREDIT');
    const operational = allAccounts.filter(a => a.accountCategory === 'OPERATIONAL');
    const depositBalance = deposits.reduce((s, a) => s + (a.availableBalance || 0), 0);
    const operationalBalance = operational.reduce((s, a) => s + (a.availableBalance || 0), 0);
    const totalBalances = depositBalance + operationalBalance;
    const exposure = credits.reduce((s, a) => s + Math.max(0, -(a.currentBalance || 0)), 0);
    const availableLimits = credits.reduce((s, a) => s + (a.availableBalance || 0), 0);
    const utilisation =
      exposure + availableLimits > 0 ? (exposure / (exposure + availableLimits)) * 100 : null;
    return { totalBalances, depositBalance, operationalBalance, exposure, availableLimits, utilisation };
  }, [allAccounts]);

  const attentionCount = (stats?.frozenAccounts ?? 0) + (stats?.dormantAccounts ?? 0);

  const rows = useMemo<AccountRow[]>(
    () =>
      accounts.map(a => ({
        ...a,
        rowHolder: a.primaryOwnerName || a.accountName,
        rowAccountName: a.accountName,
        rowType: a.accountTypeDisplay || accountTypeLabels[a.accountType] || a.accountType,
        rowStatus: a.statusDisplay || accountStatusLabels[a.status],
        rowBalance: a.availableBalance || 0,
      })),
    [accounts]
  );

  const sorted = useMemo(() => sortData(rows, sortConfig), [rows, sortConfig]);
  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));

  const categoryBreakdown = stats
    ? [
        { label: accountCategoryLabels.DEPOSIT, value: stats.depositAccounts, tone: 'positive' as Tone },
        { label: accountCategoryLabels.CREDIT, value: stats.creditAccounts, tone: 'accent' as Tone },
        {
          label: accountCategoryLabels.OPERATIONAL,
          value: stats.operationalAccounts,
          tone: 'neutral' as Tone,
        },
      ]
    : [];

  const balanceBreakdown = [
    { label: 'Deposits', value: agg.depositBalance },
    { label: 'Credit drawn', value: agg.exposure },
    { label: 'Operational', value: agg.operationalBalance },
  ];
  const balanceMax = Math.max(...balanceBreakdown.map(b => b.value), 1);

  const hasFilters = !!searchTerm || statusFilter !== 'all' || categoryFilter !== 'all';
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setPage(0);
  };

  const fieldStyle: React.CSSProperties = {
    backgroundColor: 'var(--rm-input)',
    color: 'var(--rm-text)',
    border: '1px solid var(--rm-border)',
  };
  const cardStyle: React.CSSProperties = { backgroundColor: 'var(--rm-card)' };

  const firstShown = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastShown = Math.min((page + 1) * PAGE_SIZE, totalElements);

  return (
    <div className="space-y-6">
      {/* ══ Header ══ */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Accounts
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            {loading
              ? 'Loading accounts…'
              : error
                ? 'Accounts unavailable'
                : `${totalElements.toLocaleString()} account${totalElements === 1 ? '' : 's'} across deposits, credit and operational books`}
          </p>
        </div>
        <Link
          href="/dashboard/accounts/new"
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--rm-accent)' }}
        >
          Open account
        </Link>
      </header>

      {/* ══ Filters ══ */}
      <section aria-label="Account filters" className="rounded-3xl p-6" style={cardStyle}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="account-search"
              className="block text-sm mb-1.5"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Search
            </label>
            <input
              id="account-search"
              type="search"
              placeholder="Account number, name or IBAN"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm"
              style={fieldStyle}
            />
          </div>
          <div>
            <label
              htmlFor="account-category"
              className="block text-sm mb-1.5"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Category
            </label>
            <select
              id="account-category"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="w-full rounded-xl px-4 py-2.5 text-sm"
              style={fieldStyle}
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="account-status"
              className="block text-sm mb-1.5"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Status
            </label>
            <select
              id="account-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full rounded-xl px-4 py-2.5 text-sm"
              style={fieldStyle}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
            {loading ? 'Loading…' : `${totalElements.toLocaleString()} matching accounts`}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto rounded-full px-4 py-2 text-sm font-medium hover:underline"
              style={{ color: 'var(--rm-accent)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* ══ Portfolio figures ══ */}
      <section aria-label="Portfolio figures" className="rounded-3xl p-6" style={cardStyle}>
        {statsUnavailable && allAccounts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }} role="status">
            Portfolio figures are unavailable right now. The account list below is unaffected.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-5">
            <Figure
              label="Deposit and operational balances"
              value={loading ? '—' : money(agg.totalBalances, currency)}
            />
            <Figure
              label="Lending exposure"
              value={loading ? '—' : money(agg.exposure, currency)}
            />
            <Figure
              label="Available credit limits"
              value={loading ? '—' : money(agg.availableLimits, currency)}
            />
            <Figure
              label="Credit utilisation"
              value={
                loading ? '—' : agg.utilisation === null ? '—' : `${agg.utilisation.toFixed(0)}%`
              }
            />
            <Figure
              label="Frozen or dormant"
              value={loading ? '—' : attentionCount.toLocaleString()}
            />
          </dl>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* ══ Left column ══ */}
        <div className="space-y-6 min-w-0">
          {error && (
            <section
              role="alert"
              className="rounded-3xl p-6 flex items-start gap-4 flex-wrap"
              style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
            >
              <svg
                className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {error}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
                  Your filters are still applied.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAccounts}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
              >
                Retry
              </button>
            </section>
          )}

          {loading ? (
            <TableSkeleton />
          ) : !error && accounts.length === 0 ? (
            <div className="rounded-3xl py-16 px-6 text-center" style={cardStyle}>
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--rm-input)' }}
              >
                <svg
                  className="w-7 h-7"
                  style={{ color: 'var(--rm-text-muted)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.6}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                {hasFilters ? 'No accounts match these filters' : 'No accounts yet'}
              </p>
              <p className="text-sm mt-1 mb-4" style={{ color: 'var(--rm-text-muted)' }}>
                {hasFilters
                  ? 'Try a different search term, category or status.'
                  : 'Open the first account to get started.'}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full px-4 py-2 text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  Clear filters
                </button>
              ) : (
                <Link
                  href="/dashboard/accounts/new"
                  className="rounded-full px-4 py-2 text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  Open account
                </Link>
              )}
            </div>
          ) : accounts.length > 0 ? (
            <section className="rounded-3xl overflow-hidden" style={cardStyle}>
              <div
                className="flex items-center justify-between gap-3 flex-wrap px-5 py-4"
                style={{ borderBottom: '1px solid var(--rm-border)' }}
              >
                <h2
                  className="text-xl font-semibold tracking-tight"
                  style={{ color: 'var(--rm-text)' }}
                >
                  Accounts
                </h2>
                <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                  {firstShown}–{lastShown} of {totalElements.toLocaleString()} · sorting applies to
                  this page
                </p>
              </div>

              <div
                role="region"
                aria-label="Accounts, horizontally scrollable"
                tabIndex={0}
                className="overflow-x-auto"
              >
                <table className="w-full" aria-label="Accounts">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                      <SortableHeader
                        label="Holder"
                        field="rowHolder"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        className={SORT_CLASS}
                      />
                      <SortableHeader
                        label="Type"
                        field="rowType"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        className={SORT_CLASS}
                      />
                      <SortableHeader
                        label="Account number"
                        field="accountNumber"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        className={SORT_CLASS}
                      />
                      <SortableHeader
                        label="Available balance"
                        field="rowBalance"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        align="right"
                        className={SORT_CLASS}
                      />
                      <SortableHeader
                        label="Status"
                        field="rowStatus"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        className={SORT_CLASS}
                      />
                      <th
                        scope="col"
                        className="px-5 py-3.5 text-right text-sm font-medium whitespace-nowrap"
                        style={{ color: 'var(--rm-text-muted)' }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(account => (
                      <tr
                        key={account.accountId}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                        onMouseEnter={e =>
                          (e.currentTarget.style.backgroundColor = 'rgba(127,127,127,0.06)')
                        }
                        onMouseLeave={e =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                        onClick={() => router.push(`/dashboard/accounts/${account.accountId}`)}
                      >
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
                              {(account.rowHolder.charAt(0) || '?').toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <Link
                                href={`/dashboard/accounts/${account.accountId}`}
                                onClick={e => e.stopPropagation()}
                                className="block truncate text-base font-medium hover:underline"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {account.rowHolder}
                              </Link>
                              <span
                                className="block truncate text-sm"
                                style={{ color: 'var(--rm-text-muted)' }}
                              >
                                {account.rowAccountName}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Pill tone={categoryTone(account.accountCategory)}>
                            {accountCategoryLabels[account.accountCategory]}
                          </Pill>
                          <p className="text-sm mt-1.5" style={{ color: 'var(--rm-text-muted)' }}>
                            {account.rowType}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p
                            className="text-sm tabular-nums"
                            style={{ color: 'var(--rm-text-secondary)' }}
                          >
                            {account.accountNumber}
                          </p>
                          {account.primaryIban && (
                            <p
                              className="text-sm truncate max-w-[220px] tabular-nums"
                              style={{ color: 'var(--rm-text-muted)' }}
                            >
                              {account.primaryIban}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <p
                            className="text-base font-medium tabular-nums"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {formatCurrency(account.availableBalance || 0, account.currency)}
                          </p>
                          <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                            Current{' '}
                            {formatCurrency(account.currentBalance || 0, account.currency)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <Pill tone={statusTone(account.status)}>
                            {account.statusDisplay || accountStatusLabels[account.status]}
                          </Pill>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end items-center gap-1.5">
                            <Link
                              href={`/dashboard/accounts/${account.accountId}`}
                              onClick={e => e.stopPropagation()}
                              aria-label={`View ${account.rowAccountName}`}
                              className="rounded-full p-2 transition-opacity hover:opacity-80"
                              style={{
                                backgroundColor: 'var(--rm-input)',
                                color: 'var(--rm-text-secondary)',
                              }}
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </Link>
                            <Link
                              href={`/dashboard/accounts/${account.accountId}/edit`}
                              onClick={e => e.stopPropagation()}
                              aria-label={`Edit ${account.rowAccountName}`}
                              className="rounded-full p-2 transition-opacity hover:opacity-80"
                              style={{
                                backgroundColor: 'var(--rm-input)',
                                color: 'var(--rm-text-secondary)',
                              }}
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                                />
                              </svg>
                            </Link>
                            {isBankSuperAdmin && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setDeleteError(null);
                                  setDeleteTarget(account);
                                }}
                                aria-label={`Delete ${account.rowAccountName}`}
                                className="rounded-full p-2 text-red-600 dark:text-red-400 transition-opacity hover:opacity-80"
                                style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div
                className="flex items-center justify-between gap-3 flex-wrap px-5 py-4"
                style={{ borderTop: '1px solid var(--rm-border)' }}
              >
                <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                  Showing {sorted.length} of {totalElements.toLocaleString()} accounts
                </p>
                {totalPages > 1 && (
                  <nav aria-label="Account pages" className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      aria-label="Previous page"
                      className="rounded-full p-2 transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPage(i)}
                        aria-label={`Page ${i + 1}`}
                        aria-current={page === i ? 'page' : undefined}
                        className="min-w-[36px] h-9 rounded-full text-sm font-medium tabular-nums transition-opacity hover:opacity-90"
                        style={{
                          backgroundColor: page === i ? 'var(--rm-accent-muted)' : 'transparent',
                          color: page === i ? 'var(--rm-accent)' : 'var(--rm-text-secondary)',
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      aria-label="Next page"
                      className="rounded-full p-2 transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </nav>
                )}
              </div>
            </section>
          ) : null}
        </div>

        {/* ══ Sidebar ══ */}
        <aside className="space-y-6" aria-label="Account insights">
          <section className="rounded-3xl p-6" style={cardStyle}>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Needs attention
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              Select a filter to narrow the account list.
            </p>
            {statsUnavailable && !stats ? (
              <p className="text-sm mt-4" style={{ color: 'var(--rm-text-muted)' }} role="status">
                Counts are unavailable right now.
              </p>
            ) : stats ? (
              <ul className="mt-4 space-y-2.5">
                <FilterTile
                  label="Frozen accounts"
                  hint="Access restricted"
                  count={stats.frozenAccounts}
                  pressed={statusFilter === 'FROZEN'}
                  onClick={() =>
                    setStatusFilter(statusFilter === 'FROZEN' ? 'all' : ('FROZEN' as StatusFilter))
                  }
                />
                <FilterTile
                  label="Dormant accounts"
                  hint="Inactive — worth a review"
                  count={stats.dormantAccounts}
                  pressed={statusFilter === 'DORMANT'}
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === 'DORMANT' ? 'all' : ('DORMANT' as StatusFilter)
                    )
                  }
                />
                <FilterTile
                  label="Credit facilities"
                  hint="Lending exposure"
                  count={stats.creditAccounts}
                  pressed={categoryFilter === 'CREDIT'}
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter === 'CREDIT' ? 'all' : ('CREDIT' as CategoryFilter)
                    )
                  }
                />
                <FilterTile
                  label="Deposit accounts"
                  hint="Funding base"
                  count={stats.depositAccounts}
                  pressed={categoryFilter === 'DEPOSIT'}
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter === 'DEPOSIT' ? 'all' : ('DEPOSIT' as CategoryFilter)
                    )
                  }
                />
              </ul>
            ) : (
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-2xl"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl p-6" style={cardStyle}>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Accounts by category
            </h2>
            {!stats ? (
              <p className="text-sm mt-3" style={{ color: 'var(--rm-text-muted)' }}>
                {statsUnavailable ? 'Category counts are unavailable.' : 'Loading counts…'}
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {categoryBreakdown.map(s => {
                  const pct = stats.totalAccounts
                    ? Math.round((s.value / stats.totalAccounts) * 100)
                    : 0;
                  return (
                    <li key={s.label}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2" style={{ color: 'var(--rm-text-secondary)' }}>
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: TONE_DOT[s.tone] }}
                            aria-hidden="true"
                          />
                          {s.label}
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                          {s.value} · {pct}%
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--rm-input)' }}
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: TONE_DOT[s.tone] }}
                        />
                      </div>
                    </li>
                  );
                })}
                <li className="text-sm tabular-nums pt-1" style={{ color: 'var(--rm-text-muted)' }}>
                  {stats.totalAccounts.toLocaleString()} accounts in total
                </li>
              </ul>
            )}
          </section>

          <section className="rounded-3xl p-6" style={cardStyle}>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Portfolio balance
            </h2>
            {allAccounts.length === 0 ? (
              <p className="text-sm mt-3" style={{ color: 'var(--rm-text-muted)' }}>
                {statsUnavailable
                  ? 'Balances are unavailable right now.'
                  : 'No balances recorded yet.'}
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {balanceBreakdown.map(b => (
                  <li key={b.label}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span style={{ color: 'var(--rm-text-secondary)' }}>{b.label}</span>
                      <span
                        className="text-base font-medium tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {money(b.value, currency)}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(b.value / balanceMax) * 100}%`,
                          backgroundColor: 'var(--rm-accent)',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {loading && (
        <p role="status" className="sr-only">
          Loading accounts
        </p>
      )}

      {/* ══ Delete confirmation ══ */}
      {deleteTarget && (
        <Dialog
          title="Delete account"
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        >
          <p className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
            <strong style={{ color: 'var(--rm-text)' }}>{deleteTarget.accountName}</strong> (
            {deleteTarget.accountNumber}) will be deleted. This cannot be undone.
          </p>

          {deleteError && (
            <p
              role="alert"
              className="mt-4 rounded-2xl px-5 py-4 text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
            >
              {deleteError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Keep account
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'rgba(220,38,38,1)' }}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd
        className="mt-1 text-xl font-semibold tabular-nums"
        style={{ color: 'var(--rm-text)' }}
      >
        {value}
      </dd>
    </div>
  );
}

function FilterTile({
  label,
  hint,
  count,
  pressed,
  onClick,
}: {
  label: string;
  hint: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={pressed}
        className="w-full text-left rounded-2xl px-5 py-4 transition-opacity hover:opacity-90"
        style={{ backgroundColor: pressed ? 'var(--rm-accent-muted)' : 'var(--rm-input)' }}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
            {label}
          </span>
          <span
            className="text-base font-semibold tabular-nums"
            style={{ color: 'var(--rm-text)' }}
          >
            {count}
          </span>
        </span>
        <span className="block text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
          {hint} · {pressed ? 'filter applied' : 'not filtered'}
        </span>
      </button>
    </li>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--rm-border)' }}>
        <div
          className="h-5 w-32 rounded-full animate-pulse"
          style={{ backgroundColor: 'var(--rm-input)' }}
        />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--rm-border)' }}
        >
          <div
            className="h-10 w-10 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: 'var(--rm-input)' }}
          />
          <div className="flex-1 space-y-2">
            <div
              className="h-4 w-1/3 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--rm-input)' }}
            />
            <div
              className="h-3 w-1/5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--rm-input)' }}
            />
          </div>
          <div
            className="h-6 w-24 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: 'var(--rm-input)' }}
          />
        </div>
      ))}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = `dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.55)' }}
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-3xl p-7"
        style={{ backgroundColor: 'var(--rm-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="mb-4 text-xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
