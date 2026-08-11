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

function fmt(n: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}
function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function txDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

type DirFilter = 'ALL' | 'IN' | 'OUT';

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [dir, setDir] = useState<DirFilter>('ALL');
  const [accountId, setAccountId] = useState<string>('ALL');
  const [category, setCategory] = useState<SpendCategory | 'ALL'>('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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
        if (!t.merchant.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q) && !(t.note ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [query, dir, accountId, category]);

  const grouped = useMemo(() => groupTransactionsByDay(filtered), [filtered]);
  const filteredTotalOut = filtered.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0);
  const filteredTotalIn = filtered.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amount, 0);

  const topCategories = spend.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Transactions</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Every payment, in one searchable timeline.</p>
      </div>

      {/* Summary stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total inflows',
            value: fmt(income),
            change: '+12.5% vs previous 31 days',
            positive: true,
            icon: (
              <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0v5m0-5h-5" />
              </svg>
            ),
          },
          {
            label: 'Total outflows',
            value: fmt(spending),
            change: '-8.2% vs previous 31 days',
            positive: false,
            icon: (
              <svg className="h-5 w-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l6 6 4-4 8 8m0 0v-5m0 5h-5" />
              </svg>
            ),
          },
          {
            label: 'Top spending category',
            value: topCategories[0]?.category ?? '—',
            change: `${fmt(topCategories[0]?.total ?? 0)} · ${Math.round(topCategories[0]?.pct ?? 0)}% of spend`,
            positive: null,
            icon: (
              <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            ),
          },
        ].map(tile => (
          <div key={tile.label} className="rounded-2xl p-5 relative overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{tile.label}</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{tile.value}</p>
                <p className={`text-xs mt-1 font-medium ${tile.positive === true ? 'text-emerald-500' : tile.positive === false ? 'text-rose-500' : ''}`}
                  style={tile.positive === null ? { color: 'var(--text-muted)' } : undefined}>
                  {tile.change}
                </p>
              </div>
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--surface-input)' }}>
                {tile.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main layout: list + detail panel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left: filters + list */}
        <div className={`${selectedTx ? 'xl:col-span-2' : 'xl:col-span-3'} space-y-4 min-w-0`}>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
              />
            </div>

            {/* Account filter */}
            <div className="relative">
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="rounded-xl px-3 py-2.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
              >
                <option value="ALL">All accounts</option>
                {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </div>

            {/* Dir filter */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
              {(['ALL', 'IN', 'OUT'] as DirFilter[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDir(d)}
                  className="px-3 py-2 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: dir === d ? '#7f2b7b' : 'var(--surface-input)',
                    color: dir === d ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {d === 'ALL' ? 'All' : d === 'IN' ? 'Money in' : 'Money out'}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value as SpendCategory | 'ALL')}
                className="rounded-xl px-3 py-2.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
              >
                <option value="ALL">All categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </div>

            {filtered.length !== TRANSACTIONS.length && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-muted)' }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Transaction list */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            {grouped.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: 'var(--surface-input)' }}>🔍</div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No transactions match your filters</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
                    {filteredTotalIn > 0 && <span className="text-emerald-500 font-semibold">+{fmt(filteredTotalIn)}</span>}
                    {filteredTotalOut > 0 && <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>−{fmt(filteredTotalOut)}</span>}
                  </div>
                  <button className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                </div>

                {grouped.map(group => (
                  <div key={group.label}>
                    <p className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-input)' }}>
                      {group.label}
                    </p>
                    {group.items.map((t: Transaction) => {
                      const meta = CATEGORY_META[t.category];
                      const isSelected = selectedTx?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTx(isSelected ? null : t)}
                          className="w-full text-left flex items-center gap-4 px-5 py-3.5 transition-colors"
                          style={{
                            borderBottom: '1px solid var(--surface-border)',
                            backgroundColor: isSelected ? 'rgba(127,43,123,0.07)' : undefined,
                          }}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg" style={{ backgroundColor: 'var(--surface-input)' }}>
                            {t.glyph}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.merchant}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${meta?.color ?? '#888'}1a`, color: meta?.color ?? '#888' }}>
                                {t.category}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{txTime(t.date)}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${t.direction === 'IN' ? 'text-emerald-500' : ''}`}
                              style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}>
                              {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount)}
                            </p>
                            {t.status === 'PENDING' && (
                              <span className="text-[10px] font-semibold text-amber-500">Pending</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right: transaction detail panel */}
        {selectedTx && (
          <div className="xl:col-span-1">
            <div className="rounded-2xl overflow-hidden sticky top-24" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Transaction details</h3>
                <button onClick={() => setSelectedTx(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-input)' }}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5">
                {/* Merchant */}
                <div className="flex flex-col items-center py-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl mb-3" style={{ backgroundColor: 'var(--surface-input)' }}>
                    {selectedTx.glyph}
                  </div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{selectedTx.merchant}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${selectedTx.direction === 'IN' ? 'text-emerald-500' : ''}`}
                    style={selectedTx.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}>
                    {selectedTx.direction === 'IN' ? '+' : '−'}{fmt(selectedTx.amount)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {new Date(selectedTx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
                  {[
                    { label: 'Status', value: selectedTx.status === 'PENDING' ? 'Pending' : 'Completed', chip: true },
                    { label: 'Type', value: selectedTx.direction === 'IN' ? 'Credit' : 'Card payment', chip: false },
                    { label: 'Category', value: selectedTx.category, chip: false },
                    { label: 'Account', value: ACCOUNTS.find(a => a.id === selectedTx.accountId)?.name ?? '—', chip: false },
                    ...(selectedTx.note ? [{ label: 'Note', value: selectedTx.note, chip: false }] : []),
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      {row.chip ? (
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${selectedTx.status === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'}`}>
                          {row.value}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-5 space-y-2 pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
                  <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download receipt
                  </button>
                  <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" style={{ border: '1px solid var(--surface-border)' }}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Dispute this transaction
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
