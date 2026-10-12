'use client';

/* Five-up metric row, matching the reference's KPI band.

   The reference draws a sparkline in every card. This backend only has one real
   time series — the weekly trend buckets — so putting a chart under "At risk" or
   "Booked this month" would mean inventing its history. Instead each card carries
   a visual derived from data that actually exists: the pipeline stage split, the
   submitted→booked conversion, the at-risk share of the action queue, and a true
   dot matrix only where weekly counts exist. */

export type KpiTone = 'accent' | 'amber' | 'red' | 'green' | 'violet';

/* Tokens, never literal hues: these tiles sit on glass that flips with the theme,
   and a hardcoded #0284c7 reads as a different product in the dark one. */
const TONE: Record<KpiTone, { bg: string; fg: string }> = {
  accent: { bg: 'var(--rm-brand-soft)', fg: 'var(--rm-brand-on-soft)' },
  amber: { bg: 'var(--rm-warn-soft)', fg: 'var(--rm-warn)' },
  red: { bg: 'var(--rm-accent-muted)', fg: 'var(--rm-down)' },
  green: { bg: 'var(--rm-accent-muted)', fg: 'var(--rm-up)' },
  violet: { bg: 'var(--rm-brand-soft)', fg: 'var(--rm-brand-strong)' },
};

export interface KpiCard {
  key: string;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  icon: React.ReactNode;
  tone: KpiTone;
  /** Signed change against a real prior window. Omit when there is no prior. */
  delta?: { pct: number; label: string; upIsGood?: boolean } | null;
  /** A visual built only from data that exists — Sparkline, StageBar, ShareBar. */
  visual?: React.ReactNode;
}

export function Delta({
  pct,
  label,
  upIsGood = true,
}: {
  pct: number;
  label: string;
  upIsGood?: boolean;
}) {
  const flat = Math.abs(pct) < 0.05;
  const up = pct >= 0;
  const favourable = flat ? null : up === upIsGood;
  const color = flat ? 'var(--rm-text-muted)' : favourable ? 'var(--rm-up)' : 'var(--rm-down)';
  return (
    <span
      className="num inline-flex items-center gap-1 text-xs font-semibold"
      style={{ color }}
      title={label}
    >
      <svg width="8" height="7" viewBox="0 0 8 7" fill="currentColor" aria-hidden="true">
        {up ? <path d="M4 0l4 7H0z" /> : <path d="M4 7L0 0h8z" />}
      </svg>
      <span className="sr-only">{flat ? 'No change' : up ? 'Up' : 'Down'}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Proportional segments over the real pipeline stages — a composition, not a trend. */
export function StageBar({
  segments,
}: {
  segments: { label: string; value: number; color: string; opacity?: number }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  return (
    <div className="flex h-2 w-24 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
      {segments
        .filter(s => s.value > 0)
        .map(s => (
          <span
            key={s.label}
            style={{
              flexGrow: s.value,
              flexBasis: 0,
              backgroundColor: s.color,
              opacity: s.opacity ?? 1,
            }}
          />
        ))}
    </div>
  );
}

/** A single ratio against a stated whole. */
export function ShareBar({ pct, color = 'var(--rm-accent)' }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="h-2 w-24 overflow-hidden rounded-full"
      style={{ backgroundColor: 'var(--rm-hairline-strong)' }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
}

export default function KpiRow({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(c => {
        const tone = TONE[c.tone];
        return (
          <div key={c.key} className="rm-panel flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: tone.bg, color: tone.fg }}
                aria-hidden="true"
              >
                {c.icon}
              </span>
              <div className="min-w-0">
                <p className="rm-strip-label !text-sm leading-tight">{c.label}</p>
                <p className="rm-strip-value !text-[24px]">{c.value}</p>
              </div>
            </div>

            {(c.delta || c.note) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
                {c.delta && c.delta.pct !== null && (
                  <Delta pct={c.delta.pct} label={c.delta.label} upIsGood={c.delta.upIsGood ?? true} />
                )}
                {c.note && (
                  <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    {c.note}
                  </span>
                )}
              </div>
            )}

            {c.visual && <div className="mt-3 flex justify-end">{c.visual}</div>}
          </div>
        );
      })}
    </div>
  );
}
