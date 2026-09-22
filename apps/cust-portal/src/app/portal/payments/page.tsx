'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACCOUNTS,
  BENEFICIARIES,
  SCHEDULED_PAYMENTS,
  TRANSACTIONS,
  type BankAccount,
  type Beneficiary,
} from '@/lib/banking-data';

function fmt(n: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function dayNumber(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit' });
}
function monthShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short' });
}
function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ──────────────────────────────────────────────────────────────────
 * Payment types
 * ────────────────────────────────────────────────────────────────── */

type PaymentStatus = 'Completed' | 'Pending' | 'Scheduled' | 'Failed';

const STATUS_ORDER: PaymentStatus[] = ['Scheduled', 'Pending', 'Completed', 'Failed'];

const STATUS_BADGE: Record<PaymentStatus, string> = {
  Completed: 'badge badge-success',
  Pending: 'badge badge-warning',
  Scheduled: 'badge badge-info',
  Failed: 'badge badge-error',
};

const STATUS_ICON: Record<PaymentStatus, string> = {
  Completed: 'M4.5 12.75l6 6 9-13.5',
  Pending: 'M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z',
  Scheduled: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  Failed: 'M6 18L18 6M6 6l12 12',
};

interface PaymentRow {
  id: string;
  when: number;
  dateISO: string;
  payee: string;
  description: string;
  fromAccount: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
}

