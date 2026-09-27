'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PayAgain } from '@/components/intelligence/PayAgain';
import { useAIPreferences } from '@/lib/ai-preferences';
import { formatCurrency } from '@/lib/format';
import {
  ACCOUNTS,
  CATEGORY_META,
  SCHEDULED_PAYMENTS,
  TRANSACTIONS,
  recentTransactions,
  spendByCategory,
  totalBalanceEUR,
  savingsGoal,
  groupTransactionsByDay,
  type Transaction,
} from '@/lib/banking-data';
import { BalanceAmount } from '@/components/banking/BankCard';
import {
  taskService,
  type TaskCountResponse,
} from '@/services/api/task-service';
import {
  applicationService,
  type LoanApplication,
  STATUS_LABELS,
  STATUS_COLORS,
  LOAN_PURPOSE_LABELS,
  type LoanPurpose,
} from '@/services/api/application-service';
import { aiSignalsService, type CustomerSignal } from '@/services/api/ai-signals-service';

/* ─── helpers ────────────────────────────────────────────────── */
function fmtEUR(n: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function signedEUR(n: number): string {
  return `${n >= 0 ? '+' : '−'}${fmtEUR(Math.abs(n))}`;
}

/* Quiet, informational progress: where an application actually sits in the
   lifecycle. Shown as a plain step line, not as a score or reward. */
const JOURNEY_STEPS = ['Applied', 'Identity & KYC', 'Documents', 'Credit review', 'Offer', 'Signing & funding'];
const JOURNEY_MATCH: string[][] = [
  ['DRAFT', 'SUBMITTED', 'RETURNED'],
  ['PENDING_KYC', 'KYC_APPROVED', 'KYC_REJECTED'],
  ['PENDING_DOCUMENTS', 'DOCUMENTS_RECEIVED'],
  [
    'PENDING_CREDIT_CHECK',
    'CREDIT_APPROVED',
    'PENDING_UNDERWRITING',
    'IN_UNDERWRITING',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'PENDING_DECISION',
    'UNDERWRITING_APPROVED',
  ],
  [
    'APPROVED',
    'OFFER_GENERATED',
    'OFFER_SENT',
    'OFFER_ACCEPTED',
    'OFFER_COUNTERED',
    'PENDING_CONDITIONS',
    'CONDITIONS_MET',
    'PENDING_ESIGN',
    'ESIGN_IN_PROGRESS',
    'ESIGN_COMPLETED',
  ],
  [
    'PENDING_BOOKING',
    'BOOKING_IN_PROGRESS',
    'BOOKED',
    'PENDING_DISBURSEMENT',
    'DISBURSEMENT_IN_PROGRESS',
    'DISBURSED',
  ],
];

function journeyStep(status: string): number {
  return JOURNEY_MATCH.findIndex(m => m.includes(status));
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

const SIGNAL_ACRONYMS: Record<string, string> = {
  Kyc: 'KYC',
  Aml: 'AML',
  Ai: 'AI',
  Otp: 'OTP',
};

function formatSignalType(signalType: string): string {
  return signalType
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .split(' ')
    .map(w => SIGNAL_ACRONYMS[w] ?? w)
    .join(' ');
}

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
      style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}
    >
      {children}
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-2.5 rounded-2xl px-1 py-4 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <span className="dash-icon h-12 w-12 transition-transform duration-200 group-hover:scale-105">
        {icon}
      </span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </Link>
  );
}

