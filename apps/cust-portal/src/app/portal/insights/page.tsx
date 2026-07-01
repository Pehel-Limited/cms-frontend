'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  spendByCategory,
  monthlyInOut,
  dailySpendSeries,
  TRANSACTIONS,
  CATEGORY_META,
} from '@/lib/banking-data';
import { RadialProgress, SpendBars } from '@/components/banking/BankCard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n);
}

const TABS = ['Overview', 'Expenses', 'Cash flow', 'Budgets', 'Trends'] as const;
type Tab = (typeof TABS)[number];

const MERCHANTS = [
  { name: 'Amazon.co.uk', amount: 158.49, icon: '📦' },
  { name: 'Tesco Stores', amount: 87.64, icon: '🛒' },
  { name: 'Uber Technologies', amount: 62.32, icon: '🚗' },
  { name: 'Just Eat', amount: 48.21, icon: '🍔' },
  { name: 'Netflix', amount: 39.99, icon: '🎬' },
];

const SUBSCRIPTIONS = [
  { name: 'Netflix', amount: 15.99, due: '1 Jun', icon: '🎬' },
  { name: 'Spotify Premium', amount: 9.99, due: '5 Jun', icon: '🎵' },
  { name: 'Amazon Prime', amount: 8.99, due: '10 Jun', icon: '📦' },
  { name: 'Adobe Creative Cloud', amount: 52.99, due: '17 Jun', icon: '🎨' },
];

const BUDGETS = [
  { category: 'Shopping', spent: 452.18, limit: 600, color: '#7f2b7b' },
  { category: 'Groceries', spent: 231.67, limit: 300, color: '#ae3fa9' },
  { category: 'Transport', spent: 198.40, limit: 250, color: '#ec4899' },
  { category: 'Dining Out', spent: 113.83, limit: 150, color: '#f43f5e' },
  { category: 'Utilities', spent: 175.50, limit: 200, color: '#8b5cf6' },
];

