'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  accountService,
  type AccountResponse,
  type AccountPartyRoleRequest,
  type AccountIdentifierRequest,
  type AccountLimitRequest,
  accountCategoryLabels,
  accountTypeLabels,
  accountStatusLabels,
  accountStatusColors,
  accountCategoryColors,
  partyRoleTypeLabels,
  identifierTypeLabels,
  limitTypeLabels,
  formatCurrency,
  type AccountPartyRoleType,
  type AccountIdentifierType,
  type LimitType,
} from '@/services/api/accountService';

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;

  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showAddIdentifierModal, setShowAddIdentifierModal] = useState(false);
  const [showAddLimitModal, setShowAddLimitModal] = useState(false);

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountService.getAccountById(accountId);
      setAccount(data);
    } catch (err) {
      console.error('Failed to load account:', err);
      setError('Failed to load account details.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      loadAccount();
    }
  }, [accountId, loadAccount]);

  const handleActivate = async () => {
    try {
      setActionLoading(true);
      const updated = await accountService.activateAccount(accountId);
      setAccount(updated);
    } catch (err) {
      console.error('Failed to activate account:', err);
      setError('Failed to activate account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFreeze = async () => {
    if (!freezeReason) return;
    try {
      setActionLoading(true);
      const updated = await accountService.freezeAccount(accountId, freezeReason);
      setAccount(updated);
      setShowFreezeModal(false);
      setFreezeReason('');
    } catch (err) {
      console.error('Failed to freeze account:', err);
      setError('Failed to freeze account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreeze = async () => {
    try {
      setActionLoading(true);
      const updated = await accountService.unfreezeAccount(accountId);
      setAccount(updated);
    } catch (err) {
      console.error('Failed to unfreeze account:', err);
      setError('Failed to unfreeze account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    try {
      setActionLoading(true);
      const updated = await accountService.closeAccount(accountId);
      setAccount(updated);
      setShowCloseModal(false);
    } catch (err) {
      console.error('Failed to close account:', err);
      setError('Failed to close account.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8 animate-pulse">
          <div className="h-4 bg-white/20 rounded-xl w-32 mb-4" />
          <div className="h-7 bg-white/20 rounded-xl w-56 mb-2" />
          <div className="h-4 bg-white/10 rounded-xl w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse"
              >
                <div className="h-5 bg-slate-200/70 rounded-xl w-40 mb-4" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="h-16 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse"
              >
                <div className="h-5 bg-slate-200/70 rounded-xl w-28 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="h-4 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Error Loading Account</h3>
          <p className="text-slate-500 text-sm mb-4">{error || 'Account not found'}</p>
          <Link
            href="/dashboard/accounts"
            className="text-sm text-[#7f2b7b] hover:text-[#6b2568] font-medium"
          >
            &larr; Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative">
          <Link
            href="/dashboard/accounts"
            className="text-white/60 hover:text-white text-sm mb-3 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Accounts
          </Link>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-white">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">{account.accountName}</h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                      account.status === 'ACTIVE'
                        ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/20'
                        : account.status === 'FROZEN'
                          ? 'bg-blue-400/20 text-blue-200 border border-blue-400/20'
                          : account.status === 'CLOSED'
                            ? 'bg-red-400/20 text-red-200 border border-red-400/20'
                            : account.status === 'DORMANT'
                              ? 'bg-amber-400/20 text-amber-200 border border-amber-400/20'
                              : 'bg-white/10 text-white/80 border border-white/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        account.status === 'ACTIVE'
                          ? 'bg-emerald-400'
                          : account.status === 'FROZEN'
                            ? 'bg-blue-400'
                            : account.status === 'CLOSED'
                              ? 'bg-red-400'
                              : account.status === 'DORMANT'
                                ? 'bg-amber-400'
                                : 'bg-white/60'
                      }`}
                    />
                    {accountStatusLabels[account.status]}
                  </span>
                </div>
                <p className="text-white/60 text-sm mt-0.5 font-mono">{account.accountNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/dashboard/accounts/${accountId}/edit`}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </Link>
              {account.status === 'PENDING' && (
                <button
                  onClick={handleActivate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-white text-[#7f2b7b] rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  Activate
                </button>
              )}
              {account.status === 'ACTIVE' && (
                <button
                  onClick={() => setShowFreezeModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Freeze
                </button>
              )}
              {account.status === 'FROZEN' && (
                <button
                  onClick={handleUnfreeze}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-white text-[#7f2b7b] rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  Unfreeze
                </button>
              )}
              {['ACTIVE', 'DORMANT'].includes(account.status) && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/20 text-red-200 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200/60 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {error}
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{account.accountName}</h2>
                <p className="text-slate-500 font-mono text-sm">{account.accountNumber}</p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${accountStatusColors[account.status]}`}
              >
                {accountStatusLabels[account.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50/50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Category</p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${accountCategoryColors[account.accountCategory]}`}
                >
                  {accountCategoryLabels[account.accountCategory]}
                </span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Type</p>
                <p className="text-sm font-medium text-slate-900">
                  {accountTypeLabels[account.accountType]}
                </p>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Currency</p>
                <p className="text-sm font-medium text-slate-900">{account.currency}</p>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Interest Rate</p>
                <p className="text-sm font-medium text-slate-900 tabular-nums">
                  {account.interestRate}%
                </p>
              </div>
            </div>
          </div>

          {/* Balance */}
          {account.balance && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#7f2b7b]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Balance
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-50/50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Available Balance</p>
                  <p className="text-xl font-bold text-emerald-600 tabular-nums">
                    {formatCurrency(account.balance.availableBalance ?? 0, account.currency)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50/50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Current Balance</p>
                  <p className="text-lg font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(account.balance.currentBalance ?? 0, account.currency)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50/50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Hold Balance</p>
                  <p className="text-lg font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(account.balance.holdsAmount ?? 0, account.currency)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50/50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Accrued Interest</p>
                  <p className="text-lg font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(account.balance.accruedInterest ?? 0, account.currency)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Party Roles */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Account Holders &amp; Roles</h3>
              <button
                onClick={() => setShowAddPartyModal(true)}
                className="text-sm text-[#7f2b7b] hover:text-[#6b2568] font-medium"
              >
                + Add Party
              </button>
            </div>
            {account.partyRoles.length === 0 ? (
              <p className="text-slate-500 text-sm">No party roles assigned</p>
            ) : (
              <div className="space-y-2">
                {account.partyRoles.map(role => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {role.partyName || role.partyId}
                      </p>
                      <p className="text-xs text-slate-500">
                        {partyRoleTypeLabels[role.role]}
                        {role.isPrimary && (
                          <span className="ml-2 text-xs bg-[#7f2b7b]/10 text-[#7f2b7b] px-2 py-0.5 rounded-full font-medium">
                            Primary
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1.5 text-xs">
                      {role.canTransact && (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                          Transact
                        </span>
                      )}
                      {role.canView && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                          View
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Identifiers */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Account Identifiers</h3>
              <button
                onClick={() => setShowAddIdentifierModal(true)}
                className="text-sm text-[#7f2b7b] hover:text-[#6b2568] font-medium"
              >
                + Add Identifier
              </button>
            </div>
            {account.identifiers.length === 0 ? (
              <p className="text-slate-500 text-sm">No identifiers assigned</p>
            ) : (
              <div className="space-y-2">
                {account.identifiers.map(identifier => (
                  <div
                    key={identifier.id}
                    className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl"
                  >
                    <div>
                      <p className="text-xs text-slate-500">
                        {identifierTypeLabels[identifier.identifierType]}
                      </p>
                      <p className="font-mono font-medium text-sm text-slate-900">
                        {identifier.identifierValue}
                      </p>
                    </div>
                    {identifier.isPrimary && (
                      <span className="text-xs bg-[#7f2b7b]/10 text-[#7f2b7b] px-2 py-1 rounded-full font-medium">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Key Dates */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Key Dates</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Opened Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {account.openedAt
                    ? new Date(account.openedAt).toLocaleDateString()
                    : 'Not opened'}
                </p>
              </div>
              {account.maturityDate && (
                <div>
                  <p className="text-xs text-slate-500">Maturity Date</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(account.maturityDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {account.closedAt && (
                <div>
                  <p className="text-xs text-slate-500">Closed Date</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(account.closedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              {account.termMonths && (
                <div>
                  <p className="text-xs text-slate-500">Term</p>
                  <p className="text-sm font-medium text-slate-900">{account.termMonths} months</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">Auto Renew</p>
                <p className="text-sm font-medium text-slate-900">
                  {account.autoRenew ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Limits</h3>
              <button
                onClick={() => setShowAddLimitModal(true)}
                className="text-sm text-[#7f2b7b] hover:text-[#6b2568] font-medium"
              >
                + Add Limit
              </button>
            </div>
            {account.limits.length === 0 ? (
              <p className="text-slate-500 text-sm">No limits configured</p>
            ) : (
              <div className="space-y-3">
                {account.limits.map(limit => (
                  <div key={limit.id} className="p-3 bg-slate-50/50 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-slate-900">
                        {limitTypeLabels[limit.limitType]}
                      </p>
                      {limit.isEnabled ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Limit:</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {formatCurrency(limit.limitAmount, limit.currencyCode)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Used:</span>
                      <span className="tabular-nums">
                        {formatCurrency(limit.usedAmount, limit.currencyCode)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Available:</span>
                      <span className="text-emerald-600 font-medium tabular-nums">
                        {formatCurrency(limit.availableAmount, limit.currencyCode)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {account.notes && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Notes</h3>
              <p className="text-slate-700 whitespace-pre-wrap text-sm">{account.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Freeze Account</h3>
            <p className="text-slate-500 text-sm mb-4">
              Please provide a reason for freezing this account.
            </p>
            <textarea
              value={freezeReason}
              onChange={e => setFreezeReason(e.target.value)}
              rows={3}
              placeholder="Reason for freezing..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b] text-sm mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFreezeModal(false);
                  setFreezeReason('');
                }}
                className="px-4 py-2 text-slate-700 font-medium rounded-xl hover:bg-slate-50 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFreeze}
                disabled={!freezeReason || actionLoading}
                className="px-4 py-2 bg-[#7f2b7b] text-white font-medium rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm transition-colors"
              >
                {actionLoading ? 'Freezing...' : 'Freeze Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Close Account</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Are you sure you want to close this account? This action cannot be easily undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Closing...' : 'Close Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Party Modal */}
      {showAddPartyModal && (
        <AddPartyModal
          accountId={accountId}
          onClose={() => setShowAddPartyModal(false)}
          onSuccess={updated => {
            setAccount(updated);
            setShowAddPartyModal(false);
          }}
        />
      )}

      {/* Add Identifier Modal */}
      {showAddIdentifierModal && (
        <AddIdentifierModal
          accountId={accountId}
          onClose={() => setShowAddIdentifierModal(false)}
          onSuccess={updated => {
            setAccount(updated);
            setShowAddIdentifierModal(false);
          }}
        />
      )}

      {/* Add Limit Modal */}
      {showAddLimitModal && (
        <AddLimitModal
          accountId={accountId}
          currencyCode={account.currency}
          onClose={() => setShowAddLimitModal(false)}
          onSuccess={updated => {
            setAccount(updated);
            setShowAddLimitModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ─── Sub-Modals ─── */

function AddPartyModal({
  accountId,
  onClose,
  onSuccess,
}: {
  accountId: string;
  onClose: () => void;
  onSuccess: (a: AccountResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AccountPartyRoleRequest>({
    partyId: '',
    partyType: 'INDIVIDUAL',
    role: 'PRIMARY_HOLDER',
    isPrimary: false,
    canTransact: true,
    canView: true,
    canManage: false,
    startDate: new Date().toISOString().split('T')[0],
    endDate: undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await accountService.addPartyRole(accountId, formData);
      onSuccess(updated);
    } catch (err) {
      console.error('Failed to add party role:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Party Role</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Party ID</label>
            <input
              type="text"
              value={formData.partyId}
              onChange={e => setFormData({ ...formData, partyId: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Party Type</label>
            <select
              value={formData.partyType}
              onChange={e => setFormData({ ...formData, partyType: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Business</option>
              <option value="CORPORATE">Corporate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={e =>
                setFormData({ ...formData, role: e.target.value as AccountPartyRoleType })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            >
              {(Object.keys(partyRoleTypeLabels) as AccountPartyRoleType[]).map(role => (
                <option key={role} value={role}>
                  {partyRoleTypeLabels[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {[
              { key: 'isPrimary', label: 'Primary' },
              { key: 'canTransact', label: 'Can Transact' },
              { key: 'canView', label: 'Can View' },
              { key: 'canManage', label: 'Can Manage' },
            ].map(item => (
              <label key={item.key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(formData as unknown as Record<string, unknown>)[item.key] as boolean}
                  onChange={e => setFormData({ ...formData, [item.key]: e.target.checked })}
                  className="h-4 w-4 text-[#7f2b7b] rounded accent-[#7f2b7b]"
                />
                <span className="ml-2 text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 font-medium rounded-xl hover:bg-slate-50 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#7f2b7b] text-white font-medium rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm transition-colors"
            >
              {loading ? 'Adding...' : 'Add Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddIdentifierModal({
  accountId,
  onClose,
  onSuccess,
}: {
  accountId: string;
  onClose: () => void;
  onSuccess: (a: AccountResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AccountIdentifierRequest>({
    identifierType: 'IBAN',
    identifierValue: '',
    isPrimary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await accountService.addIdentifier(accountId, formData);
      onSuccess(updated);
    } catch (err) {
      console.error('Failed to add identifier:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Identifier</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Identifier Type</label>
            <select
              value={formData.identifierType}
              onChange={e =>
                setFormData({
                  ...formData,
                  identifierType: e.target.value as AccountIdentifierType,
                })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            >
              {(Object.keys(identifierTypeLabels) as AccountIdentifierType[]).map(type => (
                <option key={type} value={type}>
                  {identifierTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
            <input
              type="text"
              value={formData.identifierValue}
              onChange={e => setFormData({ ...formData, identifierValue: e.target.value })}
              required
              placeholder={formData.identifierType === 'IBAN' ? 'IE64IRCE92050112345678' : ''}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            />
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isPrimary}
              onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })}
              className="h-4 w-4 text-[#7f2b7b] rounded accent-[#7f2b7b]"
            />
            <span className="ml-2 text-sm text-slate-700">Primary Identifier</span>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 font-medium rounded-xl hover:bg-slate-50 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#7f2b7b] text-white font-medium rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm transition-colors"
            >
              {loading ? 'Adding...' : 'Add Identifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLimitModal({
  accountId,
  currencyCode,
  onClose,
  onSuccess,
}: {
  accountId: string;
  currencyCode: string;
  onClose: () => void;
  onSuccess: (a: AccountResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AccountLimitRequest>({
    limitType: 'DAILY_DEBIT',
    limitAmount: 0,
    currencyCode: currencyCode,
    usedAmount: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: undefined,
    isEnabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await accountService.addLimit(accountId, formData);
      onSuccess(updated);
    } catch (err) {
      console.error('Failed to add limit:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Limit</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Limit Type</label>
            <select
              value={formData.limitType}
              onChange={e => setFormData({ ...formData, limitType: e.target.value as LimitType })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            >
              {(Object.keys(limitTypeLabels) as LimitType[]).map(type => (
                <option key={type} value={type}>
                  {limitTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Limit Amount ({currencyCode})
            </label>
            <input
              type="number"
              value={formData.limitAmount}
              onChange={e =>
                setFormData({ ...formData, limitAmount: parseFloat(e.target.value) || 0 })
              }
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            />
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isEnabled}
              onChange={e => setFormData({ ...formData, isEnabled: e.target.checked })}
              className="h-4 w-4 text-[#7f2b7b] rounded accent-[#7f2b7b]"
            />
            <span className="ml-2 text-sm text-slate-700">Enabled</span>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 font-medium rounded-xl hover:bg-slate-50 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#7f2b7b] text-white font-medium rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm transition-colors"
            >
              {loading ? 'Adding...' : 'Add Limit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
