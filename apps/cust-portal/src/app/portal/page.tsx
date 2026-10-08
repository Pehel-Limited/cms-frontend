'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PayAgain } from '@/components/intelligence/PayAgain';
import { useAIPreferences } from '@/lib/ai-preferences';
import { formatCurrency } from '@/lib/format';
import {
  ACCOUNTS,
  CARDS,
  SCHEDULED_PAYMENTS,
  TRANSACTIONS,
  recentTransactions,
  dailyCardSpend,
  spendByCategory,
  totalBalanceEUR,
  savingsGoal,
  dailySpendSeries,
  groupTransactionsByDay,
  type BankAccount,
  type Transaction,
} from '@/lib/banking-data';
import { BalanceAmount, DotMatrix } from '@/components/banking/BankCard';
import Glyph, { ACCOUNT_GLYPH, glyphFor, GlyphTile } from '@/components/ui/Glyph';
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

/* ─── helpers ───────────────────────────────────────────────── */
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

/* Settled activity compared over two equal, explicit windows. The sample history
   spans ~25 days, so a 12-day window against the 12 days before it is the
   widest honest comparison available — anything larger would compare a real
   period against an empty one and read as a 100% swing. */
const WINDOW_DAYS = 12;

function activityFor(direction: 'IN' | 'OUT'): {
  series: number[];
  total: number;
  prior: number;
} {
  const settled = TRANSACTIONS.filter(t => t.status === 'COMPLETED' && t.direction === direction);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series: number[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    series.push(
      settled.reduce((sum, t) => {
        const d = new Date(t.date);
        return d >= start && d < end ? sum + t.amount : sum;
      }, 0)
    );
  }

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const prior = settled.reduce(
    (sum, t) => (new Date(t.date) < cutoff ? sum + t.amount : sum),
    0
  );

  return { series, total: series.reduce((a, b) => a + b, 0), prior };
}

