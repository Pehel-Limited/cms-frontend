'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RepeatPayment } from '@/components/intelligence/RepeatPayment';
import { DotMatrix } from '@/components/banking/BankCard';
import { PageHero } from '@/components/ui/PageHero';
import Glyph, { ACCOUNT_GLYPH, glyphFor, GlyphTile } from '@/components/ui/Glyph';
import {
  ACCOUNTS,
  BENEFICIARIES,
  SCHEDULED_PAYMENTS,
  TRANSACTIONS,
  type BankAccount,
  type Beneficiary,
  type Transaction,
} from '@/lib/banking-data';

function fmt(n: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase();
}

/* ──────────────────────────────────────────────────────────────────
 * What the customer is doing — the four tiles across the top of the
 * screen. Each is a different source of recipient, not a different
 * form, so switching tile only swaps the "To" control.
 * ────────────────────────────────────────────────────────────────── */

const ACTIONS = [
  { id: 'transfer', label: 'Transfer', caption: 'Between my accounts', icon: 'swap' },
  { id: 'saved', label: 'Pay someone', caption: 'A payee you have saved', icon: 'user' },
  { id: 'bill', label: 'Pay a bill', caption: 'A supplier you pay regularly', icon: 'Bills' },
  { id: 'new', label: 'New payee', caption: 'Set up someone else', icon: 'plus' },
] as const;

type ActionId = (typeof ACTIONS)[number]['id'];

/* ──────────────────────────────────────────────────────────────────
 * Activity — posted transactions plus the upcoming schedule. Nothing is
 * invented: every row is either a transaction on record or a standing
 * payment that has a real next-deduction date.
 * ────────────────────────────────────────────────────────────────── */

type RowState = 'Scheduled' | 'Pending' | 'Completed' | 'Declined';

const STATE_ORDER: RowState[] = ['Scheduled', 'Pending', 'Completed', 'Declined'];

const STATE_BADGE: Record<RowState, string> = {
  Scheduled: 'badge badge-info',
  Pending: 'badge badge-warning',
  Completed: 'badge badge-success',
  Declined: 'badge badge-error',
};

const STATE_GLYPH: Record<RowState, string> = {
  Scheduled: 'calendar',
  Pending: 'clock',
  Completed: 'check',
  Declined: 'x',
};

interface ActivityRow {
  id: string;
  when: number;
  dateISO: string;
  title: string;
  caption: string;
  account: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  state: RowState;
  icon: string;
  /** Initials for a person, otherwise an outline glyph name. */
  who?: string;
}

const POSTED_WINDOW = 16;
/* The activity list is bounded so the composer and the rail stay on one screen;
   the count in the footer says exactly how much sits behind "Show all". */
const ACTIVITY_PREVIEW = 6;

function nameOf(id: string): string {
  return ACCOUNTS.find(a => a.id === id)?.name ?? 'Unknown account';
}

function postedRows(): ActivityRow[] {
  return [...TRANSACTIONS]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, POSTED_WINDOW)
    .map(t => ({
      id: t.id,
      when: new Date(t.date).getTime(),
      dateISO: t.date,
      title: t.merchant,
      caption: t.note ? `${t.category} · ${t.note}` : t.category,
      account: nameOf(t.accountId),
      amount: t.amount,
      currency: t.currency,
      direction: t.direction,
      state:
        t.status === 'PENDING' ? 'Pending' : t.status === 'DECLINED' ? 'Declined' : 'Completed',
      icon: glyphFor(t.category),
      who: BENEFICIARIES.some(b => b.name === t.merchant) ? initials(t.merchant) : undefined,
    }));
}

function scheduledRows(): ActivityRow[] {
  return SCHEDULED_PAYMENTS.map(s => ({
    id: `scheduled-${s.id}`,
    when: new Date(s.nextDate).getTime(),
    dateISO: s.nextDate,
    title: s.payee,
    caption: `${s.frequency} standing payment`,
    account: 'Direct debit',
    amount: s.amount,
    currency: s.currency,
    direction: 'OUT' as const,
    state: 'Scheduled' as const,
    icon: glyphFor(s.icon),
  }));
}

/** A biller is anything already on the schedule or paid from history that is
    not a personal payee — so the "Pay a bill" list is drawn from real payees. */
interface Biller {
  name: string;
  detail: string;
  icon: string;
  typical: number;
  currency: string;
}

