'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { glyphFor, GlyphTile } from '@/components/ui/Glyph';
import {
  TRANSACTIONS,
  ACCOUNTS,
  groupTransactionsByDay,
  spendByCategory,
  monthlyInOut,
  type BankAccount,
  type Transaction,
  type SpendCategory,
} from '@/lib/banking-data';

function fmt(n: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}
function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

type DirFilter = 'ALL' | 'IN' | 'OUT';

const DIR_OPTIONS: { value: DirFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'IN', label: 'Money in' },
  { value: 'OUT', label: 'Money out' },
];

const STATUS_BADGE: Record<Transaction['status'], { className: string; label: string } | null> = {
  COMPLETED: null,
  PENDING: { className: 'badge badge-warning', label: 'Pending' },
  DECLINED: { className: 'badge badge-error', label: 'Declined' },
};

/* Stable fallbacks so derived memos don't recompute while data is loading. */
const NO_TRANSACTIONS: Transaction[] = [];
const NO_ACCOUNTS: BankAccount[] = [];
const NO_CATEGORIES: SpendCategory[] = [];

/* ──────────────────────────────────────────────────────────────────
 * Data resolution — the summary tiles describe the period the dataset
 * actually covers rather than asserting a fixed 31-day comparison.
 * ────────────────────────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

interface TxnData {
  transactions: Transaction[];
  accounts: BankAccount[];
  categories: SpendCategory[];
  income: number;
  spending: number;
  incomeCount: number;
  spendingCount: number;
  historyDays: number;
  topCategory: { category: SpendCategory; total: number; pct: number } | null;
}

function resolveTransactions(): TxnData {
  if (!TRANSACTIONS.length) throw new Error('No transactions returned');
  const { income, spending } = monthlyInOut();
  const spend = spendByCategory();
  const oldest = TRANSACTIONS.reduce((min, t) => Math.min(min, new Date(t.date).getTime()), Date.now());
  return {
    transactions: TRANSACTIONS,
    accounts: ACCOUNTS,
    categories: Array.from(new Set(TRANSACTIONS.map(t => t.category))),
    income,
    spending,
    incomeCount: TRANSACTIONS.filter(t => t.direction === 'IN').length,
    spendingCount: TRANSACTIONS.filter(t => t.direction === 'OUT').length,
    historyDays: Math.max(1, Math.round((Date.now() - oldest) / 86400000)),
    topCategory: spend[0]
      ? { category: spend[0].category, total: spend[0].total, pct: spend[0].pct }
      : null,
  };
}

function useTransactionsData() {
  const [data, setData] = useState<TxnData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setData(resolveTransactions());
        setState('ready');
      } catch {
        setData(null);
        setState('error');
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { data, state, retry };
}

function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-token">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <div className="skeleton h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3.5 w-1/4" />
          </div>
          <div className="skeleton h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-5">
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="empty-state-title">We couldn&apos;t load your transactions</p>
        <p className="empty-state-text">Something went wrong while reading your history. Your filters have been kept.</p>
        <button type="button" onClick={onRetry} className="btn btn-primary btn-sm mt-4">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Try again
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [dir, setDir] = useState<DirFilter>('ALL');
  const [accountId, setAccountId] = useState<string>('ALL');
  const [category, setCategory] = useState<SpendCategory | 'ALL'>('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const { data, state, retry } = useTransactionsData();

  const transactions = data?.transactions ?? NO_TRANSACTIONS;
  const accounts = data?.accounts ?? NO_ACCOUNTS;
  const categories = data?.categories ?? NO_CATEGORIES;

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (dir !== 'ALL' && t.direction !== dir) return false;
        if (accountId !== 'ALL' && t.accountId !== accountId) return false;
        if (category !== 'ALL' && t.category !== category) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          if (
            !t.merchant.toLowerCase().includes(q) &&
            !t.category.toLowerCase().includes(q) &&
            !(t.note ?? '').toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, query, dir, accountId, category]);

  const grouped = useMemo(() => groupTransactionsByDay(filtered), [filtered]);

  const filteredTotalOut = filtered.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0);
  const filteredTotalIn = filtered.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amount, 0);
  const filtersActive = dir !== 'ALL' || accountId !== 'ALL' || category !== 'ALL' || Boolean(query.trim());

  const resetFilters = useCallback(() => {
    setQuery('');
    setDir('ALL');
    setAccountId('ALL');
    setCategory('ALL');
  }, []);

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? 'Unknown account';
  const selectedBadge = selectedTx ? STATUS_BADGE[selectedTx.status] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHero
        title="Transactions"
        subtitle="Every payment in and out, in one searchable timeline."
        actions={
          filtersActive && (
            <button type="button" onClick={resetFilters} className="btn btn-secondary shrink-0">
              Reset filters
            </button>
          )
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {state === 'loading' ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-tile space-y-2">
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-7 w-32" />
            </div>
          ))
        ) : state === 'error' || !data ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-tile">
              <p className="stat-label">Unavailable</p>
              <p className="stat-value">—</p>
            </div>
          ))
        ) : (
          <>
            <div className="stat-tile">
              <p className="stat-label">Money in</p>
              <p className="stat-value text-emerald-600 dark:text-emerald-400">{fmt(data.income)}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {data.incomeCount} payment{data.incomeCount === 1 ? '' : 's'} over {data.historyDays} days
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Money out</p>
              <p className="stat-value">{fmt(data.spending)}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {data.spendingCount} payment{data.spendingCount === 1 ? '' : 's'} over {data.historyDays} days
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Largest category</p>
              <p className="stat-value">{data.topCategory?.category ?? '—'}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {data.topCategory
                  ? `${fmt(data.topCategory.total)} · ${Math.round(data.topCategory.pct)}% of categorised spending`
                  : 'No categorised spending yet'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="panel">
        <div className="panel-body grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="txn-search" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Search
            </label>
            <div className="relative">
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="txn-search"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Merchant, category or note"
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="txn-account" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Account
            </label>
            <select
              id="txn-account"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="select"
            >
              <option value="ALL">All accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="txn-category" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Category
            </label>
            <select
              id="txn-category"
              value={category}
              onChange={e => setCategory(e.target.value as SpendCategory | 'ALL')}
              className="select"
            >
              <option value="ALL">All categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <span id="txn-direction-label" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Direction
            </span>
            <div role="group" aria-labelledby="txn-direction-label" className="segmented w-full">
              {DIR_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setDir(o.value)}
                  aria-pressed={dir === o.value}
                  data-active={dir === o.value}
                  className="segmented-item flex-1 !shrink justify-center"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* List + detail */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={`${selectedTx ? 'xl:col-span-2' : 'xl:col-span-3'} min-w-0`}>
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Transaction history</h2>
              <span className="chip tabular-nums" aria-live="polite">
                {state === 'loading'
                  ? 'Loading'
                  : `${filtered.length} shown · +${fmt(filteredTotalIn)} in · −${fmt(filteredTotalOut)} out`}
              </span>
            </div>

            {state === 'loading' ? (
              <ListSkeleton rows={6} />
            ) : state === 'error' ? (
              <LoadError onRetry={retry} />
            ) : grouped.length === 0 ? (
              <div className="p-5">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="empty-state-title">
                    {filtersActive ? 'No transactions match your filters' : 'No transactions yet'}
                  </p>
                  <p className="empty-state-text">
                    {filtersActive
                      ? 'Try widening the date, account or category filters, or clear the search term.'
                      : 'Once money starts moving through your accounts, it will be listed here by day.'}
                  </p>
                  {filtersActive && (
                    <button type="button" onClick={resetFilters} className="btn btn-secondary btn-sm mt-4">
                      Reset filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="pb-2">
                {grouped.map(group => {
                  const net = group.items.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0);
                  return (
                    <div key={group.label}>
                      <div className="flex items-center justify-between px-5 pb-1 pt-4">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                          {group.label}
                        </h3>
                        <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
                        </span>
                      </div>
                      <div className="divide-token">
                        {group.items.map((t: Transaction) => {
                          const isSelected = selectedTx?.id === t.id;
                          const badge = STATUS_BADGE[t.status];
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTx(isSelected ? null : t)}
                              aria-pressed={isSelected}
                              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                              style={{ backgroundColor: isSelected ? 'var(--brand-soft)' : undefined }}
                            >
                              <GlyphTile name={glyphFor(t.category)} className="h-11 w-11 rounded-xl" tone={isSelected ? 'brand' : 'neutral'} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {t.merchant}
                                </span>
                                <span className="mt-0.5 block truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                                  {t.category} · {txTime(t.date)} · {accountName(t.accountId)}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span
                                  className={`num block text-base font-semibold ${t.direction === 'IN' ? 'delta-up' : ''}`}
                                  style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                                >
                                  {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount, t.currency)}
                                </span>
                                {badge && <span className={`${badge.className} mt-0.5 !py-0.5 !text-xs`}>{badge.label}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedTx && (
          <div className="xl:col-span-1">
            <div className="panel sticky top-24">
              <div className="panel-header">
                <h2 className="panel-title">Transaction details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="icon-btn"
                  aria-label="Close transaction details"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="panel-body">
                <div className="flex flex-col items-center py-4 text-center">
                  <GlyphTile
                    name={glyphFor(selectedTx.category)}
                    className="mb-3 h-14 w-14 rounded-2xl"
                    iconClassName="h-7 w-7"
                  />
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{selectedTx.merchant}</p>
                  <p
                    className={`num mt-1 text-2xl font-semibold ${selectedTx.direction === 'IN' ? 'delta-up' : ''}`}
                    style={selectedTx.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                  >
                    {selectedTx.direction === 'IN' ? '+' : '−'}{fmt(selectedTx.amount, selectedTx.currency)}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(selectedTx.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {selectedBadge && (
                    <span className={`${selectedBadge.className} mt-3`}>{selectedBadge.label}</span>
                  )}
                </div>

                <dl className="divide-token border-t pt-3" style={{ borderColor: 'var(--surface-border)' }}>
                  {[
                    ['Direction', selectedTx.direction === 'IN' ? 'Money in' : 'Money out'],
                    ['Category', selectedTx.category],
                    ['Account', accountName(selectedTx.accountId)],
                    ...(selectedTx.note ? [['Note', selectedTx.note]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4 py-3">
                      <dt className="text-sm" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                      <dd className="text-right text-base font-medium" style={{ color: 'var(--text-primary)' }}>{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5 space-y-2 border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
                  <Link href="/portal/documents" className="btn btn-secondary btn-sm w-full">
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Find this on a statement
                  </Link>
                  <Link href="/portal/messages" className="btn btn-ghost btn-sm w-full text-red-600 dark:text-red-400">
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Raise a dispute
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
