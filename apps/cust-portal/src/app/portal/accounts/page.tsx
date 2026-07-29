'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ACCOUNTS,
  TRANSACTIONS,
  totalBalanceEUR,
  savingsGoal,
  type BankAccount,
  type Transaction,
} from '@/lib/banking-data';
import { Sparkline, BalanceAmount } from '@/components/banking/BankCard';

function fmt(n: number, cur = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
}

const TYPE_LABEL: Record<BankAccount['type'], string> = {
  CURRENT: 'Current account',
  SAVINGS: 'Savings account',
  JOINT: 'Joint account',
  VAULT: 'Vault',
};

const SAVINGS_GOALS = [
  { name: 'Winter Holiday', icon: '🏖️', saved: 2400, target: 4000, color: '#7f2b7b' },
  { name: 'New Car', icon: '🚗', saved: 7850, target: 15000, color: '#ae3fa9' },
  { name: 'Home Renovation', icon: '🏠', saved: 3260, target: 10000, color: '#ec4899' },
];

const LINKED_ACCOUNTS = [
  { name: 'PayPal', sub: 'sarah.mitchell@email.com', balance: 2143.75, icon: '💳' },
  { name: 'Monzo Bank', sub: '04-00-04  |  98765432', balance: 1246.34, icon: '🏦' },
  { name: 'Interactive Investor', sub: 'GIA  |  12X45678', balance: 18732.10, icon: '📈' },
];

export default function AccountsPage() {
  const [hide, setHide] = useState(false);
  const [selectedId, setSelectedId] = useState(ACCOUNTS[0].id);
  const total = useMemo(() => totalBalanceEUR(), []);

  const selected = ACCOUNTS.find(a => a.id === selectedId) ?? ACCOUNTS[0];
  const recentTxns = useMemo(
    () =>
      TRANSACTIONS.filter(t => t.accountId === selectedId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [selectedId]
  );

  function txDateShort(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }).toUpperCase();
  }

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>My Accounts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Last login: Today, 07:32 AM</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#7f2b7b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5e1f5b]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Open new account
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total deposits',
            value: fmt(total),
            sub: <span className="text-emerald-500 font-semibold text-xs">▲ €2,735.40 (1.96%) vs last month</span>,
          },
          {
            label: 'Available cash',
            value: fmt(ACCOUNTS.reduce((s, a) => a.type !== 'VAULT' ? s + a.balance : s, 0)),
            sub: <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Across all current accounts</span>,
          },
          {
            label: 'Linked accounts',
            value: '5',
            sub: <span className="text-xs" style={{ color: 'var(--text-muted)' }}>3 external · 2 internal</span>,
          },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{hide ? '••••••' : stat.value}</p>
            <div className="mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">

        {/* Left: account list */}
        <div className="xl:col-span-2 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your accounts</h2>
            <button
              onClick={() => setHide(v => !v)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-input)' }}
              aria-label="Toggle balance"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                {hide
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                  : <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </>
                }
              </svg>
            </button>
          </div>

          <div className="divide-y" style={{ '--tw-divide-color': 'var(--surface-border)' } as React.CSSProperties}>
            {ACCOUNTS.map(acc => {
              const isSelected = acc.id === selectedId;
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedId(acc.id)}
                  className="w-full text-left px-5 py-4 transition-all duration-200 relative"
                  style={{
                    backgroundColor: isSelected ? 'rgba(127,43,123,0.08)' : undefined,
                    borderLeft: isSelected ? '3px solid #7f2b7b' : '3px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-lg shadow"
                      style={{ background: acc.gradient }}
                    >
                      {acc.glyph}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{acc.name}</p>
                        <p className={`text-sm font-bold ml-2 shrink-0 ${acc.type === 'VAULT' ? 'text-amber-500' : ''}`}
                          style={acc.type !== 'VAULT' ? { color: 'var(--text-primary)' } : undefined}>
                          {hide ? '••••' : fmt(acc.balance, acc.currency)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                          {acc.sortCode} | {acc.accountNumber}
                        </p>
                        <div className="ml-2 shrink-0">
                          <Sparkline data={acc.spark} width={60} height={18} strokeWidth={1.5} fill={false} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {acc.spark && acc.spark[acc.spark.length - 1] > acc.spark[0] && (
                    <span className="absolute top-2 right-3 text-[9px] font-bold text-emerald-500">▲ {((acc.spark[acc.spark.length-1] - acc.spark[0]) / acc.spark[0] * 100).toFixed(2)}%</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <button
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ color: 'var(--text-secondary)', border: '1px dashed var(--surface-border)' }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add account
            </button>
          </div>
        </div>

        {/* Right: account detail */}
        <div className="xl:col-span-3 space-y-4">
          {/* Account header */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-lg" style={{ background: selected.gradient }}>
                  {selected.glyph}
                </span>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h2>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {selected.sortCode} | {selected.accountNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#7f2b7b] hover:bg-[#6b2468] transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  Move money
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v1a3 3 0 003 3h0a3 3 0 003-3v-1m-6 0h6M9 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2h-2m-6 0v-4a1 1 0 011-1h4a1 1 0 011 1v4" />
                  </svg>
                  View statement
                </button>
                <button className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent account activity</h3>
              <Link href="/portal/transactions" className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">View all →</Link>
            </div>
            <div className="divide-y" style={{ '--tw-divide-color': 'var(--surface-border)' } as React.CSSProperties}>
              {recentTxns.length > 0 ? recentTxns.map((t: Transaction) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                  <div className="flex flex-col items-center w-8 shrink-0">
                    <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                      {txDateShort(t.date).split(' ')[1]}
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {txDateShort(t.date).split(' ')[0]}
                    </span>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm" style={{ backgroundColor: 'var(--surface-input)' }}>
                    {t.glyph}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.merchant}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.category}</p>
                  </div>
                  <p className={`text-sm font-bold shrink-0 ${t.direction === 'IN' ? 'text-emerald-500' : ''}`}
                    style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}>
                    {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount)}
                  </p>
                </div>
              )) : (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No transactions for this account yet
                </div>
              )}
            </div>
          </div>

          {/* Savings goals + Linked accounts side by side */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Savings goals */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Savings goals</h3>
                <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View all →</button>
              </div>
              <div className="space-y-4">
                {SAVINGS_GOALS.map(g => {
                  const pct = Math.round((g.saved / g.target) * 100);
                  return (
                    <div key={g.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{g.icon}</span>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{g.name}</span>
                        </div>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-input)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {fmt(g.saved)} of {fmt(g.target)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <button className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold transition-colors" style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-muted)' }}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create a new goal
              </button>
            </div>

            {/* Linked accounts */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Linked &amp; external</h3>
                <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">Manage →</button>
              </div>
              <div className="space-y-3">
                {LINKED_ACCOUNTS.map(la => (
                  <div key={la.name} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ backgroundColor: 'var(--surface-input)' }}>
                      {la.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{la.name}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{la.sub}</p>
                    </div>
                    <p className="text-xs font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>{fmt(la.balance)}</p>
                  </div>
                ))}
              </div>
              <button className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold transition-colors" style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-muted)' }}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Link an external account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FSCS notice */}
      <div className="flex items-center gap-2 text-xs py-3 px-4 rounded-xl" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
        <svg className="h-4 w-4 shrink-0 text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        Your deposits are protected by the Financial Services Compensation Scheme (FSCS).
      </div>
    </div>
  );
}
