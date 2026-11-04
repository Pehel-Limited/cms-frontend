'use client';

import { BalanceAmount } from '@/components/banking/BankCard';
import Glyph, { ACCOUNT_GLYPH } from '@/components/ui/Glyph';
import type { BankAccount } from '@/lib/banking-data';

/* An account rendered as card art. These are accounts rather than cards, so the
   face carries the account name, balance and masked number. */
export function AccountPlastic({ acc, hidden }: { acc: BankAccount; hidden: boolean }) {
  return (
    <div
      className="card-art relative overflow-hidden rounded-2xl p-4 text-white"
      style={{
        background: acc.gradient,
        boxShadow: '0 16px 30px -22px rgba(28, 8, 30, 0.7)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.26),transparent_55%)]" />
      <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-black/10 blur-lg" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/90 ring-1 ring-inset ring-white/20 backdrop-blur-sm"
              aria-hidden="true"
            >
              <Glyph name={ACCOUNT_GLYPH[acc.type]} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">Rayva</p>
              <p className="truncate text-sm font-semibold leading-tight">{acc.name}</p>
            </div>
          </div>
          {acc.primary && (
            <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
              Primary
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Balance</p>
            <p className="num truncate text-xl font-semibold">
              <BalanceAmount
                amount={acc.balance}
                currency={acc.currency}
                hidden={hidden}
                symbolClassName="text-xs font-bold mr-0.5"
                centsClassName="text-xs text-white/65"
              />
            </p>
          </div>
          <p className="shrink-0 font-mono text-xs text-white/65">{acc.accountNumber}</p>
        </div>
      </div>

      {acc.type === 'SAVINGS' && (
        <span className="absolute right-4 top-1/2 h-6 w-8 -translate-y-1/2 rounded-md bg-gradient-to-br from-yellow-200/80 to-yellow-400/70" aria-hidden="true" />
      )}
    </div>
  );
}