export default function InsightsPage() {
  const [tab, setTab] = useState<Tab>('Overview');

  const spend = useMemo(() => spendByCategory(), []);
  const { income, spending } = useMemo(() => monthlyInOut(), []);
  const dailySpend = useMemo(() => dailySpendSeries(30), []);
  const top5 = spend.slice(0, 5);
  const topCategory = top5[0];

  /* simple line chart path */
  function lineChart(data: number[], w: number, h: number, color: string, fill = false) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4)] as const);
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={`fill-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {fill && <path d={areaPath} fill={`url(#fill-${color.replace('#','')})`} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Spending Insights</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Understand your spending and make smarter financial decisions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors" style={{ border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-card)' }}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            May 2025
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors" style={{ border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-card)' }}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-xl p-1" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t ? '#7f2b7b' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Monthly overview */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly spending overview</h2>
            <button className="text-xs" style={{ color: 'var(--text-muted)' }}>This month ▾</button>
          </div>
          <p className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{fmt(spending)}</p>
          <div className="flex items-center gap-2 mt-1 mb-4">
            <span className="text-xs font-semibold text-emerald-500">▼ £132.41 (9.6%) vs last month</span>
          </div>
          <div className="h-20 w-full">
            {lineChart(dailySpend.map(d => d.total), 300, 80, '#7f2b7b', true)}
          </div>
          <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            You spent less than last month
          </p>

          {/* Category chips */}
          <div className="grid grid-cols-2 gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
            {top5.map(s => (
              <div key={s.category} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--surface-input)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{s.category}</span>
                </div>
                <span className="text-xs font-bold ml-1 shrink-0" style={{ color: 'var(--text-primary)' }}>{fmt(s.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spending by category */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Spending by category</h2>
            <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400 hover:underline">View full breakdown</button>
          </div>
          <div className="flex items-center gap-4">
            <RadialProgress
              size={140}
              stroke={14}
              gap={0.025}
              segments={top5.map(s => ({ value: s.total, color: s.color }))}
              trackColor="var(--surface-input)"
            >
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total spend</span>
              <span className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{fmt(spending)}</span>
            </RadialProgress>
            <div className="flex-1 space-y-2.5">
              {top5.map(s => (
                <div key={s.category} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{s.category}</span>
                  <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>{Math.round(s.pct)}%</span>
                  <span className="text-xs font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>{fmt(s.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Smart insight card */}
          <div className="mt-5 rounded-xl p-4 bg-gradient-to-br from-[#7f2b7b]/10 to-[#ec4899]/10 border border-[#7f2b7b]/20">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Smart insight</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  You spent <span className="font-bold text-[#7f2b7b] dark:text-purple-300">28% more</span> on Dining Out this month.
                  That's <span className="font-bold">£24.15</span> more than your monthly average.
                </p>
                <button className="mt-2 text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View insights →</button>
              </div>
            </div>
          </div>
        </div>

        {/* Budget progress */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Budget progress</h2>
            <button className="text-xs" style={{ color: 'var(--text-muted)' }}>This month ▾</button>
          </div>
          <div className="space-y-4">
            {BUDGETS.map(b => {
              const pct = Math.round((b.spent / b.limit) * 100);
              const over = pct > 90;
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{b.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(b.spent)} / {fmt(b.limit)}</span>
                      <span className={`text-xs font-bold ${over ? 'text-rose-500' : 'text-emerald-500'}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-input)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: over ? '#f43f5e' : b.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: Spend over time + Merchant insights + Cash flow */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Spend over time */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Spend over time</h2>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-[#7f2b7b]" /> This month</span>
              <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 border-t-2 border-dashed border-slate-400" /> Last month</span>
            </div>
          </div>
          <div className="h-40">
            {lineChart(dailySpend.map(d => d.total), 600, 160, '#7f2b7b', true)}
          </div>
          <div className="mt-2 flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'].map(m => <span key={m}>{m}</span>)}
          </div>
        </div>

        {/* Merchant insights */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Merchant insights</h2>
          <div className="mb-4">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Top merchants</p>
            <div className="space-y-2.5">
              {MERCHANTS.map(m => (
                <div key={m.name} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base" style={{ backgroundColor: 'var(--surface-input)' }}>{m.icon}</span>
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                  <span className="text-xs font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>{fmt(m.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--surface-border)' }} className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Recurring subscriptions</p>
              <button className="text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View all</button>
            </div>
            <div className="space-y-2">
              {SUBSCRIPTIONS.map(s => (
                <div key={s.name} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm" style={{ backgroundColor: 'var(--surface-input)' }}>{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{s.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Due {s.due}</p>
                  </div>
                  <span className="text-xs font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>{fmt(s.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cash flow summary */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Cash flow summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total income', value: fmt(income), color: 'text-emerald-500' },
            { label: 'Total spend', value: fmt(spending), color: '' },
            { label: 'Bills & commitments', value: fmt(620), color: '' },
            { label: 'Net cash flow', value: fmt(income - spending), color: income > spending ? 'text-emerald-500' : 'text-rose-500' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-input)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`} style={!item.color ? { color: 'var(--text-primary)' } : undefined}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Savings opportunity */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-[#7f2b7b]/10 to-[#ae3fa9]/5" style={{ border: '1px solid rgba(127,43,123,0.2)' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shrink-0" style={{ backgroundColor: 'rgba(127,43,123,0.15)' }}>
            🐷
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Savings opportunity</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              You could save up to <span className="font-bold text-[#7f2b7b] dark:text-purple-300">£82.30/month</span> by reviewing your subscriptions and Dining Out spending.
            </p>
          </div>
          <button className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#7f2b7b] hover:bg-[#6b2468] transition-colors shrink-0">
            See how
          </button>
        </div>
      </div>
    </div>
  );
}
