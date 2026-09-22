'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import type { AgingHeatmapCell } from '@/services/api/dashboard-service';

/* Humanise a SCREAMING_SNAKE stage / bucket / reason into Title Case */
function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* Canonical funnel order — unknown stages sort to the end, then alphabetically. */
const STAGE_ORDER = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_KYC',
  'KYC',
  'PENDING_DOCUMENTS',
  'DOCUMENT',
  'PENDING_CREDIT_CHECK',
  'CREDIT',
  'UNDERWRITING',
  'APPROVED',
  'OFFER',
  'ESIGN',
  'BOOKING',
  'DISBURSE',
  'BOOKED',
  'DECLINED',
];

function stageRank(stage: string): number {
  const s = stage.toUpperCase();
  const i = STAGE_ORDER.findIndex(k => s.includes(k));
  return i === -1 ? STAGE_ORDER.length : i;
}

/* Buckets arrive as free-form strings ("0-7", "8_14", "OVER_30", "30+").
   Rank by the first integer so the columns read youngest → oldest. */
function bucketRank(bucket: string): number {
  const m = bucket.match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

/* Hue follows bucket age (cool → hot); alpha follows application count.
   Text stays on --rm-text so contrast holds in both light and dark mode. */
const RAMP = ['#0ea5e9', '#f59e0b', '#ef4444'];

function rampColor(ageWeight: number, heat: number): string {
  const idx = Math.min(RAMP.length - 1, Math.floor(ageWeight * RAMP.length));
  const alpha = 0.1 + heat * 0.78;
  const hex = RAMP[idx];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

type MergedCell = {
  stage: string;
  bucket: string;
  count: number;
  value: number;
  reasons: string[];
};

interface Props {
  cells: AgingHeatmapCell[];
}

export default function AgingHeatmap({ cells }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const { stages, buckets, grid, maxCount, stageTotals, bucketTotals } = useMemo(() => {
    const merged = new Map<string, MergedCell>();
    for (const c of cells) {
      if (!c?.stage || !c?.ageBucket) continue;
      const key = `${c.stage}||${c.ageBucket}`;
      const existing = merged.get(key);
      const reason = c.breachReason ? humanise(c.breachReason) : '';
      if (existing) {
        existing.count += c.applicationCount ?? 0;
        existing.value += c.totalValue ?? 0;
        if (reason && !existing.reasons.includes(reason)) existing.reasons.push(reason);
      } else {
        merged.set(key, {
          stage: c.stage,
          bucket: c.ageBucket,
          count: c.applicationCount ?? 0,
          value: c.totalValue ?? 0,
          reasons: reason ? [reason] : [],
        });
      }
    }

    const stageSet = [...new Set([...merged.values()].map(c => c.stage))].sort((a, b) => {
      const d = stageRank(a) - stageRank(b);
      return d !== 0 ? d : a.localeCompare(b);
    });
    const bucketSet = [...new Set([...merged.values()].map(c => c.bucket))].sort((a, b) => {
      const d = bucketRank(a) - bucketRank(b);
      return d !== 0 ? d : a.localeCompare(b, undefined, { numeric: true });
    });

    const stageTotals = new Map<string, number>();
    const bucketTotals = new Map<string, number>();
    let max = 0;
    for (const c of merged.values()) {
      stageTotals.set(c.stage, (stageTotals.get(c.stage) ?? 0) + c.count);
      bucketTotals.set(c.bucket, (bucketTotals.get(c.bucket) ?? 0) + c.count);
      if (c.count > max) max = c.count;
    }

    return {
      stages: stageSet,
      buckets: bucketSet,
      grid: merged,
      maxCount: max,
      stageTotals,
      bucketTotals,
    };
  }, [cells]);

  if (stages.length === 0 || buckets.length === 0) return null;

  const lastBucketIdx = buckets.length - 1;
  const selectedCell = selected ? grid.get(selected) : null;
  const totalAged = [...grid.values()].reduce((s, c) => s + c.count, 0);

  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      {/* header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Aging
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            {totalAged} applications by stage and time in stage — warmer means older
          </p>
        </div>

        {/* legend */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
            Newer
          </span>
          <span className="flex h-2.5 w-24 overflow-hidden rounded-full">
            {RAMP.map((hex, i) => (
              <span key={hex} className="flex-1" style={{ backgroundColor: hex, opacity: 0.35 + i * 0.3 }} />
            ))}
          </span>
          <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
            Older
          </span>
        </div>
      </div>

      {/* matrix */}
      <div className="overflow-x-auto no-scrollbar">
        <div
          className="grid gap-2 min-w-max"
          style={{
            gridTemplateColumns: `minmax(160px,1.5fr) repeat(${buckets.length}, minmax(84px,1fr))`,
          }}
        >
          {/* column headers */}
          <div />
          {buckets.map(b => (
            <div key={b} className="text-center pb-2">
              <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                {humanise(b)}
              </p>
              <p className="text-xs tabular-nums mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>
                {bucketTotals.get(b) ?? 0}
              </p>
            </div>
          ))}

          {/* rows */}
          {stages.map(stage => (
            <StageRow
              key={stage}
              stage={stage}
              buckets={buckets}
              lastBucketIdx={lastBucketIdx}
              maxCount={maxCount}
              grid={grid}
              stageTotal={stageTotals.get(stage) ?? 0}
              selected={selected}
              onSelect={setSelected}
            />
          ))}
        </div>
      </div>

      {/* detail / footer */}
      <div
        className="mt-6 pt-5 flex items-center justify-between flex-wrap gap-3"
        style={{ borderTop: '1px solid var(--rm-border)' }}
      >
        {selectedCell ? (
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
              {humanise(selectedCell.stage)} · {humanise(selectedCell.bucket)} days
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>
              {selectedCell.count} application{selectedCell.count === 1 ? '' : 's'} ·{' '}
              <span className="tabular-nums">{formatCurrency(selectedCell.value)}</span>
              {selectedCell.reasons.length > 0 && ` · ${selectedCell.reasons.join(', ')}`}
            </p>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Select a cell to see value and breach reasons
          </p>
        )}
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="text-sm font-medium inline-flex items-center gap-1 hover:underline shrink-0"
          style={{ color: 'var(--rm-accent)' }}
        >
          Open applications
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function StageRow({
  stage,
  buckets,
  lastBucketIdx,
  maxCount,
  grid,
  stageTotal,
  selected,
  onSelect,
}: {
  stage: string;
  buckets: string[];
  lastBucketIdx: number;
  maxCount: number;
  grid: Map<string, MergedCell>;
  stageTotal: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 pr-3">
        <span className="text-sm font-medium truncate" style={{ color: 'var(--rm-text-secondary)' }}>
          {humanise(stage)}
        </span>
        <span
          className="text-xs font-semibold tabular-nums shrink-0 px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(127,127,127,0.12)', color: 'var(--rm-text-muted)' }}
        >
          {stageTotal}
        </span>
      </div>

      {buckets.map((bucket, i) => {
        const key = `${stage}||${bucket}`;
        const cell = grid.get(key);
        const count = cell?.count ?? 0;
        const heat = maxCount > 0 ? count / maxCount : 0;
        const w = lastBucketIdx > 0 ? i / lastBucketIdx : 0;
        const isSelected = selected === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isSelected ? null : key)}
            disabled={count === 0}
            title={
              cell
                ? `${humanise(stage)} · ${humanise(bucket)} days\n${count} application${count === 1 ? '' : 's'} · ${formatCurrency(cell.value)}${
                    cell.reasons.length ? `\n${cell.reasons.join(', ')}` : ''
                  }`
                : `${humanise(stage)} · ${humanise(bucket)} days\nNo applications`
            }
            aria-label={`${humanise(stage)}, ${humanise(bucket)} days: ${count} applications`}
            className={[
              'h-12 rounded-xl text-sm font-semibold tabular-nums transition-all duration-200',
              count > 0 ? 'cursor-pointer hover:scale-[1.04]' : 'cursor-default',
              isSelected ? 'ring-2 ring-offset-1' : '',
            ].join(' ')}
            style={{
              backgroundColor: count > 0 ? rampColor(w, heat) : 'var(--rm-input)',
              color: count > 0 ? 'var(--rm-text)' : 'var(--rm-text-muted)',
              ...(isSelected
                ? { '--tw-ring-color': 'var(--rm-accent)', '--tw-ring-offset-color': 'var(--rm-card)' } as React.CSSProperties
                : {}),
            }}
          >
            {count > 0 ? count : '–'}
          </button>
        );
      })}
    </>
  );
}
