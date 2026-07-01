'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ACCOUNTS,
  BENEFICIARIES,
  SCHEDULED_PAYMENTS,
  TRANSACTIONS,
  type Beneficiary,
} from '@/lib/banking-data';

function fmt(n: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}
function nextDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const TABS = ['Transfer between accounts', 'Pay someone new', 'Saved payees', 'Scheduled'] as const;
type Tab = (typeof TABS)[number];

const PAYMENT_STATUSES = [
  { date: '24 May 2025, 09:32', payee: 'Sarah Thompson', desc: 'Rent payment', from: 'Current Account', amount: 800, dir: 'OUT', status: 'Completed' },
  { date: '24 May 2025, 10:15', payee: 'British Gas', desc: 'Direct Debit', from: 'Savings Account', amount: 87, dir: 'OUT', status: 'Pending' },
  { date: '28 May 2025, 00:00', payee: 'Virgin Media', desc: 'Direct Debit', from: 'Current Account', amount: 62.50, dir: 'OUT', status: 'Scheduled' },
  { date: '23 May 2025, 16:45', payee: 'Andrew Williams', desc: 'Birthday gift', from: 'Current Account', amount: 50, dir: 'OUT', status: 'Completed' },
];

const STATUS_COLORS: Record<string, string> = {
  Completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  Scheduled: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('Transfer between accounts');
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState(ACCOUNTS[0].id);
  const [toAccount, setToAccount] = useState(ACCOUNTS[1]?.id ?? '');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));

  const account = ACCOUNTS.find(a => a.id === fromAccount) ?? ACCOUNTS[0];
  const numericAmount = parseFloat(amount || '0');
  const canSend = numericAmount > 0 && numericAmount <= account.balance;

  const handleSend = () => {
    if (!canSend) return;
    setSent(true);
    setTimeout(() => { setSent(false); setAmount(''); setNote(''); setSelected(null); }, 2400);
  };

  /* ─── quick recipients for the sidebar ─── */
  const quickRecipients = BENEFICIARIES.slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Payments &amp; Transfers</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Move money securely between accounts and pay your payees.</p>
      </div>

      {/* Main layout: form + sidepanel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left: form */}
        <div className="xl:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="shrink-0 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap relative"
                  style={{
                    color: tab === t ? '#7f2b7b' : 'var(--text-muted)',
                    borderBottom: tab === t ? '2px solid #7f2b7b' : '2px solid transparent',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {/* From */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>From</label>
                  <div className="relative">
                    <select
                      value={fromAccount}
                      onChange={e => setFromAccount(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                      style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                    >
                      {ACCOUNTS.map(a => (
                        <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, a.currency)}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                    {tab === 'Transfer between accounts' ? 'To (account)' : 'To'}
                  </label>
                  {tab === 'Transfer between accounts' ? (
                    <div className="relative">
                      <select
                        value={toAccount}
                        onChange={e => setToAccount(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                        style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                      >
                        {ACCOUNTS.filter(a => a.id !== fromAccount).map(a => (
                          <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, a.currency)}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  ) : (
                    <input
                      placeholder="Select account or payee"
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                      style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                    />
                  )}
                </div>
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>£</span>
                    <input
                      type="text"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="w-full rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                      style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                    />
                  </div>
                  {numericAmount > account.balance && (
                    <p className="mt-1.5 text-xs text-red-500 font-medium">Insufficient balance</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Payment date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                    style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                  />
                </div>
              </div>

              {/* Reference + Note */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Reference (optional)</label>
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Rent, Invoice #123"
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                    style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Note to recipient (optional)</label>
                  <input
                    placeholder="e.g. Thank you"
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                    style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSend}
                  disabled={!canSend || sent}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all ${canSend && !sent ? 'bg-[#7f2b7b] hover:bg-[#5e1f5b]' : 'bg-slate-300 dark:bg-white/20 cursor-not-allowed'}`}
                >
                  {sent ? '✓ Payment sent' : 'Continue'}
                </button>
                <button
                  onClick={() => { setAmount(''); setNote(''); setSelected(null); setSent(false); }}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Payment status table */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Payment status</h3>
              <div className="flex gap-1 rounded-lg p-0.5 text-xs" style={{ backgroundColor: 'var(--surface-input)' }}>
                {['All', 'Completed', 'Pending', 'Scheduled'].map(s => (
                  <button key={s} className="px-2.5 py-1 rounded-md font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}>{s}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    {['Date', 'Payee', 'Description', 'From Account', 'Amount', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PAYMENT_STATUSES.map((p, i) => (
                    <tr key={i} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{p.date}</td>
                      <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>{p.payee}</td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.desc}</td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.from}</td>
                      <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(p.amount)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button className="p-1 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Payment limits */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Payment limits</h3>
              <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View limits</button>
            </div>
            <div className="mb-3">
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Daily remaining allowance</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>£8,250<span className="text-sm font-semibold text-slate-400">.00</span></p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>of £10,000.00</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface-input)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#7f2b7b" strokeWidth="3" strokeDasharray="82 18" strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: 'var(--text-primary)' }}>82%</span>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Daily limit resets in</p>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>14h 32m</p>
              </div>
            </div>
          </div>

          {/* Quick transfers */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quick transfers</h3>
              <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View all</button>
            </div>
            <div className="space-y-2">
              {quickRecipients.map(b => (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: b.gradient }}>
                    {b.glyph}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.name}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{b.handle}</p>
                  </div>
                  <button
                    onClick={() => { setSelected(b); setTab('Pay someone new'); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#7f2b7b] dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    style={{ border: '1px solid var(--surface-border)' }}
                  >
                    Transfer
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming scheduled */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming scheduled</h3>
              <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View all</button>
            </div>
            <div className="space-y-3">
              {SCHEDULED_PAYMENTS.slice(0, 4).map(s => {
                const d = new Date(s.nextDate);
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="flex flex-col items-center w-9 shrink-0 rounded-lg py-1" style={{ backgroundColor: 'var(--surface-input)' }}>
                      <span className="text-[8px] font-bold" style={{ color: 'var(--text-muted)' }}>
                        {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                      </span>
                      <span className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {String(d.getDate()).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.payee}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.frequency}</p>
                    </div>
                    <p className="text-xs font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>{fmt(s.amount, s.currency)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security notice */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b] text-white">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-purple-200 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-xs font-bold mb-1">Fraud notice</p>
                <p className="text-[10px] text-purple-200/80 leading-relaxed">We will never ask for your password or full card details.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
