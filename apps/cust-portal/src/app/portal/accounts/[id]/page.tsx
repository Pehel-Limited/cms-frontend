'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import {
  getAccount,
  transactionsForAccount,
  groupTransactionsByDay,
  CARDS,
  type Transaction,
} from '@/lib/banking-data';
import { Sparkline, BankCard } from '@/components/banking/BankCard';

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const ACTIONS = [
  { label: 'Send', icon: 'M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6' },
  { label: 'Add money', icon: 'M12 4.5v15m7.5-7.5h-15' },
  { label: 'Request', icon: 'M7.5 7.5l9 9m0-9v9h-9' },
  { label: 'Statements', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
];

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const account = getAccount(params.id);
  const [query, setQuery] = useState('');

  const txns = useMemo(
    () => (account ? transactionsForAccount(account.id) : []),
    [account]
  );
  const linkedCards = useMemo(
    () => (account ? CARDS.filter(c => c.linkedAccountId === account.id) : []),
    [account]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return txns;
    const q = query.toLowerCase();
    return txns.filter(t => t.merchant.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [txns, query]);

  const grouped = useMemo(() => groupTransactionsByDay(filtered), [filtered]);

  if (!account) return notFound();

  const inflow = txns.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amount, 0);
  const outflow = txns.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <Link href="/portal/accounts" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All accounts
      </Link>

      {/* hero */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-8"
        style={{ background: account.gradient }}
      >
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">
              {account.glyph}
            </span>
            <div>
              <p className="text-lg font-semibold">{account.name}</p>
              <p className="font-mono text-xs text-white/70">{account.sortCode} · {account.accountNumber}</p>
            </div>
          </div>
          <p className="mt-6 text-[11px] uppercase tracking-widest text-white/60">Available balance</p>
          <p className="text-4xl font-bold md:text-5xl">{fmt(account.balance, account.currency)}</p>
          <div className="mt-3 max-w-xs">
            <Sparkline data={account.spark} width={280} height={44} strokeWidth={2} />
          </div>

          {/* actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            {ACTIONS.map(a => (
              <button
                key={a.label}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={a.icon} />
                </svg>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Money in (30d)', value: fmt(inflow, account.currency), accent: 'text-emerald-600' },
          { label: 'Money out (30d)', value: fmt(outflow, account.currency), accent: 'text-slate-900' },
          { label: 'IBAN', value: account.iban, accent: 'text-slate-900', mono: true, small: true },
          { label: 'Currency', value: account.currency, accent: 'text-slate-900' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`mt-1 font-bold ${s.accent} ${s.small ? 'text-xs' : 'text-lg'} ${s.mono ? 'font-mono break-all' : ''}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* transactions */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 px-6 pb-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold text-slate-900">Transactions</h3>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-xl border-0 bg-slate-100 py-2 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:bg-white focus:ring-2 focus:ring-[#7f2b7b] sm:w-56"
                />
              </div>
            </div>

            {grouped.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-400">No transactions found</div>
            ) : (
              grouped.map(group => (
                <div key={group.label}>
                  <p className="bg-slate-50/60 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </p>
                  <div className="divide-y divide-slate-50">
                    {group.items.map((t: Transaction) => (
                      <div key={t.id} className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/60">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg">
                          {t.glyph}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{t.merchant}</p>
                          <p className="text-xs text-slate-400">
                            {txTime(t.date)} · {t.category}
                            {t.note ? ` · ${t.note}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${t.direction === 'IN' ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount, account.currency)}
                          </p>
                          {t.status === 'PENDING' && (
                            <span className="text-[10px] font-semibold text-amber-600">Pending</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* sidebar: linked cards + details */}
        <div className="space-y-6">
          {linkedCards.length > 0 && (
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-premium">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Linked cards</h3>
              <div className="space-y-4">
                {linkedCards.map(card => (
                  <Link key={card.id} href="/portal/cards" className="mx-auto block max-w-[320px] transition-transform hover:-translate-y-0.5">
                    <BankCard card={card} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">Account details</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Account name', account.name],
                ['Sort code', account.sortCode],
                ['Account number', account.accountNumber],
                ['IBAN', account.iban],
                ['Currency', account.currency],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="text-right font-medium text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            <button className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-[#7f2b7b] hover:text-[#7f2b7b]">
              Share account details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
