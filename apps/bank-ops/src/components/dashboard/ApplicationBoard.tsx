'use client';

import { useState } from 'react';
import Link from 'next/link';
import { compactCurrency, formatCurrency } from '@/lib/format';
import { statusTone } from '@/lib/statusTone';
import {
  BoardCell,
  ColumnKey,
  humanise,
  nextActionLabel,
  riskOf,
  toBoard,
} from '@/lib/application-buckets';
import type { WorklistItem } from '@/services/api/dashboard-service';

/* The board an RM actually scans: every live application, in the column its status
   puts it in, ordered by how much of its SLA window is left.

   It is a view over the queue, not a second source — the cards come from the same
   `WorklistItem[]` the table below renders, so a column count and the table's rows
   can never disagree. The queue stays a table (an RM scans amounts and SLA by
   column, not by dragging cards), and the pipeline stepper remains on the admin
   dashboard; this replaces only the RM's copy of it. */

const PER_COLUMN = 4;

const SEGMENTS = [
  { value: 'ALL', label: 'All customer segments' },
  { value: 'BUSINESS', label: 'Business customers' },
  { value: 'INDIVIDUAL', label: 'Individual customers' },
];

const TIER_DOT: Record<string, string> = {
  high: 'var(--rm-down)',
  medium: 'var(--rm-warn)',
  low: 'var(--rm-up)',
};