function pctChange(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return ((current - prior) / prior) * 100;
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

/* ─── small presentational pieces ────────────────────────────── */

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
      style={{ borderColor: 'var(--hairline-strong)', color: 'var(--text-secondary)' }}
    >
      {children}
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function Delta({
  pct,
  label,
  upIsGood = true,
}: {
  pct: number | null;
  label: string;
  /** Rising savings are good; rising spending is not. The triangle always shows
      the actual direction, so this only decides which colour carries it. */
  upIsGood?: boolean;
}) {
  if (pct === null) return null;
  const flat = Math.abs(pct) < 0.05;
  const up = pct >= 0;
  const favourable = flat ? null : up === upIsGood;
  return (
    <span
      className={`delta ${flat ? 'delta-flat' : favourable ? 'delta-up' : 'delta-down'}`}
      title={label}
    >
      <svg width="8" height="7" viewBox="0 0 8 7" fill="currentColor" aria-hidden="true">
        {up ? <path d="M4 0l4 7H0z" /> : <path d="M4 7L0 0h8z" />}
      </svg>
      <span className="sr-only">{flat ? 'No change' : up ? 'Up' : 'Down'}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function KpiCell({
  label,
  value,
  note,
  delta,
  deltaLabel,
  upIsGood = true,
  series,
  trailing,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  series?: number[];
  trailing?: React.ReactNode;
}) {
  return (
    <div className="kpi-cell">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="kpi-label">{label}</p>
          {trailing}
        </div>
        <p className="kpi-value">{value}</p>
        {(delta !== undefined || note) && (
          <p className="kpi-note flex items-center gap-2">
            {delta !== undefined && <Delta pct={delta} label={deltaLabel ?? ''} upIsGood={upIsGood} />}
            {note && <span>{note}</span>}
          </p>
        )}
      </div>
      {series && series.length > 1 && (
        <div className="hidden shrink-0 sm:block">
          <DotMatrix data={series} box={{ width: 72, height: 34 }} label={`${label} trend`} />
        </div>
      )}
    </div>
  );
}

/* An account rendered as card art. These are accounts rather than cards, so the
   face carries the account name, balance and masked number. */
function AccountPlastic({
  acc,
  hidden,
  featured,
}: {
  acc: BankAccount;
  hidden: boolean;
  featured: boolean;
}) {
  return (
    <div
      className="relative aspect-[1.586] w-full overflow-hidden rounded-2xl p-4 text-white"
      style={{
        background: acc.gradient,
        boxShadow: featured
          ? '0 30px 52px -24px rgba(28, 8, 30, 0.8), 0 6px 14px -8px rgba(28, 8, 30, 0.5)'
          : '0 16px 30px -22px rgba(28, 8, 30, 0.7)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.26),transparent_55%)]" />
      <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-black/10 blur-lg" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/90 ring-1 ring-inset ring-white/20 backdrop-blur-sm"
              aria-hidden="true"
            >
              <Glyph name={ACCOUNT_GLYPH[acc.type]} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">Rayva</p>
              <p className="truncate text-sm font-semibold leading-tight">{acc.name}</p>
            </div>
          </div>
          {acc.primary && (
            <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
              Primary
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Balance</p>
            <p className="num truncate text-xl font-semibold">
              <BalanceAmount
                amount={acc.balance}
                currency={acc.currency}
                hidden={hidden}
                symbolClassName="text-xs font-bold mr-0.5"
                centsClassName="text-xs text-white/65"
              />
            </p>
          </div>
          <p className="shrink-0 font-mono text-xs text-white/65">{acc.accountNumber}</p>
        </div>
      </div>

      {acc.type === 'SAVINGS' && (
        <span className="absolute right-4 top-1/2 h-6 w-8 -translate-y-1/2 rounded-md bg-gradient-to-br from-yellow-200/80 to-yellow-400/70" aria-hidden="true" />
      )}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
    </svg>
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
  /* Settled rows only, over two equal windows. The category split beside these
     figures excludes transfers, so the two measure different things and say so. */
  const inActivity = useMemo(() => activityFor('IN'), []);
  const outActivity = useMemo(() => activityFor('OUT'), []);
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

  /* The trend the balance sparkline draws: every account's own series summed.
     All sample accounts are EUR, so no conversion is applied to the shape. */
  const balanceSeries = useMemo(() => {
    const len = Math.min(...accounts.map(a => a.spark.length));
    if (!isFinite(len) || len < 2) return [];
    return Array.from({ length: len }, (_, i) =>
      accounts.reduce((sum, a) => sum + a.spark[i], 0)
    );
  }, [accounts]);

  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [appLoading, setAppLoading] = useState(true);
  const [taskCount, setTaskCount] = useState(0);
  const [realSignals, setRealSignals] = useState<CustomerSignal[]>([]);
  const [selectedAccount, setSelectedAccount] = useState(0);

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

  const shownAccount = accounts[selectedAccount] ?? accounts[0];
  const stepAccount = (dir: number) =>
    setSelectedAccount(i => (i + dir + accounts.length) % accounts.length);

  const goalPct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;

  /* Daily out-spend across the visible history. Days with no payments keep a
     short tick so the axis doesn't stretch the busy days out of proportion. */
  const dailySpend = useMemo(() => dailySpendSeries(30), []);
  const dailyPeak = useMemo(
    () => dailySpend.reduce((m, d) => (d.total > m.total ? d : m), { total: 0, label: '', date: '' }),
    [dailySpend]
  );
  const dailyTotal = useMemo(() => dailySpend.reduce((s, d) => s + d.total, 0), [dailySpend]);

  const cardDaily = useMemo(() => dailyCardSpend(30), []);
  const cardPeak = useMemo(
    () => cardDaily.reduce((m, d) => (d.total > m.total ? d : m), { total: 0, date: '' }),
    [cardDaily]
  );
  const cardSpendTotal = useMemo(() => cardDaily.reduce((s, d) => s + d.total, 0), [cardDaily]);

  /* Credit utilisation is summed across the credit cards only — a debit card has
     no limit, so folding it in would divide two different kinds of number. */
  const creditCards = useMemo(() => CARDS.filter(c => c.type === 'CREDIT' && (c.creditLimit ?? 0) > 0), []);
  const creditLimit = useMemo(() => creditCards.reduce((s, c) => s + (c.creditLimit ?? 0), 0), [creditCards]);
  const creditUsed = useMemo(() => creditCards.reduce((s, c) => s + (c.creditUsed ?? 0), 0), [creditCards]);
  const utilPct = creditLimit > 0 ? Math.round((creditUsed / creditLimit) * 100) : 0;

  return (
    <div className="stagger space-y-5">
      {/* The top bar renders the page name as a <p> so each page owns its single
          <h1>; this page's heading is not part of the visual design. */}
      <h1 className="sr-only">Overview</h1>

      {/* ══ KPI strip — one frosted bar, hairline-divided. The only place the
             headline money figures live. ══ */}
      <section className="glass-panel" aria-label="Money summary">
        {/* Kept out of the cells so every value starts on the same baseline. */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-3"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          <span className="badge badge-neutral !text-[11px]">Sample data</span>
          <button
            onClick={() => setHideBalance(v => !v)}
            className="ring-btn !h-8 !w-8"
            aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
            aria-pressed={hideBalance}
          >
            <EyeIcon open={!hideBalance} />
          </button>
        </div>
        <div className="kpi-strip">
          <KpiCell
            label="Total balance"
            value={mask(fmtEUR(total))}
            note={`Across ${accounts.length} accounts`}
            series={balanceSeries}
          />
          <KpiCell
            label="Money in"
            value={mask(fmtEUR(inActivity.total))}
            delta={pctChange(inActivity.total, inActivity.prior)}
            deltaLabel={`Last ${WINDOW_DAYS} days against the ${WINDOW_DAYS} days before`}
            note={`last ${WINDOW_DAYS} days`}
            series={inActivity.series}
          />
          <KpiCell
            label="Money out"
            value={mask(fmtEUR(outActivity.total))}
            delta={pctChange(outActivity.total, outActivity.prior)}
            deltaLabel={`Last ${WINDOW_DAYS} days against the ${WINDOW_DAYS} days before`}
            upIsGood={false}
            note={`last ${WINDOW_DAYS} days`}
            series={outActivity.series}
          />
          <KpiCell
            label="Savings goal"
            value={mask(fmtEUR(goal.saved))}
            note={`of ${hideBalance ? '••••••' : fmtEUR(goal.target)} target`}
            series={accounts.find(a => a.id === 'acc-savings')?.spark}
            trailing={
              <span className="dash-update-chip">{Math.round(goalPct)}%</span>
            }
          />
        </div>
      </section>

      {/* ══ Accounts as a fanned stack | where the money went ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="glass-panel xl:col-span-7" aria-label="Your accounts">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Accounts</h2>
              <p className="glass-sub">Tap a card to bring it forward</p>
            </div>
            <PillLink href="/portal/accounts">View all</PillLink>
          </div>

          {/* Neighbour labels either side of the focused card, so the stack reads
              as a set rather than four disconnected tiles. */}
          <div className="flex items-start justify-between gap-3 px-6">
            <button
              type="button"
              onClick={() => stepAccount(-1)}
              className="min-w-0 flex-1 text-left"
              aria-label="Previous account"
            >
              <p className="serif truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                {accounts[(selectedAccount - 1 + accounts.length) % accounts.length]?.name}
              </p>
            </button>
            <div className="shrink-0 text-center">
              <p className="serif text-[26px] font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                {shownAccount?.name}
              </p>
              <p className="num text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {shownAccount && (
                  <BalanceAmount
                    amount={shownAccount.balance}
                    currency={shownAccount.currency}
                    hidden={hideBalance}
                    symbolClassName="text-sm mr-0.5"
                    centsClassName="text-sm opacity-60"
                  />
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => stepAccount(1)}
              className="min-w-0 flex-1 text-right"
              aria-label="Next account"
            >
              <p className="serif truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                {accounts[(selectedAccount + 1) % accounts.length]?.name}
              </p>
            </button>
          </div>

          <div className="card-fan mt-4 overflow-hidden">
            {accounts.map((acc, i) => {
              let d = i - selectedAccount;
              if (d > accounts.length / 2) d -= accounts.length;
              if (d < -accounts.length / 2) d += accounts.length;
              const featured = d === 0;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccount(i)}
                  aria-label={acc.name}
                  aria-pressed={featured}
                  className="fan-card"
                  style={{
                    transform: `translateX(calc(var(--fan-step) * ${d})) translateY(${featured ? 'var(--fan-lift)' : 'var(--fan-drop)'}) scale(${featured ? 1 : 0.9}) rotate(${d * -2}deg)`,
                    zIndex: 30 - Math.abs(d) * 10,
                    /* Only the front card stays fully opaque; anything see-through
                       on top of its neighbours reads as one muddy shape. */
                    opacity: featured ? 1 : Math.abs(d) === 1 ? 0.62 : 0.32,
                    filter: featured ? 'none' : 'saturate(0.65)',
                  }}
                >
                  <AccountPlastic acc={acc} hidden={hideBalance} featured={featured} />
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-4 px-6 pb-6">
            <div className="flex items-center gap-2" role="tablist" aria-label="Choose account">
              {accounts.map((acc, i) => (
                <button
                  key={acc.id}
                  type="button"
                  role="tab"
                  aria-selected={i === selectedAccount}
                  aria-label={acc.name}
                  onClick={() => setSelectedAccount(i)}
                  className="h-2.5 rounded-full transition-all"
                  style={{
                    width: i === selectedAccount ? 26 : 10,
                    background: i === selectedAccount ? 'var(--brand)' : 'var(--hairline-strong)',
                  }}
                />
              ))}
            </div>

            {shownAccount?.type === 'SAVINGS' && goal.target > 0 && (
              <div
                className="w-full max-w-sm"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={goal.target}
                aria-valuenow={goal.saved}
                aria-label={`Savings goal: ${Math.round(goalPct)}% of target`}
              >
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--hairline)' }}>
                  <div className="h-full rounded-full" style={{ width: `${goalPct}%`, background: 'var(--brand)' }} />
                </div>
                <p className="mt-2 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  {Math.round(goalPct)}% of {hideBalance ? '••••••' : fmtEUR(goal.target)} goal
                </p>
              </div>
            )}

            <Link
              href={`/portal/accounts/${shownAccount?.id}`}
              className="pill-btn"
            >
              Open {shownAccount?.name}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Spending categories — the reference's 2-up grid over a stacked bar. */}
        <section className="glass-panel flex flex-col xl:col-span-5" aria-label="Where the money went">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Spending categories</h2>
              <p className="glass-sub">Settled spending, excludes transfers</p>
            </div>
            <PillLink href="/portal/insights">Insights</PillLink>
          </div>
          <div className="glass-body flex-1">
            <div className="grid grid-cols-2 gap-x-6">
              {topSpend.slice(0, 4).map(c => (
                <div key={c.category} className="cat-cell">
                  <p className="cat-name flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: c.color }}
                      aria-hidden="true"
                    />
                    {c.category}
                  </p>
                  <p className="num text-[22px] font-bold">
                    {mask(fmtEUR(c.total))}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {Math.round(c.pct)}% of spend
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4" aria-hidden="true">
              <div className="stack-bar">
                {topSpend.map((c, i) => (
                  <span
                    key={c.category}
                    className="stack-seg"
                    data-comb={i === 0 || undefined}
                    style={{
                      width: `${c.pct}%`,
                      background: i === 0 ? undefined : c.color,
                      color: c.color,
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{topSpend[0]?.category} leads at {Math.round(topSpend[0]?.pct ?? 0)}%</span>
                <span>{spend.length} categories</span>
              </div>
            </div>
          </div>
          <p className="glass-foot">
            {mask(fmtEUR(spendTotal))} across {spend.length} categories
            {spendWindow ? ` · ${spendWindow}` : ''}
          </p>
        </section>
      </div>

      {/* ══ Daily spending (hairline comb) | Card usage (dots) | Utilisation ══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-12">
        <section className="glass-panel lg:col-span-1 xl:col-span-4" aria-label="Daily spending">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Daily spending</h2>
              <p className="glass-sub">Last 30 days</p>
            </div>
            <PillLink href="/portal/insights">View all</PillLink>
          </div>
          <div className="glass-body">
            <p className="num text-[26px] font-bold">{mask(fmtEUR(dailyTotal))}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              over {dailySpend.filter(d => d.total > 0).length} active days
            </p>

            <div className="mt-5 flex items-end gap-3">
              <div className="thin-bars flex-1">
                {dailySpend.map(d => {
                  const ratio = dailyPeak.total > 0 ? d.total / dailyPeak.total : 0;
                  /* Heights stay proportional. The only exception is a 5% floor for
                     days that had any spend at all — without it a €5.60 rail fare
                     against a €410 flight is sub-pixel, and "no spend" becomes
                     indistinguishable from "small spend". */
                  return (
                    <span
                      key={d.date}
                      className="thin-bar"
                      data-zero={d.total === 0 || undefined}
                      data-active={(d.total === dailyPeak.total && d.total > 0) || undefined}
                      title={`${new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${fmtEUR(d.total)}`}
                      style={{ height: d.total > 0 ? `${Math.max(5, ratio * 100)}%` : '2%' }}
                    />
                  );
                })}
              </div>
              {dailyPeak.total > 0 && (
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <span className="chart-marker">
                    {Math.round((dailyPeak.total / (dailyTotal || 1)) * 100)}%
                  </span>
                  <span className="marker-leader h-8" aria-hidden="true" />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    peak
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="glass-panel lg:col-span-1 xl:col-span-4" aria-label="Card usage">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Card usage</h2>
              <p className="glass-sub">Card-funded payments</p>
            </div>
            <PillLink href="/portal/cards">Manage</PillLink>
          </div>
          <div className="glass-body">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="num text-[26px] font-bold">{mask(fmtEUR(cardSpendTotal))}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  last 30 days
                </p>
              </div>
              {cardPeak.total > 0 && (
                <span className="chart-marker mb-1">
                  {Math.round((cardPeak.total / (cardSpendTotal || 1)) * 100)}%
                </span>
              )}
            </div>

            <div className="mt-4">
              <DotMatrix
                data={cardDaily.map(d => d.total)}
                box={{ width: 360, height: 72 }}
                stretch
                label={`Card-funded spending by day, last ${cardDaily.length} days`}
                format={(value, i) =>
                  `${new Date(cardDaily[i].date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })} · ${fmtEUR(value)}`
                }
              />
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Excludes transfers and direct debits, which carry no card.
            </p>
          </div>
        </section>

        <section className="glass-panel lg:col-span-2 xl:col-span-4" aria-label="Card utilisation">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Card utilisation</h2>
              <p className="glass-sub">Credit used against total limit</p>
            </div>
            <PillLink href="/portal/cards">View all</PillLink>
          </div>

          {creditCards.length === 0 ? (
            <p className="glass-body text-sm" style={{ color: 'var(--text-muted)' }}>
              No credit cards on this profile yet.
            </p>
          ) : (
            <div className="glass-body">
              <div className="flex items-center gap-6">
                {/* The ring is drawn from the same two numbers the caption states. */}
                <div className="relative h-[104px] w-[104px] shrink-0" aria-hidden="true">
                  <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
                    <circle
                      cx="52" cy="52" r="44" fill="none"
                      stroke="var(--hairline-strong)" strokeWidth="9" strokeLinecap="round"
                    />
                    <circle
                      cx="52" cy="52" r="44" fill="none"
                      stroke="var(--brand)" strokeWidth="9" strokeLinecap="round"
                      strokeDasharray={`${(utilPct / 100) * 2 * Math.PI * 44} ${2 * Math.PI * 44}`}
                    />
                  </svg>
                  <span className="num absolute inset-0 flex items-center justify-center text-xl font-bold">
                    {utilPct}%
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="num text-[24px] font-bold">{mask(fmtEUR(creditUsed))}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    of {mask(fmtEUR(creditLimit))} available
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {creditCards.map(c => {
                  const pct = Math.min(100, Math.round(((c.creditUsed ?? 0) / (c.creditLimit ?? 1)) * 100));
                  return (
                    <div key={c.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {c.label} <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>•••• {c.last4}</span>
                        </span>
                        <span className="num shrink-0 font-semibold">{pct}%</span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: 'var(--hairline)' }}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={`${c.label} utilisation`}
                      >
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ══ Quick actions ══ */}
      <nav aria-label="Quick actions" className="glass-panel">
        <div className="grid grid-cols-3 gap-1 p-3 sm:grid-cols-6">
          {[
            {
              href: '/portal/payments', label: 'Make a payment', icon:
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
            },
            {
              href: '/portal/payments', label: 'Transfer money', icon:
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            },
            {
              href: '/portal/transactions', label: 'Pay a bill', icon:
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            },
            {
              href: '/portal/documents', label: 'Statements', icon:
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            },
            {
              href: '/portal/products', label: 'Products', icon:
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            },
            {
              href: '/portal/ai-assistant', label: 'Rayva AI', icon:
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            },
          ].map(a => (
            <Link
              key={a.label}
              href={a.href}
              className="group flex flex-col items-center gap-2.5 rounded-2xl px-1 py-4 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
            >
              <span className="ring-btn h-12 w-12 transition-transform duration-200 group-hover:scale-105">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {a.icon}
                </svg>
              </span>
              <span className="text-center text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {a.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ══ Activity: transactions | repeat shortcuts + upcoming payments ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">

        {/* Recent transactions — grouped by day */}
        <section className="glass-panel xl:col-span-7" aria-label="Recent transactions">
          <div className="glass-head">
            <h2 className="glass-title">Recent transactions</h2>
            <PillLink href="/portal/transactions">View all</PillLink>
          </div>
          <div className="glass-body !pb-4">
            {txnGroups.map(group => {
              const net = group.items.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0);
              return (
                <div key={group.label}>
                  <div className="flex items-center justify-between pb-1 pt-5">
                    <span className="dash-day">{group.label}</span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {mask(signedEUR(net))}
                    </span>
                  </div>
                  <div className="rounded-2xl" style={{ border: '1px solid var(--hairline)' }}>
                    {group.items.map((t: Transaction) => (
                      <div key={t.id} className="glass-row !px-4">
                        <GlyphTile name={glyphFor(t.category)} className="h-10 w-10 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {t.merchant}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t.category} · {txTime(t.date)}
                          </p>
                        </div>
                        {/* Amount carries its own caption, so the state reads without
                            a badge competing for the same row space. */}
                        <div className="shrink-0 text-right">
                          <p
                            className={`num text-base font-semibold ${t.direction === 'IN' ? 'delta-up' : ''}`}
                            style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                          >
                            {t.direction === 'IN' ? '+' : '−'}{mask(fmtEUR(t.amount))}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t.direction === 'IN'
                              ? 'Income'
                              : t.status === 'PENDING'
                                ? 'Pending'
                                : t.status === 'DECLINED'
                                  ? 'Declined'
                                  : 'Spending'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right rail: repeat shortcuts and upcoming payments. Spending is not
            repeated here — the composition panel already owns it. */}
        <div className="flex flex-col gap-5 xl:col-span-5">
          {ready && preferences.repeats && <PayAgain mask={mask} />}

          <section className="glass-panel flex flex-1 flex-col" aria-label="Upcoming payments">
            <div className="glass-head">
              <h2 className="glass-title">Upcoming payments</h2>
              <PillLink href="/portal/payments">View all</PillLink>
            </div>
            <div className="flex-1">
              {scheduledPayments.map((p, i) => {
                const d = new Date(p.nextDate);
                const day = d.getDate().toString().padStart(2, '0');
                const mon = d.toLocaleDateString(undefined, { month: 'short' });
                return (
                  <div key={i} className="glass-row">
                    <div
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl"
                      style={{ background: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                      aria-hidden="true"
                    >
                      <span className="text-[10px] font-semibold uppercase leading-none">{mon}</span>
                      <span className="num text-base font-semibold leading-tight">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.payee}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.frequency}</p>
                    </div>
                    <span className="num shrink-0 text-base font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {mask(fmtEUR(p.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link
              href="/portal/payments"
              className="glass-foot flex items-center justify-center gap-1.5 !text-sm font-semibold transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              style={{ color: 'var(--brand-on-soft)' }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Schedule new payment
            </Link>
          </section>
        </div>
      </div>

      {/* ══ Applications + relationship ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="glass-panel xl:col-span-8" aria-label="Loans and applications">
          <div className="glass-head">
            <div className="flex items-center gap-2">
              <h2 className="glass-title">Loans &amp; applications</h2>
              {taskCount > 0 && <span className="badge badge-warning">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>}
            </div>
            <PillLink href="/portal/applications">View all</PillLink>
          </div>
          {appLoading ? (
            <div className="space-y-3 px-6 pb-6">
              {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : recentApps.length === 0 ? (
            <div className="px-6 pb-6">
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
              <div className="px-6">
                <div className="rounded-2xl" style={{ border: '1px solid var(--hairline)' }}>
                {recentApps.map(app => {
                  const updates = signalsByApp.get(app.applicationId) ?? [];
                  return (
                    <Link
                      key={app.applicationId}
                      href={`/portal/applications/${app.applicationId}`}
                      className="group glass-row !rounded-2xl gap-4 !px-4"
                    >
                      <div className="dash-icon dash-icon-sq h-11 w-11 shrink-0">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {app.product?.productName || LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
                          </p>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-700'}`}>
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
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {app.applicationNumber} · {formatCurrency(app.requestedAmount)}
                        </p>
                        {!terminal.has(app.status) && journeyStep(app.status) >= 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div
                              className="h-1 w-24 overflow-hidden rounded-full"
                              style={{ backgroundColor: 'var(--hairline-strong)' }}
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
              </div>
              <div
                className="glass-foot mt-4 flex items-center justify-between !text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>{activeApps.length} active · {apps.length} total</span>
                <Link href="/portal/products" className="link-arrow">
                  Apply for more <span data-arrow aria-hidden="true">→</span>
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Relationship manager + support */}
        <section className="glass-panel flex flex-col p-6 xl:col-span-4" aria-label="Your relationship manager">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: 'var(--tile-active)' }}
              aria-hidden="true"
            >
              JC
            </div>
            <div className="min-w-0">
              <p className="serif truncate text-lg font-medium" style={{ color: 'var(--text-primary)' }}>James Carter</p>
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
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Need help? Contact support
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
