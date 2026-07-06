'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CARDS, getAccount, type PaymentCard } from '@/lib/banking-data';
import { BankCard } from '@/components/banking/BankCard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n);
}

const CARD_TRANSACTIONS: Record<string, { merchant: string; glyph: string; amount: number; dir: 'IN' | 'OUT'; date: string; category: string }[]> = {
  'card-1': [
    { merchant: 'Amazon.co.uk', glyph: '📦', amount: 58.99, dir: 'OUT', date: '24 May 2025', category: 'Shopping' },
    { merchant: 'Tesco Stores', glyph: '🛒', amount: 74.31, dir: 'OUT', date: '23 May 2025', category: 'Groceries' },
    { merchant: 'Uber Technologies', glyph: '🚗', amount: 18.40, dir: 'OUT', date: '23 May 2025', category: 'Transport' },
    { merchant: 'Pret A Manger', glyph: '☕', amount: 11.83, dir: 'OUT', date: '22 May 2025', category: 'Dining Out' },
  ],
};

const CARD_CONTROLS = [
  { id: 'online', label: 'Online payments', desc: 'Allow card to be used for online purchases', enabled: true },
  { id: 'contactless', label: 'Contactless payments', desc: 'Tap to pay at terminals', enabled: true },
  { id: 'international', label: 'International use', desc: 'Use card abroad', enabled: false },
  { id: 'atm', label: 'ATM withdrawals', desc: 'Withdraw cash from ATMs', enabled: true },
];

export default function CardsPage() {
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [controls, setControls] = useState(Object.fromEntries(CARD_CONTROLS.map(c => [c.id, c.enabled])));
  const [frozen, setFrozen] = useState(false);

  const card = CARDS[activeCardIdx];
  const account = card ? getAccount(card.linkedAccountId) : null;
  const txns = CARD_TRANSACTIONS[card?.id] ?? CARD_TRANSACTIONS['card-1'] ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Cards</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage your debit and credit cards.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#7f2b7b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5e1f5b]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Apply for card
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Left: card list */}
        <div className="xl:col-span-2 space-y-4">
          {/* Card switcher */}
          <div className="space-y-3">
            {CARDS.map((c, i) => {
              const acc = getAccount(c.linkedAccountId);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCardIdx(i)}
                  className="w-full text-left rounded-2xl p-4 transition-all"
                  style={{
                    backgroundColor: activeCardIdx === i ? 'rgba(127,43,123,0.08)' : 'var(--surface-card)',
                    border: `1px solid ${activeCardIdx === i ? '#7f2b7b' : 'var(--surface-border)'}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-14 h-9 rounded-lg overflow-hidden shadow" style={{ background: c.gradient }}>
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-5 h-3 rounded border-2 border-white/60" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>•••• {c.last4}</p>
                    </div>
                    {activeCardIdx === i && (
                      <svg className="h-5 w-5 text-[#7f2b7b] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {acc && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      {acc.name} · Balance: {fmt(acc.balance)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Full card render */}
          {card && (
            <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
              <div className="mx-auto w-full max-w-[340px]">
                <BankCard card={card} />
              </div>
              <div className="mx-auto mt-4 grid w-full max-w-[340px] grid-cols-3 gap-2">
                {[
                  { label: frozen ? 'Unfreeze' : 'Freeze', icon: '❄️', action: () => setFrozen(v => !v), danger: false },
                  { label: 'PIN', icon: '🔐', action: () => {}, danger: false },
                  { label: 'Report lost', icon: '🚫', action: () => {}, danger: true },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: 'var(--surface-input)',
                      color: btn.danger ? '#ef4444' : 'var(--text-secondary)',
                      border: btn.danger ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--surface-border)',
                    }}
                  >
                    <span className="text-base">{btn.icon}</span>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: controls + transactions */}
        <div className="xl:col-span-3 space-y-4">
          {/* Card controls */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Card controls</h2>
            {frozen && (
              <div className="mb-4 rounded-xl p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Card is frozen. All transactions are blocked.</p>
              </div>
            )}
            <div className="space-y-3">
              {CARD_CONTROLS.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.desc}</p>
                  </div>
                  <button
                    onClick={() => setControls(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                    className={`relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 ${controls[c.id] && !frozen ? 'bg-[#7f2b7b]' : 'bg-slate-200 dark:bg-white/20'}`}
                    aria-checked={controls[c.id]}
                    role="switch"
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${controls[c.id] && !frozen ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Spending limits */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Spending limits</h2>
              <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">Edit limits</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Daily limit', value: fmt(3000), used: fmt(752.48), pct: 25 },
                { label: 'Monthly limit', value: fmt(10000), used: fmt(1257.68), pct: 13 },
              ].map(lim => (
                <div key={lim.label} className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-input)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{lim.label}</p>
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{lim.value}</p>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-border)' }}>
                    <div className="h-full rounded-full bg-[#7f2b7b]" style={{ width: `${lim.pct}%` }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Used: {lim.used} ({lim.pct}%)</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent card transactions */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent card transactions</h2>
              <Link href="/portal/transactions" className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">View all →</Link>
            </div>
            <div>
              {txns.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ backgroundColor: 'var(--surface-input)' }}>
                    {t.glyph}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.merchant}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.category} · {t.date}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>−{fmt(t.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
