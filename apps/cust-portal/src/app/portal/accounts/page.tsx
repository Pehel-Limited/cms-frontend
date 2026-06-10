'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ACCOUNTS, totalBalanceGBP, type BankAccount } from '@/lib/banking-data';
import { Sparkline } from '@/components/banking/BankCard';

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const TYPE_LABEL: Record<BankAccount['type'], string> = {
  CURRENT: 'Current account',
  SAVINGS: 'Savings account',
  JOINT: 'Joint account',
  VAULT: 'Vault',
};

export default function AccountsPage() {
  const [hide, setHide] = useState(false);
  const total = useMemo(() => totalBalanceGBP(), []);
  const mask = (s: string) => (hide ? '••••••' : s);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">All your money in one place.</p>
        </div>
        <button className="inline-flex items-center gap-2 self-start rounded-xl bg-[#7f2b7b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5e1f5b] sm:self-auto">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Open new account
        </button>
      </div>

      {/* total banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b] p-6 text-white shadow-xl md:p-8">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-purple-200/70">Combined balance (GBP)</p>
            <p className="mt-1 text-3xl font-bold md:text-4xl">{mask(fmt(total, 'GBP'))}</p>
            <p className="mt-2 text-sm text-purple-200/80">{ACCOUNTS.length} accounts · updated just now</p>
          </div>
          <button
            onClick={() => setHide(v => !v)}
            className="rounded-xl bg-white/10 p-2.5 text-purple-100 transition-colors hover:bg-white/20"
            aria-label="Toggle balance"
          >
            {hide ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* account cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {ACCOUNTS.map(acc => (
          <Link
            key={acc.id}
            href={`/portal/accounts/${acc.id}`}
            className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative p-5 text-white" style={{ background: acc.gradient }}>
              <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-lg" />
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl backdrop-blur">
                    {acc.glyph}
                  </span>
                  <div>
                    <p className="font-semibold">{acc.name}</p>
                    <p className="text-xs text-white/70">{TYPE_LABEL[acc.type]}</p>
                  </div>
                </div>
                {acc.primary && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                    Primary
                  </span>
                )}
              </div>
              <div className="relative z-10 mt-5 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Available</p>
                  <p className="text-2xl font-bold">{mask(fmt(acc.balance, acc.currency))}</p>
                </div>
                <Sparkline data={acc.spark} width={90} height={32} strokeWidth={2} />
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 text-xs text-slate-500">
              <span className="font-mono">{acc.sortCode} · {acc.accountNumber}</span>
              <span className="flex items-center gap-1 font-semibold text-[#7f2b7b] transition-colors group-hover:text-[#5e1f5b]">
                Details
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
