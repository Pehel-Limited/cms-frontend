'use client';

import { useMemo } from 'react';
import {
  spendByCategory,
  monthlyInOut,
  dailySpendSeries,
  TRANSACTIONS,
  SCHEDULED_PAYMENTS,
  CATEGORY_META,
} from '@/lib/banking-data';
import { RadialProgress } from '@/components/banking/BankCard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);
}

const WINDOW_DAYS = 30;

/** Daily spend as an accessible line chart. Everything drawn is derived from
    the transaction history — no synthetic series. */
function SpendLineChart({ data, id }: { data: number[]; id: string }) {
  const w = 600;
  const h = 160;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 8) - 4] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label={`Daily spending over the last ${data.length} days, ranging from ${fmt(min)} to ${fmt(max)}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function InsightsPage() {
  const spend = useMemo(() => spendByCategory(), []);
  const { income, spending } = useMemo(() => monthlyInOut(), []);
  const dailySpend = useMemo(() => dailySpendSeries(WINDOW_DAYS), []);

  /* Top merchants, derived from the same transaction history the rest of the
     page uses — grouped by merchant and summed for outgoing payments. */
  const topMerchants = useMemo(() => {
    const totals = new Map<string, { total: number; glyph: string; category: string; count: number }>();
    TRANSACTIONS.filter(t => t.direction === 'OUT').forEach(t => {
      const prev = totals.get(t.merchant) ?? {
        total: 0,
        glyph: t.glyph || CATEGORY_META[t.category].glyph,
        category: t.category,
        count: 0,
      };
      prev.total += t.amount;
      prev.count += 1;
      totals.set(t.merchant, prev);
    });
    return Array.from(totals.entries())
      .map(([merchant, v]) => ({ merchant, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, []);

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

  const topCategory = spend[0];
  const net = income - spending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          Spending insights
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {window
            ? `Based on ${TRANSACTIONS.length} transactions between ${window.from} and ${window.to}.`
            : 'No transactions on record yet.'}
        </p>
      </div>

      {/* Headline figures — each one computed from the transaction history */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-tile">
          <p className="stat-label">Total spent</p>
          <p className="stat-value">{fmt(spending)}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Total received</p>
          <p className="stat-value">{fmt(income)}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Net cash flow</p>
          <p className="stat-value">{`${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}`}</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {net >= 0 ? 'Money in exceeded money out' : 'Money out exceeded money in'}
          </p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Upcoming scheduled payments</p>
          <p className="stat-value">{fmt(scheduledTotal)}</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {scheduled.length} payment{scheduled.length === 1 ? '' : 's'} queued
          </p>
        </div>
      </div>

      {/* Spend over time + category split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <h2 className="panel-title">Spend over time</h2>
            <span className="chip">Last {WINDOW_DAYS} days</span>
          </div>
          <div className="p-5">
            {dailySpend.length > 0 ? (
              <>
                <div className="h-40 w-full">
                  <SpendLineChart data={dailySpend.map(d => d.total)} id="insights-spend-fill" />
                </div>
                <div className="mt-2 flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
                  {chartTicks.map(t => (
                    <span key={t.key}>{t.label}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No spending recorded in this period.
              </p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Spending by category</h2>
          </div>
          {spend.length === 0 ? (
            <div className="p-5">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="empty-state-title">No category data yet</p>
                <p className="empty-state-text">
                  Your spending breakdown appears here once transactions have posted.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 p-5">
              <RadialProgress
                size={140}
                stroke={14}
                gap={0.025}
                segments={spend.slice(0, 5).map(s => ({ value: s.total, color: s.color }))}
                trackColor="var(--surface-input)"
              >
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Total</span>
                <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {fmt(spending)}
                </span>
              </RadialProgress>
              <ul className="w-full space-y-2.5">
                {spend.slice(0, 5).map(s => (
                  <li key={s.category} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {s.category}
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {Math.round(s.pct)}%
                    </span>
                    <span
                      className="w-24 shrink-0 text-right text-base font-semibold tabular-nums"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {fmt(s.total)}
                    </span>
                  </li>
                ))}
              </ul>
              {topCategory && (
                <p className="w-full text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {topCategory.category} is your largest category at{' '}
                  <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmt(topCategory.total)}
                  </span>
                  , or <span className="font-semibold tabular-nums">{Math.round(topCategory.pct)}%</span> of
                  total spending.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Merchants + scheduled payments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Top merchants</h2>
            <span className="chip">By total spent</span>
          </div>
          {topMerchants.length === 0 ? (
            <div className="p-5">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <p className="empty-state-title">No merchants yet</p>
                <p className="empty-state-text">
                  Merchants appear here once you have made card or account payments.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-token">
              {topMerchants.map(m => (
                <li key={m.merchant} className="flex items-center gap-3 px-5 py-4">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: 'var(--surface-input)' }}
                    aria-hidden="true"
                  >
                    {m.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                      {m.merchant}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {m.category} · {m.count} payment{m.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-base font-semibold tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {fmt(m.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Scheduled payments</h2>
            <span className="chip">{fmt(scheduledTotal)} total</span>
          </div>
          {scheduled.length === 0 ? (
            <div className="p-5">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="empty-state-title">Nothing scheduled</p>
                <p className="empty-state-text">
                  Set up a standing order or direct debit and it will show up here.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-token">
              {scheduled.map(p => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-4">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: 'var(--surface-input)' }}
                    aria-hidden="true"
                  >
                    {p.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                      {p.payee}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {p.frequency} · next{' '}
                      {new Date(p.nextDate).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-base font-semibold tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {fmt(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
