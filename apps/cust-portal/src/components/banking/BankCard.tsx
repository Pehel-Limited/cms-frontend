'use client';

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
