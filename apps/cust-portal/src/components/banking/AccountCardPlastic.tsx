'use client';

/* The plastic, drawn from the card record the bank actually holds. */
export interface CardFace {
  /** The customer's own name for the card, or the account it spends from. */
  label: string;
  holder: string;
  last4: string;
  scheme: string;
  /** MM/YY, as printed on the card. */
  expiry: string;
  gradient: string;
  frozen?: boolean;
  /** Reported lost or stolen, or cancelled: it cannot be spent with again. */
  blocked?: boolean;
}

export function AccountCardPlastic({
  face,
  className = '',
}: {
  face: CardFace;
  className?: string;
}) {
  const unusable = face.frozen || face.blocked;
  return (
    <div
      className={`card-art relative overflow-hidden rounded-2xl p-5 text-white ${className}`}
      style={{ background: face.gradient }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-black/10 blur-lg" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/70">Rayva</p>
            <p className="truncate text-sm font-semibold">{face.label}</p>
          </div>
          <span className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">
            Debit
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-7 w-9 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-400/80 shadow-inner">
            <div className="m-1 h-5 w-7 rounded-sm border border-yellow-600/30" />
          </div>
          <svg className="h-5 w-5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" d="M8.5 8.5a5 5 0 010 7M11.5 6a8 8 0 010 12M5.5 11a2 2 0 010 2" />
          </svg>
        </div>

        <div>
          <p className="font-mono text-base tracking-[0.2em] text-white/95">
            •••• •••• •••• {face.last4 || '••••'}
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-white/60">Card holder</p>
              <p className="truncate text-xs font-medium">{face.holder}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/60">Expires</p>
              <p className="text-xs font-medium">{face.expiry}</p>
            </div>
            <span className="shrink-0 text-sm font-extrabold italic tracking-tight text-white/95">
              {face.scheme === 'MASTERCARD' ? 'MC' : face.scheme}
            </span>
          </div>
        </div>
      </div>

      {unusable && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px]">
          <span className="flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-slate-700">
            {face.blocked ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
              </svg>
            )}
            {face.blocked ? 'Blocked' : 'Frozen'}
          </span>
        </div>
      )}
    </div>
  );
}

/* The same face at list-thumbnail size. */
export function MiniCardPlastic({ face }: { face: CardFace }) {
  return (
    <span aria-hidden="true" className="mini-plastic" style={{ background: face.gradient }}>
      <span className="mini-plastic-word">Rayva</span>
      <span className="mini-plastic-chip" />
      <span className="mini-plastic-scheme">{face.scheme === 'MASTERCARD' ? 'MC' : face.scheme}</span>
    </span>
  );
}
