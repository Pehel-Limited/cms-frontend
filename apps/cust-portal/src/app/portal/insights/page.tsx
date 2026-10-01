'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  spendByCategory,
  monthlyInOut,
  dailySpendSeries,
  savingsGoal,
  TRANSACTIONS,
  SCHEDULED_PAYMENTS,
  CATEGORY_META,
  type SpendCategory,
} from '@/lib/banking-data';
import { useInsightFeedback } from '@/lib/insight-feedback';
import {
  categoryOf,
  detectRecurring,
  merchantKey,
  projectSavings,
  weekdayWeekendSplit,
  spendingHighlights,
  type RecurringConfidence,
} from '@/lib/spending-insights';
import { InsightFooter } from '@/components/intelligence/InsightFooter';
import { RadialProgress } from '@/components/banking/BankCard';

/* ─── helpers ────────────────────────────────────────────────── */
function fmtEUR(n: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function signedEUR(n: number): string {
  return `${n >= 0 ? '+' : '−'}${fmtEUR(Math.abs(n))}`;
}

const WINDOW_DAYS = 30;
const PROJECTION_ID = 'projection:savings';

/** What each confidence level actually claims — no stronger than the arithmetic. */
const CONFIDENCE_LABEL: Record<RecurringConfidence, { label: string; note: string }> = {
  CONFIRMED: {
    label: 'Regular',
    note: 'Three or more settled payments, each roughly the same gap apart.',
  },
  PROBABLE: {
    label: 'Likely regular',
    note: 'Three or more settled payments, but the gap between them varies.',
  },
  INSUFFICIENT_HISTORY: {
    label: 'Not enough history',
    note: 'Seen twice. Two payments always look regular, so this is not treated as a pattern yet.',
  },
};

function CategoryIcon({ category, className = 'w-5 h-5' }: { category: SpendCategory | string; className?: string }) {
  switch (category) {
    case 'Groceries':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'Eating out':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'Transport':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-5 4h2M5 4h14a2 2 0 012 2v10a2 2 0 01-2 2h-1l-2 3H8l-2-3H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
      );
    case 'Shopping':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case 'Bills':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'Entertainment':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case 'Health':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case 'Travel':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'Cash':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'Transfers':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'Income':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      );
  }
}

