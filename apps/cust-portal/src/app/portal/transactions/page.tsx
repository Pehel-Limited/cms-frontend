'use client';

import { useMemo, useState } from 'react';
import {
  TRANSACTIONS,
  ACCOUNTS,
  groupTransactionsByDay,
  spendByCategory,
  monthlyInOut,
  CATEGORY_META,
  type Transaction,
  type SpendCategory,
} from '@/lib/banking-data';

function fmt(n: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

type DirFilter = 'ALL' | 'IN' | 'OUT';

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [dir, setDir] = useState<DirFilter>('ALL');
  const [accountId, setAccountId] = useState<string>('ALL');
  const [category, setCategory] = useState<SpendCategory | 'ALL'>('ALL');

  const { income, spending } = useMemo(() => monthlyInOut(), []);
  const spend = useMemo(() => spendByCategory(), []);

  const categories = useMemo(
    () => Array.from(new Set(TRANSACTIONS.map(t => t.category))) as SpendCategory[],
    []
  );

  const filtered = useMemo(() => {
    return TRANSACTIONS.filter(t => {
      if (dir !== 'ALL' && t.direction !== dir) return false;
      if (accountId !== 'ALL' && t.accountId !== accountId) return false;
      if (category !== 'ALL' && t.category !== category) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!t.merchant.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q) && !(t.note ?? '').toLowerCase().includes(q))
          return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [query, dir, accountId, category]);

  const grouped = useMemo(() => groupTransactionsByDay(filtered), [filtered]);
  const filteredTotal = filtered.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <p className="mt-1 text-sm text-slate-500">Every payment, in one searchable timeline.</p>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">Money in</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">+{fmt(income)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">Money out</p>
          <p className="mt-1 text-xl font-bold text-slate-900">−{fmt(spending)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">Net flow</p>
          <p className={`mt-1 text-xl font-bold ${income - spending >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {income - spending >= 0 ? '+' : '−'}{fmt(Math.abs(income - spending))}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">Transactions</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{TRANSACTIONS.length}</p>
        </div>
      </div>

      {/* category chips bar */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-900">Spending by category</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {spend.map(s => (
            <div key={s.category} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.category} ${Math.round(s.pct)}%`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {spend.slice(0, 6).map(s => (
            <div key={s.category} className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-slate-600">{s.category}</span>
              <span className="font-semibold text-slate-900">{fmt(s.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search merchants, notes, categories..."
            className="w-full rounded-xl border-0 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-[#7f2b7b]"
          />
        </div>

        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(['ALL', 'IN', 'OUT'] as DirFilter[]).map(d => (
            <button
              key={d}
              onClick={() => setDir(d)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                dir === d ? 'bg-white text-[#7f2b7b] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {d === 'ALL' ? 'All' : d === 'IN' ? 'In' : 'Out'}
            </button>
          ))}
        </div>

        <select
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          className="rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-700 shadow-sm ring-1 ring-slate-100 focus:ring-2 focus:ring-[#7f2b7b]"
        >
          <option value="ALL">All accounts</option>
          {ACCOUNTS.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={e => setCategory(e.target.value as SpendCategory | 'ALL')}
          className="rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-700 shadow-sm ring-1 ring-slate-100 focus:ring-2 focus:ring-[#7f2b7b]"
        >
          <option value="ALL">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* list */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-b border-slate-50 px-6 py-3 text-xs text-slate-400">
            <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            <span>Total out: <span className="font-semibold text-slate-700">{fmt(filteredTotal)}</span></span>
          </div>
        )}
        {grouped.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-2xl">🔍</div>
            <p className="text-sm text-slate-500">No transactions match your filters</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label}>
              <p className="bg-slate-50/60 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="divide-y divide-slate-50">
                {group.items.map((t: Transaction) => {
                  const meta = CATEGORY_META[t.category];
                  return (
                    <div key={t.id} className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/60">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg">
                        {t.glyph}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{t.merchant}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: `${meta.color}1a`, color: meta.color }}
                          >
                            {t.category}
                          </span>
                          <span className="text-xs text-slate-400">{txTime(t.date)}</span>
                          {t.note && <span className="truncate text-xs text-slate-400">· {t.note}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${t.direction === 'IN' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount)}
                        </p>
                        {t.status === 'PENDING' && <span className="text-[10px] font-semibold text-amber-600">Pending</span>}
                        {t.status === 'DECLINED' && <span className="text-[10px] font-semibold text-red-500">Declined</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
