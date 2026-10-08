'use client';

/* Dot-matrix charts.
 *
 * These replace the line and area charts the RM dashboard was drawn with. The
 * decision is deliberate: a series of weekly application counts is a sequence of
 * discrete totals, not a continuous quantity, and joining it with a line implies
 * interpolation between weeks that never happened. Columns of dots state each
 * week as its own fact, and because a dot's opacity is fixed by the ROW it sits
 * in, magnitude reads twice over — by height and by weight — which is what lets
 * these survive at 34px tall where a sparkline turns to noise.
 *
 * Colour goes through `style`, never a presentation attribute: SVG attributes do
 * not resolve CSS custom properties, so `stroke="var(--rm-brand)"` renders
 * nothing and the chart silently disappears in one of the two themes.
 */

interface Dot {
  x: number;
  y: number;
  o: number;
  /** Overrides the grid's own colour — used to tint each series differently. */
  color?: string;
}

/**
 * Fill one column from the baseline. Floored at a single dot for any non-zero
 * value: on a skewed series a peak week can make a small week round to nothing,
 * and an empty-looking column would claim zero when the truth was "not many".
 */
function column(
  value: number,
  max: number,
  rows: number,
  pitch: number,
  height: number,
  x0: number,
  wide: number,
  color?: string
): Dot[] {
  const filled = value > 0 ? Math.max(1, Math.round((value / max) * rows)) : 0;
  const out: Dot[] = [];
  for (let r = 0; r < filled; r += 1) {
    const o = 0.18 + 0.82 * (r / Math.max(1, rows - 1));
    const y = height - (r + 0.5) * pitch;
    for (let k = 0; k < wide; k += 1) {
      out.push({ x: x0 + (k + 0.5) * pitch, y, o, color });
    }
  }
  return out;
}

function Grid({
  dots,
  pitch,
  width,
  height,
  color,
  label,
  stretch,
  className,
  hits,
}: {
  dots: Dot[];
  pitch: number;
  width: number;
  height: number;
  color: string;
  label: string;
  stretch?: boolean;
  className?: string;
  hits?: { x: number; width: number; title: string }[];
}) {
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
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={pitch * 0.3}
          style={{ fill: d.color ?? color, fillOpacity: d.o }}
        />
      ))}
      {hits?.map((h, i) => (
        <rect key={`hit-${i}`} x={h.x} y={0} width={h.width} height={height} fill="transparent">
          <title>{h.title}</title>
        </rect>
      ))}
    </svg>
  );
}

export function DotMatrix({
  data,
  cell = 4,
  rows = 10,
  box,
  max,
  stretch = false,
  color = 'var(--rm-brand)',
  label,
  className,
  format,
}: {
  data: number[];
  /** Dot pitch in px. Two dots wide per data point. */
  cell?: number;
  rows?: number;
  /** Solve the pitch to fit this box instead of naming one. */
  box?: { width: number; height: number };
  /**
   * Share a scale across several matrices so their columns compare honestly.
   * Defaults to this series' own maximum.
   */
  max?: number;
  /** Fill the parent, scaling uniformly so dots stay circular. */
  stretch?: boolean;
  color?: string;
  label: string;
  className?: string;
  format?: (value: number, index: number) => string;
}) {
  if (!data.length) return null;

  const pitch = box ? Math.max(2, Math.min(8, Math.round(box.width / (data.length * 2)))) : cell;
  const gridRows = box ? Math.max(3, Math.min(12, Math.round(box.height / pitch))) : rows;
  const scale = max && max > 0 ? max : Math.max(...data, 0);
  const width = data.length * pitch * 2;
  const height = gridRows * pitch;

  if (scale <= 0) return null;

  const dots = data.flatMap((value, c) =>
    column(value, scale, gridRows, pitch, height, c * pitch * 2, 2)
  );

  return (
    <Grid
      dots={dots}
      pitch={pitch}
      width={width}
      height={height}
      color={color}
      label={label}
      stretch={stretch}
      className={className}
      hits={
        format
          ? data.map((value, c) => ({
              x: c * pitch * 2,
              width: pitch * 2,
              title: format(value, c),
            }))
          : undefined
      }
    />
  );
}

