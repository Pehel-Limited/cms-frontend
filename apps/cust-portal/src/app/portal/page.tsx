'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import {
  ACCOUNTS,
  CATEGORY_META,
  SCHEDULED_PAYMENTS,
  recentTransactions,
  spendByCategory,
  monthlyInOut,
  totalBalanceEUR,
  balanceTrend,
  groupTransactionsByDay,
  type Transaction,
} from '@/lib/banking-data';
import {
  Sparkline,
  BalanceAmount,
  RadialProgress,
} from '@/components/banking/BankCard';
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

function MiniChart({ data }: { data: number[] }) {
  const w = 120;
  const h = 48;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#heroFill)" />
      <path d={line} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
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

const SIGNAL_SEVERITY_TONE: Record<string, string> = {
  HIGH: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
};

const GUIDANCE_ICON_BG: Record<string, string> = {
  emerald: 'linear-gradient(135deg, #059669, #34d399)',
  purple: 'linear-gradient(135deg, #7f2b7b, #ae3fa9)',
  amber: 'linear-gradient(135deg, #d97706, #fbbf24)',
};

/* ─── small building blocks ──────────────────────────────────── */

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
    <Link href={href} className="group flex flex-col items-center gap-2 rounded-2xl px-1 py-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </Link>
  );
}

