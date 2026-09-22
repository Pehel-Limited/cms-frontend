'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import {
  getAccount,
  transactionsForAccount,
  groupTransactionsByDay,
  CARDS,
  type PaymentCard,
  type Transaction,
} from '@/lib/banking-data';
import { Sparkline, BankCard } from '@/components/banking/BankCard';

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const STATUS_BADGE: Record<Transaction['status'], { className: string; label: string } | null> = {
  COMPLETED: null,
  PENDING: { className: 'badge badge-warning', label: 'Pending' },
  DECLINED: { className: 'badge badge-error', label: 'Declined' },
};

const TYPE_LABEL: Record<string, string> = {
  CURRENT: 'Current account',
  SAVINGS: 'Savings account',
  JOINT: 'Joint account',
  VAULT: 'Vault',
};

/* ──────────────────────────────────────────────────────────────────
 * Data resolution — every figure below is derived from the account's own
 * transaction history, so the labels never claim a window the data lacks.
 * ────────────────────────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

interface AccountData {
  transactions: Transaction[];
  linkedCards: PaymentCard[];
  inflow: number;
  outflow: number;
  inflowCount: number;
  outflowCount: number;
  windowDays: number;
}

function resolveAccount(accountId: string): AccountData {
  const transactions = transactionsForAccount(accountId);
  const inflowTxns = transactions.filter(t => t.direction === 'IN');
  const outflowTxns = transactions.filter(t => t.direction === 'OUT');
  const oldest = transactions.reduce(
    (min, t) => Math.min(min, new Date(t.date).getTime()),
    Date.now()
  );
  return {
    transactions,
    linkedCards: CARDS.filter(c => c.linkedAccountId === accountId),
    inflow: inflowTxns.reduce((s, t) => s + t.amount, 0),
    outflow: outflowTxns.reduce((s, t) => s + t.amount, 0),
    inflowCount: inflowTxns.length,
    outflowCount: outflowTxns.length,
    windowDays: Math.max(1, Math.round((Date.now() - oldest) / 86400000)),
  };
}

function useAccountData(accountId: string) {
  const [data, setData] = useState<AccountData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setData(resolveAccount(accountId));
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
  }, [accountId, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { data, state, retry };
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-token">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <div className="skeleton h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3.5 w-1/2" />
          </div>
          <div className="skeleton h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function LoadError({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <div className="p-5">
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="empty-state-title">We couldn&apos;t load {what}</p>
        <p className="empty-state-text">Something went wrong while reading this account. Nothing has been changed.</p>
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

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const account = getAccount(params.id);
  const [query, setQuery] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const { data, state, retry } = useAccountData(params.id);

  const filtered = useMemo(() => {
    const txns = data?.transactions ?? [];
    if (!query.trim()) return txns;
    const q = query.toLowerCase();
    return txns.filter(
      t =>
        t.merchant.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.note ?? '').toLowerCase().includes(q)
    );
  }, [data, query]);

  const grouped = useMemo(() => groupTransactionsByDay(filtered), [filtered]);

  const details = useMemo(
    () =>
      account
        ? [
            ['Account name', account.name],
            ['Account type', TYPE_LABEL[account.type] ?? account.type],
            ['Sort code', account.sortCode],
            ['Account number', account.accountNumber],
            ['IBAN', account.iban],
            ['Currency', account.currency],
          ]
        : [],
    [account]
  );

  const handleCopy = useCallback(async () => {
    if (!account) return;
    const payload = `Account name: ${account.name}\nSort code: ${account.sortCode}\nAccount number: ${account.accountNumber}\nIBAN: ${account.iban}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 3000);
  }, [account]);

  if (!account) return notFound();

  const currency = account.currency;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/portal/accounts"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All accounts
        </Link>
      </nav>

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg md:p-8"
        style={{ background: account.gradient }}
      >
        <div aria-hidden="true" className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur"
            >
              {account.glyph}
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{account.name}</h1>
              <p className="font-mono text-sm text-white/75">
                {account.sortCode} · {account.accountNumber}
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm text-white/75">Current balance</p>
          <p className="text-4xl font-bold tabular-nums tracking-tight md:text-5xl">
            {fmt(account.balance, currency)}
          </p>

          <div className="mt-4 max-w-xs" aria-hidden="true">
            <Sparkline data={account.spark} width={280} height={44} strokeWidth={2} />
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/portal/payments"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-white/90"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
              </svg>
              Send money
            </Link>
            <Link
              href="/portal/documents"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Statements
            </Link>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {state === 'loading' ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-tile space-y-2">
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-7 w-28" />
            </div>
          ))
        ) : state === 'error' || !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-tile">
              <p className="stat-label">Unavailable</p>
              <p className="stat-value">—</p>
            </div>
          ))
        ) : (
          <>
            <div className="stat-tile">
              <p className="stat-label">Money in</p>
              <p className="stat-value text-emerald-600 dark:text-emerald-400">{fmt(data.inflow, currency)}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {data.inflowCount} payment{data.inflowCount === 1 ? '' : 's'} over {data.windowDays} days
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Money out</p>
              <p className="stat-value">{fmt(data.outflow, currency)}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {data.outflowCount} payment{data.outflowCount === 1 ? '' : 's'} over {data.windowDays} days
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Available to spend</p>
              <p className="stat-value">{fmt(account.available, currency)}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>After pending holds</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Currency</p>
              <p className="stat-value">{currency}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Single-currency account</p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Transactions */}
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <h2 className="panel-title">Transactions</h2>
            <span className="chip tabular-nums" aria-live="polite">
              {state === 'loading' ? 'Loading' : `${filtered.length} shown`}
            </span>
          </div>

          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--surface-border)' }}>
            <label htmlFor="txn-search" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Search this account
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

          {state === 'loading' ? (
            <ListSkeleton rows={5} />
          ) : state === 'error' ? (
            <LoadError onRetry={retry} what="these transactions" />
          ) : grouped.length === 0 ? (
            <div className="p-5">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="empty-state-title">
                  {query.trim() ? 'No matching transactions' : 'No transactions yet'}
                </p>
                <p className="empty-state-text">
                  {query.trim()
                    ? `Nothing on this account matches “${query.trim()}”. Try a different merchant, category or note.`
                    : 'Money moving in or out of this account will show up here, grouped by day.'}
                </p>
                {query.trim() && (
                  <button type="button" onClick={() => setQuery('')} className="btn btn-secondary btn-sm mt-4">
                    Clear search
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
                        {net >= 0 ? '+' : '−'}{fmt(Math.abs(net), currency)}
                      </span>
                    </div>
                    <div className="divide-token">
                      {group.items.map((t: Transaction) => {
                        const badge = STATUS_BADGE[t.status];
                        return (
                          <div
                            key={t.id}
                            className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                          >
                            <span
                              aria-hidden="true"
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
                              style={{ backgroundColor: 'var(--surface-input)' }}
                            >
                              {t.glyph || '✨'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                                {t.merchant}
                              </p>
                              <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                                {txTime(t.date)} · {t.category}
                                {t.note ? ` · ${t.note}` : ''}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p
                                className={`text-base font-bold tabular-nums ${t.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                                style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                              >
                                {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount, currency)}
                              </p>
                              {badge ? (
                                <span className={`${badge.className} mt-0.5`}>{badge.label}</span>
                              ) : (
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                  {t.direction === 'IN' ? 'Money in' : 'Money out'}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Linked cards</h2>
              <Link href="/portal/cards" className="link-arrow">
                Manage <span data-arrow aria-hidden="true">→</span>
              </Link>
            </div>
            {state === 'loading' ? (
              <div className="space-y-4 p-5">
                <div className="skeleton aspect-[1.586] w-full rounded-2xl" />
              </div>
            ) : state === 'error' ? (
              <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                Card details are unavailable right now. Use “Try again” on the transactions panel.
              </p>
            ) : data && data.linkedCards.length > 0 ? (
              <div className="space-y-4 p-5">
                {data.linkedCards.map(card => (
                  <Link
                    key={card.id}
                    href="/portal/cards"
                    aria-label={`${card.label}, ${card.type.toLowerCase()} card ending ${card.last4}${card.frozen ? ', currently frozen' : ''}`}
                    className="block transition-transform hover:-translate-y-0.5"
                  >
                    <BankCard card={card} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <div className="empty-state !py-10">
                  <div className="empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                  </div>
                  <p className="empty-state-title">No cards on this account</p>
                  <p className="empty-state-text">You can order a card for this account from the cards page.</p>
                  <Link href="/portal/cards" className="btn btn-secondary btn-sm mt-4">Go to cards</Link>
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Account details</h2>
            </div>
            <div className="panel-body">
              <dl className="divide-token">
                {details.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <dt className="text-sm" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                    <dd
                      className={`text-right text-base font-medium ${k === 'IBAN' ? 'break-all font-mono' : ''}`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={handleCopy} className="btn btn-secondary btn-sm mt-4 w-full">
                <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                {copyState === 'copied' ? 'Copied' : 'Copy account details'}
              </button>
              <p className="sr-only" aria-live="polite">
                {copyState === 'copied'
                  ? 'Account details copied to your clipboard'
                  : copyState === 'failed'
                    ? 'Could not copy account details. Please select the text and copy it manually.'
                    : ''}
              </p>
              {copyState === 'failed' && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Your browser blocked the clipboard. Select the details above to copy them manually.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
