'use client';

import { PaymentCard } from '@/lib/banking-data';

/* ──────────────────────────────────────────────────────────────────
 * Sparkline — pure SVG mini line chart with gradient fill
 * ────────────────────────────────────────────────────────────────── */

export function Sparkline({
  data,
  color = '#ffffff',
  width = 120,
  height = 36,
  strokeWidth = 2,
  fill = true,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gid = `spark-${Math.round(data[0])}-${data.length}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
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
