'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TRANSACTIONS,
  savingsGoal,
  type BankAccount,
  type Transaction,
} from '@/lib/banking-data';
import {
  accountService,
  type AccountSource,
  type SampleReason,
} from '@/services/api/account-service';
import { DotMatrix } from '@/components/banking/BankCard';
import { ACCOUNT_GLYPH, glyphFor, GlyphTile } from '@/components/ui/Glyph';
import { PageHero } from '@/components/ui/PageHero';

function fmt(n: number, cur = 'EUR') {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(n);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const TYPE_LABEL: Record<BankAccount['type'], string> = {
  CURRENT: 'Current account',
  SAVINGS: 'Savings account',
  JOINT: 'Joint account',
  VAULT: 'Vault',
};

/* Stable fallbacks so derived memos don't recompute while data is loading. */
const NO_ACCOUNTS: BankAccount[] = [];

/* ──────────────────────────────────────────────────────────────────
 * Data resolution
 *
 * Accounts come from bff-customer, which serves the customer's own real
 * accounts and falls back to the sample set when it cannot. The snapshot
 * always reports which of the two it is, so the page can label its figures
 * instead of implying money that was never read.
 *
 * Transactions have no backend feed yet, so they are only ever shown against
 * the sample accounts they actually belong to.
 * ────────────────────────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

interface AccountsData {
  accounts: BankAccount[];
  transactions: Transaction[];
  total: number;
  /** Null when the accounts do not share one currency — then no single total is honest. */
  totalCurrency: string | null;
  available: number;
  goal: ReturnType<typeof savingsGoal> | null;
  source: AccountSource;
  sampleReason: SampleReason | null;
  balanceAsOf: string | null;
}

async function resolveAccounts(): Promise<AccountsData> {
  const { accounts, source, sampleReason, balanceAsOf } = await accountService.getAccountsSnapshot();

  const currencies = new Set(accounts.map(a => a.currency));
  const totalCurrency = currencies.size === 1 ? accounts[0]?.currency ?? null : null;
  const sum = (pick: (a: BankAccount) => number) => accounts.reduce((total, a) => total + pick(a), 0);

  return {
    accounts,
    transactions: source === 'LIVE' ? [] : TRANSACTIONS,
    total: totalCurrency ? sum(a => a.balance) : 0,
    totalCurrency,
    available: totalCurrency ? sum(a => a.available) : 0,
    goal: source === 'LIVE' ? null : savingsGoal(),
    source,
    sampleReason,
    balanceAsOf,
  };
}