/* ─── main component ─────────────────────────────────────────── */
export default function PortalDashboard() {
  const [hideBalance, setHideBalance] = useState(false);
  const { preferences, ready } = useAIPreferences();

  const accounts = ACCOUNTS;
  const txns = useMemo(() => recentTransactions(8), []);
  const txnGroups = useMemo(() => groupTransactionsByDay(txns), [txns]);
  const spend = useMemo(() => spendByCategory(), []);
  const topSpend = spend.slice(0, 5);
  /* The donut's centre must equal the sum of its own slices, so it is built from
     the category totals rather than a separate money-out figure that also counts
     transfers and would disagree with the chart drawn around it. */
  const spendTotal = useMemo(() => spend.reduce((sum, c) => sum + c.total, 0), [spend]);
  /* Settled rows only. The category split beside these figures excludes
     transfers, so the two measure different things and say so. */
  const cashFlow = useMemo(() => {
    const settled = TRANSACTIONS.filter(t => t.status === 'COMPLETED');
    return {
      income: settled.filter(t => t.direction === 'IN').reduce((sum, t) => sum + t.amount, 0),
      spending: settled.filter(t => t.direction === 'OUT').reduce((sum, t) => sum + t.amount, 0),
    };
  }, []);
  /* The actual span of the history, so the panel never claims "this month" for a
     window that is not a month. */
  const spendWindow = useMemo(() => {
    const times = TRANSACTIONS.map(t => new Date(t.date).getTime());
    if (times.length === 0) return null;
    const day = (ms: number) =>
      new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `${day(Math.min(...times))} – ${day(Math.max(...times))}`;
  }, []);
  const total = useMemo(() => totalBalanceEUR(), []);
  const goal = useMemo(() => savingsGoal(), []);
  const scheduledPayments = SCHEDULED_PAYMENTS;

  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [appLoading, setAppLoading] = useState(true);
  const [taskCount, setTaskCount] = useState(0);
  const [realSignals, setRealSignals] = useState<CustomerSignal[]>([]);

  useEffect(() => {
    applicationService
      .list(0, 100)
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setAppLoading(false));
    taskService
      .countPending()
      .then((r: TaskCountResponse) => setTaskCount(r.pendingCount))
      .catch(() => setTaskCount(0));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRealSignals([]);
    if (!ready || !preferences.insights) return;
    aiSignalsService.getSignals()
      .then(s => { if (!cancelled) setRealSignals(s.activeSignals || []); })
      .catch(() => { if (!cancelled) setRealSignals([]); });
    return () => { cancelled = true; };
  }, [ready, preferences.insights]);

  /* Updates are folded into the application rows rather than shown as their own
     band: the same status repeated in a separate strip and again on each row
     read as noise. The detail lives in the application's own review. */
  const signalsByApp = useMemo(() => {
    const map = new Map<string, CustomerSignal[]>();
    realSignals.forEach(sig => {
      const id = typeof sig.evidence?.applicationId === 'string' ? sig.evidence.applicationId : null;
      if (!id) return;
      const bucket = map.get(id);
      if (bucket) bucket.push(sig);
      else map.set(id, [sig]);
    });
    return map;
  }, [realSignals]);

  const terminal = useMemo(
    () => new Set(['COMPLETED','WITHDRAWN','CANCELLED','DECLINED','EXPIRED','UNDERWRITING_DECLINED','CREDIT_DECLINED','KYC_REJECTED','OFFER_REJECTED','OFFER_EXPIRED','CLOSED']),
    []
  );
  const activeApps = useMemo(() => apps.filter(a => !terminal.has(a.status)), [apps, terminal]);
  const recentApps = useMemo(
    () => [...apps].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3),
    [apps]
  );
  const mask = useCallback((s: string) => (hideBalance ? '••••••' : s), [hideBalance]);

  return (
    <div className="stagger space-y-5">
      {/* The top bar renders the page name as a <p> so each page owns its single
          <h1>; this page's heading is not part of the visual design. */}
      <h1 className="sr-only">Overview</h1>

      {/* ══ Hero — one dominant figure, with the cash flow and the composition
             that explain it. This is the only place spending appears. ══ */}
      <section className="dash-hero" aria-label="Balance overview">
        <div className="relative z-10 grid gap-9 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="dash-hero-label">Total balance</p>
                <span className="dash-hero-chip">Sample data</span>
              </div>
              <button
                onClick={() => setHideBalance(v => !v)}
                className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
                aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
                aria-pressed={hideBalance}
              >
                {hideBalance ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            <p className="mt-7 text-5xl font-extrabold tracking-tight sm:text-6xl">
              <BalanceAmount
                amount={total}
                currency="EUR"
                hidden={hideBalance}
                symbolClassName="text-2xl font-bold mr-1"
                centsClassName="text-2xl font-bold text-white/60"
              />
            </p>
            <p className="dash-hero-label mt-3">Across {accounts.length} accounts</p>

            <div className="mt-auto flex flex-wrap items-end gap-x-9 gap-y-4 pt-9">
              <div>
                <p className="dash-hero-label">Money in</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{mask(fmtEUR(cashFlow.income))}</p>
              </div>
              <div>
                <p className="dash-hero-label">Money out</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{mask(fmtEUR(cashFlow.spending))}</p>
              </div>
              <Link
                href="/portal/insights"
                className="dash-hero-link ml-auto inline-flex items-center gap-1"
              >
                Spending insights <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="dash-hero-inset self-center">
            <p className="dash-hero-label">Where the money went</p>
            <div className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full" aria-hidden="true">
              {topSpend.map(c => (
                <span key={c.category} style={{ width: `${c.pct}%`, background: c.color }} />
              ))}
            </div>
            <ul className="mt-5 space-y-3">
              {topSpend.slice(0, 4).map(c => (
                <li key={c.category} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-white/80">{c.category}</span>
                  <span className="shrink-0 tabular-nums text-white/55">{Math.round(c.pct)}%</span>
                  <span className="w-24 shrink-0 text-right font-semibold tabular-nums">
                    {mask(fmtEUR(c.total))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-white/10 pt-3.5 text-sm text-white/55">
              {mask(fmtEUR(spendTotal))} across {spend.length} categories
              {spendWindow ? ` · ${spendWindow}` : ''} · settled only · excludes transfers
            </p>
          </div>
        </div>
      </section>

      {/* ══ Accounts ══ */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="dash-card-title">Accounts</h2>
          <PillLink href="/portal/accounts">View all</PillLink>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {accounts.map(acc => (
            <Link
              key={acc.id}
              href={`/portal/accounts/${acc.id}`}
              className="group relative flex min-h-[184px] flex-col overflow-hidden rounded-3xl p-5 text-white shadow-md transition-transform duration-200 hover:-translate-y-1"
              style={{ background: acc.gradient }}
            >
              <div
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15 blur-lg"
                aria-hidden="true"
              />
              <div className="relative z-10 flex items-start justify-between gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-base backdrop-blur-sm"
                  aria-hidden="true"
                >
                  {acc.glyph}
                </span>
                {acc.primary && (
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                    Primary
                  </span>
                )}
              </div>
              <div className="relative z-10 mt-auto pt-6">
                <p className="text-sm text-white/75">{acc.name}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  <BalanceAmount
                    amount={acc.balance}
                    currency={acc.currency}
                    hidden={hideBalance}
                    symbolClassName="text-sm font-semibold mr-0.5"
                    centsClassName="text-sm text-white/65"
                  />
                </p>
                {acc.type === 'SAVINGS' && goal.target > 0 && (
                  <div
                    className="mt-3"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={goal.target}
                    aria-valuenow={goal.saved}
                    aria-label={`Savings goal: ${Math.round((goal.saved / goal.target) * 100)}% of target`}
                  >
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white/85"
                        style={{ width: `${Math.min(100, (goal.saved / goal.target) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-white/70">
                      {Math.round((goal.saved / goal.target) * 100)}% of{' '}
                      {hideBalance ? '••••••' : fmtEUR(goal.target)} goal
                    </p>
                  </div>
                )}
              </div>
              <p className="relative z-10 mt-4 font-mono text-sm text-white/65">{acc.accountNumber}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ Quick actions ══ */}
      <div className="dash-card grid grid-cols-3 gap-1 p-2 sm:grid-cols-6">
        <QuickAction href="/portal/payments" label="Make a payment" icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
          </svg>
        } />
        <QuickAction href="/portal/payments" label="Transfer money" icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        } />
        <QuickAction href="/portal/transactions" label="Pay a bill" icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
        } />
        <QuickAction href="/portal/documents" label="Statements" icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        } />
        <QuickAction href="/portal/products" label="Products" icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        } />
        <QuickAction href="/portal/ai-assistant" label="Rayva AI" icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        } />
      </div>

      {/* ══ Activity: transactions | repeat shortcuts + upcoming payments ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">

        {/* Recent transactions — grouped by day */}
        <div className="dash-card xl:col-span-7">
          <div className="dash-card-head">
            <h3 className="dash-card-title">Recent transactions</h3>
            <PillLink href="/portal/transactions">View all</PillLink>
          </div>
          <div className="pb-3">
            {txnGroups.map(group => {
              const net = group.items.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0);
              return (
                <div key={group.label}>
                  <div className="flex items-center justify-between px-6 pb-1.5 pt-5">
                    <span className="dash-day">{group.label}</span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {mask(signedEUR(net))}
                    </span>
                  </div>
                  {group.items.map((t: Transaction) => (
                    <div key={t.id} className="dash-row">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg"
                        style={{ backgroundColor: `${CATEGORY_META[t.category].color}33` }}
                        aria-hidden="true"
                      >
                        {t.glyph || '✨'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                          {t.merchant}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {t.category} · {txTime(t.date)}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-base font-bold tabular-nums ${t.direction === 'IN' ? 'text-emerald-500' : ''}`}
                        style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                      >
                        {t.direction === 'IN' ? '+' : '−'}{mask(fmtEUR(t.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right rail: repeat shortcuts and upcoming payments. Spending is not
            repeated here — the hero already owns it. */}
        <div className="flex flex-col gap-5 xl:col-span-5">
          {ready && preferences.repeats && <PayAgain mask={mask} />}

          <div className="dash-card flex flex-1 flex-col">
            <div className="dash-card-head">
              <h3 className="dash-card-title">Upcoming payments</h3>
              <PillLink href="/portal/payments">View all</PillLink>
            </div>
            <div className="flex-1 pb-1">
              {scheduledPayments.map((p, i) => {
                const d = new Date(p.nextDate);
                const day = d.getDate().toString().padStart(2, '0');
                const mon = d.toLocaleDateString(undefined, { month: 'short' });
                return (
                  <div key={i} className="dash-row">
                    <div
                      className="dash-date-tile h-11 w-11 shrink-0"
                      aria-hidden="true"
                    >
                      <span className="text-xs font-semibold leading-none">{mon}</span>
                      <span className="text-base font-bold leading-tight">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>{p.payee}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.frequency}</p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {mask(fmtEUR(p.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <Link
                href="/portal/payments"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                style={{ color: 'var(--brand-on-soft)' }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Schedule new payment
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Applications + relationship ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="dash-card xl:col-span-8">
          <div className="dash-card-head">
            <div className="flex items-center gap-2">
              <h3 className="dash-card-title">Loans &amp; applications</h3>
              {taskCount > 0 && <span className="badge badge-warning">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>}
            </div>
            <PillLink href="/portal/applications">View all</PillLink>
          </div>
          {appLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : recentApps.length === 0 ? (
            <div className="p-6">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="empty-state-title">No applications yet</p>
                <p className="empty-state-text">When you apply for a loan or credit product, you&apos;ll be able to track its progress here.</p>
                <Link href="/portal/products" className="btn btn-primary btn-sm mt-4">Explore products</Link>
              </div>
            </div>
          ) : (
            <>
              <div>
                {recentApps.map(app => {
                  const updates = signalsByApp.get(app.applicationId) ?? [];
                  return (
                  <Link
                    key={app.applicationId}
                    href={`/portal/applications/${app.applicationId}`}
                    className="group dash-row gap-4"
                  >
                    <div className="dash-icon dash-icon-sq h-11 w-11 shrink-0">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                          {app.product?.productName || LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                        {updates.length > 0 && (
                          <span
                            className="dash-update-chip"
                            title={updates.map(s => formatSignalType(s.signalType)).join(', ')}
                          >
                            {updates.length} update{updates.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {app.applicationNumber} · {formatCurrency(app.requestedAmount)}
                      </p>
                      {!terminal.has(app.status) && journeyStep(app.status) >= 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className="h-1 w-24 overflow-hidden rounded-full"
                            style={{ backgroundColor: 'var(--surface-input)' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${((journeyStep(app.status) + 1) / JOURNEY_STEPS.length) * 100}%`,
                                backgroundColor: 'var(--brand)',
                              }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Step {journeyStep(app.status) + 1} of {JOURNEY_STEPS.length} ·{' '}
                            {JOURNEY_STEPS[journeyStep(app.status)]}
                          </span>
                        </div>
                      )}
                    </div>
                    <svg
                      className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--text-muted)' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  );
                })}
              </div>
              <div
                className="flex items-center justify-between px-6 py-3.5 text-sm"
                style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}
              >
                <span>{activeApps.length} active · {apps.length} total</span>
                <Link href="/portal/products" className="link-arrow">
                  Apply for more <span data-arrow aria-hidden="true">→</span>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Relationship manager + support */}
        <div className="dash-card flex flex-col p-6 xl:col-span-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4a1747, #7f2b7b)' }}
              aria-hidden="true"
            >
              JC
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>James Carter</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Relationship manager</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              href="/portal/messages"
              className="btn btn-primary btn-sm"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Message
            </Link>
            <button className="btn btn-secondary btn-sm">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              Call
            </button>
          </div>
          <div className="mt-auto pt-4">
            <Link
              href="/portal/messages"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Need help? Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
