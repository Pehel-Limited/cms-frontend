'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  accountService,
  type AccountSummaryResponse,
  type AccountCategory,
  type AccountStatus,
  type AccountStatsResponse,
  accountCategoryLabels,
  accountTypeLabels,
  formatCurrency,
} from '@/services/api/accountService';
import { useAppSelector } from '@/store';
import config from '@/config';

type StatusFilter = 'all' | AccountStatus;
type CategoryFilter = 'all' | AccountCategory;

const ACCOUNT_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'DEPOSIT', label: 'Deposit Accounts' },
  { value: 'CREDIT', label: 'Credit Accounts' },
  { value: 'OPERATIONAL', label: 'Operational Accounts' },
];

const ACCOUNT_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DORMANT', label: 'Dormant' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'BLOCKED', label: 'Blocked' },
];

/* Status → accent colour (works in both themes via rgba tint) */
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#10b981',
  PENDING: '#f59e0b',
  DORMANT: '#94a3b8',
  FROZEN: '#3b82f6',
  CLOSED: '#ef4444',
  BLOCKED: '#f97316',
};
const getStatusColor = (s: string) => STATUS_COLOR[s] || '#94a3b8';

const CATEGORY_COLOR: Record<string, string> = {
  DEPOSIT: '#10b981',
  CREDIT: '#8b5cf6',
  OPERATIONAL: '#6366f1',
};
const getCategoryColor = (c: string) => CATEGORY_COLOR[c] || '#94a3b8';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0ea5e9,#2563eb)',
  'linear-gradient(135deg,#8b5cf6,#6366f1)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#f97316)',
  'linear-gradient(135deg,#ec4899,#db2777)',
  'linear-gradient(135deg,#14b8a6,#0891b2)',
];
function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function symbolFor(currency?: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).formatToParts(0);
    return parts.find(p => p.type === 'currency')?.value || (currency || '$');
  } catch {
    return currency || '$';
  }
}
function compact(n: number, currency?: string): string {
  const s = symbolFor(currency);
  const a = Math.abs(n);
  if (a >= 1e9) return `${s}${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${(n / 1e3).toFixed(0)}K`;
  return `${s}${n.toFixed(0)}`;
}

/* ------------------------------------------------------------------ */
/* KPI stat card                                                       */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, sub, tint, icon }: { label: string; value: string; sub?: string; tint: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--rm-text-muted)' }}>{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: `${tint}1a`, color: tint }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--rm-text)' }}>{value}</p>
      {sub && <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--rm-text-muted)' }}>{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut chart                                                         */
/* ------------------------------------------------------------------ */
function Donut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 80 80" className="w-28 h-28 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="10" style={{ stroke: 'var(--rm-input)' }} />
        {total > 0 && segments.map(s => {
          const len = (s.value / total) * circ;
          const el = (
            <circle key={s.label} cx="40" cy="40" r={r} fill="none" strokeWidth="10"
              stroke={s.color} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color: 'var(--rm-text)' }}>{total}</span>
        <span className="text-[9px]" style={{ color: 'var(--rm-text-muted)' }}>Accounts</span>
      </div>
    </div>
  );
}

