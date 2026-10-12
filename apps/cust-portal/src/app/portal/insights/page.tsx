'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  spendByCategory,
  bucketSpendByDay,
  bucketDaily,
  savingsGoal,
  TRANSACTIONS,
  SCHEDULED_PAYMENTS,
  type SpendCategory,
} from '@/lib/banking-data';
import Glyph, { glyphFor, GlyphTile } from '@/components/ui/Glyph';
import { DotMatrix } from '@/components/banking/BankCard';
import { PageHero } from '@/components/ui/PageHero';
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

/* ─── helpers ───────────────────────────────────────────────── */
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

function dayShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const WINDOW_DAYS = 30;
/** Daily grid: 30 columns × 10 rows at a 10px pitch is a 600×100 block, which is
    roughly the width the panel has at desktop. `stretch` scales it down below. */
const MATRIX_CELL = 10;
const MATRIX_ROWS = 10;
const PROJECTION_ID = 'projection:savings';

/**
 * The category ring and legend are one plum ramp, stepped by opacity against the
 * panel ground. A per-category rainbow would fight the rest of the portal, where
 * colour is reserved for brand and for good/bad sentiment.
 */
function tone(index: number, count: number): number {
  if (count <= 1) return 1;
  return Number((1 - (index / count) * 0.72).toFixed(3));
}

/**
 * A ring of evenly-spaced dots, partitioned by share. Every dot occupies the
 * same angle, so the eye reads proportion from arc length rather than from dot
 * size — which is what makes the encoding legible at this scale.
 */