function billers(): Biller[] {
  const seen = new Map<string, Biller>();
  SCHEDULED_PAYMENTS.forEach(s => {
    seen.set(s.payee, {
      name: s.payee,
      detail: `${s.frequency} · ${fmt(s.amount, s.currency)}`,
      icon: glyphFor(s.icon),
      typical: s.amount,
      currency: s.currency,
    });
  });
  TRANSACTIONS.filter(t => t.direction === 'OUT')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach(t => {
      if (seen.has(t.merchant) || BENEFICIARIES.some(b => b.name === t.merchant)) return;
      seen.set(t.merchant, {
        name: t.merchant,
        detail: `${t.category} · last ${fmt(t.amount, t.currency)}`,
        icon: glyphFor(t.category),
        typical: t.amount,
        currency: t.currency,
      });
    });
  return [...seen.values()];
}

type LoadState = 'loading' | 'ready' | 'error';

interface Activity {
  rows: ActivityRow[];
  states: RowState[];
}

function resolveActivity(): Activity {
  if (!ACCOUNTS.length) throw new Error('No accounts returned');
  const rows = [...scheduledRows(), ...postedRows()].sort((a, b) => b.when - a.when);
  const present = new Set(rows.map(r => r.state));
  return { rows, states: STATE_ORDER.filter(s => present.has(s)) };
}

function useActivity() {
  const [data, setData] = useState<Activity | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setData(resolveActivity());
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

  return { data, state, retry: useCallback(() => setAttempt(a => a + 1), []) };
}

/* ────────────────────────────────────────────────────────────────── */

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass-body">
      <div className="empty-state">
        <div className="empty-state-icon">
          <Glyph name="alert" className="h-6 w-6" />
        </div>
        <p className="empty-state-title">We couldn&apos;t load your activity</p>
        <p className="empty-state-text">
          Something went wrong while reading your payment history. No payment has been made.
        </p>
        <button type="button" onClick={onRetry} className="btn btn-primary btn-sm mt-4">
          <Glyph name="subscription" className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}

/** A native select wearing an avatar row: the whole row opens it, and the
    keyboard path is unchanged because the select itself stays in the tree. */
function PickRow({
  id,
  label,
  value,
  onChange,
  avatar,
  title,
  detail,
  trailing,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  avatar: React.ReactNode;
  title: string;
  detail?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="pick-row relative cursor-pointer">
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        {detail && (
          <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {detail}
          </span>
        )}
      </span>
      {trailing}
      <Glyph name="chevron" className="h-4 w-4 shrink-0" strokeWidth={2} />
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {children}
      </select>
    </label>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </label>
  );
}

/* ────────────────────────────────────────────────────────────────── */

