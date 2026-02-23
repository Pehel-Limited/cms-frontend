'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  accountService,
  type AccountSummaryResponse,
  type AccountCategory,
  type AccountType,
  type AccountStatus,
  type AccountStatsResponse,
  accountCategoryLabels,
  accountTypeLabels,
  accountStatusLabels,
  accountStatusColors,
  accountCategoryColors,
  formatCurrency,
} from '@/services/api/accountService';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';
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

export default function AccountsPage() {
  const { user } = useAppSelector(state => state.auth);
  const [accounts, setAccounts] = useState<AccountSummaryResponse[]>([]);
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

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

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Reset page when filters change
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
    } catch (err) {
      console.error('Failed to delete account:', err);
      setError('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Check if user has Bank Super Admin role (only they can delete accounts)
  const isBankSuperAdmin =
    user?.roles?.some(role => {
      const roleType = typeof role === 'string' ? role : role.roleType;
      return roleType === 'BANK_SUPER_ADMIN' || roleType === 'Bank Super Admin';
    }) ?? false;

  const onSort = (field: string) => {
    setSortConfig(handleSortToggle(field, sortConfig));
  };

  const sortedAccounts = sortData(accounts, sortConfig);

  const STAT_CARDS = stats
    ? [
        {
          label: 'Total',
          value: stats.totalAccounts,
          color: 'text-slate-900',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          ),
        },
        {
          label: 'Active',
          value: stats.activeAccounts,
          color: 'text-emerald-600',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          ),
        },
        {
          label: 'Dormant',
          value: stats.dormantAccounts,
          color: 'text-slate-500',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </div>
          ),
        },
        {
          label: 'Frozen',
          value: stats.frozenAccounts,
          color: 'text-blue-600',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          ),
        },
        {
          label: 'Deposit',
          value: stats.depositAccounts,
          color: 'text-emerald-600',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          ),
        },
        {
          label: 'Credit',
          value: stats.creditAccounts,
          color: 'text-violet-600',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-violet-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
          ),
        },
        {
          label: 'Operational',
          value: stats.operationalAccounts,
          color: 'text-indigo-600',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          ),
        },
        {
          label: 'Closed',
          value: stats.closedAccounts,
          color: 'text-red-600',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          ),
        },
      ]
    : [];

  const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    DORMANT: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    FROZEN: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    CLOSED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    BLOCKED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  };

  const getStatusBadge = (status: string) =>
    STATUS_BADGE[status] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };

  const CATEGORY_BADGE: Record<string, { bg: string; text: string }> = {
    DEPOSIT: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    CREDIT: { bg: 'bg-violet-50', text: 'text-violet-700' },
    OPERATIONAL: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  };

  const getCategoryBadge = (cat: string) =>
    CATEGORY_BADGE[cat] || { bg: 'bg-slate-50', text: 'text-slate-600' };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ──── Gradient header banner ──── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a3a7a] via-[#1e4da0] to-[#3b82f6]">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 w-56 h-56 bg-blue-400/10 rounded-full blur-2xl" />
        <svg
          className="absolute bottom-0 left-0 right-0 text-slate-100"
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" />
        </svg>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-14">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Account Management</h1>
              <p className="text-blue-200 text-sm mt-1">
                {totalElements} account{totalElements !== 1 ? 's' : ''} across all categories
              </p>
            </div>
            <Link
              href="/dashboard/accounts/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Account
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-8 space-y-4">
        {/* ──── Stats strip ──── */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {STAT_CARDS.map(s => (
              <div
                key={s.label}
                className="flex-none min-w-[130px] bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3 text-center"
              >
                {s.icon}
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ──── Filters card ──── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by account number, name, or IBAN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors appearance-none"
              >
                {ACCOUNT_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors appearance-none"
              >
                {ACCOUNT_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ──── Error ──── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm">{error}</span>
            <button
              onClick={loadAccounts}
              className="ml-auto text-sm font-medium text-red-800 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ──── Loading ──── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Loading accounts...</p>
            </div>
          </div>
        ) : accounts.length === 0 ? (
          /* ──── Empty state ──── */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm py-20 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <p className="text-slate-900 font-semibold text-lg">No accounts found</p>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating your first account'}
            </p>
            {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
              <Link
                href="/dashboard/accounts/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Account
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ──── Accounts table ──── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <SortableHeader
                        label="Account"
                        field="accountName"
                        currentSort={sortConfig}
                        onSort={onSort}
                      />
                      <SortableHeader
                        label="Type"
                        field="accountCategory"
                        currentSort={sortConfig}
                        onSort={onSort}
                      />
                      <SortableHeader
                        label="Balance"
                        field="availableBalance"
                        currentSort={sortConfig}
                        onSort={onSort}
                      />
                      <SortableHeader
                        label="Status"
                        field="status"
                        currentSort={sortConfig}
                        onSort={onSort}
                      />
                      <SortableHeader
                        label="Primary Holder"
                        field="primaryOwnerName"
                        currentSort={sortConfig}
                        onSort={onSort}
                      />
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedAccounts.map(account => {
                      const sb = getStatusBadge(account.status);
                      const cb = getCategoryBadge(account.accountCategory);
                      return (
                        <tr
                          key={account.accountId}
                          className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                          onClick={() => {
                            window.location.href = `/dashboard/accounts/${account.accountId}`;
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {account.accountName}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">{account.accountNumber}</p>
                            {account.primaryIban && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {account.primaryIban}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cb.bg} ${cb.text}`}
                            >
                              {accountCategoryLabels[account.accountCategory]}
                            </span>
                            <p className="text-xs text-slate-400 mt-1">
                              {account.accountTypeDisplay || accountTypeLabels[account.accountType]}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-bold text-slate-900 tabular-nums">
                              {formatCurrency(account.availableBalance, account.currency)}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Current: {formatCurrency(account.currentBalance, account.currency)}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sb.bg} ${sb.text}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${sb.dot}`} />
                              {account.statusDisplay || accountStatusLabels[account.status]}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm text-slate-700">
                              {account.primaryOwnerName || '-'}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end items-center gap-1">
                              <Link
                                href={`/dashboard/accounts/${account.accountId}`}
                                onClick={e => e.stopPropagation()}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                title="View"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              </Link>
                              <Link
                                href={`/dashboard/accounts/${account.accountId}/edit`}
                                onClick={e => e.stopPropagation()}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                title="Edit"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </Link>
                              {isBankSuperAdmin && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setDeleteConfirm(account.accountId);
                                  }}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                  title="Delete"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
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
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Page <span className="font-semibold text-slate-700">{page + 1}</span> of{' '}
                    <span className="font-semibold text-slate-700">{totalPages}</span>
                    <span className="ml-2 text-slate-400">({totalElements} total)</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
                          page === i
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ──── Delete Confirmation Modal ──── */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Delete Account</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete this account? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition-colors"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