const TABS = [
  { id: 'transfer', label: 'Between my accounts' },
  { id: 'saved', label: 'Saved payee' },
  { id: 'new', label: 'Someone new' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/* ──────────────────────────────────────────────────────────────────
 * Data resolution — the payment history is assembled from posted
 * transactions plus the upcoming schedule, never from invented rows.
 * ────────────────────────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

interface PaymentsData {
  rows: PaymentRow[];
  accounts: BankAccount[];
  beneficiaries: Beneficiary[];
  statuses: PaymentStatus[];
}

function resolvePayments(): PaymentsData {
  if (!ACCOUNTS.length) throw new Error('No accounts returned');
  const nameOf = (id: string) => ACCOUNTS.find(a => a.id === id)?.name ?? 'Unknown account';

  const posted: PaymentRow[] = TRANSACTIONS.filter(t => t.direction === 'OUT')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 12)
    .map(t => ({
      id: t.id,
      when: new Date(t.date).getTime(),
      dateISO: t.date,
      payee: t.merchant,
      description: t.note ?? t.category,
      fromAccount: nameOf(t.accountId),
      amount: t.amount,
      currency: t.currency,
      status: t.status === 'PENDING' ? 'Pending' : t.status === 'DECLINED' ? 'Failed' : 'Completed',
    }));

  const scheduled: PaymentRow[] = SCHEDULED_PAYMENTS.map(s => ({
    id: `scheduled-${s.id}`,
    when: new Date(s.nextDate).getTime(),
    dateISO: s.nextDate,
    payee: s.payee,
    description: `${s.frequency} payment`,
    fromAccount: 'Standing order',
    amount: s.amount,
    currency: s.currency,
    status: 'Scheduled',
  }));

  const rows = [...scheduled, ...posted].sort((a, b) => b.when - a.when);
  const present = new Set(rows.map(r => r.status));

  return {
    rows,
    accounts: ACCOUNTS,
    beneficiaries: BENEFICIARIES,
    statuses: STATUS_ORDER.filter(s => present.has(s)),
  };
}

function usePaymentsData() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setData(resolvePayments());
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

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-5">
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="empty-state-title">We couldn&apos;t load your payments</p>
        <p className="empty-state-text">Something went wrong while reading your payment history. No payment has been made.</p>
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

export default function PaymentsPage() {
  const [tab, setTab] = useState<TabId>('transfer');
  const [payeeId, setPayeeId] = useState('');
  const [payeeText, setPayeeText] = useState('');
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState(ACCOUNTS[0]?.id ?? '');
  const [toAccount, setToAccount] = useState(ACCOUNTS[1]?.id ?? '');
  const [reference, setReference] = useState('');
  const [payDate, setPayDate] = useState(todayISO);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'All'>('All');
  const [submitted, setSubmitted] = useState<PaymentRow[]>([]);
  const [confirmation, setConfirmation] = useState('');
  const { data, state, retry } = usePaymentsData();

  const accounts = data?.accounts ?? ACCOUNTS;
  const beneficiaries = data?.beneficiaries ?? BENEFICIARIES;
  const source = accounts.find(a => a.id === fromAccount) ?? accounts[0];
  const otherAccounts = accounts.filter(a => a.id !== fromAccount);

  const rows = useMemo(() => {
    const all = [...submitted, ...(data?.rows ?? [])];
    return all.sort((a, b) => b.when - a.when);
  }, [submitted, data]);

  const visibleRows = useMemo(
    () => (statusFilter === 'All' ? rows : rows.filter(r => r.status === statusFilter)),
    [rows, statusFilter]
  );

  const numericAmount = parseFloat(amount || '0');
  const available = source?.available ?? 0;
  const recipientChosen =
    tab === 'transfer' ? Boolean(toAccount) : tab === 'saved' ? Boolean(payeeId) : Boolean(payeeText.trim());
  const overBalance = numericAmount > available;
  const canSend =
    Boolean(source) && recipientChosen && Number.isFinite(numericAmount) && numericAmount > 0 && !overBalance;

  const recipientLabel =
    tab === 'transfer'
      ? otherAccounts.find(a => a.id === toAccount)?.name ?? 'the selected account'
      : tab === 'saved'
        ? beneficiaries.find(b => b.id === payeeId)?.name ?? 'the selected payee'
        : payeeText.trim() || 'the new payee';

  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(''), 6000);
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  const handleSubmit = useCallback(() => {
    if (!canSend || !source) return;
    const when = new Date(`${payDate}T12:00:00`).getTime();
    const row: PaymentRow = {
      id: `local-${Date.now()}`,
      when: Number.isFinite(when) ? when : Date.now(),
      dateISO: Number.isFinite(when) ? new Date(when).toISOString() : new Date().toISOString(),
      payee: recipientLabel,
      description: reference.trim() || 'One-off payment',
      fromAccount: source.name,
      amount: numericAmount,
      currency: source.currency,
      status: payDate > todayISO() ? 'Scheduled' : 'Pending',
    };
    setSubmitted(prev => [row, ...prev]);
    setConfirmation(`${fmt(row.amount, row.currency)} to ${row.payee} submitted from ${row.fromAccount}.`);
    setAmount('');
    setReference('');
  }, [canSend, source, payDate, recipientLabel, reference, numericAmount]);

  const handleClear = useCallback(() => {
    setAmount('');
    setReference('');
    setPayeeId('');
    setPayeeText('');
    setPayDate(todayISO());
    setConfirmation('');
  }, []);

  const pickQuickRecipient = useCallback((b: Beneficiary) => {
    setTab('saved');
    setPayeeId(b.id);
    setConfirmation(`${b.name} selected as the payee.`);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments &amp; transfers</h1>
          <p className="page-subtitle">Move money between your accounts, pay a saved payee, or set up someone new.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left: form + history */}
        <div className="space-y-6 xl:col-span-2">
          <form
            className="panel"
            onSubmit={e => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="panel-header">
              <h2 className="panel-title">Make a payment</h2>
            </div>

            <div className="panel-body space-y-6">
              {/* Payment type */}
              <div>
                <span id="payment-type-label" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Payment type
                </span>
                <div role="group" aria-labelledby="payment-type-label" className="segmented w-full">
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      aria-pressed={tab === t.id}
                      data-active={tab === t.id}
                      className="segmented-item flex-1 !shrink justify-center"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* From */}
                <div>
                  <label htmlFor="pay-from" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    From
                  </label>
                  <select
                    id="pay-from"
                    value={fromAccount}
                    onChange={e => setFromAccount(e.target.value)}
                    className="select"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {fmt(a.available, a.currency)} available
                      </option>
                    ))}
                  </select>
                </div>

                {/* To */}
                <div>
                  {tab === 'transfer' && (
                    <>
                      <label htmlFor="pay-to-account" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        To account
                      </label>
                      <select
                        id="pay-to-account"
                        value={toAccount}
                        onChange={e => setToAccount(e.target.value)}
                        className="select"
                      >
                        {otherAccounts.length === 0 && <option value="">No other accounts</option>}
                        {otherAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </>
                  )}

                  {tab === 'saved' && (
                    <>
                      <label htmlFor="pay-to-payee" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Saved payee
                      </label>
                      <select
                        id="pay-to-payee"
                        value={payeeId}
                        onChange={e => setPayeeId(e.target.value)}
                        className="select"
                      >
                        <option value="">Choose a payee</option>
                        {beneficiaries.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.handle})</option>
                        ))}
                      </select>
                    </>
                  )}

                  {tab === 'new' && (
                    <>
                      <label htmlFor="pay-to-new" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Payee name
                      </label>
                      <input
                        id="pay-to-new"
                        type="text"
                        value={payeeText}
                        onChange={e => setPayeeText(e.target.value)}
                        placeholder="e.g. Olivia Bennett"
                        autoComplete="off"
                        className="input"
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Amount */}
                <div>
                  <label htmlFor="pay-amount" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Amount
                  </label>
                  <div className="relative">
                    <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                      €
                    </span>
                    <input
                      id="pay-amount"
                      type="text"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      inputMode="decimal"
                      aria-describedby="pay-amount-hint"
                      className="input pl-8 tabular-nums"
                    />
                  </div>
                  <p id="pay-amount-hint" className="field-hint">
                    {overBalance
                      ? `That is more than the ${fmt(available, source?.currency ?? 'EUR')} available in ${source?.name ?? 'this account'}.`
                      : `${fmt(available, source?.currency ?? 'EUR')} available in ${source?.name ?? 'this account'}`}
                  </p>
                </div>

                {/* Date */}
                <div>
                  <label htmlFor="pay-date" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Payment date
                  </label>
                  <input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    min={todayISO()}
                    onChange={e => setPayDate(e.target.value)}
                    className="input"
                  />
                  <p className="field-hint">Today if you leave this as it is.</p>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label htmlFor="pay-reference" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Reference (optional)
                </label>
                <input
                  id="pay-reference"
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. Rent, Invoice #123"
                  autoComplete="off"
                  className="input"
                />
              </div>

              {overBalance && (
                <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
                  Insufficient available balance for this payment.
                </p>
              )}

              <div className="flex flex-wrap gap-3 border-t pt-5" style={{ borderColor: 'var(--surface-border)' }}>
                <button type="submit" disabled={!canSend} className="btn btn-primary flex-1">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
                  </svg>
                  Submit payment
                </button>
                <button type="button" onClick={handleClear} className="btn btn-secondary">
                  Clear
                </button>
              </div>

              <div aria-live="polite">
                {confirmation && (
                  <div className="alert alert-success">
                    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>{confirmation}</span>
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* Payment history */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Payments and upcoming</h2>
              <span className="chip tabular-nums" aria-live="polite">
                {state === 'loading' ? 'Loading' : `${visibleRows.length} shown`}
              </span>
            </div>

            {data && data.statuses.length > 1 && (
              <div
                role="group"
                aria-label="Filter payments by status"
                className="flex flex-wrap gap-2 border-b px-5 py-4"
                style={{ borderColor: 'var(--surface-border)' }}
              >
                {(['All', ...data.statuses] as (PaymentStatus | 'All')[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    aria-pressed={statusFilter === s}
                    className="chip transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    style={
                      statusFilter === s
                        ? { backgroundColor: 'var(--brand-soft)', borderColor: 'var(--brand)', color: 'var(--brand-on-soft)' }
                        : undefined
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {state === 'loading' ? (
              <div className="divide-token">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4">
                    <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-1/3" />
                      <div className="skeleton h-3.5 w-1/4" />
                    </div>
                    <div className="skeleton h-4 w-20 shrink-0" />
                  </div>
                ))}
              </div>
            ) : state === 'error' ? (
              <LoadError onRetry={retry} />
            ) : visibleRows.length === 0 ? (
              <div className="p-5">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <p className="empty-state-title">
                    {statusFilter === 'All' ? 'No payments yet' : `No ${statusFilter.toLowerCase()} payments`}
                  </p>
                  <p className="empty-state-text">
                    {statusFilter === 'All'
                      ? 'Payments you make and payments you schedule will both be listed here.'
                      : `Nothing is currently marked as ${statusFilter.toLowerCase()}. Choose a different status to see the rest.`}
                  </p>
                  {statusFilter !== 'All' && (
                    <button type="button" onClick={() => setStatusFilter('All')} className="btn btn-secondary btn-sm mt-4">
                      Show all payments
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                role="region"
                aria-label="Payments and upcoming payments, scroll horizontally to see all columns"
                tabIndex={0}
                className="overflow-x-auto"
              >
                <table className="w-full min-w-[680px] border-collapse text-sm" aria-label="Payments and upcoming payments">
                  <thead>
                    <tr>
                      {['Date', 'Payee', 'From', 'Amount', 'Status'].map(h => (
                        <th
                          key={h}
                          scope="col"
                          className="px-5 py-3 text-left text-sm font-semibold"
                          style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--surface-border)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(r => (
                      <tr key={r.id} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                        <td className="px-5 py-4 text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--surface-border)' }}>
                          {dateLabel(r.dateISO)}
                        </td>
                        <td className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                          <span className="block text-base font-medium" style={{ color: 'var(--text-primary)' }}>{r.payee}</span>
                          <span className="block text-sm" style={{ color: 'var(--text-muted)' }}>{r.description}</span>
                        </td>
                        <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--surface-border)' }}>
                          {r.fromAccount}
                        </td>
                        <td
                          className="px-5 py-4 text-right text-base font-bold tabular-nums whitespace-nowrap"
                          style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)' }}
                        >
                          −{fmt(r.amount, r.currency)}
                        </td>
                        <td className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                          <span className={`${STATUS_BADGE[r.status]} whitespace-nowrap`}>
                            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={STATUS_ICON[r.status]} />
                            </svg>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Quick transfers */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Quick transfers</h2>
            </div>
            {state === 'loading' ? (
              <div className="divide-token">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4">
                    <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-1/2" />
                      <div className="skeleton h-3.5 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : state === 'error' ? (
              <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                Saved payees are unavailable right now. Use “Try again” on the payment history panel.
              </p>
            ) : beneficiaries.length === 0 ? (
              <div className="p-5">
                <div className="empty-state !py-10">
                  <div className="empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <p className="empty-state-title">No saved payees</p>
                  <p className="empty-state-text">People you pay more than once can be saved here for next time.</p>
                </div>
              </div>
            ) : (
              <div className="divide-token">
                {beneficiaries.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-4">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: b.gradient }}
                    >
                      {b.glyph}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>{b.name}</p>
                      <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                        {b.handle}
                        {typeof b.lastSent === 'number' ? ` · last sent ${fmt(b.lastSent)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => pickQuickRecipient(b)}
                      className="btn btn-secondary btn-sm shrink-0"
                      aria-label={`Pay ${b.name}`}
                    >
                      Pay
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming scheduled */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Upcoming scheduled</h2>
              <span className="chip tabular-nums">{SCHEDULED_PAYMENTS.length} total</span>
            </div>
            <div className="divide-token">
              {SCHEDULED_PAYMENTS.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--surface-input)' }}
                  >
                    <span className="text-xs font-semibold leading-none" style={{ color: 'var(--text-muted)' }}>
                      {monthShort(s.nextDate)}
                    </span>
                    <span className="text-base font-bold leading-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {dayNumber(s.nextDate)}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>{s.payee}</p>
                    <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                      {s.frequency} · {dateLabel(s.nextDate)}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmt(s.amount, s.currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Fraud notice */}
          <div className="panel flex items-start gap-3 p-5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </span>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Fraud notice</p>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                We will never ask for your password, PIN or full card details. If someone does, report it through
                messages straight away.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
