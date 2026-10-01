'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip, { compactCurrency } from './ChartTooltip';
import type { TrendPoint } from '@/services/api/dashboard-service';

const COUNT_SERIES = [
  { key: 'submittedCount', name: 'Submitted', color: '#0ea5e9' },
  { key: 'approvedCount', name: 'Approved', color: '#10b981' },
  { key: 'declinedCount', name: 'Declined', color: '#ef4444' },
] as const;

function weekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* Recharts paints via SVG attributes, which don't resolve CSS custom properties,
   so read the resolved theme tokens and refresh when <html> flips light/dark. */
function useThemeTokens(): { grid: string; text: string } {
  const [tokens, setTokens] = useState({ grid: 'rgba(128,128,128,0.18)', text: '#94a3b8' });

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      setTokens({
        grid: styles.getPropertyValue('--rm-border').trim() || 'rgba(128,128,128,0.18)',
        text: styles.getPropertyValue('--rm-text-muted').trim() || '#94a3b8',
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

interface Props {
  points: TrendPoint[];
  /** Names the book being charted, e.g. "your book" or "All RMs" */
  scopeLabel?: string;
}

export default function TrendChart({ points, scopeLabel = 'your book' }: Props) {
  const [mode, setMode] = useState<'count' | 'value'>('count');
  const { grid, text } = useThemeTokens();
  const reducedMotion = usePrefersReducedMotion();
  const duration = reducedMotion ? 0 : 800;

  const data = useMemo(
    () => points.map(p => ({ ...p, label: weekLabel(p.weekStart) })),
    [points]
  );

  const totals = useMemo(
    () =>
      points.reduce(
        (acc, p) => ({
          submitted: acc.submitted + p.submittedCount,
          decided: acc.decided + p.decidedCount,
          approved: acc.approved + p.approvedCount,
          declined: acc.declined + p.declinedCount,
          value: acc.value + Number(p.submittedValue ?? 0),
        }),
        { submitted: 0, decided: 0, approved: 0, declined: 0, value: 0 }
      ),
    [points]
  );

  if (data.length === 0) return null;

  /* A window with nothing in it is not a trend — say so instead of drawing a flat line. */
  const hasSignal = totals.submitted + totals.decided > 0;

  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Trend
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            {data.length} weeks · {scopeLabel}
          </p>
        </div>
        <div
          className="flex rounded-full p-1"
          style={{ backgroundColor: 'var(--rm-input)' }}
          role="group"
          aria-label="Trend metric"
        >
          {(['count', 'value'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={
                mode === m
                  ? { backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }
                  : { color: 'var(--rm-text-muted)' }
              }
            >
              {m === 'count' ? 'Applications' : 'Requested value'}
            </button>
          ))}
        </div>
      </div>

      {hasSignal ? (
        <div className="h-56 w-full animate-fade-in">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: text, fontSize: 12 }}
                stroke={grid}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={{ fill: text, fontSize: 12 }}
                stroke={grid}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={v => (mode === 'value' ? compactCurrency(Number(v)) : String(v))}
              />
              <Tooltip
                content={p => (
                  <ChartTooltip
                    {...p}
                    currencyKeys={mode === 'value' ? ['submittedValue'] : undefined}
                    labelSuffix=" week"
                  />
                )}
                cursor={{ fill: 'rgba(127,127,127,0.08)' }}
              />
              {mode === 'count' ? (
                <>
                  <Bar
                    dataKey="submittedCount"
                    name="Submitted"
                    fill={COUNT_SERIES[0].color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    animationDuration={duration}
                  />
                  <Line
                    type="monotone"
                    dataKey="approvedCount"
                    name="Approved"
                    stroke={COUNT_SERIES[1].color}
                    strokeWidth={2}
                    dot={{ r: 2.5, strokeWidth: 0, fill: COUNT_SERIES[1].color }}
                    activeDot={{ r: 4 }}
                    animationDuration={duration}
                  />
                  <Line
                    type="monotone"
                    dataKey="declinedCount"
                    name="Declined"
                    stroke={COUNT_SERIES[2].color}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 2.5, strokeWidth: 0, fill: COUNT_SERIES[2].color }}
                    activeDot={{ r: 4 }}
                    animationDuration={duration}
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="submittedValue"
                  name="Requested"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="#0ea5e9"
                  fillOpacity={0.16}
                  animationDuration={duration}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--rm-text-muted)' }}>
          No submissions or decisions recorded for {scopeLabel} in this window.
        </p>
      )}

      <div
        className="mt-5 pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
        style={{ borderTop: '1px solid var(--rm-border)', color: 'var(--rm-text-muted)' }}
      >
        <span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
            {totals.submitted}
          </span>{' '}
          submitted
        </span>
        <span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
            {totals.approved}
          </span>{' '}
          approved
        </span>
        <span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
            {totals.declined}
          </span>{' '}
          declined
        </span>
        <span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
            {compactCurrency(totals.value)}
          </span>{' '}
          requested
        </span>
      </div>

      <p className="mt-3 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
        Weeks keyed on submission date and decision date as recorded on each application.
        {'Decisions land in the week they were made, so a week can show decisions against earlier submissions.'}
      </p>
    </section>
  );
}
