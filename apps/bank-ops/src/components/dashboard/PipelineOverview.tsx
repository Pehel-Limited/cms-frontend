'use client';

import { useMemo } from 'react';
import { compactCurrency } from './ChartTooltip';
import type { PipelineStage } from '@/services/api/dashboard-service';

function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* Sequential, calm ramp — one hue family per phase of the funnel. */
const RAMP = [
  '#94a3b8',
  '#38bdf8',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#059669',
];

const PENDING = [
  { key: 'kycPendingCount', label: 'KYC', color: '#f59e0b' },
  { key: 'amlPendingCount', label: 'AML', color: '#f97316' },
  { key: 'docsPendingCount', label: 'Docs', color: '#3b82f6' },
  { key: 'creditCheckPendingCount', label: 'Credit', color: '#8b5cf6' },
] as const;

interface Props {
  stages: PipelineStage[];
}

export default function PipelineOverview({ stages }: Props) {
  const rows = useMemo(
    () =>
      stages
        .filter(s => s?.stage)
        .map((s, i) => ({
          stage: s.stage,
          name: humanise(s.stage),
          count: s.applicationCount ?? 0,
          value: s.totalValue ?? 0,
          avg: s.avgDaysInStage ?? 0,
          p90: s.p90DaysInStage ?? 0,
          color: RAMP[i % RAMP.length],
          pending: PENDING.map(p => ({ ...p, n: s[p.key] ?? 0 })).filter(p => p.n > 0),
        })),
    [stages]
  );

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  /* Widest gap between the slowest 10% and the typical deal = the real bottleneck. */
  const bottleneck = useMemo(
    () =>
      [...rows]
        .filter(r => r.count > 0 && r.p90 > 0 && r.avg > 0)
        .sort((a, b) => b.p90 - b.avg - (a.p90 - a.avg))[0],
    [rows]
  );

  if (totalCount === 0) return null;

  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Pipeline
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            {totalCount} applications moving through {rows.filter(r => r.count > 0).length} stages
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: 'var(--rm-text)' }}>
            {compactCurrency(totalValue)}
          </p>
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            total value
          </p>
        </div>
      </div>

      {/* single segmented funnel bar */}
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'rgba(127,127,127,0.15)' }}
        role="img"
        aria-label={`Pipeline distribution across ${rows.length} stages`}
      >
        {rows
          .filter(r => r.count > 0)
          .map(r => (
            <div
              key={r.stage}
              title={`${r.name}: ${r.count}`}
              style={{ flexGrow: r.count, flexBasis: 0, backgroundColor: r.color }}
            />
          ))}
      </div>

      {/* stage detail */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-5">
        {rows.map(r => (
          <div key={r.stage} className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
              <span className="text-sm font-medium truncate" style={{ color: 'var(--rm-text)' }}>
                {r.name}
              </span>
              <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                {r.count}
              </span>
            </div>
            <p className="mt-1 text-sm tabular-nums pl-[18px]" style={{ color: 'var(--rm-text-muted)' }}>
              {r.value > 0 ? compactCurrency(r.value) : '—'}
              {r.avg > 0 && ` · avg ${r.avg.toFixed(0)}d`}
              {r.p90 > 0 && ` · p90 ${r.p90.toFixed(0)}d`}
            </p>
            {r.pending.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-[18px]">
                {r.pending.map(p => (
                  <span
                    key={p.key}
                    className="rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                    style={{ backgroundColor: `${p.color}1f`, color: p.color }}
                  >
                    {p.label} {p.n}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {bottleneck && bottleneck.p90 >= bottleneck.avg * 2 && (
        <p className="mt-6 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          <span className="font-semibold" style={{ color: '#f59e0b' }}>
            {bottleneck.name}
          </span>{' '}
          has the longest tail — the slowest 10% of deals take {bottleneck.p90.toFixed(0)} days against a{' '}
          {bottleneck.avg.toFixed(0)}-day average.
        </p>
      )}
    </section>
  );
}