/* ─── main component ─────────────────────────────────────────── */
export default function PortalDashboard() {
  const [hideBalance, setHideBalance] = useState(false);

  const accounts = ACCOUNTS;
  const txns = useMemo(() => recentTransactions(8), []);
  const txnGroups = useMemo(() => groupTransactionsByDay(txns), [txns]);
  const spend = useMemo(() => spendByCategory(), []);
  const { income, spending } = useMemo(() => monthlyInOut(), []);
  const total = useMemo(() => totalBalanceEUR(), []);
  const trend = useMemo(() => balanceTrend(), []);
  const topSpend = spend.slice(0, 5);
  const scheduledPayments = SCHEDULED_PAYMENTS;

  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [appLoading, setAppLoading] = useState(true);
  const [taskCount, setTaskCount] = useState(0);
  const [realSignals, setRealSignals] = useState<CustomerSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

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
    // Loaded independently — a degraded/unavailable AI service never blocks the dashboard.
    aiSignalsService
      .getSignals()
      .then(s => setRealSignals(s.activeSignals || []))
      .catch(() => setRealSignals([]))
      .finally(() => setSignalsLoading(false));
  }, []);

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
  const monthlySurplus = income - spending;
  const guidance = useMemo(() => {
    if (activeApps.length === 0) {
      return {
        title: 'Opportunity check',
        summary: `Your current cash-flow shows a monthly surplus of ${mask(fmtEUR(Math.abs(monthlySurplus)))}. This is a solid starting point to explore products or set a savings goal.`,
        action: 'Explore products',
        href: '/portal/products',
        accent: 'emerald',
      };
    }

    const nextApp = [...activeApps].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    const statusText = STATUS_LABELS[nextApp.status] || nextApp.status;

    if (monthlySurplus >= 0) {
      return {
        title: 'Ready to move forward',
        summary: `${statusText} is the current focus on your active loan. Your recent cash-flow indicates you remain in a stable position to keep progressing with this application.`,
        action: 'Review application',
        href: `/portal/applications/${nextApp.applicationId}`,
        accent: 'purple',
      };
    }

    return {
      title: 'Monitoring cash flow',
      summary: `${statusText} is still in progress, and your recent spend is slightly above income. A short review of your budget or upcoming payments may help keep momentum steady.`,
      action: 'Ask Rayva AI',
      href: '/portal/ai-assistant',
      accent: 'amber',
    };
  }, [activeApps, monthlySurplus, mask]);

  return (
    <div className="stagger space-y-5">

      {/* ══ Quick actions — the six things people actually come here to do ══ */}
      <div className="panel grid grid-cols-3 gap-1 p-2 sm:grid-cols-6">
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

      {/* ══ Balance hero + accounts carousel ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">

        {/* Balance card */}
        <div className="mesh-hero aurora relative overflow-hidden rounded-3xl text-white shadow-float xl:col-span-5">
          <MiniChart data={trend} />
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex h-full flex-col p-6 md:p-7">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/55">Total balance</p>
                <p className="mt-1 text-sm font-medium text-white/75">Across {accounts.length} accounts</p>
              </div>
              <button
                onClick={() => setHideBalance(v => !v)}
                className="mt-1 rounded-lg bg-white/10 p-1.5 transition-colors hover:bg-white/20"
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
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              <BalanceAmount
                amount={total}
                currency="EUR"
                hidden={hideBalance}
                symbolClassName="text-xl md:text-2xl font-bold mr-0.5"
                centsClassName="text-lg md:text-xl font-bold text-white/65"
              />
            </h1>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 px-2.5 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0v5m0-5h-5" />
                </svg>
                +€2,735 · 1.96%
              </span>
              <span className="text-xs text-white/60">vs last month</span>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Income</p>
                <p className="text-base font-bold text-white">{mask(fmtEUR(income))}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Spent</p>
                <p className="text-base font-bold text-white">{mask(fmtEUR(spending))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Accounts carousel */}
        <div className="flex flex-col xl:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Accounts</h2>
            <PillLink href="/portal/accounts">View all</PillLink>
          </div>
          <div className="flex flex-1 snap-x gap-4 overflow-x-auto no-scrollbar">
            {accounts.map(acc => (
              <Link
                key={acc.id}
                href={`/portal/accounts/${acc.id}`}
                className="group relative flex min-h-[210px] min-w-[215px] flex-1 snap-start flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-md transition-transform duration-200 hover:-translate-y-1"
                style={{ background: acc.gradient }}
              >
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15 blur-lg" />
                <div className="relative z-10 flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-base backdrop-blur-sm">
                    {acc.glyph}
                  </span>
                  {acc.primary && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm">
                      Primary
                    </span>
                  )}
                </div>
                <div className="relative z-10">
                  <p className="text-xs text-white/70">{acc.name}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    <BalanceAmount
                      amount={acc.balance}
                      currency={acc.currency}
                      hidden={hideBalance}
                      symbolClassName="text-sm font-semibold mr-0.5"
                      centsClassName="text-sm text-white/65"
                    />
                  </p>
                </div>
                <div className="relative z-10 flex items-end justify-between">
                  <span className="font-mono text-[10px] text-white/55">{acc.accountNumber}</span>
                  <div className="h-6 w-14 opacity-80">
                    <Sparkline data={acc.spark} width={56} height={20} strokeWidth={1.2} fill={false} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Activity: transactions | spending + upcoming ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">

        {/* Recent transactions — grouped by day, Revolut style */}
        <div className="panel xl:col-span-7">
          <div className="panel-header">
            <h3 className="panel-title">Recent transactions</h3>
            <PillLink href="/portal/transactions">View all</PillLink>
          </div>
          <div className="pb-3">
            {txnGroups.map(group => {
              const net = group.items.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0);
              return (
                <div key={group.label}>
                  <div className="flex items-center justify-between px-5 pb-1 pt-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                      {group.label}
                    </span>
                    <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {mask(signedEUR(net))}
                    </span>
                  </div>
                  {group.items.map((t: Transaction) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
                        style={{ backgroundColor: `${CATEGORY_META[t.category].color}1f` }}
                      >
                        {t.glyph || '✨'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {t.merchant}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {t.category} · {txTime(t.date)}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-sm font-bold tabular-nums ${t.direction === 'IN' ? 'text-emerald-500' : ''}`}
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

        {/* Right rail: spending + upcoming payments */}
        <div className="flex flex-col gap-5 xl:col-span-5">
          <div className="panel flex flex-1 flex-col">
            <div className="panel-header">
              <h3 className="panel-title">Spending</h3>
              <span className="chip">This month</span>
            </div>
            <div className="flex flex-1 items-center gap-5 px-5 py-4">
              <RadialProgress
                size={124}
                stroke={12}
                gap={0.03}
                segments={topSpend.map(s => ({ value: s.total, color: s.color }))}
                trackColor="var(--surface-input)"
              >
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Total</span>
                <span className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {mask(fmtEUR(spending))}
                </span>
              </RadialProgress>
              <div className="flex-1 space-y-2.5">
                {topSpend.map(s => (
                  <div key={s.category} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{s.category}</span>
                    <span className="ml-auto font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {mask(fmtEUR(s.total))}
                    </span>
                    <span className="w-8 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {Math.round(s.pct)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel flex flex-col">
            <div className="panel-header">
              <h3 className="panel-title">Upcoming payments</h3>
              <PillLink href="/portal/payments">View all</PillLink>
            </div>
            <div className="flex-1">
              {scheduledPayments.map((p, i) => {
                const d = new Date(p.nextDate);
                const day = d.getDate().toString().padStart(2, '0');
                const mon = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl"
                      style={{ backgroundColor: 'var(--surface-input)' }}
                    >
                      <span className="text-[9px] font-bold leading-none" style={{ color: 'var(--text-muted)' }}>{mon}</span>
                      <span className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.payee}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.frequency}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {mask(fmtEUR(p.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <Link
                href="/portal/payments"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20"
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

      {/* ══ Guidance — one calm, evidence-based nudge ══ */}
      <div className="panel p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ background: GUIDANCE_ICON_BG[guidance.accent] || GUIDANCE_ICON_BG.purple }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{guidance.title}</h3>
            <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{guidance.summary}</p>
          </div>
          <Link href={guidance.href} className="btn btn-primary btn-sm shrink-0 self-start md:self-center">
            {guidance.action}
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-xs" style={{ borderColor: 'var(--surface-border)' }}>
          <span className="chip">Monthly surplus: {mask(fmtEUR(Math.abs(monthlySurplus)))}</span>
          <span className="chip">Active applications: {appLoading ? '—' : activeApps.length}</span>
          <span className="chip">Open tasks: {taskCount}</span>
          {!signalsLoading &&
            realSignals.slice(0, 3).map((sig, idx) => (
              <span
                key={`${sig.signalType}-${sig.evidence?.applicationId ?? idx}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${SIGNAL_SEVERITY_TONE[sig.severity || 'MEDIUM'] || 'border-slate-200 bg-slate-50 text-slate-700'}`}
              >
                {formatSignalType(sig.signalType)}
                {typeof sig.evidence?.applicationNumber === 'string' && (
                  <span className="font-mono text-[10px] opacity-80">{sig.evidence.applicationNumber}</span>
                )}
              </span>
            ))}
          {!signalsLoading && realSignals.length > 3 && (
            <Link
              href="/portal/applications"
              className="chip transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              +{realSignals.length - 3} more from your applications
            </Link>
          )}
        </div>
      </div>

      {/* ══ Applications + relationship ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="panel xl:col-span-8">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <h3 className="panel-title">Loans &amp; applications</h3>
              {taskCount > 0 && <span className="badge badge-warning">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>}
            </div>
            <PillLink href="/portal/applications">View all</PillLink>
          </div>
          {appLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : recentApps.length === 0 ? (
            <div className="p-5">
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
                {recentApps.map(app => (
                  <Link
                    key={app.applicationId}
                    href={`/portal/applications/${app.applicationId}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {app.product?.productName || LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {app.applicationNumber} · {formatCurrency(app.requestedAmount)}
                      </p>
                    </div>
                    <svg
                      className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--text-muted)' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
              <div
                className="flex items-center justify-between px-5 py-3 text-xs"
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
        <div className="panel flex flex-col p-5 xl:col-span-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-sm font-bold text-white">
              JC
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>James Carter</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Relationship manager</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/portal/messages"
              className="btn btn-secondary btn-sm"
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