export default function PaymentsPage() {
  const [action, setAction] = useState<ActionId>('transfer');
  const [payeeId, setPayeeId] = useState('');
  const [payeeText, setPayeeText] = useState('');
  const [billerName, setBillerName] = useState('');
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState(ACCOUNTS[0]?.id ?? '');
  const [toAccount, setToAccount] = useState(ACCOUNTS[1]?.id ?? '');
  const [reference, setReference] = useState('');
  const [payDate, setPayDate] = useState(todayISO);
  const [direction, setDirection] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [stateFilter, setStateFilter] = useState<RowState | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [sent, setSent] = useState<ActivityRow[]>([]);
  const [confirmation, setConfirmation] = useState('');

  const { data, state, retry } = useActivity();

  const accounts = ACCOUNTS;
  const source = accounts.find(a => a.id === fromAccount) ?? accounts[0];
  const otherAccounts = accounts.filter(a => a.id !== fromAccount);
  const allBillers = useMemo(billers, []);

  /* A recipient is resolved the same way whatever tile is selected, so the
     submit path and the summary line never need to branch on the tile. */
  const recipient = useMemo(() => {
    if (action === 'transfer') {
      const a = otherAccounts.find(x => x.id === toAccount);
      return a
        ? {
            name: a.name,
            detail: `${fmt(a.available, a.currency)} available`,
            icon: ACCOUNT_GLYPH[a.type],
            currency: a.currency,
          }
        : null;
    }
    if (action === 'saved') {
      const b = BENEFICIARIES.find(x => x.id === payeeId);
      return b
        ? { name: b.name, detail: b.handle, icon: '', initials: initials(b.name), currency: 'EUR' }
        : null;
    }
    if (action === 'bill') {
      const s = allBillers.find(x => x.name === billerName);
      return s
        ? { name: s.name, detail: s.detail, icon: s.icon, currency: s.currency }
        : null;
    }
    const typed = payeeText.trim();
    return typed ? { name: typed, detail: 'New payee', icon: 'user', currency: 'EUR' } : null;
  }, [action, otherAccounts, toAccount, payeeId, allBillers, billerName, payeeText]);

  const numericAmount = parseFloat(amount || '0');
  const available = source?.available ?? 0;
  const overBalance = numericAmount > available;
  const canSend =
    Boolean(source) && Boolean(recipient) && Number.isFinite(numericAmount) && numericAmount > 0 && !overBalance;

  const rows = useMemo(() => [...sent, ...(data?.rows ?? [])].sort((a, b) => b.when - a.when), [sent, data]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (direction !== 'ALL' && r.direction !== direction) return false;
      if (stateFilter !== 'ALL' && r.state !== stateFilter) return false;
      if (!q) return true;
      return `${r.title} ${r.caption} ${r.account}`.toLowerCase().includes(q);
    });
  }, [rows, direction, stateFilter, query]);

  const shownRows = expanded ? visibleRows : visibleRows.slice(0, ACTIVITY_PREVIEW);

  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(''), 6000);
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  const handleSubmit = useCallback(() => {
    if (!canSend || !source || !recipient) return;
    const when = new Date(`${payDate}T12:00:00`).getTime();
    const iso = Number.isFinite(when) ? new Date(when).toISOString() : new Date().toISOString();
    const row: ActivityRow = {
      id: `local-${Date.now()}`,
      when: Number.isFinite(when) ? when : Date.now(),
      dateISO: iso,
      title: recipient.name,
      caption: reference.trim() || 'One-off payment',
      account: source.name,
      amount: numericAmount,
      currency: source.currency,
      direction: 'OUT',
      state: payDate > todayISO() ? 'Scheduled' : 'Pending',
      icon: recipient.icon || 'send',
      who: 'initials' in recipient ? recipient.initials : undefined,
    };
    setSent(prev => [row, ...prev]);
    setConfirmation(
      `${fmt(row.amount, row.currency)} to ${row.title} prepared as a demo from ${row.account}. No money has moved.`
    );
    setAmount('');
    setReference('');
  }, [canSend, source, recipient, payDate, reference, numericAmount]);

  const chooseAction = useCallback((next: ActionId) => {
    setAction(next);
    setPayeeId('');
    setBillerName('');
    setPayeeText('');
  }, []);

  const swap = useCallback(() => {
    setAction('transfer');
    setFromAccount(toAccount);
    setToAccount(fromAccount);
  }, [fromAccount, toAccount]);

  const pickPayee = useCallback((b: Beneficiary) => {
    setAction('saved');
    setPayeeId(b.id);
    setConfirmation(`${b.name} selected as the payee. Add an amount to continue.`);
  }, []);

  const pickBiller = useCallback((name: string, typical: number) => {
    setAction('bill');
    setBillerName(name);
    setAmount(String(typical));
  }, []);

  const prepareRepeat = useCallback((t: Transaction) => {
    const beneficiary = BENEFICIARIES.find(b => b.name === t.merchant);
    if (beneficiary) {
      setAction('saved');
      setPayeeId(beneficiary.id);
    } else {
      setAction('new');
      setPayeeText(t.merchant);
    }
    setAmount(String(t.amount));
    setReference(t.note || '');
    setFromAccount(t.accountId);
  }, []);

  const scheduledCount = SCHEDULED_PAYMENTS.length;
  const scheduledTotal = SCHEDULED_PAYMENTS.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-5">
      <PageHero
        title="Payments & transfers"
        subtitle="Choose what you are paying for, then fill in the amount. Every payment on this screen is simulated."
        meta={
          <>
            <span className="chip">Sample data</span>
            <span className="chip">{accounts.length} accounts</span>
            <span className="chip">{scheduledCount} scheduled</span>
          </>
        }
        actions={
          <Link href="/portal/transactions" className="pill-btn">
            All activity
            <Glyph name="Transfers" className="h-4 w-4" />
          </Link>
        }
      />

      {/* ══ What are you paying ══ */}
      <div role="group" aria-label="Payment type" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACTIONS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => chooseAction(a.id)}
            aria-pressed={action === a.id}
            data-active={action === a.id}
            className="action-tile"
          >
            <span className="action-tile-icon">
              <Glyph name={a.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{a.label}</span>
              <span
                className="block truncate text-xs"
                style={{ color: 'inherit', opacity: 0.65 }}
              >
                {a.caption}
              </span>
            </span>
            <span className="action-tile-arrow">
              <Glyph name="send" className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>

      <RepeatPayment onRepeat={prepareRepeat} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* ══ Composer + activity ══ */}
        <div className="flex flex-col gap-5 xl:col-span-7">
          <form
            className="glass-panel"
            onSubmit={e => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="glass-head">
              <div>
                <h2 className="glass-title">
                  {action === 'transfer' ? 'Transfer money' : 'Make a payment'}
                </h2>
                <p className="glass-sub">
                  {action === 'transfer'
                    ? 'Moving between your own accounts settles instantly.'
                    : 'Pick a date to schedule instead of sending now.'}
                </p>
              </div>
              <span className="chip num shrink-0">{fmt(available, source?.currency ?? 'EUR')} available</span>
            </div>

            <div className="glass-body space-y-4">
              {/* From / To */}
              <div className="flex flex-col gap-3">
                <div>
                  <FieldLabel htmlFor="pay-from">From</FieldLabel>
                  <PickRow
                    id="pay-from"
                    label="Account to pay from"
                    value={fromAccount}
                    onChange={setFromAccount}
                    avatar={
                      <GlyphTile
                        name={ACCOUNT_GLYPH[source?.type ?? 'CURRENT']}
                        className="h-9 w-9 rounded-xl"
                        iconClassName="h-4 w-4"
                      />
                    }
                    title={source?.name ?? 'No account'}
                    detail={`${source?.sortCode ?? ''} · ${source?.accountNumber ?? ''}`}
                    trailing={
                      <span className="num shrink-0 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmt(source?.balance ?? 0, source?.currency ?? 'EUR')}
                      </span>
                    }
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {fmt(a.available, a.currency)} available
                      </option>
                    ))}
                  </PickRow>
                </div>

                {action === 'transfer' && otherAccounts.length > 0 && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={swap}
                      className="ring-btn !h-9 !w-9"
                      aria-label="Swap the accounts"
                    >
                      <Glyph name="swap" className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                )}

                <div>
                  <FieldLabel htmlFor={action === 'new' ? 'pay-new-payee' : 'pay-to'}>To</FieldLabel>
                  {action === 'new' ? (
                    <input
                      id="pay-new-payee"
                      type="text"
                      value={payeeText}
                      onChange={e => setPayeeText(e.target.value)}
                      placeholder="Who are you paying?"
                      autoComplete="off"
                      className="input"
                    />
                  ) : otherAccounts.length === 0 && action === 'transfer' ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      This is the only account we can see, so there is nothing to transfer to yet.
                    </p>
                  ) : (
                    <PickRow
                      id="pay-to"
                      label="Recipient"
                      value={action === 'transfer' ? toAccount : action === 'saved' ? payeeId : billerName}
                      onChange={v => {
                        if (action === 'transfer') setToAccount(v);
                        else if (action === 'saved') setPayeeId(v);
                        else {
                          setBillerName(v);
                          const b = allBillers.find(x => x.name === v);
                          if (b) setAmount(String(b.typical));
                        }
                      }}
                      avatar={
                        recipient && 'initials' in recipient && recipient.initials ? (
                          <span className="avatar-dot h-9 w-9 text-xs">{recipient.initials}</span>
                        ) : (
                          <GlyphTile
                            name={recipient?.icon || (action === 'transfer' ? 'Transfers' : 'Other')}
                            className="h-9 w-9 rounded-xl"
                            iconClassName="h-4 w-4"
                          />
                        )
                      }
                      title={recipient?.name ?? (action === 'bill' ? 'Choose a supplier' : action === 'saved' ? 'Choose a payee' : 'Choose an account')}
                      detail={recipient?.detail ?? 'Nothing selected yet'}
                    >
                      <option value="">
                        {action === 'transfer' ? 'Choose an account' : action === 'saved' ? 'Choose a payee' : 'Choose a supplier'}
                      </option>
                      {action === 'transfer' &&
                        otherAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} — {fmt(a.available, a.currency)}
                          </option>
                        ))}
                      {action === 'saved' &&
                        BENEFICIARIES.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.handle})
                          </option>
                        ))}
                      {action === 'bill' &&
                        allBillers.map(b => (
                          <option key={b.name} value={b.name}>
                            {b.name} — {b.detail}
                          </option>
                        ))}
                    </PickRow>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div>
                <FieldLabel htmlFor="pay-amount">Amount</FieldLabel>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
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
                    className="input num pl-9 text-lg"
                  />
                </div>
                <p id="pay-amount-hint" className="field-hint">
                  {overBalance
                    ? `That is more than the ${fmt(available, source?.currency ?? 'EUR')} available in ${source?.name ?? 'this account'}.`
                    : `${fmt(available, source?.currency ?? 'EUR')} available in ${source?.name ?? 'this account'}.`}
                </p>
              </div>

              {/* When + reference */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="pay-date">When</FieldLabel>
                  <input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    min={todayISO()}
                    onChange={e => setPayDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="pay-reference">Reference</FieldLabel>
                  <input
                    id="pay-reference"
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                    className="input"
                  />
                </div>
              </div>

              {overBalance && (
                <p className="text-sm font-medium" role="alert" style={{ color: 'var(--down)' }}>
                  Insufficient available balance for this payment.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="submit" disabled={!canSend} className="btn btn-primary flex-1">
                  <Glyph name="send" className="h-4 w-4" strokeWidth={2} />
                  {payDate > todayISO() ? 'Schedule payment' : 'Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAmount('');
                    setReference('');
                    setConfirmation('');
                  }}
                  className="btn btn-secondary"
                >
                  Clear
                </button>
              </div>

              <div aria-live="polite">
                {confirmation && (
                  <div className="alert alert-success">
                    <Glyph name="check" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                    <span>{confirmation}</span>
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* ══ Activity ══ */}
          <section className="glass-panel" aria-label="Recent activity">
            <div className="glass-head flex-col !items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="glass-title">Recent activity</h2>
                <p className="glass-sub">
                  Posted payments, money in, and everything still scheduled.
                </p>
              </div>
              <span className="chip num shrink-0" aria-live="polite">
                {state === 'loading' ? 'Loading' : `${visibleRows.length} shown`}
              </span>
            </div>

            <div
              className="flex flex-col gap-3 px-6 pb-4 lg:flex-row lg:items-center"
              style={{ borderTop: '1px solid var(--hairline)', paddingTop: 16 }}
            >
              <div className="relative flex-1">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Glyph name="search" className="h-4 w-4" strokeWidth={2} />
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Payee, category or account"
                  aria-label="Search activity"
                  className="input pl-9"
                />
              </div>

              <div className="segmented" role="group" aria-label="Filter by direction">
                {(
                  [
                    { id: 'ALL', label: 'All' },
                    { id: 'IN', label: 'Money in' },
                    { id: 'OUT', label: 'Money out' },
                  ] as const
                ).map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDirection(f.id)}
                    aria-pressed={direction === f.id}
                    data-active={direction === f.id}
                    className="segmented-item"
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <select
                value={stateFilter}
                onChange={e => setStateFilter(e.target.value as RowState | 'ALL')}
                aria-label="Filter by status"
                className="select !w-auto"
              >
                <option value="ALL">Any status</option>
                {(data?.states ?? STATE_ORDER).map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {state === 'loading' ? (
              <div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="glass-row">
                    <div className="skeleton h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-1/3" />
                      <div className="skeleton h-3.5 w-1/4" />
                    </div>
                    <div className="skeleton h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : state === 'error' ? (
              <LoadError onRetry={retry} />
            ) : visibleRows.length === 0 ? (
              <div className="glass-body">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Glyph name="calendar" className="h-6 w-6" />
                  </div>
                  <p className="empty-state-title">Nothing matches those filters</p>
                  <p className="empty-state-text">
                    {rows.length === 0
                      ? 'Payments you make and payments you schedule will both appear here.'
                      : `${rows.length} activity ${rows.length === 1 ? 'row exists' : 'rows exist'} outside the current search and filters.`}
                  </p>
                  {rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setDirection('ALL');
                        setStateFilter('ALL');
                      }}
                      className="btn btn-secondary btn-sm mt-4"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {shownRows.map(r => (
                  <div key={r.id} className="glass-row">
                    {r.who ? (
                      <span className="avatar-dot h-10 w-10 text-sm">{r.who}</span>
                    ) : (
                      <GlyphTile name={r.icon} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {r.title}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.caption} · {dateLabel(r.dateISO)}
                      </p>
                    </div>
                    <span className={`${STATE_BADGE[r.state]} shrink-0 whitespace-nowrap`}>
                      <Glyph name={STATE_GLYPH[r.state]} className="h-3.5 w-3.5" strokeWidth={2} />
                      {r.state}
                    </span>
                    <div className="w-24 shrink-0 text-right">
                      <p
                        className={`num text-sm font-semibold ${r.direction === 'IN' ? 'delta-up' : ''}`}
                        style={r.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                      >
                        {r.direction === 'IN' ? '+' : '−'}
                        {fmt(r.amount, r.currency)}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.account}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {visibleRows.length > ACTIVITY_PREVIEW && (
              <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-4">
                {expanded ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Show fewer
                  </button>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Showing {ACTIVITY_PREVIEW} of {visibleRows.length} matching rows
                  </span>
                )}
                <Link href="/portal/transactions" className="link-arrow shrink-0 text-sm">
                  Full transaction history
                  <span data-arrow aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* ══ Rail ══ */}
        <div className="flex flex-col gap-5 xl:col-span-5">
          <section className="glass-panel" aria-label="Your accounts">
            <div className="glass-head">
              <div>
                <h2 className="glass-title">Your accounts</h2>
                <p className="glass-sub">Where the money would come from.</p>
              </div>
              <Link href="/portal/accounts" className="pill-btn shrink-0 !px-3 !py-1.5 !text-xs">
                Manage
              </Link>
            </div>
            {state === 'loading' ? (
              <div className="pb-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="glass-row">
                    <div className="skeleton h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-1/2" />
                      <div className="skeleton h-3.5 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pb-3">
                {accounts.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setFromAccount(a.id);
                      if (action === 'transfer' && a.id === toAccount) setToAccount(source?.id ?? a.id);
                    }}
                    aria-pressed={a.id === fromAccount}
                    className="glass-row w-full text-left"
                  >
                    <GlyphTile
                      name={ACCOUNT_GLYPH[a.type]}
                      className="h-9 w-9 rounded-xl"
                      iconClassName="h-4 w-4"
                      tone={a.id === fromAccount ? 'brand' : 'neutral'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {a.name}
                      </span>
                      <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {a.accountNumber}
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0">
                      <DotMatrix data={a.spark} cell={3} rows={5} label={`${a.name} balance trend`} />
                    </span>
                    <span className="num w-24 shrink-0 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {fmt(a.available, a.currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="glass-panel" aria-label="People you pay">
            <div className="glass-head">
              <div>
                <h2 className="glass-title">People you pay</h2>
                <p className="glass-sub">Saved payees, ready to select.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  chooseAction('new');
                  setConfirmation('Add a name in the New payee field to set someone up.');
                }}
                className="ring-btn shrink-0 !h-9 !w-9"
                aria-label="Set up a new payee"
              >
                <Glyph name="plus" className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 px-6 pb-5">
              {BENEFICIARIES.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pickPayee(b)}
                  aria-pressed={action === 'saved' && payeeId === b.id}
                  className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-colors"
                  style={{
                    background: action === 'saved' && payeeId === b.id ? 'var(--brand-soft)' : 'var(--tile-bg)',
                    border: '1px solid var(--hairline)',
                    color:
                      action === 'saved' && payeeId === b.id
                        ? 'var(--brand-on-soft)'
                        : 'var(--text-secondary)',
                  }}
                >
                  <span className="avatar-dot !border-0 h-7 w-7 text-[10px]">{initials(b.name)}</span>
                  {b.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </section>

          <section className="glass-panel" aria-label="Suppliers you pay regularly">
            <div className="glass-head">
              <div>
                <h2 className="glass-title">Everyday bills</h2>
                <p className="glass-sub">
                  {scheduledCount} on standing order · {fmt(scheduledTotal)} a cycle
                </p>
              </div>
            </div>
            <div className="pb-3">
              {allBillers.slice(0, 5).map(b => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => pickBiller(b.name, b.typical)}
                  aria-pressed={action === 'bill' && billerName === b.name}
                  className="glass-row w-full text-left"
                >
                  <GlyphTile
                    name={b.icon}
                    className="h-9 w-9 rounded-xl"
                    iconClassName="h-4 w-4"
                    tone={action === 'bill' && billerName === b.name ? 'brand' : 'neutral'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {b.name}
                    </span>
                    <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                      {b.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--brand-on-soft)' }}>
                    Use
                  </span>
                </button>
              ))}
            </div>
            <p className="glass-foot">
              Selecting a bill fills the payee and the amount usually paid. You can still change both.
            </p>
          </section>

          <section className="glass-panel flex flex-1 items-start gap-3 p-5" aria-label="Fraud warning">
            <span className="action-tile-icon shrink-0">
              <Glyph name="shield" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Fraud notice
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                We will never ask for your password, PIN or full card details. If someone does, report
                it through{' '}
                <Link href="/portal/messages" className="link-arrow">
                  messages
                </Link>
                .
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
