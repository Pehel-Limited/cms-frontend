'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { formatCurrency } from '@/lib/format';
import {
  ACCOUNTS,
  CARDS,
  BENEFICIARIES,
  SCHEDULED_PAYMENTS,
  recentTransactions,
  spendByCategory,
  monthlyInOut,
  totalBalanceGBP,
  balanceTrend,
  dailySpendSeries,
  savingsGoal,
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

/* ─── helpers ────────────────────────────────────────────────── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtGBP(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function txDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  if (dd.getTime() === today.getTime()) return 'Today';
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (dd.getTime() === yest.getTime()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function nextDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
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
  return <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-white/10 ${className}`} />;
}

function QuickActionBtn({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 group"
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}
      >
        <span className="text-[#7f2b7b] dark:text-purple-300">{icon}</span>
      </span>
      <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </Link>
  );
}

/* ─── main component ─────────────────────────────────────────── */
export default function PortalDashboard() {
  const user = useSelector((s: RootState) => s.auth.user);
  const [hideBalance, setHideBalance] = useState(false);

  const accounts = ACCOUNTS;
  const txns = useMemo(() => recentTransactions(5), []);
  const spend = useMemo(() => spendByCategory(), []);
  const { income, spending } = useMemo(() => monthlyInOut(), []);
  const total = useMemo(() => totalBalanceGBP(), []);
  const trend = useMemo(() => balanceTrend(), []);
  const topSpend = spend.slice(0, 5);
  const scheduledPayments = SCHEDULED_PAYMENTS.slice(0, 4);

  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [appLoading, setAppLoading] = useState(true);
  const [taskCount, setTaskCount] = useState(0);

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

  const terminal = useMemo(
    () => new Set(['COMPLETED','WITHDRAWN','CANCELLED','DECLINED','EXPIRED','UNDERWRITING_DECLINED','CREDIT_DECLINED','KYC_REJECTED','OFFER_REJECTED','OFFER_EXPIRED','CLOSED']),
    []
  );
  const activeApps = useMemo(() => apps.filter(a => !terminal.has(a.status)), [apps, terminal]);
  const recentApps = useMemo(
    () => [...apps].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3),
    [apps]
  );

  const mask = (s: string) => (hideBalance ? '••••••' : s);

  return (
    <div className="space-y-6 animate-rise">

      {/* ══ ROW 1 ══ Balance hero (left) + Accounts strip (right) ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">

        {/* Balance card */}
        <div className="xl:col-span-2 mesh-hero aurora relative overflow-hidden rounded-3xl text-white shadow-float">
          <MiniChart data={trend} />
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 p-6 md:p-7">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-white/75 font-medium">
                  {getGreeting()}, {user?.firstName || 'there'}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-white/50 mt-3">Total balance</p>
              </div>
              <button
                onClick={() => setHideBalance(v => !v)}
                className="mt-1 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Toggle balance"
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
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              <BalanceAmount
                amount={total}
                currency="GBP"
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
                +£2,735 · 1.96%
              </span>
              <span className="text-xs text-white/60">vs last month</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Income</p>
                <p className="text-base font-bold text-white">{mask(fmtGBP(income))}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Spent</p>
                <p className="text-base font-bold text-white">{mask(fmtGBP(spending))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Accounts strip */}
        <div className="xl:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Accounts</h2>
            <Link href="/portal/accounts" className="text-xs font-semibold text-[#7f2b7b] hover:text-[#5e1f5b] dark:text-purple-400 dark:hover:text-purple-300">
              View all accounts →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {accounts.slice(0, 3).map(acc => (
              <Link
                key={acc.id}
                href={`/portal/accounts/${acc.id}`}
                className="group relative overflow-hidden rounded-2xl p-4 text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: acc.gradient }}
              >
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15 blur-lg" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{acc.glyph}</span>
                    {acc.primary && (
                      <span className="text-[9px] uppercase tracking-wide bg-white/20 rounded-full px-1.5 py-0.5 font-bold">Primary</span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/70 truncate">{acc.name}</p>
                  <p className="text-lg font-bold tracking-tight mt-0.5">
                    <BalanceAmount amount={acc.balance} currency={acc.currency} hidden={hideBalance} symbolClassName="text-sm font-semibold mr-0.5" centsClassName="text-xs text-white/65" />
                  </p>
                  <div className="mt-2 flex items-end justify-between">
                    <span className="font-mono text-[10px] text-white/55">{acc.accountNumber}</span>
                    <div className="h-6 w-14">
                      <Sparkline data={acc.spark} width={56} height={20} strokeWidth={1.2} fill={false} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          <div className="mt-4 flex items-center gap-4 overflow-x-auto no-scrollbar">
            <QuickActionBtn href="/portal/payments" label="Make a payment" icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
              </svg>
            } />
            <QuickActionBtn href="/portal/payments" label="Transfer money" icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            } />
            <QuickActionBtn href="/portal/transactions" label="Pay a bill" icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            } />
            <QuickActionBtn href="/portal/documents" label="Download statement" icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            } />
            <QuickActionBtn href="/portal/products" label="Apply for product" icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            } />
          </div>
        </div>
      </div>

      {/* ══ ROW 2 ══ Recent transactions | Upcoming payments | Spending overview ══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Recent Transactions */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent transactions</h3>
            <Link href="/portal/transactions" className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {txns.map((t: Transaction) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ backgroundColor: 'var(--surface-input)' }}>
                  {t.glyph}
                  <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white dark:ring-[#161c2d] text-white ${t.direction === 'IN' ? 'bg-emerald-500' : 'bg-slate-600 dark:bg-slate-700'}`}>
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      {t.direction === 'IN'
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6-6m-6 6l-6-6" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0l6 6m-6-6l-6 6" />
                      }
                    </svg>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.merchant}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {txDateLabel(t.date)} · {txTime(t.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${t.direction === 'IN' ? 'text-emerald-500' : ''}`}
                    style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}>
                    {t.direction === 'IN' ? '+' : '−'}{mask(fmtGBP(t.amount))}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming payments</h3>
            <Link href="/portal/payments" className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y">
            {scheduledPayments.map((p, i) => {
              const d = new Date(p.nextDate);
              const day = d.getDate().toString().padStart(2, '0');
              const mon = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex flex-col items-center justify-center h-10 w-10 shrink-0 rounded-xl" style={{ backgroundColor: 'var(--surface-input)' }}>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{mon}</span>
                    <span className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.payee}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.frequency}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>
                    {fmtGBP(p.amount)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <Link href="/portal/payments" className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold text-[#7f2b7b] dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Schedule new payment
            </Link>
          </div>
        </div>

        {/* Spending Overview */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Spending overview</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>This month</span>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-4">
              <RadialProgress
                size={120}
                stroke={12}
                gap={0.03}
                segments={topSpend.map(s => ({ value: s.total, color: s.color }))}
                trackColor="var(--surface-input)"
              >
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Total</span>
                <span className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{mask(fmtGBP(spending))}</span>
              </RadialProgress>
              <div className="flex-1 space-y-2">
                {topSpend.map(s => (
                  <div key={s.category} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{s.category}</span>
                    <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{Math.round(s.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <div className="rounded-xl px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">Money in</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{mask(fmtGBP(income))}</p>
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--surface-input)' }}>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Money out</p>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>−{mask(fmtGBP(spending))}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ROW 3 ══ Pending Applications | Relationship manager | Need help ══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Pending Applications */}
        <div className="rounded-2xl overflow-hidden shadow-sm lg:col-span-2" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Loans &amp; applications</h3>
              {taskCount > 0 && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  {taskCount} task{taskCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <Link href="/portal/applications" className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">
              View all →
            </Link>
          </div>
          {appLoading ? (
            <div className="space-y-3 p-5">
              {[1,2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : recentApps.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center px-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ backgroundColor: 'var(--surface-input)' }}>
                <svg className="h-6 w-6 text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active applications</p>
              <Link href="/portal/products" className="mt-2 text-sm font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">
                Explore products →
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {recentApps.map(app => (
                <Link
                  key={app.applicationId}
                  href={`/portal/applications/${app.applicationId}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--surface-input)' }}>
                    <svg className="h-5 w-5 text-[#7f2b7b] dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
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
                  <svg className="h-4 w-4 shrink-0 transition-colors group-hover:text-[#7f2b7b]" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
              <div className="flex items-center justify-between px-5 py-3 text-xs" style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>
                <span>{activeApps.length} active · {apps.length} total</span>
                <Link href="/portal/products" className="font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">
                  Apply for more →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Relationship Manager + Help */}
        <div className="space-y-4">
          {/* Relationship Manager */}
          <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Your relationship</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                JC
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>James Carter</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Relationship Manager</p>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1 align-middle" />
                <span className="text-[10px] text-emerald-500">Online</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/portal/messages" className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-[#7f2b7b] dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors" style={{ border: '1px solid var(--surface-border)' }}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message
              </Link>
              <button className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors" style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                Call
              </button>
            </div>
          </div>

          {/* Need help */}
          <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Need help?</h3>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Our support team is here to help you with anything you need.
            </p>
            <Link
              href="/portal/messages"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-white bg-[#7f2b7b] hover:bg-[#6b2468] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
