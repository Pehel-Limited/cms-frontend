// components/workflow/BookingModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { accountService, AccountSummaryResponse } from '@/services/api/accountService';

interface DisbursementAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  iban?: string;
  bic?: string;
  isExternal: boolean;
  amount: number;
  percentage: number;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (disbursements: DisbursementAccount[]) => void;
  applicationId: string;
  customerId: string;
  approvedAmount: number;
  currency?: string;
  loading?: boolean;
}

export function BookingModal({
  isOpen,
  onClose,
  onConfirm,
  applicationId,
  customerId,
  approvedAmount,
  currency = 'EUR',
  loading = false,
}: BookingModalProps) {
  const [customerAccounts, setCustomerAccounts] = useState<AccountSummaryResponse[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [disbursements, setDisbursements] = useState<DisbursementAccount[]>([]);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalAccount, setExternalAccount] = useState({
    accountNumber: '',
    accountName: '',
    bankName: '',
    iban: '',
    bic: '',
  });

  // Load customer accounts
  useEffect(() => {
    if (isOpen && customerId) {
      void loadCustomerAccountsInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, customerId]);

  async function loadCustomerAccountsInternal() {
    try {
      setLoadingAccounts(true);
      const accounts = await accountService.getAccountsByParty(customerId);
      // Filter to only show deposit accounts that can receive funds
      const eligibleAccounts = accounts.filter(
        acc =>
          acc.status === 'ACTIVE' &&
          ['DEPOSIT', 'OPERATIONAL'].includes(acc.accountCategory) &&
          ['CURRENT_ACCOUNT', 'SAVINGS_ACCOUNT', 'DEMAND_DEPOSIT'].includes(acc.accountType)
      );
      setCustomerAccounts(eligibleAccounts);
    } catch (error) {
      console.error('Failed to load customer accounts:', error);
      toast.error('Failed to load customer accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }

  // Calculate total allocated amount
  const totalAllocated = disbursements.reduce((sum, d) => sum + d.amount, 0);
  const remainingAmount = approvedAmount - totalAllocated;

  // Add an existing account to disbursements
  function addAccountToDisbursement(account: AccountSummaryResponse) {
    // Check if already added
    if (disbursements.some(d => d.id === account.accountId)) {
      toast.warning('This account is already added');
      return;
    }

    const newDisbursement: DisbursementAccount = {
      id: account.accountId,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: 'Internal',
      iban: account.primaryIban,
      isExternal: false,
      amount: remainingAmount > 0 ? remainingAmount : 0,
      percentage: remainingAmount > 0 ? (remainingAmount / approvedAmount) * 100 : 0,
    };

    setDisbursements([...disbursements, newDisbursement]);
  }

  // Add external account
  function addExternalAccount() {
    if (!externalAccount.accountNumber || !externalAccount.bankName) {
      toast.warning('Please fill in required fields');
      return;
    }

    const newDisbursement: DisbursementAccount = {
      id: `external-${Date.now()}`,
      accountNumber: externalAccount.accountNumber,
      accountName: externalAccount.accountName || 'External Account',
      bankName: externalAccount.bankName,
      iban: externalAccount.iban,
      bic: externalAccount.bic,
      isExternal: true,
      amount: remainingAmount > 0 ? remainingAmount : 0,
      percentage: remainingAmount > 0 ? (remainingAmount / approvedAmount) * 100 : 0,
    };

    setDisbursements([...disbursements, newDisbursement]);
    setShowExternalForm(false);
    setExternalAccount({
      accountNumber: '',
      accountName: '',
      bankName: '',
      iban: '',
      bic: '',
    });
  }

  // Update disbursement amount
  function updateDisbursementAmount(id: string, amount: number) {
    setDisbursements(
      disbursements.map(d => {
        if (d.id === id) {
          return {
            ...d,
            amount: Math.max(0, Math.min(amount, approvedAmount)),
            percentage: (Math.max(0, Math.min(amount, approvedAmount)) / approvedAmount) * 100,
          };
        }
        return d;
      })
    );
  }

  // Update disbursement percentage
  function updateDisbursementPercentage(id: string, percentage: number) {
    const amount = (percentage / 100) * approvedAmount;
    updateDisbursementAmount(id, amount);
  }

  // Remove disbursement
  function removeDisbursement(id: string) {
    setDisbursements(disbursements.filter(d => d.id !== id));
  }

  // Distribute remaining equally
  function distributeEqually() {
    if (disbursements.length === 0) return;

    const amountPerAccount = approvedAmount / disbursements.length;
    setDisbursements(
      disbursements.map(d => ({
        ...d,
        amount: amountPerAccount,
        percentage: 100 / disbursements.length,
      }))
    );
  }

  // Handle form submission
  function handleSubmit() {
    if (disbursements.length === 0) {
      toast.error('Please add at least one disbursement account');
      return;
    }

    if (Math.abs(totalAllocated - approvedAmount) > 0.01) {
      toast.error(
        `Total disbursement (${formatCurrency(totalAllocated)}) must equal approved amount (${formatCurrency(approvedAmount)})`
      );
      return;
    }

    onConfirm(disbursements);
  }

  // Format currency
  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-emerald-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Complete Loan Booking</h2>
                <p className="text-emerald-100 text-sm mt-1">
                  Configure disbursement accounts for Application #{applicationId.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Loan Summary */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-emerald-600">Approved Amount</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {formatCurrency(approvedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-emerald-600">Allocated</p>
                  <p
                    className={`text-2xl font-bold ${totalAllocated === approvedAmount ? 'text-emerald-900' : 'text-amber-600'}`}
                  >
                    {formatCurrency(totalAllocated)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-emerald-600">Remaining</p>
                  <p
                    className={`text-2xl font-bold ${remainingAmount === 0 ? 'text-emerald-900' : 'text-red-600'}`}
                  >
                    {formatCurrency(remainingAmount)}
                  </p>
                </div>
              </div>
              {remainingAmount !== 0 && (
                <p className="text-sm text-amber-700 mt-2">
                  ⚠️ Please allocate the full approved amount to proceed with booking
                </p>
              )}
            </div>

            {/* Customer Accounts */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Customer Accounts</h3>
                <button
                  onClick={() => setShowExternalForm(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Add External Account
                </button>
              </div>

              {loadingAccounts ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading accounts...</p>
                </div>
              ) : customerAccounts.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <span className="text-4xl">🏦</span>
                  <p className="text-gray-500 mt-2">No eligible accounts found</p>
                  <p className="text-gray-400 text-sm">Add an external account for disbursement</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {customerAccounts.map(account => {
                    const isAdded = disbursements.some(d => d.id === account.accountId);
                    return (
                      <div
                        key={account.accountId}
                        className={`p-4 border rounded-lg transition-all cursor-pointer ${
                          isAdded
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                        onClick={() => !isAdded && addAccountToDisbursement(account)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{account.accountName}</p>
                            <p className="text-sm text-gray-500">{account.accountNumber}</p>
                            <p className="text-xs text-gray-400">
                              {account.accountType.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(account.currentBalance || 0)}
                            </p>
                            {isAdded ? (
                              <span className="text-xs text-emerald-600">✓ Added</span>
                            ) : (
                              <span className="text-xs text-blue-600">Click to add</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* External Account Form */}
            {showExternalForm && (
              <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Add External Account</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      value={externalAccount.accountNumber}
                      onChange={e =>
                        setExternalAccount({ ...externalAccount, accountNumber: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={externalAccount.accountName}
                      onChange={e =>
                        setExternalAccount({ ...externalAccount, accountName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Account holder name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={externalAccount.bankName}
                      onChange={e =>
                        setExternalAccount({ ...externalAccount, bankName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Bank name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                    <input
                      type="text"
                      value={externalAccount.iban}
                      onChange={e =>
                        setExternalAccount({ ...externalAccount, iban: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="IE12BOFI90001234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BIC/SWIFT
                    </label>
                    <input
                      type="text"
                      value={externalAccount.bic}
                      onChange={e =>
                        setExternalAccount({ ...externalAccount, bic: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="BOFIIE2D"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={addExternalAccount}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Account
                  </button>
                  <button
                    onClick={() => setShowExternalForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Disbursement Configuration */}
            {disbursements.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Disbursement Allocation</h3>
                  {disbursements.length > 1 && (
                    <button
                      onClick={distributeEqually}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Distribute Equally
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {disbursements.map((disbursement, index) => (
                    <div
                      key={disbursement.id}
                      className="p-4 border border-gray-200 rounded-lg bg-white"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </span>
                            <p className="font-medium text-gray-900">{disbursement.accountName}</p>
                            {disbursement.isExternal && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                External
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 ml-8">
                            {disbursement.accountNumber}
                            {disbursement.iban && ` • ${disbursement.iban}`}
                          </p>
                          <p className="text-xs text-gray-400 ml-8">{disbursement.bankName}</p>
                        </div>
                        <button
                          onClick={() => removeDisbursement(disbursement.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg
                            className="w-5 h-5"
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
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Amount
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                              {currency}
                            </span>
                            <input
                              type="number"
                              value={disbursement.amount}
                              onChange={e =>
                                updateDisbursementAmount(disbursement.id, Number(e.target.value))
                              }
                              className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              min={0}
                              max={approvedAmount}
                              step={0.01}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Percentage
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={disbursement.percentage.toFixed(2)}
                              onChange={e =>
                                updateDisbursementPercentage(
                                  disbursement.id,
                                  Number(e.target.value)
                                )
                              }
                              className="w-full pr-8 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                              min={0}
                              max={100}
                              step={0.01}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {disbursements.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Disbursement Summary</h4>
                <div className="space-y-1 text-sm">
                  {disbursements.map((d, i) => (
                    <div key={d.id} className="flex justify-between">
                      <span className="text-gray-600">
                        {i + 1}. {d.accountNumber} ({d.bankName})
                      </span>
                      <span className="font-medium">
                        {formatCurrency(d.amount)} ({d.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span
                      className={
                        totalAllocated === approvedAmount ? 'text-emerald-600' : 'text-red-600'
                      }
                    >
                      {formatCurrency(totalAllocated)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <p className="text-sm text-gray-500">{disbursements.length} account(s) configured</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  loading ||
                  disbursements.length === 0 ||
                  Math.abs(totalAllocated - approvedAmount) > 0.01
                }
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {loading ? 'Processing...' : 'Complete Booking'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingModal;