/**
 * Grouped dot columns: one slot per bucket, one column inside it per series.
 * All series share `max`, so a taller column really does mean more.
 */
export function DotGroups({
  series,
  labels,
  rows = 8,
  cell = 4,
  max,
  stretch = false,
  label,
  className,
  format,
}: {
  series: { name: string; values: number[]; color: string }[];
  /** Text under each slot, e.g. the week start. */
  labels?: string[];
  rows?: number;
  cell?: number;
  max?: number;
  /** Fill the parent, scaling uniformly so dots stay circular. */
  stretch?: boolean;
  label: string;
  className?: string;
  format?: (seriesName: string, value: number, bucketIndex: number) => string;
}) {
  if (!series.length || !series[0].values.length) return null;

  const buckets = series[0].values.length;
  const slot = series.length * cell * 2 + cell * 2;
  const width = buckets * slot - cell * 2;
  const height = rows * cell;
  const scale = max && max > 0 ? max : Math.max(...series.flatMap(s => s.values), 0);
  if (scale <= 0) return null;

  const dots: Dot[] = [];
  const hits: { x: number; width: number; title: string }[] = [];

  for (let b = 0; b < buckets; b += 1) {
    const slotX = b * slot;
    series.forEach((s, si) => {
      const x0 = slotX + si * cell * 2;
      dots.push(...column(s.values[b] ?? 0, scale, rows, cell, height, x0, 2, s.color));
    });
    if (format) {
      hits.push({
        x: slotX,
        width: series.length * cell * 2,
        title: series.map(s => format(s.name, s.values[b] ?? 0, b)).join('\n'),
      });
    }
  }

  return (
    <div className={className}>
      <Grid
        dots={dots}
        pitch={cell}
        width={width}
        height={height}
        color="var(--rm-brand)"
        label={label}
        stretch={stretch}
        hits={hits.length ? hits : undefined}
      />
      {labels && (
        <div className="relative mt-2 h-4" aria-hidden="true">
          {labels.map((text, b) => (
            <span
              key={`${text}-${b}`}
              className="num absolute -translate-x-1/2 text-[10px] whitespace-nowrap"
              /* Percentages, so the labels keep tracking their slot when the grid
                 is stretched to fill its panel. */
              style={{
                left: `${((b * slot + series.length * cell) / width) * 100}%`,
                color: 'var(--rm-text-muted)',
              }}
            >
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A ring of evenly-spaced dots partitioned by share. Every dot takes the same
 * angle, so proportion reads from arc length rather than dot size — and because
 * the segments are painted with a plum ramp, a four-way split stays legible
 * without borrowing four unrelated hues.
 */
export function DottedRing({
  segments,
  size = 176,
  dots = 76,
  color = 'var(--rm-brand)',
  label,
  children,
}: {
  segments: { value: number; opacity: number }[];
  size?: number;
  dots?: number;
  color?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  const r = size / 2 - 9;
  const cx = size / 2;
  const cy = size / 2;

  let acc = 0;
  const bounds = segments.map(s => {
    acc += s.value / total;
    return { end: acc, opacity: s.opacity };
  });

  const marks = Array.from({ length: dots }, (_, k) => {
    const share = (k + 0.5) / dots;
    const angle = share * Math.PI * 2 - Math.PI / 2;
    const seg = bounds.find(b => share < b.end) ?? bounds[bounds.length - 1];
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), o: seg.opacity };
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {marks.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={2.6} style={{ fill: color, fillOpacity: m.o }} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/** Opacity for the nth of n segments — a plum ramp, not a rainbow. */
export function rampTone(index: number, count: number): number {
  if (count <= 1) return 1;
  return Number((1 - (index / count) * 0.72).toFixed(3));
}