function DottedRing({
  segments,
  size = 196,
  dots = 84,
  children,
}: {
  segments: { value: number; opacity: number }[];
  size?: number;
  dots?: number;
  children?: React.ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;

  const marks: { x: number; y: number; opacity: number }[] = [];
  if (total > 0) {
    // Each segment claims an arc up to its cumulative share of the whole.
    let acc = 0;
    const bounds = segments.map(s => {
      acc += s.value / total;
      return { end: acc, opacity: s.opacity };
    });
    for (let k = 0; k < dots; k += 1) {
      const share = (k + 0.5) / dots;
      const angle = share * Math.PI * 2 - Math.PI / 2;
      const seg = bounds.find(b => share < b.end) ?? bounds[bounds.length - 1];
      marks.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        opacity: seg.opacity,
      });
    }
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        {marks.map((m, i) => (
          <circle
            key={i}
            cx={m.x}
            cy={m.y}
            r={2.6}
            style={{ fill: 'var(--brand)', fillOpacity: m.opacity }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/** A short run of dots carrying the same tone as the ring segment it labels. */
function DotRun({ opacity, filled }: { opacity: number; filled: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-[3px]">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full"
          style={{
            backgroundColor: 'var(--brand)',
            opacity: i < filled ? opacity : 0.14,
          }}
        />
      ))}
    </span>
  );
}

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

/* ────────────────────────────────────────────────────────────────── */

function KpiCell({
  icon,
  label,
  value,
  note,
  series,
  children,
}: {
  icon: string;
  label: string;
  value: string;
  note: React.ReactNode;
  series?: number[];
  children?: React.ReactNode;
}) {
  return (
    <div className="kpi-cell block">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="action-tile-icon h-7 w-7 shrink-0 rounded-lg">
              <Glyph name={icon} className="h-3.5 w-3.5" />
            </span>
            <p className="kpi-label !text-[13px]">{label}</p>
          </div>
          <p className="num mt-2.5 text-[26px] font-bold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {value}
          </p>
          <p className="mt-2 text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
            {note}
          </p>
          {children}
        </div>
        {series && series.length > 1 && (
          <span aria-hidden="true" className="hidden shrink-0 sm:block">
            <DotMatrix data={series} box={{ width: 72, height: 34 }} label={`${label} trend`} />
          </span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

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

  const isDismissed = useCallback(
    (id: string) => feedback.dismissed.includes(id),
    [feedback.dismissed]
  );

  /* One spending basis for the whole page: settled, outgoing, and not a transfer
     between the customer's own accounts. Every figure below is computed from
     this set, so the KPI strip, the daily chart and the category ring cannot
     drift apart. `projection` is the deliberate exception — net cash flow needs
     the incoming rows too, and it says so in its own assumptions. */
  const spendRows = useMemo(
    () =>
      TRANSACTIONS.filter(
        t => t.direction === 'OUT' && t.status === 'COMPLETED' && categoryOf(t, overrides) !== 'Transfers'
      ),
    [overrides]
  );

  const spend = useMemo(() => spendByCategory(overrides, true), [overrides]);
  const ringTotal = useMemo(() => spend.reduce((sum, s) => sum + s.total, 0), [spend]);
  const dailySpend = useMemo(() => bucketSpendByDay(spendRows, WINDOW_DAYS), [spendRows]);
  const recurring = useMemo(() => detectRecurring(spendRows, overrides), [spendRows, overrides]);
  const goal = useMemo(() => savingsGoal(), []);
  const projection = useMemo(() => projectSavings(TRANSACTIONS, goal, overrides), [goal, overrides]);
  const highlights = useMemo(() => spendingHighlights(spendRows, overrides), [spendRows, overrides]);
  const split = useMemo(() => weekdayWeekendSplit(spendRows), [spendRows]);

  const [recurringFilter, setRecurringFilter] = useState<'ALL' | 'CONFIRMED' | 'OTHER'>('ALL');

  const visibleRecurring = useMemo(
    () => recurring.filter(r => !isDismissed(r.id)),
    [recurring, isDismissed]
  );
  const filteredRecurring = useMemo(() => {
    if (recurringFilter === 'CONFIRMED') return visibleRecurring.filter(r => r.confidence === 'CONFIRMED');
    if (recurringFilter === 'OTHER') return visibleRecurring.filter(r => r.confidence !== 'CONFIRMED');
    return visibleRecurring;
  }, [visibleRecurring, recurringFilter]);

  const recurringMonthly = useMemo(
    () => visibleRecurring.reduce((sum, r) => sum + r.typicalAmount, 0),
    [visibleRecurring]
  );

  /** Titles of everything currently hidden, so each can be brought back. */
  const dismissedItems = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    recurring.forEach(r => {
      if (isDismissed(r.id)) items.push({ id: r.id, label: r.merchant });
    });
    if (isDismissed(PROJECTION_ID)) items.push({ id: PROJECTION_ID, label: `${goal.label} projection` });
    return items;
  }, [recurring, isDismissed, goal.label]);

  const topMerchants = useMemo(() => {
    const totals = new Map<string, { total: number; category: SpendCategory; count: number }>();
    spendRows.forEach(t => {
      const prev = totals.get(t.merchant) ?? { total: 0, category: categoryOf(t, overrides), count: 0 };
      prev.total += t.amount;
      prev.count += 1;
      totals.set(t.merchant, prev);
    });
    const rows = Array.from(totals.entries())
      .map(([merchant, v]) => ({ merchant, ...v }))
      .sort((a, b) => b.total - a.total);
    const max = rows.length ? rows[0].total : 1;
    return rows.slice(0, 6).map(m => ({ ...m, dots: Math.max(1, Math.round((m.total / max) * 10)) }));
  }, [spendRows, overrides]);

  const scheduled = useMemo(() => SCHEDULED_PAYMENTS, []);
  const scheduledTotal = useMemo(() => scheduled.reduce((sum, p) => sum + p.amount, 0), [scheduled]);

  /* Honest date window: the oldest and newest transaction actually on record. */
  const span = useMemo(() => {
    const dates = TRANSACTIONS.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
    if (dates.length === 0) return null;
    return { from: dayShort(new Date(dates[0]).toISOString()), to: dayShort(new Date(dates[dates.length - 1]).toISOString()) };
  }, []);

  const spentTotal = useMemo(() => spendRows.reduce((sum, t) => sum + t.amount, 0), [spendRows]);

  /* The KPI thumbnail is 30 days of daily figures, which is far too many dots to
     read at 72px. Collapsed into three-day sums — still the same money, just
     coarser, so the shape of the window survives at thumbnail size. */
  const threeDayBuckets = useMemo(
    () => bucketDaily(dailySpend, 3).map(d => d.total),
    [dailySpend]
  );

  const peak = useMemo(() => {
    const idx = dailySpend.reduce((best, d, i) => (d.total > dailySpend[best].total ? i : best), 0);
    return { value: dailySpend[idx]?.total ?? 0, index: idx, date: dailySpend[idx]?.date };
  }, [dailySpend]);

  /** The chart's own window, taken from the buckets it actually draws — which is
      wider than the transaction span, since the oldest payment is 25 days back
      but the grid is 30 days long. */
  const chartRange = useMemo(() => {
    if (dailySpend.length === 0) return null;
    return `${dayShort(dailySpend[0].date)} – ${dayShort(dailySpend[dailySpend.length - 1].date)}`;
  }, [dailySpend]);

  const goalPct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
  const topCategory = spend[0];
  const largestCategoryShare = topCategory ? Math.round(topCategory.pct) : 0;

  /* Three lines, each traceable to a figure already computed above. Nothing here
     is generated: they are the arithmetic, phrased. */
  const readouts = useMemo(() => {
    const items: { icon: string; title: string; body: string }[] = [];
    if (topCategory) {
      items.push({
        icon: glyphFor(topCategory.category),
        title: `${topCategory.category} is your largest category`,
        body: `${fmtEUR(topCategory.total)} of settled spending, ${Math.round(topCategory.pct)}% of the total across the ${projection.windowDays}-day window.`,
      });
    }
    if (highlights.largestOut) {
      items.push({
        icon: 'chart',
        title: `${fmtEUR(highlights.avgPerDay)} a day, settled`,
        body: `Across ${highlights.activeDaysCount} of ${projection.windowDays} days. Your largest single payment was ${fmtEUR(highlights.largestOut.amount)} to ${highlights.largestOut.merchant}.`,
      });
    }
    const regular = visibleRecurring.filter(r => r.confidence === 'CONFIRMED');
    if (regular.length) {
      items.push({
        icon: 'subscription',
        title: `${regular.length} regular commitment${regular.length === 1 ? '' : 's'} at ${fmtEUR(
          regular.reduce((s, r) => s + r.typicalAmount, 0)
        )} a cycle`,
        body: `Weekdays take ${split.weekdayPct}% of your outgoing money (${fmtEUR(split.weekdayTotal)}) against ${split.weekendPct}% at weekends.`,
      });
    }
    return items;
  }, [topCategory, highlights, visibleRecurring, split, projection.windowDays]);

  return (
    <div className="space-y-5">
      <PageHero
        title="Insights"
        subtitle="Where your money went, worked out from the transactions on your accounts."
        meta={
          <>
            <span className="chip">{span ? `${span.from} – ${span.to}` : 'This period'}</span>
            <span className="chip">{TRANSACTIONS.length} transactions</span>
            <span className="chip">Calculated on device</span>
          </>
        }
        actions={
          <Link href="/portal/transactions" className="pill-btn">
            Transaction feed
            <Glyph name="Transfers" className="h-4 w-4" />
          </Link>
        }
      />

      {ready && (dismissedCount > 0 || correctionCount > 0) && (
        <div
          className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
          style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Personalised view:</span>
            {correctionCount > 0 && (
              <span>{correctionCount} custom categor{correctionCount === 1 ? 'y' : 'ies'} applied</span>
            )}
            {dismissedItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-2">
                <span className="text-xs">Dismissed:</span>
                {dismissedItems.map(item => (
                  <button key={item.id} type="button" onClick={() => restore(item.id)} className="chip hover:opacity-80">
                    {item.label} · restore
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={clearAll} className="text-xs font-semibold underline underline-offset-2 hover:opacity-80">
            Reset all overrides
          </button>
        </div>
      )}

      {/* ══ KPI strip ══ */}
      <section className="glass-panel" aria-label="Spending summary">
        <div className="kpi-strip">
          <KpiCell
            icon="chart"
            label="Spent, settled"
            value={fmtEUR(spentTotal)}
            note={`From ${spendRows.length} settled payments · ${span ? `${span.from} – ${span.to}` : 'this period'}`}
            series={threeDayBuckets}
          />
          <KpiCell
            icon="calendar"
            label="Average per day"
            value={fmtEUR(highlights.avgPerDay)}
            note={`On ${highlights.activeDaysCount} of ${projection.windowDays} days with activity · ${highlights.zeroSpendDays} with none`}
          />
          <KpiCell
            icon="savings"
            label={`${goal.label} forecast`}
            value={
              projection.targetDate
                ? new Date(projection.targetDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                : 'Paused'
            }
            note={
              projection.targetDate
                ? `At ${signedEUR(projection.monthlyNet)} net a month · ${fmtEUR(projection.remaining)} to go`
                : `Net cash flow is not positive, so no date can be projected`
            }
          >
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--tile-bg)' }}>
                <div className="h-full rounded-full" style={{ width: `${goalPct}%`, backgroundColor: 'var(--brand)' }} />
              </div>
              <p className="mt-1.5 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {fmtEUR(goal.saved)} of {fmtEUR(goal.target)} · {goalPct}%
              </p>
            </div>
          </KpiCell>
          <KpiCell
            icon="subscription"
            label="Recurring payments"
            value={`${visibleRecurring.length} detected`}
            note={`Typically ${fmtEUR(recurringMonthly)} a cycle between them`}
          />
        </div>
      </section>

      {/* ══ Money story | category ring ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="glass-panel xl:col-span-7" aria-label="Your money story">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Your money story</h2>
              <p className="glass-sub">Settled outgoing payments, day by day</p>
            </div>
            <span className="chip shrink-0">{chartRange ?? `${dailySpend.length} days`}</span>
          </div>

          <div className="glass-body">
            {peak.value === 0 ? (
              <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No settled spending recorded in this period.
              </p>
            ) : (
              <>
                {/* The wrapper is sized to the matrix's own grid, so the peak
                    marker and the end labels — all positioned in percentages —
                    keep lining up with their columns when `stretch` shrinks the
                    chart on narrow screens. */}
                <div
                  className="relative"
                  style={{
                    width: dailySpend.length * MATRIX_CELL * 2,
                    maxWidth: '100%',
                    paddingTop: 44,
                  }}
                >
                  <span
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${((peak.index + 0.5) / dailySpend.length) * 100}%`,
                      top: 0,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <span className="chart-marker flex-col !items-center !py-1 whitespace-nowrap">
                      <span>{fmtEUR(peak.value)}</span>
                      <span className="text-[10px] font-medium opacity-75">
                        {peak.date ? dayShort(peak.date) : ''}
                      </span>
                    </span>
                    <span className="marker-leader" style={{ height: 8 }} aria-hidden="true" />
                  </span>

                  <DotMatrix
                    data={dailySpend.map(d => d.total)}
                    cell={MATRIX_CELL}
                    rows={MATRIX_ROWS}
                    stretch
                    label={`Settled outgoing spending by day, ${chartRange ?? 'last 30 days'}`}
                    format={(value, i) => `${dayShort(dailySpend[i].date)} · ${fmtEUR(value)}`}
                  />

                  <div className="relative mt-2 h-4" aria-hidden="true">
                    <span className="num absolute left-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {dayShort(dailySpend[0].date)}
                    </span>
                    <span className="num absolute right-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {dayShort(dailySpend[dailySpend.length - 1].date)}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="stat-row !items-start">
                <span className="action-tile-icon h-9 w-9 shrink-0 rounded-xl">
                  <Glyph name="calendar" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    Weekdays ({split.weekdayPct}%)
                  </span>
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {fmtEUR(split.weekdayTotal)}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {split.weekdayCount} payments · avg {fmtEUR(split.weekdayAvg)}/day
                  </span>
                </span>
              </div>

              <div className="stat-row !items-start">
                <span className="action-tile-icon h-9 w-9 shrink-0 rounded-xl">
                  <Glyph name="Entertainment" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    Weekends ({split.weekendPct}%)
                  </span>
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {fmtEUR(split.weekendTotal)}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {split.weekendCount} payments · avg {fmtEUR(split.weekendAvg)}/day
                  </span>
                </span>
              </div>

              <div className="stat-row !items-start">
                <span className="action-tile-icon h-9 w-9 shrink-0 rounded-xl">
                  <Glyph name="Income" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    Net cash flow
                  </span>
                  <span
                    className="num block text-base font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {signedEUR(projection.monthlyNet)}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    a month, over {projection.windowDays} observed days
                  </span>
                </span>
              </div>
            </div>
          </div>

          <p className="glass-foot">
            Column height is settled outgoing money that day, excluding transfers between your own accounts. Pending
            and incoming transactions are left out, so the bars sum to {fmtEUR(spentTotal)}.
          </p>
        </section>

        <section className="glass-panel xl:col-span-5" aria-label="Spending by category">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Spending by category</h2>
              <p className="glass-sub">{spend.length} categories with settled spend</p>
            </div>
            <span className="chip shrink-0">{largestCategoryShare}% top</span>
          </div>

          {spend.length === 0 ? (
            <div className="glass-body">
              <div className="empty-state">
                <p className="empty-state-title">No category data yet</p>
                <p className="empty-state-text">
                  Your spending breakdown appears here once transactions have settled.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center pb-2">
                <DottedRing segments={spend.map((s, i) => ({ value: s.total, opacity: tone(i, spend.length) }))}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Spent
                  </span>
                  <span className="num text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {fmtEUR(ringTotal)}
                  </span>
                </DottedRing>
              </div>

              <ul className="px-6 pb-2">
                {spend.slice(0, 6).map((s, i) => {
                  const corrected = overrides[merchantKey(s.category)] !== undefined;
                  return (
                    <li key={s.category} className="glass-row !px-0">
                      <GlyphTile
                        name={glyphFor(s.category)}
                        className="h-8 w-8 rounded-lg"
                        iconClassName="h-4 w-4"
                        tone={corrected ? 'brand' : 'neutral'}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {s.category}
                        </span>
                        <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                          {Math.round(s.pct)}% of settled spend
                        </span>
                      </span>
                      <DotRun opacity={tone(i, spend.length)} filled={Math.max(1, Math.round((s.pct / 100) * 10))} />
                      <span className="num w-20 shrink-0 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmtEUR(s.total)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {spend.length > 6 && (
                <p className="glass-foot text-center">
                  +{spend.length - 6} more categories make up the remaining{' '}
                  {Math.round(spend.slice(6).reduce((sum, s) => sum + s.pct, 0))}%
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {/* ══ Recurring | merchants + readouts ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="glass-panel flex flex-col xl:col-span-7" aria-label="Recurring payments and subscriptions">
          <div className="glass-head flex-col !items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="glass-title">Recurring payments &amp; subscriptions</h2>
              <p className="glass-sub">
                Identified from payment cadence and amounts. Each row shows the evidence behind it.
              </p>
            </div>
            <div className="segmented shrink-0" role="group" aria-label="Filter recurring payments">
              {(
                [
                  { id: 'ALL', label: `All (${visibleRecurring.length})` },
                  { id: 'CONFIRMED', label: `Regular (${visibleRecurring.filter(r => r.confidence === 'CONFIRMED').length})` },
                  { id: 'OTHER', label: `Other (${visibleRecurring.filter(r => r.confidence !== 'CONFIRMED').length})` },
                ] as const
              ).map(f => (
                <button
                  key={f.id}
                  type="button"
                  data-active={recurringFilter === f.id}
                  aria-pressed={recurringFilter === f.id}
                  onClick={() => setRecurringFilter(f.id)}
                  className="segmented-item text-xs"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredRecurring.length === 0 ? (
            <div className="glass-body">
              <div className="empty-state">
                <p className="empty-state-title">No recurring payments in this view</p>
                <p className="empty-state-text">
                  When regular debits or subscriptions are detected, they appear here with the exact transactions that
                  proved them.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {filteredRecurring.map(item => {
                const confidence = CONFIDENCE_LABEL[item.confidence];
                const key = merchantKey(item.merchant);
                const corrected = overrides[key] !== undefined;
                return (
                  <div key={item.id} className="border-t px-6 py-5 first:border-t-0" style={{ borderColor: 'var(--hairline)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <GlyphTile
                          name={glyphFor(item.category)}
                          className="h-10 w-10 rounded-xl"
                          tone={corrected ? 'brand' : 'neutral'}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {item.merchant}
                            </p>
                            <span
                              className={`badge text-xs ${item.confidence === 'CONFIRMED' ? 'badge-primary' : 'badge-neutral'}`}
                            >
                              {confidence.label}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {item.category} · seen {item.occurrences} times ·{' '}
                            {item.medianGapDays !== null && item.confidence !== 'INSUFFICIENT_HISTORY'
                              ? `roughly every ${item.medianGapDays} days`
                              : 'not enough history to call a cadence'}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {confidence.note}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                          ~{fmtEUR(item.typicalAmount)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {fmtEUR(item.totalInWindow)} in window
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

          <div className="glass-foot mt-auto flex flex-wrap items-center justify-between gap-2">
            <span>Only settled payments are counted. Three or more at an even cadence qualify as Regular.</span>
            <span className="num font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
              ~{fmtEUR(recurringMonthly)} a cycle
            </span>
          </div>
        </section>

        <div className="flex flex-col gap-5 xl:col-span-5">
          <section className="glass-panel" aria-label="Top merchants">
            <div className="glass-head">
              <div>
                <h2 className="glass-title">Top merchants</h2>
                <p className="glass-sub">Where settled money went most</p>
              </div>
              <span className="chip shrink-0">By total</span>
            </div>

            {topMerchants.length === 0 ? (
              <div className="glass-body">
                <div className="empty-state !py-8">
                  <p className="empty-state-title">No merchant activity</p>
                  <p className="empty-state-text">Settled payments will be ranked here.</p>
                </div>
              </div>
            ) : (
              <div>
                {topMerchants.map((m, idx) => (
                  <div key={m.merchant} className="glass-row">
                    <span className="num w-4 shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {idx + 1}
                    </span>
                    <GlyphTile name={glyphFor(m.category)} className="h-9 w-9 rounded-xl" iconClassName="h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {m.merchant}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {m.category} · {m.count} payment{m.count === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span aria-hidden="true" className="shrink-0">
                      <DotRun opacity={tone(idx, topMerchants.length)} filled={m.dots} />
                    </span>
                    <span className="num w-20 shrink-0 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {fmtEUR(m.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-panel flex-1" aria-label="What the numbers say">
            <div className="glass-head">
              <div>
                <h2 className="glass-title">What the numbers say</h2>
                <p className="glass-sub">Arithmetic over your transactions, phrased</p>
              </div>
              <span className="chip shrink-0">No model involved</span>
            </div>

            <div className="flex-1">
              {readouts.map(item => (
                <div key={item.title} className="glass-row">
                  <GlyphTile name={item.icon} className="h-9 w-9 rounded-xl" iconClassName="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/portal/ai-assistant" className="glass-foot flex items-center justify-between link-arrow">
              Ask about any of this
              <span data-arrow aria-hidden="true">
                →
              </span>
            </Link>
          </section>
        </div>
      </div>

      {/* ══ Forecast working | scheduled ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {!isDismissed(PROJECTION_ID) && (
          <section className="glass-panel flex flex-col xl:col-span-7" aria-label="Savings forecast">
            <div className="glass-head">
              <div>
                <h2 className="glass-title">{goal.label} forecast</h2>
                <p className="glass-sub">
                  Extrapolated strictly from observed net cash flow. Not a bank commitment.
                </p>
              </div>
              <span className="chip shrink-0">Illustration only</span>
            </div>

            <div className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-3">
              <div className="stat-row !items-start">
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Saved so far
                  </p>
                  <p className="num text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {fmtEUR(projection.saved)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Target {fmtEUR(projection.target)}
                  </p>
                </div>
              </div>
              <div className="stat-row !items-start">
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Net per month
                  </p>
                  <p className="num text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {signedEUR(projection.monthlyNet)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Over {projection.windowDays} observed days
                  </p>
                </div>
              </div>
              <div className="stat-row !items-start">
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Target date
                  </p>
                  <p className="num text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {projection.targetDate
                      ? new Date(projection.targetDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                      : 'Unreachable'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fmtEUR(projection.remaining)} remaining
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-6 mt-4 rounded-2xl p-4 text-xs leading-relaxed" style={{ backgroundColor: 'var(--tile-bg)', border: '1px solid var(--hairline)' }}>
              <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Calculation assumptions:
              </p>
              <ul className="mt-1.5 space-y-1" style={{ color: 'var(--text-muted)' }}>
                {projection.assumptions.map(a => (
                  <li key={a}>· {a}</li>
                ))}
              </ul>
            </div>

            <div className="mt-auto px-6">
              <InsightFooter
                basis={projection.evidence.basis}
                lines={projection.evidence.lines}
                onDismiss={() => dismiss(PROJECTION_ID)}
              />
            </div>
          </section>
        )}

        <section
          className={`glass-panel flex flex-col ${isDismissed(PROJECTION_ID) ? 'xl:col-span-12' : 'xl:col-span-5'}`}
          aria-label="Scheduled payments and direct debits"
        >
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Scheduled payments</h2>
              <p className="glass-sub">Committed instructions on your accounts</p>
            </div>
            <span className="chip num shrink-0">{fmtEUR(scheduledTotal)} upcoming</span>
          </div>

          {scheduled.length === 0 ? (
            <div className="glass-body">
              <div className="empty-state">
                <p className="empty-state-title">Nothing scheduled</p>
                <p className="empty-state-text">
                  Standing orders and direct debits will be listed here with their next deduction date.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {scheduled.map(p => {
                const next = new Date(p.nextDate);
                const daysUntil = Math.max(0, Math.ceil((next.getTime() - Date.now()) / 86_400_000));
                return (
                  <div key={p.id} className="glass-row">
                    <span className="dash-date-tile h-11 w-11 shrink-0 rounded-xl">
                      <span className="text-[9px] font-semibold uppercase leading-none">
                        {next.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="num text-base font-semibold leading-tight">{next.getDate()}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {p.payee}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {p.frequency} · in {daysUntil} day{daysUntil === 1 ? '' : 's'}
                      </p>
                    </div>
                    <p className="num shrink-0 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {fmtEUR(p.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="glass-foot mt-auto flex items-center justify-between">
            <span>{scheduled.length} active instructions</span>
            <Link href="/portal/payments" className="link-arrow">
              Manage <span data-arrow aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