function SpendLineChart({ data, id }: { data: number[]; id: string }) {
  const w = 600;
  const h = 160;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 16) - 8] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label={`Daily spending over the last ${data.length} days, ranging from ${fmtEUR(min)} to ${fmtEUR(max)}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ae3fa9" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#7f2b7b" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#7f2b7b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke="#7f2b7b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function InsightsPage() {
  const {
    feedback,
    ready,
    dismiss,
    restore,
    setCategory,
    resetCategory,
    clearAll,
    dismissedCount,
    correctionCount,
  } = useInsightFeedback();
  const overrides = feedback.overrides;

  const spend = useMemo(() => spendByCategory(overrides), [overrides]);
  const { income, spending } = useMemo(() => monthlyInOut(), []);
  const dailySpend = useMemo(() => dailySpendSeries(WINDOW_DAYS), []);

  const isDismissed = useCallback(
    (id: string) => feedback.dismissed.includes(id),
    [feedback.dismissed]
  );

  const recurring = useMemo(() => detectRecurring(TRANSACTIONS, overrides), [overrides]);
  const goal = useMemo(() => savingsGoal(), []);
  const projection = useMemo(
    () => projectSavings(TRANSACTIONS, goal, overrides),
    [goal, overrides]
  );

  const [recurringFilter, setRecurringFilter] = useState<'ALL' | 'CONFIRMED' | 'OTHER'>('ALL');

  const visibleRecurring = useMemo(
    () => recurring.filter(r => !isDismissed(r.id)),
    [recurring, isDismissed]
  );

  const filteredRecurring = useMemo(() => {
    if (recurringFilter === 'CONFIRMED') {
      return visibleRecurring.filter(r => r.confidence === 'CONFIRMED');
    }
    if (recurringFilter === 'OTHER') {
      return visibleRecurring.filter(r => r.confidence !== 'CONFIRMED');
    }
    return visibleRecurring;
  }, [visibleRecurring, recurringFilter]);

  const recurringMonthlyEstimate = useMemo(() => {
    return visibleRecurring.reduce((sum, r) => sum + r.typicalAmount, 0);
  }, [visibleRecurring]);

  /** Titles of everything currently hidden, so each can be brought back. */
  const dismissedItems = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    recurring.forEach(r => {
      if (isDismissed(r.id)) items.push({ id: r.id, label: r.merchant });
    });
    if (isDismissed(PROJECTION_ID)) {
      items.push({ id: PROJECTION_ID, label: `${goal.label} projection` });
    }
    return items;
  }, [recurring, isDismissed, goal.label]);

  /* Top merchants, derived from the same transaction history the rest of the
     page uses — grouped by merchant and summed for outgoing payments, and
     honouring any category the customer has corrected. */
  const topMerchants = useMemo(() => {
    const totals = new Map<string, { total: number; glyph: string; category: SpendCategory; count: number }>();
    TRANSACTIONS.filter(t => t.direction === 'OUT').forEach(t => {
      const prev = totals.get(t.merchant) ?? {
        total: 0,
        glyph: t.glyph || CATEGORY_META[t.category].glyph,
        category: categoryOf(t, overrides),
        count: 0,
      };
      prev.total += t.amount;
      prev.count += 1;
      totals.set(t.merchant, prev);
    });
    return Array.from(totals.entries())
      .map(([merchant, v]) => ({ merchant, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [overrides]);

  /* Genuine upcoming commitments, taken from the scheduled-payment list. */
  const scheduled = useMemo(() => SCHEDULED_PAYMENTS, []);
  const scheduledTotal = useMemo(
    () => scheduled.reduce((sum, p) => sum + p.amount, 0),
    [scheduled]
  );

  /* Honest date window: the oldest and newest transaction actually on record. */
  const window = useMemo(() => {
    const dates = TRANSACTIONS.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
    if (dates.length === 0) return null;
    const fmtDay = (ms: number) =>
      new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return { from: fmtDay(dates[0]), to: fmtDay(dates[dates.length - 1]) };
  }, []);

  const chartTicks = useMemo(() => {
    if (dailySpend.length === 0) return [];
    const count = Math.min(6, dailySpend.length);
    const out: { label: string; key: string }[] = [];
    for (let i = 0; i < count; i += 1) {
      const idx = Math.round((i * (dailySpend.length - 1)) / (count - 1 || 1));
      const d = dailySpend[idx];
      out.push({
        key: `${d.date}-${idx}`,
        label: new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      });
    }
    return out;
  }, [dailySpend]);

  const highlights = useMemo(() => spendingHighlights(TRANSACTIONS, overrides), [overrides]);
  const split = useMemo(() => weekdayWeekendSplit(TRANSACTIONS), []);

  const net = income - spending;
  const savingsPct = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;
  const goalPct = Math.min(100, Math.round((goal.saved / goal.target) * 100));

  return (
    <div className="stagger space-y-6">
      <h1 className="sr-only">Spending Insights</h1>

      {/* Plum Hero */}
      <section className="dash-hero" aria-labelledby="insights-hero-heading">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="dash-hero-chip">
                {window ? `${window.from} – ${window.to}` : 'This period'}
              </span>
              <span className="dash-hero-chip">
                {TRANSACTIONS.length} transactions
              </span>
              <span className="dash-hero-chip">Calculated on device</span>
            </div>

            <p id="insights-hero-heading" className="dash-hero-label mt-4">
              Total spent across all accounts
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl lg:text-6xl">
              {fmtEUR(spending)}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-white/80">
              {net >= 0 ? (
                <>
                  You kept <span className="font-semibold text-white">{fmtEUR(net)}</span> of what came in ({savingsPct}% net retention across the period).
                </>
              ) : (
                <>
                  Spending exceeded income by <span className="font-semibold text-white">{fmtEUR(Math.abs(net))}</span> across this period.
                </>
              )}
            </p>
          </div>

          <div className="dash-hero-inset w-full lg:w-[360px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="dash-hero-label">{goal.label}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-white">
                  {fmtEUR(goal.saved)}
                </p>
              </div>
              <span className="dash-hero-chip font-semibold text-white">
                {goalPct}% of goal
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <RadialProgress
                size={64}
                stroke={6}
                segments={[{ value: goal.saved, color: '#ec4899' }]}
                trackColor="rgba(255, 255, 255, 0.18)"
              >
                <span className="text-xs font-bold text-white">{goalPct}%</span>
              </RadialProgress>
              <div className="min-w-0 flex-1 text-xs text-white/80">
                <p>
                  Target <span className="font-semibold text-white">{fmtEUR(goal.target)}</span>
                </p>
                <p className="mt-0.5 truncate text-white/60">
                  {projection.targetDate
                    ? `On track for ${new Date(projection.targetDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
                    : 'Target date projection paused'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xs text-white/60">
                {fmtEUR(projection.remaining)} remaining
              </span>
              <Link href="/portal/accounts" className="dash-hero-link text-xs">
                Manage pot <span data-arrow aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/70">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Money received: <strong className="font-semibold text-white">{signedEUR(income)}</strong>
            </span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span>
              Net cash flow: <strong className="font-semibold text-white">{signedEUR(net)}</strong>
            </span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span>
              Queued commitments: <strong className="font-semibold text-white">{fmtEUR(scheduledTotal)}</strong>
            </span>
          </div>
          <Link href="/portal/transactions" className="dash-hero-link inline-flex items-center gap-1">
            View transaction feed <span data-arrow aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
      {/* Corrections notification bar */}
      {ready && (dismissedCount > 0 || correctionCount > 0) && (
        <div
          className="dash-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
          style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Personalised view:</span>
            {correctionCount > 0 && (
              <span>
                {correctionCount} custom categor{correctionCount === 1 ? 'y' : 'ies'} applied
              </span>
            )}
            {dismissedItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-2">
                <span className="text-xs">Dismissed:</span>
                {dismissedItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => restore(item.id)}
                    className="chip text-xs hover:opacity-80"
                  >
                    {item.label} · restore
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Reset all overrides
          </button>
        </div>
      )}

      {/* 4 KPI Summary Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="dash-tile">
          <p className="dash-tile-label">Average daily spend</p>
          <p className="dash-tile-value">{fmtEUR(highlights.avgPerDay)}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Across {highlights.activeDaysCount} active days
          </p>
        </div>

        <div className="dash-tile">
          <p className="dash-tile-label">No-spend days</p>
          <p className="dash-tile-value">{highlights.zeroSpendDays} days</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Zero outgoing transactions
          </p>
        </div>

        <div className="dash-tile">
          <p className="dash-tile-label">Largest single payment</p>
          <p className="dash-tile-value">
            {highlights.largestOut ? fmtEUR(highlights.largestOut.amount) : '—'}
          </p>
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {highlights.largestOut ? highlights.largestOut.merchant : 'No settled payments'}
          </p>
        </div>

        <div className="dash-tile">
          <p className="dash-tile-label">Regular commitments</p>
          <p className="dash-tile-value">{fmtEUR(recurringMonthlyEstimate)}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {visibleRecurring.length} recurring merchants
          </p>
        </div>
      </div>



      {/* Savings Projection & Top Merchants Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {!isDismissed(PROJECTION_ID) && (
          <div className="dash-card dash-accent flex flex-col p-6 lg:col-span-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="dash-card-title">{goal.label} forecast</h2>
                  <span className="dash-update-chip text-xs">Deterministic</span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Extrapolated strictly from observed net cash flow. Not a bank commitment.
                </p>
              </div>
              <span className="chip text-xs">Illustration only</span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="dash-tile">
                <p className="dash-tile-label">Saved so far</p>
                <p className="dash-tile-value text-xl">{fmtEUR(projection.saved)}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Target {fmtEUR(projection.target)}
                </p>
              </div>
              <div className="dash-tile">
                <p className="dash-tile-label">Net per month</p>
                <p className="dash-tile-value text-xl">
                  {signedEUR(projection.monthlyNet)}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Over {projection.windowDays} observed days
                </p>
              </div>
              <div className="dash-tile">
                <p className="dash-tile-label">Target date</p>
                <p className="dash-tile-value text-xl">
                  {projection.targetDate
                    ? new Date(projection.targetDate).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Unreachable'}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {fmtEUR(projection.remaining)} remaining
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl p-3 text-xs leading-relaxed" style={{ backgroundColor: 'var(--surface-input)' }}>
              <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Calculation assumptions:
              </p>
              <ul className="mt-1 space-y-1" style={{ color: 'var(--text-muted)' }}>
                {projection.assumptions.map(assumption => (
                  <li key={assumption}>· {assumption}</li>
                ))}
              </ul>
            </div>

            <InsightFooter
              basis={projection.evidence.basis}
              lines={projection.evidence.lines}
              onDismiss={() => dismiss(PROJECTION_ID)}
            />
          </div>
        )}

        <div className={`dash-card flex flex-col ${isDismissed(PROJECTION_ID) ? 'lg:col-span-12' : 'lg:col-span-5'}`}>
          <div className="dash-card-head">
            <div>
              <h2 className="dash-card-title">Top merchants</h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Where your money was spent most
              </p>
            </div>
            <span className="chip text-xs">By total spend</span>
          </div>

          {topMerchants.length === 0 ? (
            <div className="p-6">
              <div className="empty-state">
                <p className="empty-state-title">No merchant activity</p>
                <p className="empty-state-text">Settled payments will be ranked here.</p>
              </div>
            </div>
          ) : (
            <div className="divide-token">
              {topMerchants.map((m, idx) => (
                <div key={m.merchant} className="dash-row">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
                    style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                  >
                    {m.glyph || m.merchant.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {m.merchant}
                      </p>
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        #{idx + 1}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {m.category} · {m.count} payment{m.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmtEUR(m.total)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="dash-card-foot mt-auto flex items-center justify-between text-xs">
            <span>Derived from settled payments</span>
            <Link href="/portal/transactions" className="link-arrow">
              View all <span data-arrow aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Grid: Daily Rhythm & Spending by Category */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="dash-card flex flex-col p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="dash-card-title">Daily spending rhythm</h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Observed outgoing transactions over the last {WINDOW_DAYS} days
              </p>
            </div>
            <span className="chip text-xs">
              Peak: {fmtEUR(Math.max(...dailySpend.map(d => d.total), 0))}
            </span>
          </div>

          <div className="mt-6">
            {dailySpend.length > 0 ? (
              <>
                <div className="h-44 w-full">
                  <SpendLineChart data={dailySpend.map(d => d.total)} id="insights-daily-line" />
                </div>
                <div
                  className="mt-3 flex justify-between border-t pt-2 text-xs"
                  style={{ borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}
                >
                  {chartTicks.map(t => (
                    <span key={t.key}>{t.label}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No spending recorded in this period.
              </p>
            )}
          </div>

          <div
            className="mt-6 grid grid-cols-2 gap-4 border-t pt-4"
            style={{ borderColor: 'var(--surface-border)' }}
          >
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Weekdays ({split.weekdayPct}%)
                </span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {fmtEUR(split.weekdayTotal)}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--surface-input)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${split.weekdayPct}%`, backgroundColor: '#7f2b7b' }}
                />
              </div>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {split.weekdayCount} payments · avg {fmtEUR(split.weekdayAvg)}/day
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Weekends ({split.weekendPct}%)
                </span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {fmtEUR(split.weekendTotal)}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--surface-input)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${split.weekendPct}%`, backgroundColor: '#ec4899' }}
                />
              </div>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {split.weekendCount} payments · avg {fmtEUR(split.weekendAvg)}/day
              </p>
            </div>
          </div>
        </div>

        <div className="dash-card flex flex-col p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="dash-card-title">Spending by category</h2>
            <span className="chip text-xs">{spend.length} categories</span>
          </div>

          {spend.length === 0 ? (
            <div className="empty-state my-auto">
              <p className="empty-state-title">No category data yet</p>
              <p className="empty-state-text">
                Your spending breakdown appears here once transactions have settled.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center">
              <div className="py-2">
                <RadialProgress
                  size={148}
                  stroke={14}
                  gap={0.025}
                  segments={spend.slice(0, 6).map(s => ({ value: s.total, color: s.color }))}
                  trackColor="var(--surface-input)"
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Spent</span>
                  <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmtEUR(spending)}
                  </span>
                </RadialProgress>
              </div>

              <ul className="mt-4 w-full space-y-2.5">
                {spend.slice(0, 5).map(s => (
                  <li key={s.category} className="flex items-center gap-3 text-sm">
                    <span
                      aria-hidden="true"
                      className="dash-icon-sq flex h-8 w-8 shrink-0 items-center justify-center text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      <CategoryIcon category={s.category} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                          {s.category}
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {fmtEUR(s.total)}
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: 'var(--surface-input)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, s.pct)}%`, backgroundColor: s.color }}
                        />
                      </div>
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {Math.round(s.pct)}%
                    </span>
                  </li>
                ))}
              </ul>

              {spend.length > 5 && (
                <p className="mt-3 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  +{spend.length - 5} more categories make up the remaining {Math.round(spend.slice(5).reduce((sum, s) => sum + s.pct, 0))}%
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recurring Payments Section */}
      <div className="dash-card flex flex-col">
        <div className="dash-card-head flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="dash-card-title">Recurring payments & subscriptions</h2>
              <span className="dash-update-chip text-xs">
                {visibleRecurring.length} detected
              </span>
            </div>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Identified through payment frequency and amounts. Each result shows its exact evidence.
            </p>
          </div>

          <div className="segmented" role="group" aria-label="Filter recurring payments">
            <button
              type="button"
              data-active={recurringFilter === 'ALL'}
              aria-pressed={recurringFilter === 'ALL'}
              onClick={() => setRecurringFilter('ALL')}
              className="segmented-item text-xs"
            >
              All ({visibleRecurring.length})
            </button>
            <button
              type="button"
              data-active={recurringFilter === 'CONFIRMED'}
              aria-pressed={recurringFilter === 'CONFIRMED'}
              onClick={() => setRecurringFilter('CONFIRMED')}
              className="segmented-item text-xs"
            >
              Regular ({visibleRecurring.filter(r => r.confidence === 'CONFIRMED').length})
            </button>
            <button
              type="button"
              data-active={recurringFilter === 'OTHER'}
              aria-pressed={recurringFilter === 'OTHER'}
              onClick={() => setRecurringFilter('OTHER')}
              className="segmented-item text-xs"
            >
              Other ({visibleRecurring.filter(r => r.confidence !== 'CONFIRMED').length})
            </button>
          </div>
        </div>

        {filteredRecurring.length === 0 ? (
          <div className="p-8">
            <div className="empty-state">
              <p className="empty-state-title">No recurring payments in this view</p>
              <p className="empty-state-text">
                When regular debits or subscriptions are detected, they appear here with the exact transactions that proved them.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-token">
            {filteredRecurring.map(item => {
              const confidence = CONFIDENCE_LABEL[item.confidence];
              const key = merchantKey(item.merchant);
              const corrected = overrides[key] !== undefined;

              return (
                <div key={item.id} className="p-5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.02]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                        style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                      >
                        {item.glyph || item.merchant.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {item.merchant}
                          </p>
                          <span
                            className={`badge text-xs ${
                              item.confidence === 'CONFIRMED'
                                ? 'badge-primary'
                                : 'badge-neutral'
                            }`}
                          >
                            {confidence.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {item.category} · seen {item.occurrences} times · {fmtEUR(item.totalInWindow)} total
                          {item.medianGapDays !== null && item.confidence !== 'INSUFFICIENT_HISTORY'
                            ? ` · roughly every ${item.medianGapDays} days`
                            : ''}
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {confidence.note}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        ~{fmtEUR(item.typicalAmount)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        typical per payment
                      </p>
                    </div>
                  </div>

                  <InsightFooter
                    basis={item.evidence.basis}
                    lines={item.evidence.lines}
                    onDismiss={() => dismiss(item.id)}
                    correction={{
                      merchant: item.merchant,
                      category: overrides[key] ?? item.category,
                      corrected,
                      onChange: category => setCategory(key, category),
                      onReset: () => resetCategory(key),
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="dash-card-foot flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            Only settled payments are counted. Three or more at an even cadence qualify as Regular.
          </span>
          <span className="font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
            ~{fmtEUR(recurringMonthlyEstimate)} recurring / cycle
          </span>
        </div>

      </div>

      {/* Scheduled Payments Ahead */}
      <div className="dash-card flex flex-col">
        <div className="dash-card-head">
          <div>
            <h2 className="dash-card-title">Scheduled payments & direct debits</h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Upcoming outgoing transfers and direct debits committed on your accounts
            </p>
          </div>
          <span className="chip font-semibold text-xs">{fmtEUR(scheduledTotal)} upcoming</span>
        </div>

        {scheduled.length === 0 ? (
          <div className="p-8">
            <div className="empty-state">
              <p className="empty-state-title">Nothing scheduled</p>
              <p className="empty-state-text">
                Standing orders and direct debits will be listed here with their next scheduled deduction date.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-3" style={{ borderColor: 'var(--surface-border)' }}>
            {scheduled.map(p => {
              const next = new Date(p.nextDate);
              const daysUntil = Math.max(0, Math.ceil((next.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return (
                <div key={p.id} className="flex items-center gap-3.5 p-5">
                  <div className="dash-date-tile h-12 w-12 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {next.toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-base font-extrabold leading-none">
                      {next.getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {p.payee}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.frequency} · in {daysUntil} day{daysUntil === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {fmtEUR(p.amount)}
                    </p>
                    <span className="chip text-[10px] py-0.5 px-1.5">
                      Auto
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="dash-card-foot flex items-center justify-between text-xs">
          <span>{scheduled.length} active scheduled instructions</span>
          <Link href="/portal/payments" className="link-arrow">
            Manage scheduled payments <span data-arrow aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
