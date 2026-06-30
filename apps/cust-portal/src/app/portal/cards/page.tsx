'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CARDS, getAccount, type PaymentCard } from '@/lib/banking-data';
import { BankCard } from '@/components/banking/BankCard';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/* small toggle */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-[#7f2b7b]' : 'bg-slate-200'}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

function ControlRow({
  label,
  desc,
  on,
  onChange,
  icon,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export default function CardsPage() {
  const [cards, setCards] = useState<PaymentCard[]>(CARDS);
  const [activeId, setActiveId] = useState<string>(CARDS[0].id);
  const active = cards.find(c => c.id === activeId)!;

  const update = (id: string, patch: Partial<PaymentCard>) =>
    setCards(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));

  const linkedAccount = getAccount(active.linkedAccountId);
  const utilization =
    active.type === 'CREDIT' && active.creditLimit
      ? Math.min(100, ((active.creditUsed ?? 0) / active.creditLimit) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cards</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your debit and credit cards.</p>
        </div>
        <button className="inline-flex items-center gap-2 self-start rounded-xl bg-[#7f2b7b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5e1f5b]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Order a card
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* card carousel */}
        <div className="space-y-4 lg:col-span-2">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => setActiveId(card.id)}
              className={`block w-full max-w-[360px] rounded-2xl text-left transition-all ${
                activeId === card.id ? 'scale-100 ring-2 ring-[#7f2b7b] ring-offset-2' : 'scale-[0.97] opacity-80 hover:opacity-100'
              }`}
            >
              <BankCard card={card} />
            </button>
          ))}
        </div>

        {/* details + controls */}
        <div className="space-y-6 lg:col-span-3">
          {/* summary */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{active.label}</p>
                <p className="text-xs text-slate-400">
                  {active.scheme} {active.type.toLowerCase()} · {linkedAccount?.name}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${active.frozen ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {active.frozen ? 'Frozen' : 'Active'}
              </span>
            </div>

            {active.type === 'CREDIT' ? (
              <div className="mt-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Balance owed</p>
                    <p className="text-2xl font-bold text-slate-900">{fmt(active.creditUsed ?? 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Limit</p>
                    <p className="text-sm font-semibold text-slate-700">{fmt(active.creditLimit ?? 0)}</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${utilization > 75 ? 'bg-red-500' : utilization > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${utilization}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{Math.round(utilization)}% used</span>
                  <span>{fmt((active.creditLimit ?? 0) - (active.creditUsed ?? 0))} available</span>
                </div>
                <div className="mt-4 flex gap-3">
                  <button className="flex-1 rounded-xl bg-[#7f2b7b] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5e1f5b]">
                    Pay balance
                  </button>
                  <button className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-[#7f2b7b] hover:text-[#7f2b7b]">
                    View statement
                  </button>
                </div>
                <p className="mt-3 text-center text-[11px] text-slate-400">Representative APR {active.apr}% (variable)</p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Spent this month</p>
                  <p className="text-xl font-bold text-slate-900">{fmt(active.spentThisMonth ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Linked balance</p>
                  <p className="text-xl font-bold text-slate-900">{fmt(linkedAccount?.balance ?? 0)}</p>
                </div>
              </div>
            )}
          </div>

          {/* freeze + controls */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-50 to-purple-50/50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#7f2b7b] shadow-sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Freeze card</p>
                  <p className="text-xs text-slate-400">Instantly block all spending</p>
                </div>
              </div>
              <Toggle on={active.frozen} onChange={v => update(active.id, { frozen: v })} />
            </div>

            <div className="mt-2 divide-y divide-slate-50">
              <ControlRow
                label="Contactless payments"
                desc="Tap to pay in store"
                on={active.contactless}
                onChange={v => update(active.id, { contactless: v })}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" d="M8.5 8.5a5 5 0 010 7M11.5 6a8 8 0 010 12M5.5 11a2 2 0 010 2" />
                  </svg>
                }
              />
              <ControlRow
                label="Online payments"
                desc="Use card on the web"
                on={active.online}
                onChange={v => update(active.id, { online: v })}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
                  </svg>
                }
              />
            </div>

            {/* quick links */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'View PIN', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
                { label: 'Add to wallet', icon: 'M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m0 0a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 9' },
                { label: 'Report lost', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
              ].map(q => (
                <button key={q.label} className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-3 text-center transition-colors hover:border-[#7f2b7b]/30 hover:bg-purple-50/40">
                  <svg className="h-5 w-5 text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={q.icon} />
                  </svg>
                  <span className="text-[11px] font-medium text-slate-600">{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Card controls are a UI preview.{' '}
        <Link href="/portal/transactions" className="font-semibold text-[#7f2b7b] hover:underline">
          View card transactions →
        </Link>
      </p>
    </div>
  );
}