function useAccountsData() {
  const [data, setData] = useState<AccountsData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    resolveAccounts()
      .then(result => {
        if (!active) return;
        setData(result);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setData(null);
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { data, state, retry };
}

const SOURCE_BADGE: Record<AccountSource, { label: string; tone: string }> = {
  LIVE: { label: 'Live balances', tone: 'var(--success, #10b981)' },
  SAMPLE: { label: 'Sample data', tone: 'var(--warning, #f59e0b)' },
};

const SAMPLE_REASON_TEXT: Record<SampleReason, string> = {
  NO_LIVE_ACCOUNTS: 'No accounts are linked to your profile yet, so these figures are illustrative.',
  SERVICE_UNAVAILABLE: 'Your account service could not be reached, so these figures are illustrative.',
};

/* ──────────────────────────────────────────────────────────────────
 * Shared states
 * ────────────────────────────────────────────────────────────────── */

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
        <p className="empty-state-text">Something went wrong while reading your account data. Nothing has been changed.</p>
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

export default function AccountsPage() {
  const [hideBalances, setHideBalances] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, state, retry } = useAccountsData();

  const accounts = data?.accounts ?? NO_ACCOUNTS;
  const selected = useMemo(
    () => accounts.find(a => a.id === selectedId) ?? accounts[0],
    [accounts, selectedId]
  );

  const recentTxns = useMemo(() => {
    if (!data || !selected) return [];
    return data.transactions
      .filter(t => t.accountId === selected.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [data, selected]);

  const goal = data?.goal;
  const goalPct = goal && goal.target > 0 ? Math.round((goal.saved / goal.target) * 100) : 0;
  const mask = (value: string) => (hideBalances ? '••••••' : value);

  /* A single, page-level failure state — one honest message and one retry,
     rather than the same error repeated inside every panel. */
  if (state === 'error') {
    return (
      <div className="space-y-6">
        <PageHero
          title="My accounts"
          subtitle="Balances, recent activity and payment details for every account you hold with us."
        />
        <div className="panel">
          <LoadError onRetry={retry} what="your accounts" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHero
        title="My accounts"
        subtitle={
          <>
            Balances, recent activity and payment details for every account you hold with us.
            {data?.source === 'SAMPLE' && data.sampleReason && (
              <span className="mt-1 block">{SAMPLE_REASON_TEXT[data.sampleReason]}</span>
            )}
          </>
        }
        meta={
          data && (
            <span
              className="rounded-full border px-2.5 py-1 text-sm font-medium"
              style={{
                color: SOURCE_BADGE[data.source].tone,
                borderColor: SOURCE_BADGE[data.source].tone,
              }}
            >
              {SOURCE_BADGE[data.source].label}
            </span>
          )
        }
        actions={
          <Link href="/portal/products" className="btn btn-primary shrink-0">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Open a new account
          </Link>
        }
      />

      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-tile flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="stat-label">Total balance</p>
            {state === 'loading' ? (
              <div className="skeleton mt-2 h-7 w-32" />
            ) : !data || !data.totalCurrency ? (
              <>
                <p className="stat-value">—</p>
                {data && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Held in more than one currency
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="stat-value">{mask(fmt(data.total, data.totalCurrency))}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Across {data.accounts.length} accounts
                  {data.balanceAsOf ? ` · as of ${new Date(data.balanceAsOf).toLocaleString()}` : ''}
                </p>
              </>
            )}
          </div>
          {/* One column per account, scaled to its balance. A composition of what
              is held, not a trend — the page has no balance history. */}
          {state === 'ready' && data && data.totalCurrency && (
            <div className="shrink-0">
              <DotMatrix
                data={data.accounts.map(a => a.balance)}
                cell={8}
                rows={5}
                label={`Balance held by each of ${data.accounts.length} accounts`}
                format={(value, i) => `${data.accounts[i].name} · ${fmt(value, data.totalCurrency ?? undefined)}`}
              />
            </div>
          )}
        </div>

        <div className="stat-tile flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="stat-label">Available to spend</p>
            {state === 'loading' ? (
              <div className="skeleton mt-2 h-7 w-32" />
            ) : !data || !data.totalCurrency ? (
              <p className="stat-value">—</p>
            ) : (
              <>
                <p className="stat-value">{mask(fmt(data.available, data.totalCurrency))}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  After pending holds
                </p>
              </>
            )}
          </div>
          {state === 'ready' && data && data.totalCurrency && (
            <div className="shrink-0">
              <DotMatrix
                data={data.accounts.map(a => Math.max(0, a.available))}
                cell={8}
                rows={5}
                color="var(--brand-strong)"
                label={`Available to spend in each of ${data.accounts.length} accounts`}
                format={(value, i) => `${data.accounts[i].name} · ${fmt(value, data.totalCurrency ?? undefined)}`}
              />
            </div>
          )}
        </div>

        <div className="stat-tile">
          <p className="stat-label">{goal?.label ?? 'Savings'} goal</p>
          {state === 'loading' ? (
            <div className="skeleton mt-2 h-7 w-24" />
          ) : !goal ? (
            <p className="stat-value">—</p>
          ) : (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={goal.target}
              aria-valuenow={goal.saved}
              aria-label={`${goal.label}: ${mask(fmt(goal.saved))} saved of ${mask(fmt(goal.target))}`}
            >
              <p className="stat-value">{goalPct}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-input)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, goalPct)}%`, backgroundColor: 'var(--brand)' }}
                />
              </div>
              <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                {mask(fmt(goal.saved, goal.currency))} of {mask(fmt(goal.target, goal.currency))} saved
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Screen-reader announcement for the balance visibility toggle */}
      <p className="sr-only" aria-live="polite">
        {hideBalances ? 'Balances hidden' : 'Balances shown'}
      </p>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Left: account list */}
        <div className="panel xl:col-span-2">
          <div className="panel-header">
            <h2 className="panel-title">Your accounts</h2>
            <button
              type="button"
              onClick={() => setHideBalances(v => !v)}
              className="icon-btn"
              aria-pressed={hideBalances}
              aria-label={hideBalances ? 'Show balances' : 'Hide balances'}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                {hideBalances ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </>
                )}
              </svg>
            </button>
          </div>

          {state === 'loading' ? (
            <ListSkeleton rows={4} />
          ) : accounts.length === 0 ? (
            <div className="p-5">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                </div>
                <p className="empty-state-title">No accounts yet</p>
                <p className="empty-state-text">Once you open an account it will appear here with its balance and recent activity.</p>
                <Link href="/portal/products" className="btn btn-primary btn-sm mt-4">Open a new account</Link>
              </div>
            </div>
          ) : (
            <div className="divide-token">
              {accounts.map(acc => {
                const isSelected = selected?.id === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedId(acc.id)}
                    aria-pressed={isSelected}
                    className="w-full px-5 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    style={{
                      backgroundColor: isSelected ? 'var(--brand-soft)' : undefined,
                      borderLeft: `3px solid ${isSelected ? 'var(--brand)' : 'transparent'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <GlyphTile
                        name={ACCOUNT_GLYPH[acc.type]}
                        className="h-11 w-11 rounded-xl"
                        tone={isSelected ? 'brand' : 'neutral'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {acc.name}
                          </p>
                          <p className="shrink-0 text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            {mask(fmt(acc.balance, acc.currency))}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                            {[acc.typeLabel ?? TYPE_LABEL[acc.type], acc.sortCode, acc.accountNumber]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <span aria-hidden="true" className="shrink-0">
                            <DotMatrix data={acc.spark} cell={3} rows={5} label={`${acc.name} balance trend`} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: selected account */}
        <div className="space-y-6 xl:col-span-3">
          {state === 'loading' ? (
            <div className="panel">
              <div className="panel-body space-y-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-12 w-12 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-40" />
                    <div className="skeleton h-3.5 w-28" />
                  </div>
                </div>
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-9 w-full" />
              </div>
            </div>
          ) : selected ? (
            <div className="panel">
              <div className="panel-body space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <GlyphTile
                      name={ACCOUNT_GLYPH[selected.type]}
                      className="h-12 w-12 rounded-2xl"
                      iconClassName="h-6 w-6"
                    />
                    <div>
                      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {selected.name}
                      </h2>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {[selected.typeLabel ?? TYPE_LABEL[selected.type], selected.statusDisplay]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Available</p>
                    <p className="text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {mask(fmt(selected.available, selected.currency))}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>IBAN</p>
                  <p className="break-all font-mono text-base" style={{ color: 'var(--text-primary)' }}>
                    {selected.iban}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
                  <Link href="/portal/payments" className="btn btn-secondary btn-sm">
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    Move money
                  </Link>
                  {/* The detail page is driven by the sample dataset, so it is
                      only linked while that is what we are showing. */}
                  {data?.source !== 'LIVE' && (
                    <Link href={`/portal/accounts/${selected.id}`} className="btn btn-secondary btn-sm">
                      View full account
                    </Link>
                  )}
                  <Link href="/portal/documents" className="btn btn-ghost btn-sm">
                    Statements
                  </Link>                </div>
              </div>
            </div>
          ) : null}

          {/* Recent activity */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Recent activity</h2>
              <Link href="/portal/transactions" className="link-arrow">
                View all <span data-arrow aria-hidden="true">→</span>
              </Link>
            </div>

            {state === 'loading' ? (
              <ListSkeleton rows={4} />
            ) : recentTxns.length === 0 ? (
              <div className="p-5">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="empty-state-title">
                    {data?.source === 'LIVE' ? 'No transaction feed yet' : 'No activity on this account'}
                  </p>
                  <p className="empty-state-text">
                    {data?.source === 'LIVE'
                      ? `Balances for ${selected?.name} are live, but transaction history is not served for this account yet. Nothing is being hidden.`
                      : `Transactions will appear here as soon as money moves in or out of ${selected?.name}.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-token">
                {recentTxns.map((t: Transaction) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <GlyphTile name={glyphFor(t.category)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t.merchant}
                      </p>
                      <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t.category} · {shortDate(t.date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`num text-base font-semibold ${t.direction === 'IN' ? 'delta-up' : ''}`}
                        style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                      >
                        {t.direction === 'IN' ? '+' : '−'}{mask(fmt(t.amount, t.currency))}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t.direction === 'IN' ? 'Money in' : 'Money out'}
                        {t.status === 'PENDING' ? ' · Pending' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FSCS notice */}
      <div className="panel flex items-start gap-3 p-4">
        <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--brand-on-soft)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your eligible deposits are protected by the Financial Services Compensation Scheme (FSCS).
        </p>
      </div>
    </div>
  );
}
