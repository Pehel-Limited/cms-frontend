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
    if (!confirm('Are you sure you want to close this account?')) return;
    try {
      setActionLoading(true);
      const updated = await accountService.closeAccount(accountId);
      setAccount(updated);
    } catch (err) {
      console.error('Failed to close account:', err);
      setError('Failed to close account.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading account details...</p>
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Account</h3>
          <p className="text-gray-600 mb-4">{error || 'Account not found'}</p>
          <Link
            href="/dashboard/accounts"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Account Details</h1>
              <p className="text-xs text-gray-600 mt-0.5">{account.accountNumber}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href={`/dashboard/accounts/${accountId}/edit`}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
              >
                Edit Account
              </Link>
              <Link
                href="/dashboard/accounts"
                className="inline-flex items-center px-4 py-2 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100"
              >
                Back to Accounts
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline hover:no-underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{account.accountName}</h2>
                  <p className="text-gray-500 font-mono">{account.accountNumber}</p>
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    accountStatusColors[account.status]
                  }`}
                >
                  {accountStatusLabels[account.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      accountCategoryColors[account.accountCategory]
                    }`}
                  >
                    {accountCategoryLabels[account.accountCategory]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium">{accountTypeLabels[account.accountType]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Currency</p>
                  <p className="font-medium">{account.currency}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Interest Rate</p>
                  <p className="font-medium">{account.interestRate}%</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t flex flex-wrap gap-2">
                {account.status === 'PENDING' && (
                  <button
                    onClick={handleActivate}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Activate Account
                  </button>
                )}
                {account.status === 'ACTIVE' && (
                  <button
                    onClick={() => setShowFreezeModal(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Freeze Account
                  </button>
                )}
                {account.status === 'FROZEN' && (
                  <button
                    onClick={handleUnfreeze}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Unfreeze Account
                  </button>
                )}
                {['ACTIVE', 'DORMANT'].includes(account.status) && (
                  <button
                    onClick={handleClose}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Close Account
                  </button>
                )}
              </div>
            </div>

            {/* Balance */}
            {account.balance && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Balance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Available Balance</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(account.balance.availableBalance ?? 0, account.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Current Balance</p>
                    <p className="text-xl font-semibold">
                      {formatCurrency(account.balance.currentBalance ?? 0, account.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Hold Balance</p>
                    <p className="text-xl font-semibold">
                      {formatCurrency(account.balance.holdsAmount ?? 0, account.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Accrued Interest</p>
                    <p className="text-xl font-semibold">
                      {formatCurrency(account.balance.accruedInterest ?? 0, account.currency)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Party Roles */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Account Holders & Roles</h3>
                <button
                  onClick={() => setShowAddPartyModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  + Add Party
                </button>
              </div>
              {account.partyRoles.length === 0 ? (
                <p className="text-gray-500 text-sm">No party roles assigned</p>
              ) : (
                <div className="space-y-3">
                  {account.partyRoles.map(role => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{role.partyName || role.partyId}</p>
                        <p className="text-sm text-gray-500">
                          {partyRoleTypeLabels[role.role]}
                          {role.isPrimary && (
                            <span className="ml-2 text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex space-x-2 text-xs">
                        {role.canTransact && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            Transact
                          </span>
                        )}
                        {role.canView && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">View</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Identifiers */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Account Identifiers</h3>
                <button
                  onClick={() => setShowAddIdentifierModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  + Add Identifier
                </button>
              </div>
              {account.identifiers.length === 0 ? (
                <p className="text-gray-500 text-sm">No identifiers assigned</p>
              ) : (
                <div className="space-y-2">
                  {account.identifiers.map(identifier => (
                    <div
                      key={identifier.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm text-gray-500">
                          {identifierTypeLabels[identifier.identifierType]}
                        </p>
                        <p className="font-mono font-medium">{identifier.identifierValue}</p>
                      </div>
                      {identifier.isPrimary && (
                        <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded">
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
            {/* Dates */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Dates</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Opened Date</p>
                  <p className="font-medium">
                    {account.openedAt
                      ? new Date(account.openedAt).toLocaleDateString()
                      : 'Not opened'}
                  </p>
                </div>
                {account.maturityDate && (
                  <div>
                    <p className="text-sm text-gray-500">Maturity Date</p>
                    <p className="font-medium">
                      {new Date(account.maturityDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {account.closedAt && (
                  <div>
                    <p className="text-sm text-gray-500">Closed Date</p>
                    <p className="font-medium">{new Date(account.closedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {account.termMonths && (
                  <div>
                    <p className="text-sm text-gray-500">Term</p>
                    <p className="font-medium">{account.termMonths} months</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Auto Renew</p>
                  <p className="font-medium">{account.autoRenew ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Limits</h3>
                <button
                  onClick={() => setShowAddLimitModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  + Add Limit
                </button>
              </div>
              {account.limits.length === 0 ? (
                <p className="text-gray-500 text-sm">No limits configured</p>
              ) : (
                <div className="space-y-3">
                  {account.limits.map(limit => (
                    <div key={limit.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium">{limitTypeLabels[limit.limitType]}</p>
                        {limit.isEnabled ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Limit:</span>
                        <span className="font-medium">
                          {formatCurrency(limit.limitAmount, limit.currencyCode)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Used:</span>
                        <span>{formatCurrency(limit.usedAmount, limit.currencyCode)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Available:</span>
                        <span className="text-green-600">
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
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{account.notes}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Freeze Account</h3>
            <p className="text-gray-600 mb-4">Please provide a reason for freezing this account.</p>
            <textarea
              value={freezeReason}
              onChange={e => setFreezeReason(e.target.value)}
              rows={3}
              placeholder="Reason for freezing..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowFreezeModal(false);
                  setFreezeReason('');
                }}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleFreeze}
                disabled={!freezeReason || actionLoading}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Freezing...' : 'Freeze Account'}
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

// Add Party Modal Component
function AddPartyModal({
  accountId,
  onClose,
  onSuccess,
}: {
  accountId: string;
  onClose: () => void;
  onSuccess: (account: AccountResponse) => void;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Party Role</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party ID</label>
            <input
              type="text"
              value={formData.partyId}
              onChange={e => setFormData({ ...formData, partyId: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party Type</label>
            <select
              value={formData.partyType}
              onChange={e => setFormData({ ...formData, partyType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Business</option>
              <option value="CORPORATE">Corporate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={e =>
                setFormData({ ...formData, role: e.target.value as AccountPartyRoleType })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {(Object.keys(partyRoleTypeLabels) as AccountPartyRoleType[]).map(role => (
                <option key={role} value={role}>
                  {partyRoleTypeLabels[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isPrimary}
                onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Primary</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.canTransact}
                onChange={e => setFormData({ ...formData, canTransact: e.target.checked })}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Can Transact</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.canView}
                onChange={e => setFormData({ ...formData, canView: e.target.checked })}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Can View</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.canManage}
                onChange={e => setFormData({ ...formData, canManage: e.target.checked })}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Can Manage</span>
            </label>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Identifier Modal Component
function AddIdentifierModal({
  accountId,
  onClose,
  onSuccess,
}: {
  accountId: string;
  onClose: () => void;
  onSuccess: (account: AccountResponse) => void;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Identifier</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identifier Type</label>
            <select
              value={formData.identifierType}
              onChange={e =>
                setFormData({
                  ...formData,
                  identifierType: e.target.value as AccountIdentifierType,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {(Object.keys(identifierTypeLabels) as AccountIdentifierType[]).map(type => (
                <option key={type} value={type}>
                  {identifierTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
            <input
              type="text"
              value={formData.identifierValue}
              onChange={e => setFormData({ ...formData, identifierValue: e.target.value })}
              required
              placeholder={formData.identifierType === 'IBAN' ? 'IE64IRCE92050112345678' : ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isPrimary}
              onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })}
              className="h-4 w-4 text-primary-600 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Primary Identifier</span>
          </label>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Identifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Limit Modal Component
function AddLimitModal({
  accountId,
  currencyCode,
  onClose,
  onSuccess,
}: {
  accountId: string;
  currencyCode: string;
  onClose: () => void;
  onSuccess: (account: AccountResponse) => void;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Limit</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limit Type</label>
            <select
              value={formData.limitType}
              onChange={e => setFormData({ ...formData, limitType: e.target.value as LimitType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {(Object.keys(limitTypeLabels) as LimitType[]).map(type => (
                <option key={type} value={type}>
                  {limitTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isEnabled}
              onChange={e => setFormData({ ...formData, isEnabled: e.target.checked })}
              className="h-4 w-4 text-primary-600 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Enabled</span>
          </label>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Limit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
