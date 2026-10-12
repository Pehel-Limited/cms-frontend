'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import type { AgingHeatmapCell } from '@/services/api/dashboard-service';

/* SCREAMING_SNAKE stage / reason → Title Case (used for breach reasons only —
   stage and bucket labels get the quieter sentence case below). */
function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* Small labels read as shouting in mixed caps, so stages stay sentence-cased. */
function sentenceCase(s: string): string {
  const words = s.toLowerCase().replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* Canonical funnel order — unknown stages sort to the end, then alphabetically.
   Only used to break ties between stages holding the same number of cases. */
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

/* Compact column header: strip the noise, keep the range. */
function bucketLabel(bucket: string): string {
  const s = bucket.toUpperCase();
  const nums = s.match(/\d+/g);
  if (!nums) return sentenceCase(bucket);
  if (s.includes('OVER') || s.includes('+') || nums.length === 1) return `${nums[0]}+`;
  return `${nums[0]}-${nums[1]}`;
}

/* Always render the full aging spectrum so empty (young/old) columns still show
   as "0" instead of the grid silently collapsing to only the buckets with data. */
const CANONICAL_BUCKETS = ['0-2', '3-7', '8-14', '15-30', '30+'];

/* Rows are capped so the heatmap sits level with a 6-row table next to it. The
   stages past the cap are counted and named, never dropped from the totals. */
const MAX_VISIBLE_STAGES = 6;

/* Colour follows bucket age (calm → hot) and alpha follows application count, so
   a cell that is both old and crowded is the one that shouts. Older really is
   worse here, which is why the ramp ends on the sentiment red rather than an
   arbitrary hot hue.

   `color-mix` rather than hex arithmetic so the stops can stay theme tokens —
   the previous version parsed #rrggbb, which cannot read `var(--rm-brand)` and
   so pinned the light palette into dark mode. */
const RAMP = ['var(--rm-brand)', 'var(--rm-warn)', 'var(--rm-down)'];

function rampColor(ageWeight: number, heat: number): string {
  const idx = Math.min(RAMP.length - 1, Math.floor(ageWeight * RAMP.length));
  const pct = Math.round((0.1 + heat * 0.78) * 100);
  return `color-mix(in srgb, ${RAMP[idx]} ${pct}%, transparent)`;
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
  /** Fired when a cell is selected/deselected (bucket null = cleared). Omit to keep static. */
  onCellClick?: (stage: string, bucket: string | null) => void;
}

export default function AgingHeatmap({ cells, onCellClick }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const {
    buckets,
    grid,
    maxCount,
    stageTotals,
    bucketTotals,
    visibleStages,
    hiddenStages,
    hiddenApplications,
    totalAged,
  } = useMemo(() => {
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

    const bucketSet = [
      ...new Set([...CANONICAL_BUCKETS, ...[...merged.values()].map(c => c.bucket)]),
    ].sort((a, b) => {
      const d = bucketRank(a) - bucketRank(b);
      return d !== 0 ? d : a.localeCompare(b, undefined, { numeric: true });
    });

    const stageTotals = new Map<string, number>();
    const bucketTotals = new Map<string, number>();
    let totalAged = 0;
    for (const c of merged.values()) {
      stageTotals.set(c.stage, (stageTotals.get(c.stage) ?? 0) + c.count);
      bucketTotals.set(c.bucket, (bucketTotals.get(c.bucket) ?? 0) + c.count);
      totalAged += c.count;
    }

    /* Busiest stages first — a terminal stage with one deal left in it is not
       worth a row above the ones actually holding the book. */
    const rankedStages = [...stageTotals.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => {
        const d = b[1] - a[1];
        if (d !== 0) return d;
        const r = stageRank(a[0]) - stageRank(b[0]);
        return r !== 0 ? r : a[0].localeCompare(b[0]);
      })
      .map(([stage]) => stage);

    const visibleStages = rankedStages.slice(0, MAX_VISIBLE_STAGES);
    const hiddenStages = rankedStages.slice(MAX_VISIBLE_STAGES);
    const hiddenApplications = hiddenStages.reduce((s, st) => s + (stageTotals.get(st) ?? 0), 0);

    /* Intensity is relative to what is actually rendered, so the ramp still
       spreads across the visible rows. */
    const visible = new Set(visibleStages);
    let max = 0;
    for (const c of merged.values()) {
      if (visible.has(c.stage) && c.count > max) max = c.count;
    }

    return {
      buckets: bucketSet,
      grid: merged,
      maxCount: max,
      stageTotals,
      bucketTotals,
      visibleStages,
      hiddenStages,
      hiddenApplications,
      totalAged,
    };
  }, [cells]);

  if (visibleStages.length === 0 || buckets.length === 0) return null;

  const lastBucketIdx = buckets.length - 1;
  const selectedCell = selected ? grid.get(selected) : null;

  return (
    <section className="rm-panel flex h-full flex-col">
      {/* header */}
      <div className="rm-panel-head">
        <div className="min-w-0">
          <h2 className="rm-title">Aging</h2>
          <p className="rm-sub">
            <span className="num">{totalAged}</span> applications, aged from the last write. This is the
            aging view&apos;s own set, so it can differ from the board above
          </p>
        </div>

        {/* legend */}
        <div className="flex shrink-0 items-center gap-1.5 pt-1">
          <span className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>
            Newer
          </span>
          <span className="flex h-1.5 w-14 overflow-hidden rounded-full">
            {RAMP.map((stop, i) => (
              <span key={stop} className="flex-1" style={{ backgroundColor: stop, opacity: 0.35 + i * 0.3 }} />
            ))}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>
            Older
          </span>
        </div>
      </div>

      {/* matrix */}
      <div className="rm-body flex-1">
        <div className="overflow-x-auto no-scrollbar">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `minmax(84px,0.9fr) repeat(${buckets.length}, minmax(0,1fr))`,
            }}
          >
            {/* column headers */}
            <div />
            {buckets.map(b => (
              <div key={b} className="pb-1 text-center">
                <p className="num text-[11px] font-medium leading-tight" style={{ color: 'var(--rm-text-secondary)' }}>
                  {bucketLabel(b)}
                </p>
                <p className="num text-[10px] leading-tight" style={{ color: 'var(--rm-text-muted)' }}>
                  {bucketTotals.get(b) ?? 0}
                </p>
              </div>
            ))}

            {/* rows */}
            {visibleStages.map((stage, rowIndex) => (
              <StageRow
                key={stage}
                stage={stage}
                rowIndex={rowIndex}
                buckets={buckets}
                lastBucketIdx={lastBucketIdx}
                maxCount={maxCount}
                grid={grid}
                stageTotal={stageTotals.get(stage) ?? 0}
                selected={selected}
                onSelect={setSelected}
                onCellClick={onCellClick}
              />
            ))}
          </div>
        </div>

        {/* the cap is stated, not hidden */}
        {hiddenStages.length > 0 && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>
            <span className="num">+{hiddenStages.length}</span> more stage
            {hiddenStages.length === 1 ? '' : 's'} ·{' '}
            <span className="num">{hiddenApplications}</span> application
            {hiddenApplications === 1 ? '' : 's'} past the cut
          </p>
        )}
      </div>

      {/* detail / footer */}
      <div
        className="rm-rule mt-auto flex items-center justify-between gap-3 px-6 py-3 sm:px-7"
      >
        {selectedCell ? (
          <p className="min-w-0 truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
            <span style={{ color: 'var(--rm-text-secondary)' }}>
              {sentenceCase(selectedCell.stage)} · <span className="num">{bucketLabel(selectedCell.bucket)}</span> days
            </span>
            {' · '}
            <span className="num">{selectedCell.count}</span> application
            {selectedCell.count === 1 ? '' : 's'}
            {' · '}
            <span className="num">{formatCurrency(selectedCell.value)}</span>
            {selectedCell.reasons.length > 0 && ` · ${selectedCell.reasons.join(', ')}`}
          </p>
        ) : (
          <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
            Select a cell to filter by stage and age
          </p>
        )}
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="shrink-0 text-xs font-medium hover:underline"
          style={{ color: 'var(--rm-accent)' }}
        >
          Open applications
        </button>
      </div>
    </section>
  );
}

