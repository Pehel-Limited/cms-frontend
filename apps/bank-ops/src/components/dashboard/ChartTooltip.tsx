'use client';

import type { TooltipContentProps } from 'recharts';
import { getCurrencySymbol } from '@/lib/format';

/**
 * Theme-safe recharts tooltip. Colours come from the --rm-* surface tokens so the
 * same chart reads correctly in both light and dark mode.
 *
 * recharts v3 requires the injected props on an element passed to `content`, so
 * use the render-function form: <Tooltip content={p => <ChartTooltip {...p} />} />
 */
export default function ChartTooltip({
  active,
  payload,
  label,
  currency = false,
  currencyKeys,
  suffix = '',
  labelSuffix = '',
}: Partial<TooltipContentProps> & {
  currency?: boolean;
  /** dataKeys formatted as currency when the tooltip mixes counts and money */
  currencyKeys?: string[];
  suffix?: string;
  labelSuffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const fmt = (v: unknown, dataKey?: unknown) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isNaN(n)) return String(v ?? '—');
    const asCurrency = currency || (currencyKeys?.includes(String(dataKey)) ?? false);
    if (asCurrency) return compactCurrency(n);
    return `${n.toLocaleString()}${suffix}`;
  };

  return (
    <div
      className="rounded-xl px-3 py-2 shadow-lg"
      style={{
        backgroundColor: 'var(--rm-card)',
        border: '1px solid var(--rm-border)',
      }}
    >
      {label !== undefined && label !== null && label !== '' && (
        <p
          className="text-[11px] font-semibold mb-1.5 pb-1.5"
          style={{ color: 'var(--rm-text)', borderBottom: '1px solid var(--rm-border)' }}
        >
          {label}
          {labelSuffix}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={`${entry.dataKey ?? i}`} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color ?? 'var(--rm-accent)' }}
            />
            <span style={{ color: 'var(--rm-text-muted)' }}>{entry.name}</span>
            <span className="ml-auto font-bold tabular-nums pl-3" style={{ color: 'var(--rm-text)' }}>
              {fmt(entry.value, entry.dataKey)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Compact currency for axis/tooltip use — 1.2M rather than 1,200,000.
   Symbol comes from the bank's configured currency, not a hardcoded literal. */
export function compactCurrency(value: number): string {
  const symbol = getCurrencySymbol();
  const compact = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
  return `${symbol}${compact}`;
}