function initials(name: string): string {
  const parts = (name || '').split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * How long the row has been idle, against the window its status is given.
 *
 * `elapsed > limit` with no recorded overrun does happen: the view's breach CASE for
 * an issued offer also requires `decision_made_at`, which is NULL on most rows. Those
 * say "idle, window N" instead of "N of M", which would read as if it still fitted.
 */
function waitingLine(item: WorklistItem): { text: string; tone: string } | null {
  const risk = riskOf(item);
  if (!risk) return null;
  const days = `${risk.elapsed} day${risk.elapsed === 1 ? '' : 's'}`;
  if (risk.over > 0) {
    return {
      text: `${risk.over} day${risk.over === 1 ? '' : 's'} past its ${risk.limit ?? 'SLA'}-day window`,
      tone: 'var(--rm-down)',
    };
  }
  if (risk.limit === null) return { text: `${days} idle`, tone: 'var(--rm-text-muted)' };
  if (risk.elapsed > risk.limit) {
    return { text: `${days} idle · ${risk.limit}-day window`, tone: 'var(--rm-warn)' };
  }
  return {
    text: `${risk.elapsed} of ${risk.limit} days idle`,
    tone: risk.tier === 'medium' ? 'var(--rm-warn)' : 'var(--rm-text-muted)',
  };
}

interface Props {
  items: WorklistItem[];
  loading: boolean;
  selectedColumn: ColumnKey | null;
  onColumnSelect: (column: ColumnKey | null) => void;
  segment: string;
  onSegmentChange: (segment: string) => void;
  /** True when the queue request hit its row limit and the board is a page of the book. */
  capped: boolean;
}

export default function ApplicationBoard({
  items,
  loading,
  selectedColumn,
  onColumnSelect,
  segment,
  onSegmentChange,
  capped,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // `items` arrives already scoped by segment and timeframe from the page, which
  // owns those filters so the cards, the action band and the queue all agree.
  const cells: BoardCell[] = toBoard(items);
  /* Counted from the columns, not from `items`, because the board drops closed
     applications — the sub-line has to describe the cards it is standing over. */
  const onBoard = cells.reduce((s, c) => s + c.items.length, 0);
  const onBoardValue = cells.reduce((s, c) => s + c.value, 0);

  return (
    <section className="rm-panel">
      <header className="rm-panel-head flex-wrap">
        <div className="min-w-0">
          <h2 className="rm-title">Lending application pipeline</h2>
          <p className="rm-sub">
            {onBoard > 0 ? (
              <>
                <span className="num">{onBoard}</span> application{onBoard === 1 ? '' : 's'} on the board,{' '}
                <span className="num">{compactCurrency(onBoardValue)}</span> requested, across{' '}
                <span className="num">{cells.length}</span> stages
              </>
            ) : (
              'No live applications in view'
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            value={segment}
            onChange={e => onSegmentChange(e.target.value)}
            aria-label="Filter applications by customer segment"
            className="rounded-full px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
          >
            {SEGMENTS.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {selectedColumn && (
            <button
              type="button"
              onClick={() => onColumnSelect(null)}
              className="rounded-full px-3.5 py-2 text-sm font-medium"
              style={{ backgroundColor: 'var(--rm-brand-soft)', color: 'var(--rm-brand-on-soft)' }}
            >
              All stages
            </button>
          )}
        </div>
      </header>

      <div className="rm-body">
        {cells.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {loading ? 'Loading your pipeline…' : 'Nothing is moving through the pipeline right now.'}
          </p>
        ) : (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {cells.map(cell => {
              const open = Boolean(expanded[cell.column]);
              const cards = open ? cell.items : cell.items.slice(0, PER_COLUMN);
              const hidden = cell.items.length - cards.length;
              const active = selectedColumn === cell.column;
              const head =
                cell.column === 'done'
                  ? 'color-mix(in srgb, var(--rm-up) 12%, transparent)'
                  : `color-mix(in srgb, var(--rm-brand) ${Math.round(cell.tint * 100)}%, transparent)`;

              return (
                <div key={cell.column} className="min-w-[208px] flex-1 basis-0">
                  <button
                    type="button"
                    onClick={() => onColumnSelect(active ? null : cell.column)}
                    aria-pressed={active}
                    className="w-full rounded-2xl p-3.5 text-left transition-transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor: head,
                      boxShadow: active ? 'inset 0 0 0 2px var(--rm-brand)' : 'none',
                    }}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                        {cell.label}
                      </span>
                      <span className="num shrink-0 text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                        {cell.items.length}
                      </span>
                    </span>
                    <span className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {cell.hint}
                      </span>
                      <span className="num shrink-0 text-xs" style={{ color: 'var(--rm-text-secondary)' }}>
                        {compactCurrency(cell.value)}
                      </span>
                    </span>
                  </button>

                  <div className="mt-3 space-y-2.5">
                    {cards.map(item => (
                      <BoardCard key={item.applicationId} item={item} />
                    ))}
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(e => ({ ...e, [cell.column]: true }))}
                        className="w-full rounded-xl py-2 text-sm font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--rm-card)',
                          color: 'var(--rm-accent)',
                          boxShadow: 'inset 0 0 0 1px var(--rm-hairline)',
                        }}
                      >
                        +{hidden} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cells.length > 0 && (
        <footer className="rm-foot">
          {selectedColumn
            ? 'One stage in view — the queue below is filtered the same way. '
            : 'Ordered by days left in each status’s window. Click a column to filter the queue below. '}
          {capped && (
            <>
              The queue returns its {items.length} most urgent applications, so a column&apos;s cards are the top of
              that stage, not all of it.{' '}
            </>
          )}
          <Link
            href="/dashboard/applications"
            className="font-medium hover:underline"
            style={{ color: 'var(--rm-accent)' }}
          >
            All applications
          </Link>
        </footer>
      )}
    </section>
  );
}

function BoardCard({ item }: { item: WorklistItem }) {
  const tone = statusTone(item.status);
  const risk = riskOf(item);
  const wait = waitingLine(item);
  const settled = risk === null;
  const action = nextActionLabel(item);

  return (
    <Link
      href={`/dashboard/applications/${item.applicationId}`}
      className="block rounded-2xl p-3.5 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
      style={{
        backgroundColor: 'var(--rm-card)',
        boxShadow: 'inset 0 0 0 1px var(--rm-hairline)',
        '--tw-ring-color': 'var(--rm-accent)',
      } as React.CSSProperties}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#7f2b7b,#b155ac)' }}
          aria-hidden="true"
        >
          {initials(item.customerName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--rm-text)' }} title={item.customerName}>
            {item.customerName || '—'}
          </p>
          <p className="num text-xs" style={{ color: 'var(--rm-text-secondary)' }}>
            {formatCurrency(item.requestedAmount)}
            <span style={{ color: 'var(--rm-text-muted)' }}> · {item.productName || humanise(item.status)}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
          style={{ backgroundColor: tone.bg, color: tone.text }}
        >
          <span className="w-1.5 h-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone.dot }} />
          <span className="truncate">{humanise(item.status)}</span>
        </span>
        {risk && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            title={`${risk.tier} priority`}
            style={{ backgroundColor: TIER_DOT[risk.tier] }}
          />
        )}
      </div>

      {wait ? (
        <p className="mt-2 truncate text-xs" style={{ color: wait.tone }} title={wait.text}>
          {wait.text}
        </p>
      ) : null}
      {!settled && (
        <p
          className="num mt-1.5 flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--rm-accent)' }}
        >
          <span aria-hidden="true">→</span> {action}
        </p>
      )}
    </Link>
  );
}
