'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ACCOUNTS,
  BENEFICIARIES,
  SCHEDULED_PAYMENTS,
  type Beneficiary,
} from '@/lib/banking-data';

function fmt(n: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function nextDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const TABS = ['Send', 'Scheduled', 'Payees'] as const;
type Tab = (typeof TABS)[number];

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('Send');
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState(ACCOUNTS[0].id);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const account = ACCOUNTS.find(a => a.id === fromAccount)!;
  const numericAmount = parseFloat(amount || '0');
  const canSend = selected && numericAmount > 0 && numericAmount <= account.balance;

  const handleSend = () => {
    if (!canSend) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setSelected(null);
      setAmount('');
      setNote('');
    }, 2200);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">Send money, manage payees and scheduled transfers.</p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === t ? 'bg-white text-[#7f2b7b] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ─── SEND ─── */}
      {tab === 'Send' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* compose */}
          <div className="space-y-5 lg:col-span-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-900">Pay someone</p>

              {/* recipient picker */}
              <div className="mb-5 flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                {BENEFICIARIES.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelected(b)}
                    className="flex flex-shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white shadow transition-all ${
                        selected?.id === b.id ? 'ring-2 ring-[#7f2b7b] ring-offset-2' : ''
                      }`}
                      style={{ background: b.gradient }}
                    >
                      {b.glyph}
                    </span>
                    <span className="w-12 truncate text-center text-[10px] text-slate-500">{b.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {/* amount */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/40 p-6 text-center">
                <p className="text-xs text-slate-400">
                  {selected ? `Sending to ${selected.name}` : 'Select a recipient'}
                </p>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <span className="text-3xl font-bold text-slate-300">£</span>
                  <input
                    value={amount}
                    onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="w-40 border-0 bg-transparent text-center text-4xl font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-0"
                  />
                </div>
                {numericAmount > account.balance && (
                  <p className="mt-2 text-xs font-semibold text-red-500">Insufficient balance</p>
                )}
              </div>

              {/* from account */}
              <div className="mt-5">
                <label className="text-xs font-medium text-slate-500">From account</label>
                <div className="mt-2 space-y-2">
                  {ACCOUNTS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setFromAccount(a.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        fromAccount === a.id ? 'border-[#7f2b7b] bg-purple-50/40' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                      style={{ background: a.gradient }}
                    >
                        {a.glyph}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.accountNumber}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{fmt(a.balance, a.currency)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* note */}
              <div className="mt-5">
                <label className="text-xs font-medium text-slate-500">Reference (optional)</label>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="What's it for?"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[#7f2b7b] focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={!canSend || sent}
                className={`mt-5 w-full rounded-xl py-3 text-sm font-bold text-white transition-all ${
                  canSend && !sent ? 'bg-[#7f2b7b] hover:bg-[#5e1f5b]' : 'cursor-not-allowed bg-slate-300'
                }`}
              >
                {sent ? '✓ Payment sent' : selected ? `Send ${amount ? fmt(numericAmount) : ''} to ${selected.name.split(' ')[0]}` : 'Send money'}
              </button>
            </div>
          </div>

          {/* summary side */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Transfer summary</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Recipient</dt>
                  <dd className="font-medium text-slate-700">{selected?.name || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Amount</dt>
                  <dd className="font-medium text-slate-700">{numericAmount > 0 ? fmt(numericAmount) : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Fee</dt>
                  <dd className="font-medium text-emerald-600">Free</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Arrives</dt>
                  <dd className="font-medium text-slate-700">Instantly</dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-3">
                  <dt className="font-semibold text-slate-900">Total</dt>
                  <dd className="font-bold text-slate-900">{numericAmount > 0 ? fmt(numericAmount) : '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b] p-5 text-white shadow-lg">
              <svg className="h-7 w-7 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-3 text-sm font-semibold">Bank-grade protection</p>
              <p className="mt-1 text-xs text-purple-200/80">
                Every payment is secured with biometric approval and real-time fraud monitoring.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── SCHEDULED ─── */}
      {tab === 'Scheduled' && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 pb-3 pt-5">
            <h3 className="text-base font-semibold text-slate-900">Upcoming payments</h3>
            <span className="text-xs text-slate-400">{SCHEDULED_PAYMENTS.length} active</span>
          </div>
          <div className="divide-y divide-slate-50">
            {SCHEDULED_PAYMENTS.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/60">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg">
                  {s.glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{s.payee}</p>
                  <p className="text-xs text-slate-400">{s.frequency} · Next {nextDateLabel(s.nextDate)}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{fmt(s.amount, s.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── PAYEES ─── */}
      {tab === 'Payees' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-5 text-sm font-semibold text-slate-500 transition-colors hover:border-[#7f2b7b] hover:text-[#7f2b7b]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add new payee
          </button>
          {BENEFICIARIES.map(b => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <span
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow`}
                style={{ background: b.gradient }}
              >
                {b.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{b.name}</p>
                <p className="text-xs text-slate-400">{b.handle}</p>
              </div>
              <button
                onClick={() => {
                  setSelected(b);
                  setTab('Send');
                }}
                className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-[#7f2b7b] transition-colors hover:bg-purple-100"
              >
                Pay
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
