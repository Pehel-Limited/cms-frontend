'use client';

import { useMemo, useState } from 'react';
import { DotGroups } from '@/components/dashboard/DotMatrix';
import { compactCurrency } from '@/lib/format';
import type { TrendPoint } from '@/services/api/dashboard-service';

/** Which axis a series is measured against, and which one the toggle emphasises. */
type Axis = 'count' | 'value';
interface SeriesMeta {
  key: keyof TrendPoint;
  name: string;
  color: string;
  axis: Axis;
}

/* Brand for volume, sentiment for outcomes. Approved and declined are not two
   arbitrary categories — one is good news and one is bad — so they earn the
   up/down hues. Everything else stays in the plum ramp rather than borrowing a
   sky blue that no longer matches the rest of the product.
   `var()` works here because the dots are painted through inline `style`; SVG
   presentation attributes would silently resolve nothing. */
const COUNT_SERIES: SeriesMeta[] = [
  { key: 'submittedCount', name: 'Submitted', color: 'var(--rm-brand)', axis: 'count' },
  { key: 'approvedCount', name: 'Approved', color: 'var(--rm-up)', axis: 'count' },
  { key: 'declinedCount', name: 'Declined', color: 'var(--rm-down)', axis: 'count' },
];
/* Money gets its own series and its own scale, because a value in millions and a
   count of applications cannot share one. */
const VALUE_SERIES: SeriesMeta = {
  key: 'submittedValue',
  name: 'Requested value',
  color: 'var(--rm-brand-strong)',
  axis: 'value',
};

/** Geometry per mode: one series gets a wider, shorter grid than three, so the
    pitch is chosen to keep both roughly the same overall size. */
const GEOMETRY: Record<Axis, { cell: number; rows: number }> = {
  count: { cell: 6, rows: 13 },
  value: { cell: 13, rows: 6 },
};

function weekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* DOM swatches rather than a chart legend: they sit outside the SVG, so they can
   use theme tokens and match the dot encoding they describe. */
function LegendMark({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className="grid grid-cols-2 gap-[2px]">
      {[0.55, 1, 0.25, 0.75].map((o, i) => (
        <span key={i} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: color, opacity: o }} />
      ))}
    </span>
  );
}

interface Props {
  points: TrendPoint[];
  /** Names the book being charted, e.g. "your book" or "All RMs" */
  scopeLabel?: string;
}

export default function TrendChart({ points, scopeLabel = 'your book' }: Props) {
  const [mode, setMode] = useState<Axis>('count');

  const labels = useMemo(() => points.map(p => weekLabel(p.weekStart)), [points]);

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

  /* A window with nothing in it is not a trend — say so instead of drawing a
     row of empty columns and letting the reader infer a shape. */
  const hasSignal = totals.submitted + totals.decided > 0;

  /* The same rule for money: a run of zeros is an absent series, not a trend,
     so it is not plotted and the value toggle is not offered. */
  const hasValueSignal = points.some(p => Number(p.submittedValue ?? 0) > 0);
  const emphasis: Axis = hasValueSignal ? mode : 'count';
  const plotted = emphasis === 'value' ? [VALUE_SERIES] : COUNT_SERIES;

  /* Every series in a mode shares one maximum, so a taller column really does
     mean more — normalising each series to its own peak would make a week of 2
     decisions look as busy as a week of 40 submissions. */
  const scale = useMemo(
    () => Math.max(...plotted.flatMap(s => points.map(p => Number(p[s.key] ?? 0))), 0),
    [plotted, points]
  );

  const geometry = GEOMETRY[emphasis];

  // Below every hook: bailing out above one changes the hook count between the
  // empty render and the loaded one, which React rejects outright.
  if (points.length === 0) return null;

  return (
    <section className="rm-panel p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="rm-title">Trend</h2>
          {/* window length comes from the data, never a hardcoded twelve */}
          <p className="rm-sub">
            {points.length} week{points.length === 1 ? '' : 's'} · applications and requested value
          </p>
        </div>
        <div
          className="flex rounded-full p-1"
          style={{ backgroundColor: 'var(--rm-input)' }}
          role="group"
          aria-label="Trend metric"
        >
          {(['count', 'value'] as const).map(m => {
            const unavailable = m === 'value' && !hasValueSignal;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={unavailable}
                title={
                  unavailable ? `No requested value recorded for ${scopeLabel} in this window` : undefined
                }
                aria-pressed={emphasis === m}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-40"
                style={
                  emphasis === m
                    ? { backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }
                    : { color: 'var(--rm-text-muted)' }
                }
              >
                {m === 'count' ? 'Applications' : 'Requested value'}
              </button>
            );
          })}
        </div>
      </div>

      {hasSignal ? (
        <>
          <div className="w-full overflow-x-auto animate-fade-in">
            <DotGroups
              series={plotted.map(s => ({
                name: s.name,
                color: s.color,
                values: points.map(p => Number(p[s.key] ?? 0)),
              }))}
              labels={labels}
              cell={geometry.cell}
              rows={geometry.rows}
              max={scale}
              label={`${emphasis === 'count' ? 'Weekly' : 'Requested value'} for ${scopeLabel}, ${points.length} weeks`}
              format={(name, value, b) =>
                `${labels[b]} · ${name}: ${
                  emphasis === 'value' ? compactCurrency(value) : `${value}`
                }`
              }
            />
          </div>

          <ul
            className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
            aria-label="Charted series"
          >
            {plotted.map(s => (
              <li key={String(s.key)} className="flex items-center gap-2">
                <LegendMark color={s.color} />
                <span style={{ color: 'var(--rm-text-secondary)' }}>{s.name}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--rm-text-muted)' }}>
          No submissions or decisions recorded for {scopeLabel} in this window.
        </p>
      )}

      {hasSignal && !hasValueSignal && (
        <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          No requested value is recorded for {scopeLabel} in this window, so that series is not
          plotted — the counts above carry no value trend.
        </p>
      )}

      <div
        className="mt-5 pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
        style={{ borderTop: '1px solid var(--rm-border)', color: 'var(--rm-text-muted)' }}
      >
        <span>
          <span className="num font-semibold" style={{ color: 'var(--rm-text)' }}>
            {totals.submitted}
          </span>{' '}
          submitted
        </span>
        <span>
          <span className="num font-semibold" style={{ color: 'var(--rm-up)' }}>
            {totals.approved}
          </span>{' '}
          approved
        </span>
        <span>
          <span className="num font-semibold" style={{ color: 'var(--rm-down)' }}>
            {totals.declined}
          </span>{' '}
          declined
        </span>
        <span>
          <span className="num font-semibold" style={{ color: 'var(--rm-text)' }}>
            {hasValueSignal ? compactCurrency(totals.value) : '—'}
          </span>{' '}
          requested value
        </span>
      </div>

      <p className="mt-3 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
        Weeks keyed on submission date and decision date as recorded on each application. Decisions
        land in the week they were made, so a week can show decisions against earlier submissions.
        Each column is one week&rsquo;s own total — nothing is interpolated between them.
      </p>
    </section>
  );
}
