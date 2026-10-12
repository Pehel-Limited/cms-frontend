'use client';

import { PaymentCard } from '@/lib/banking-data';
import { getCurrencySymbol } from '@/lib/format';

/* ──────────────────────────────────────────────────────────────────
 * DotMatrix — a series drawn as a matrix of dots
 *
 * Each value becomes a column of dots stacked from the baseline, two dots wide.
 * A dot's opacity is fixed by the ROW it sits in and shared across every column,
 * so a small value is a short, uniformly pale stack while the peak climbs into
 * the dark rows. That reads magnitude twice over — by height and by weight —
 * which is why it survives at 30px tall where a line chart turns to noise.
 * Zero draws nothing rather than a stub, so an empty period stays empty.
 *
 * The chart is always its natural size: `cell` × `rows` × the number of points.
 * Stretching a dot grid to fill a box turns the dots into ellipses, so callers
 * pick a pitch that suits the space instead.
 * ────────────────────────────────────────────────────────────────── */

export function DotMatrix({
  data,
  cell = 4,
  rows = 10,
  box,
  stretch = false,
  color = 'var(--brand)',
  label,
  className,
  format,
}: {
  data: number[];
  /** Dot pitch in px. Two dots wide per data point, one per row. */
  cell?: number;
  rows?: number;
  /**
   * Fit to a box instead of naming a pitch: the pitch is solved so the grid is
   * as close to `box` as square cells allow. Use this when several matrices sit
   * side by side carrying different point counts and need to line up.
   */
  box?: { width: number; height: number };
  /**
   * Fill the parent's width, scaling the whole grid uniformly so dots stay
   * circular. Pair it with a wrapper sized to `data.length * cell * 2` when
   * other elements — axis labels, markers — are positioned in percentages of
   * that same box and have to keep lining up as the chart shrinks.
   */
  stretch?: boolean;
  color?: string;
  /** Announced to screen readers in place of the picture. */
  label: string;
  className?: string;
  /** Turns a raw value into the hover text for its column. */
  format?: (value: number, index: number) => string;
}) {
  if (!data.length) return null;

  const pitch = box
    ? Math.max(2, Math.min(8, Math.round(box.width / (data.length * 2))))
    : cell;
  const gridRows = box ? Math.max(3, Math.min(12, Math.round(box.height / pitch))) : rows;

  const max = Math.max(...data);
  const width = data.length * pitch * 2;
  const height = gridRows * pitch;
  const radius = pitch * 0.3;

  const dots: { x: number; y: number; o: number }[] = [];
  if (max > 0) {
    data.forEach((value, c) => {
      /* Rounded to whole rows, but floored at one for any non-zero value: on a
         skewed series a €410 flight makes a €5.60 rail fare round to nothing,
         and an empty-looking column would claim a day with no spending. */
      const filled = value > 0 ? Math.max(1, Math.round((value / max) * gridRows)) : 0;
      for (let r = 0; r < filled; r += 1) {
        // Bottom row stays pale, top row lands near full strength.
        const o = 0.18 + 0.82 * (r / Math.max(1, gridRows - 1));
        const y = height - (r + 0.5) * pitch;
        dots.push({ x: (c * 2 + 0.5) * pitch, y, o });
        dots.push({ x: (c * 2 + 1.5) * pitch, y, o });
      }
    });
  }

  return (
    <svg
      width={stretch ? '100%' : width}
      height={stretch ? undefined : height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={stretch ? { display: 'block' } : undefined}
      role="img"
      aria-label={label}
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={radius} style={{ fill: color, fillOpacity: d.o }} />
      ))}
      {format &&
        data.map((value, c) => (
          <rect key={`hit-${c}`} x={c * 2 * pitch} y={0} width={pitch * 2} height={height} fill="transparent">
            <title>{format(value, c)}</title>
          </rect>
        ))}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * SchemeMark — Visa / Mastercard logo glyph
 * ────────────────────────────────────────────────────────────────── */

export function SchemeMark({ scheme }: { scheme: 'VISA' | 'MASTERCARD' }) {
  if (scheme === 'MASTERCARD') {
    return (
      <div className="flex items-center -space-x-2">
        <span className="w-6 h-6 rounded-full bg-[#eb001b]" />
        <span className="w-6 h-6 rounded-full bg-[#f79e1b] mix-blend-screen" />
      </div>
    );
  }
  return <span className="text-white font-extrabold italic tracking-tight text-lg">VISA</span>;
}

/* ──────────────────────────────────────────────────────────────────
 * BankCard — the photoreal plastic card art
 * ────────────────────────────────────────────────────────────────── */

export function BankCard({
  card,
  className = '',
  showBalance,
}: {
  card: PaymentCard;
  className?: string;
  showBalance?: string;
}) {
  return (
    <div
      className={`relative aspect-[1.586] w-full rounded-2xl p-5 text-white shadow-xl overflow-hidden ${card.frozen ? 'opacity-95' : ''} ${className}`}
      style={{ background: card.gradient }}
    >
      {/* sheen + texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-black/10 blur-lg" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/70">Rayva</p>
            <p className="text-sm font-semibold">{card.label}</p>
          </div>
          <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">
            {card.type}
          </span>
        </div>

        {/* chip + contactless */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-9 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-400/80 shadow-inner">
            <div className="m-1 h-5 w-7 rounded-sm border border-yellow-600/30" />
          </div>
          {card.contactless && (
            <svg className="h-5 w-5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M8.5 8.5a5 5 0 010 7M11.5 6a8 8 0 010 12M5.5 11a2 2 0 010 2" />
            </svg>
          )}
        </div>

        <div>
          <p className="font-mono text-base tracking-[0.2em] text-white/95">
            •••• •••• •••• {card.last4}
          </p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-white/60">Card holder</p>
              <p className="text-xs font-medium">{card.holder}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/60">Expires</p>
              <p className="text-xs font-medium">{card.expiry}</p>
            </div>
            <SchemeMark scheme={card.scheme} />
          </div>
        </div>
      </div>

      {/* frozen overlay */}
      {card.frozen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px]">
          <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
            </svg>
            Frozen
          </span>
        </div>
      )}

      {showBalance && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-right">
          <p className="text-[9px] uppercase tracking-wider text-white/60">Balance</p>
          <p className="text-lg font-bold">{showBalance}</p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * BalanceAmount — big bold figure with superscript cents (fintech hero)
 * ────────────────────────────────────────────────────────────────── */

export function BalanceAmount({
  amount,
  currency,
  className = '',
  centsClassName = '',
  symbolClassName = '',
  hidden = false,
}: {
  amount: number;
  currency?: string;
  className?: string;
  centsClassName?: string;
  symbolClassName?: string;
  hidden?: boolean;
}) {
  const symbol = getCurrencySymbol(currency);
  const whole = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - whole) * 100)
    .toString()
    .padStart(2, '0');
  const grouped = whole.toLocaleString();

  if (hidden) {
    return (
      <span className={`tabular-nums tracking-tight ${className}`}>
        <span className={symbolClassName}>{symbol}</span>
        ••••••
      </span>
    );
  }

  return (
    <span className={`tabular-nums tracking-tight ${className}`}>
      <span className={`align-top ${symbolClassName}`}>{symbol}</span>
      {grouped}
      <span className={`align-top ${centsClassName}`}>.{cents}</span>
    </span>
  );
}