const I = {
  wallet: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>,
  bank: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m-1 4h1m4-4h1m-1 4h1" /></svg>,
  card: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 5.25h16.5c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125H3.75c-.621 0-1.125-.504-1.125-1.125V6.375c0-.621.504-1.125 1.125-1.125z" /></svg>,
  gauge: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  warn: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
  snow: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-3 3m3-3l3 3m-3 12l-3-3m3 3l3-3M3 12h18M3 12l3-3m-3 3l3 3m12-3l3-3m-3 3l3 3" /></svg>,
  moon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>,
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AccountsPage() {
  const { user } = useAppSelector(state => state.auth);
  const [accounts, setAccounts] = useState<AccountSummaryResponse[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountSummaryResponse[]>([]);
  const [stats, setStats] = useState<AccountStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'balance' | 'name' | 'status'>('balance');

  const getBankId = useCallback((): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          return userData.bankId || '123e4567-e89b-12d3-a456-426614174000';
        } catch {
          return '123e4567-e89b-12d3-a456-426614174000';
        }
      }
    }
    return '123e4567-e89b-12d3-a456-426614174000';
  }, [user?.bankId]);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const bankId = getBankId();

      let response;
      if (searchTerm) {
        response = await accountService.searchAccounts(bankId, searchTerm, page, 20);
      } else if (statusFilter !== 'all') {
        response = await accountService.getAccountsByStatus(statusFilter, bankId, page, 20);
      } else if (categoryFilter !== 'all') {
        response = await accountService.getAccountsByCategory(categoryFilter, bankId, page, 20);
      } else {
        response = await accountService.getAccounts(bankId, page, 20);
      }

      setAccounts(response.content);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError('Failed to load accounts. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [getBankId, page, searchTerm, statusFilter, categoryFilter]);

  const loadStats = useCallback(async () => {
    try {
      const bankId = getBankId();
      const statsData = await accountService.getAccountStats(bankId);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load account stats:', err);
    }
  }, [getBankId]);

  /* Full list for financial aggregates (bank has a modest number of accounts) */
  const loadAggregate = useCallback(async () => {
    try {
      const bankId = getBankId();
      const res = await accountService.getAccounts(bankId, 0, 500);
      setAllAccounts(res.content);
    } catch (err) {
      console.error('Failed to load aggregate accounts:', err);
    }
  }, [getBankId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadStats();
    loadAggregate();
  }, [loadStats, loadAggregate]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, categoryFilter, searchTerm]);

  const handleDelete = async (accountId: string) => {
    try {
      setDeleting(true);
      await accountService.deleteAccount(accountId);
      setAccounts(accounts.filter(a => a.accountId !== accountId));
      setDeleteConfirm(null);
      loadStats();
      loadAggregate();
    } catch (err) {
      console.error('Failed to delete account:', err);
      setError('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const isBankSuperAdmin =
    user?.roles?.some(role => {
      const roleType = typeof role === 'string' ? role : role.roleType;
      return roleType === 'BANK_SUPER_ADMIN' || roleType === 'Bank Super Admin';
    }) ?? false;

  const currency = allAccounts[0]?.currency;

  /* Financial aggregates derived from real account data */
  const agg = useMemo(() => {
    const deposits = allAccounts.filter(a => a.accountCategory === 'DEPOSIT');
    const credits = allAccounts.filter(a => a.accountCategory === 'CREDIT');
    const operational = allAccounts.filter(a => a.accountCategory === 'OPERATIONAL');
    const totalBalances = deposits.reduce((s, a) => s + (a.availableBalance || 0), 0)
      + operational.reduce((s, a) => s + (a.availableBalance || 0), 0);
    const depositBalance = deposits.reduce((s, a) => s + (a.availableBalance || 0), 0);
    const operationalBalance = operational.reduce((s, a) => s + (a.availableBalance || 0), 0);
    const exposure = credits.reduce((s, a) => s + Math.max(0, -(a.currentBalance || 0)), 0);
    const availableLimits = credits.reduce((s, a) => s + (a.availableBalance || 0), 0);
    const utilisation = exposure + availableLimits > 0 ? (exposure / (exposure + availableLimits)) * 100 : 0;
    return { totalBalances, depositBalance, operationalBalance, exposure, availableLimits, utilisation };
  }, [allAccounts]);

  const attentionCount = (stats?.frozenAccounts ?? 0) + (stats?.dormantAccounts ?? 0);

  const kpiCards = [
    { label: 'Total Balances', value: compact(agg.totalBalances, currency), sub: 'Deposit + operational', tint: '#14b8a6', icon: I.wallet },
    { label: 'Lending Exposure', value: compact(agg.exposure, currency), sub: 'Drawn credit', tint: '#6366f1', icon: I.bank },
    { label: 'Available Limits', value: compact(agg.availableLimits, currency), sub: 'Undrawn credit', tint: '#0ea5e9', icon: I.card },
    { label: 'Utilisation Rate', value: `${agg.utilisation.toFixed(0)}%`, sub: 'Credit facilities', tint: '#8b5cf6', icon: I.gauge },
    { label: 'Attention Accounts', value: attentionCount.toLocaleString(), sub: 'Frozen / dormant', tint: '#ef4444', icon: I.warn },
  ];

  /* Client-side sort of the current page */
  const sorted = useMemo(() => {
    return [...accounts].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.primaryOwnerName || a.accountName).localeCompare(b.primaryOwnerName || b.accountName);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'balance':
        default:
          return (b.availableBalance || 0) - (a.availableBalance || 0);
      }
    });
  }, [accounts, sortBy]);

  const donutSegments = stats
    ? [
        { label: 'Deposit', value: stats.depositAccounts, color: '#10b981' },
        { label: 'Credit', value: stats.creditAccounts, color: '#8b5cf6' },
        { label: 'Operational', value: stats.operationalAccounts, color: '#6366f1' },
      ]
    : [];

  const balanceBreakdown = [
    { label: 'Deposits', value: agg.depositBalance, color: '#10b981' },
    { label: 'Credit (drawn)', value: agg.exposure, color: '#8b5cf6' },
    { label: 'Operational', value: agg.operationalBalance, color: '#6366f1' },
  ];
  const balanceMax = Math.max(...balanceBreakdown.map(b => b.value), 1);

  const hasFilters = searchTerm || statusFilter !== 'all' || categoryFilter !== 'all';
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setPage(0);
  };

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--rm-input)',
    color: 'var(--rm-text)',
    border: '1px solid var(--rm-border)',
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>Accounts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-secondary)' }}>
            Manage customer accounts, exposures and facility performance
          </p>
        </div>
        <Link href="/dashboard/accounts/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: '#0ea5e9' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Account
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
          className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
          {ACCOUNT_CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
          {ACCOUNT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by account number, name, or IBAN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle} />
        </div>
        {hasFilters && (
          <button onClick={resetFilters} className="text-xs font-semibold px-2" style={{ color: 'var(--rm-accent)' }}>Reset</button>
        )}
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpiCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Main content + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Left column */}
        <div className="space-y-4 min-w-0">
          {/* Error */}
          {error && (
            <div className="rounded-2xl px-5 py-4 flex items-center gap-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{error}</span>
              <button onClick={loadAccounts} className="ml-auto font-semibold hover:underline">Retry</button>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mx-auto mb-3" />
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>Loading accounts...</p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-2xl py-20 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3" style={{ backgroundColor: 'var(--rm-input)' }}>
                <svg className="w-7 h-7" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </div>
              <p className="font-semibold" style={{ color: 'var(--rm-text)' }}>No accounts found</p>
              <p className="text-sm mt-1 mb-4" style={{ color: 'var(--rm-text-muted)' }}>
                {hasFilters ? 'Try adjusting your filters' : 'Get started by creating your first account'}
              </p>
              {!hasFilters && (
                <Link href="/dashboard/accounts/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#0ea5e9' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Create Account
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-2" style={{ borderBottom: '1px solid var(--rm-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  {totalElements} account{totalElements !== 1 ? 's' : ''}
                </span>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  Sort by
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none" style={selectStyle}>
                    <option value="balance">Balance</option>
                    <option value="name">Holder</option>
                    <option value="status">Status</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)', backgroundColor: 'rgba(148,163,184,0.06)' }}>
                      {['Customer / Holder', 'Type', 'Account No.', 'Balance', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--rm-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(account => {
                      const statusColor = getStatusColor(account.status);
                      const catColor = getCategoryColor(account.accountCategory);
                      const holder = account.primaryOwnerName || account.accountName;
                      return (
                        <tr key={account.accountId} className="transition-colors hover:bg-white/[0.03] cursor-pointer" style={{ borderBottom: '1px solid var(--rm-border)' }}
                          onClick={() => { window.location.href = `/dashboard/accounts/${account.accountId}`; }}>
                          {/* Customer / Holder */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: avatarGradient(holder) }}>
                                {holder.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{holder}</p>
                                <p className="text-[10px] truncate" style={{ color: 'var(--rm-text-muted)' }}>{account.accountName}</p>
                              </div>
                            </div>
                          </td>
                          {/* Type */}
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${catColor}22`, color: catColor }}>
                              {accountCategoryLabels[account.accountCategory]}
                            </span>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--rm-text-muted)' }}>{account.accountTypeDisplay || accountTypeLabels[account.accountType]}</p>
                          </td>
                          {/* Account No. */}
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-mono" style={{ color: 'var(--rm-text-secondary)' }}>{account.accountNumber}</p>
                            {account.primaryIban && <p className="text-[10px] font-mono truncate" style={{ color: 'var(--rm-text-muted)' }}>{account.primaryIban}</p>}
                          </td>
                          {/* Balance */}
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>{formatCurrency(account.availableBalance, account.currency)}</p>
                            <p className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>Current: {formatCurrency(account.currentBalance, account.currency)}</p>
                          </td>
                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                              {account.statusDisplay || account.status}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex justify-end items-center gap-1">
                              <Link href={`/dashboard/accounts/${account.accountId}`} onClick={e => e.stopPropagation()}
                                className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--rm-accent)' }} title="View">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </Link>
                              <Link href={`/dashboard/accounts/${account.accountId}/edit`} onClick={e => e.stopPropagation()}
                                className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--rm-text-muted)' }} title="Edit">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </Link>
                              {isBankSuperAdmin && (
                                <button onClick={e => { e.stopPropagation(); setDeleteConfirm(account.accountId); }}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.06]" style={{ color: '#ef4444' }} title="Delete">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderTop: '1px solid var(--rm-border)' }}>
                <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  Showing {sorted.length} of {totalElements} accounts
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(page - 1)} disabled={page === 0}
                      className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: 'var(--rm-text-muted)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                      <button key={i} onClick={() => setPage(i)}
                        className="min-w-[34px] h-8 rounded-lg text-sm font-medium transition-all"
                        style={page === i ? { backgroundColor: '#0ea5e9', color: '#fff' } : { color: 'var(--rm-text-secondary)' }}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}
                      className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: 'var(--rm-text-muted)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          {/* Account Insights */}
          {stats && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Account Insights</h3>
              <div className="space-y-2.5">
                <button onClick={() => setStatusFilter('FROZEN')} className="w-full text-left rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div>
                    <p className="text-xs font-bold" style={{ color: '#60a5fa' }}>Frozen Accounts</p>
                    <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>Restricted access</p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: '#60a5fa' }}>{stats.frozenAccounts}</span>
                </button>
                <button onClick={() => setStatusFilter('DORMANT')} className="w-full text-left rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' }}>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--rm-text-secondary)' }}>Dormant Accounts</p>
                    <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>Inactive — review</p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: 'var(--rm-text-secondary)' }}>{stats.dormantAccounts}</span>
                </button>
                <button onClick={() => setCategoryFilter('CREDIT')} className="w-full text-left rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div>
                    <p className="text-xs font-bold" style={{ color: '#a78bfa' }}>Credit Facilities</p>
                    <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>Lending exposure</p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: '#a78bfa' }}>{stats.creditAccounts}</span>
                </button>
                <button onClick={() => setCategoryFilter('DEPOSIT')} className="w-full text-left rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div>
                    <p className="text-xs font-bold" style={{ color: '#34d399' }}>Deposit Accounts</p>
                    <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>Funding base</p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: '#34d399' }}>{stats.depositAccounts}</span>
                </button>
              </div>
            </div>
          )}

          {/* Accounts by Category donut */}
          {stats && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Accounts by Category</h3>
              <div className="flex items-center gap-4">
                <Donut segments={donutSegments} total={stats.totalAccounts} />
                <div className="space-y-1.5 flex-1">
                  {donutSegments.map(s => {
                    const pct = stats.totalAccounts ? Math.round((s.value / stats.totalAccounts) * 100) : 0;
                    return (
                      <div key={s.label} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--rm-text-secondary)' }}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span style={{ color: 'var(--rm-text-muted)' }}>{s.value} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Portfolio balance breakdown */}
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Portfolio Balance</h3>
            <div className="space-y-3">
              {balanceBreakdown.map(b => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold" style={{ color: 'var(--rm-text-secondary)' }}>{b.label}</span>
                    <span style={{ color: 'var(--rm-text-muted)' }}>{compact(b.value, currency)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--rm-input)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(b.value / balanceMax) * 100}%`, backgroundColor: b.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
              <svg className="w-6 h-6" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--rm-text)' }}>Delete Account</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--rm-text-muted)' }}>
              Are you sure you want to delete this account? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="px-4 py-2 font-medium rounded-xl transition-colors" style={{ color: 'var(--rm-text-secondary)', backgroundColor: 'var(--rm-input)' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                className="px-4 py-2 text-white font-medium rounded-xl disabled:opacity-50 transition-colors" style={{ backgroundColor: '#dc2626' }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