function StageRow({
  stage,
  rowIndex,
  buckets,
  lastBucketIdx,
  maxCount,
  grid,
  stageTotal,
  selected,
  onSelect,
  onCellClick,
}: {
  stage: string;
  rowIndex: number;
  buckets: string[];
  lastBucketIdx: number;
  maxCount: number;
  grid: Map<string, MergedCell>;
  stageTotal: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onCellClick?: (stage: string, bucket: string | null) => void;
}) {
  return (
    <>
      <div className="flex h-6 items-center justify-between gap-1.5 pr-1">
        <span
          className="truncate text-xs leading-none"
          style={{ color: 'var(--rm-text-secondary)' }}
          title={sentenceCase(stage)}
        >
          {sentenceCase(stage)}
        </span>
        <span
          className="num shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold leading-none"
          style={{ backgroundColor: 'rgba(127,127,127,0.14)', color: 'var(--rm-text-muted)' }}
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
            onClick={() => {
              onSelect(isSelected ? null : key);
              onCellClick?.(stage, isSelected ? null : bucket);
            }}
            disabled={count === 0}
            title={
              cell
                ? `${sentenceCase(stage)} · ${bucketLabel(bucket)} days\n${count} application${count === 1 ? '' : 's'} · ${formatCurrency(cell.value)}${
                    cell.reasons.length ? `\n${cell.reasons.join(', ')}` : ''
                  }`
                : `${sentenceCase(stage)} · ${bucketLabel(bucket)} days\nNo applications`
            }
            aria-label={`${sentenceCase(stage)}, ${bucketLabel(bucket)} days: ${count} applications`}
            className={[
              'num grid h-6 place-items-center rounded-md text-xs font-semibold transition-all duration-200 animate-fade-in',
              count > 0 ? 'cursor-pointer hover:scale-[1.06]' : 'cursor-default',
            ].join(' ')}
            style={{
              /* Zero keeps its digit and a hairline so the grid still reads as a
                 grid — an em dash or an empty block loses the column shape. */
              backgroundColor: count > 0 ? rampColor(w, heat) : 'var(--rm-hairline)',
              boxShadow: isSelected
                ? '0 0 0 2px var(--rm-accent)'
                : count === 0
                  ? 'inset 0 0 0 1px var(--rm-hairline-strong)'
                  : 'none',
              color: count > 0 ? 'var(--rm-text)' : 'var(--rm-text-muted)',
              animationDelay: `${(rowIndex * buckets.length + i) * 14}ms`,
            }}
          >
            {count}
          </button>
        );
      })}
    </>
  );
}
