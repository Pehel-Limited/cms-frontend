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
  recentTransactions,
  spendByCategory,
  monthlyInOut,
  totalBalanceGBP,
  balanceTrend,
  type Transaction,
} from '@/lib/banking-data';
import { BankCard, Sparkline } from '@/components/banking/BankCard';
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

/* ─── helpers ───────────────────────────────────────────────── */

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

function fmtAcct(n: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function txDay(iso: string): string {
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

/* ─── line area chart for hero ──────────────────────────────── */

function HeroChart({ data }: { data: number[] }) {
  const w = 100;
  const h = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * h] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-70">
      <defs>
        <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#heroFill)" />
      <path d={line} fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ─── spend donut ───────────────────────────────────────────── */

function SpendDonut({ segments }: { segments: { total: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.total, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" className="flex-shrink-0 -rotate-90">
      <circle cx="75" cy="75" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
      {segments.map((seg, i) => {
        const dash = (seg.total / total) * c;
        const el = (
          <circle
            key={i}
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

/* ─── skeleton ──────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

/* ─── quick action button ───────────────────────────────────── */
function QuickAction({ href, label, icon, accent }: { href: string; label: string; icon: React.ReactNode; accent: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 group">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent} text-white shadow-lg transition-transform group-hover:scale-110 group-active:scale-95`}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-white/90 group-hover:text-white">{label}</span>
    </Link>
  );
}

/* ─── main ──────────────────────────────────────────────────── */

export default function PortalDashboard() {
  const user = useSelector((s: RootState) => s.auth.user);
  const [hideBalance, setHideBalance] = useState(false);

  // Banking (mock) — instant
  const accounts = ACCOUNTS;
  const cards = CARDS;
  const txns = useMemo(() => recentTransactions(3), [])
  const spend = useMemo(() => spendByCategory(), []);
  const { income, spending } = useMemo(() => monthlyInOut(), []);
  const total = useMemo(() => totalBalanceGBP(), []);
  const trend = useMemo(() => balanceTrend(), []);
  const topSpend = spend.slice(0, 5);

  // Lending (real data) — preserved integration
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
    () =>
      new Set([
        'COMPLETED', 'WITHDRAWN', 'CANCELLED', 'DECLINED', 'EXPIRED',
        'UNDERWRITING_DECLINED', 'CREDIT_DECLINED', 'KYC_REJECTED',
        'OFFER_REJECTED', 'OFFER_EXPIRED', 'CLOSED',
      ]),
    []
  );
  const activeApps = useMemo(() => apps.filter(a => !terminal.has(a.status)), [apps, terminal]);
  const recentApps = useMemo(
    () =>
      [...apps]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3),
    [apps]
  );

  const mask = (s: string) => (hideBalance ? '••••••' : s);

  return (
    <div className="space-y-6">
      {/* ════════ HERO: total balance ════════ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b] text-white shadow-2xl">
        <HeroChart data={trend} />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute right-24 top-10 h-24 w-24 rounded-full bg-fuchsia-400/20 blur-2xl" />

        <div className="relative z-10 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-purple-200">
                {getGreeting()}, {user?.firstName || 'there'} 👋
              </p>
              <div className="mt-2 flex items-center gap-3">
                <p className="text-[11px] uppercase tracking-widest text-purple-200/70">Total balance</p>
                <button
                  onClick={() => setHideBalance(v => !v)}
                  className="text-purple-200/70 transition-colors hover:text-white"
                  aria-label="Toggle balance visibility"
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
              <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">
                {mask(fmtGBP(total))}
              </h1>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 font-semibold text-emerald-100">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0v5m0-5h-5" />
                  </svg>
                  +4.8%
                </span>
                <span className="text-purple-200/80">vs last month across {accounts.length} accounts</span>
              </div>
            </div>

            {/* quick actions */}
            <div className="grid grid-cols-4 gap-4 rounded-2xl bg-white/5 p-4 backdrop-blur-sm sm:gap-6">
              <QuickAction
                href="/portal/payments"
                label="Send"
                accent="bg-white/15 hover:bg-white/25"
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
                  </svg>
                }
              />
              <QuickAction
                href="/portal/payments"
                label="Request"
                accent="bg-white/15 hover:bg-white/25"
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5l9 9m0-9v9h-9" />
                  </svg>
                }
              />
              <QuickAction
                href="/portal/accounts"
                label="Top up"
                accent="bg-white/15 hover:bg-white/25"
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                }
              />
              <QuickAction
                href="/portal/payments"
                label="Pay bills"
                accent="bg-white/15 hover:bg-white/25"
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5M3.75 12h16.5m-16.5 4.5h16.5" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ════════ ACCOUNTS strip ════════ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Your accounts</h2>
          <Link href="/portal/accounts" className="text-xs font-semibold text-[#7f2b7b] hover:text-[#5e1f5b]">
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {accounts.map(acc => (
            <Link
              key={acc.id}
              href={`/portal/accounts/${acc.id}`}
              className="group relative overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-transform hover:-translate-y-1"
              style={{ background: acc.gradient }}
            >
              <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-lg" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-lg backdrop-blur">
                    {acc.glyph}
                  </span>
                  {acc.primary && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                      Primary
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-white/70">{acc.name}</p>
                <p className="text-xl font-bold">{mask(fmtAcct(acc.balance, acc.currency))}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-white/60">{acc.accountNumber}</span>
                  <Sparkline data={acc.spark} width={56} height={20} strokeWidth={1.5} fill={false} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════ MAIN GRID ════════ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recent transactions */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 pb-3 pt-5">
              <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
              <Link href="/portal/transactions" className="text-xs font-semibold text-[#7f2b7b] hover:text-[#5e1f5b]">
                See all →
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {txns.map((t: Transaction) => (
                <div key={t.id} className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/60">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg">
                    {t.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{t.merchant}</p>
                    <p className="text-xs text-slate-400">
                      {txDay(t.date)} · {txTime(t.date)}
                      {t.status === 'PENDING' && (
                        <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                          Pending
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${t.direction === 'IN' ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {t.direction === 'IN' ? '+' : '−'}
                      {mask(fmtGBP(t.amount))}
                    </p>
                    <p className="text-[10px] text-slate-400">{t.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lending summary — REAL data (preserved integration) */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 pb-3 pt-5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">Loans &amp; financing</h3>
                {taskCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    {taskCount} task{taskCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <Link href="/portal/applications" className="text-xs font-semibold text-[#7f2b7b] hover:text-[#5e1f5b]">
                View all →
              </Link>
            </div>

            {appLoading ? (
              <div className="space-y-3 px-6 pb-5">
                {[1, 2].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentApps.length === 0 ? (
              <div className="px-6 pb-8 pt-2 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50">
                  <svg className="h-6 w-6 text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">No active financing</p>
                <Link href="/portal/products" className="mt-2 inline-block text-sm font-semibold text-[#7f2b7b] hover:underline">
                  Explore credit products →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentApps.map(app => (
                  <Link
                    key={app.applicationId}
                    href={`/portal/applications/${app.applicationId}`}
                    className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/60"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7f2b7b]/10 to-purple-100">
                      <svg className="h-5 w-5 text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {app.product?.productName || LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {app.applicationNumber} · {formatCurrency(app.requestedAmount)}
                      </p>
                    </div>
                    <svg className="h-4 w-4 flex-shrink-0 text-slate-300 transition-colors group-hover:text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
                <div className="flex items-center justify-between bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
                  <span>{activeApps.length} active · {apps.length} total</span>
                  <Link href="/portal/products" className="font-semibold text-[#7f2b7b] hover:underline">
                    Apply for more →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 1/3 */}
        <div className="space-y-6">
          {/* Cards preview — single featured card with switcher chips */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Your cards</h3>
              <Link href="/portal/cards" className="text-xs font-semibold text-[#7f2b7b] hover:text-[#5e1f5b]">
                All cards →
              </Link>
            </div>
            {/* featured card — constrained width so it doesn't dominate the sidebar */}
            <div className="mx-auto w-4/5">
              <BankCard card={cards[0]} />
            </div>
            {/* chip switcher */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              {cards.map((card, i) => (
                <Link
                  key={card.id}
                  href="/portal/cards"
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    i === 0
                      ? 'bg-[#7f2b7b]/10 text-[#7f2b7b]'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: card.gradient }}
                  />
                  ···{card.last4}
                </Link>
              ))}
              <Link
                href="/portal/cards"
                className="ml-auto flex flex-shrink-0 items-center gap-1 rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-[#7f2b7b] hover:text-[#7f2b7b]"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add
              </Link>
            </div>
          </div>

          {/* Spending insights */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Spending</h3>
              <span className="text-xs text-slate-400">This month</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <SpendDonut segments={topSpend} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400">Spent</span>
                  <span className="text-lg font-bold text-slate-900">{mask(fmtGBP(spending))}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {topSpend.map(s => (
                  <div key={s.category} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate text-slate-600">{s.category}</span>
                    <span className="ml-auto font-semibold text-slate-900">{Math.round(s.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
            {/* in / out */}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-[11px] text-slate-400">Money in</p>
                <p className="text-sm font-bold text-emerald-600">+{mask(fmtGBP(income))}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400">Money out</p>
                <p className="text-sm font-bold text-slate-900">−{mask(fmtGBP(spending))}</p>
              </div>
            </div>
          </div>

          {/* Quick send (beneficiaries) */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Quick send</h3>
              <Link href="/portal/payments" className="text-xs font-semibold text-[#7f2b7b] hover:text-[#5e1f5b]">
                Pay →
              </Link>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
              <Link href="/portal/payments" className="flex flex-shrink-0 flex-col items-center gap-1.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-[#7f2b7b] hover:text-[#7f2b7b]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                <span className="text-[10px] text-slate-500">New</span>
              </Link>
              {BENEFICIARIES.slice(0, 5).map(b => (
                <Link key={b.id} href="/portal/payments" className="flex flex-shrink-0 flex-col items-center gap-1.5">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white shadow"
                    style={{ background: b.gradient }}
                  >
                    {b.glyph}
                  </span>
                  <span className="w-12 truncate text-center text-[10px] text-slate-500">{b.name.split(' ')[0]}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
