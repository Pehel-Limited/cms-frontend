'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  accountService,
  type AccountResponse,
  type UpdateAccountRequest,
} from '@/services/api/accountService';

export default function EditAccountPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateAccountRequest>({
    accountName: '',
    branchId: '',
    interestRate: 0,
    maturityDate: '',
    termMonths: undefined,
    autoRenew: false,
    notes: '',
  });

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountService.getAccountById(accountId);
      setAccount(data);
      setFormData({
        accountName: data.accountName,
        branchId: data.branchId || '',
        interestRate: data.interestRate || 0,
        maturityDate: data.maturityDate?.split('T')[0] || '',
        termMonths: data.termMonths,
        autoRenew: data.autoRenew,
        notes: data.notes || '',
      });
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : type === 'number'
            ? parseFloat(value) || 0
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const request: UpdateAccountRequest = {
        ...formData,
        maturityDate: formData.maturityDate || undefined,
        termMonths: formData.termMonths || undefined,
        branchId: formData.branchId || undefined,
        notes: formData.notes || undefined,
      };

      await accountService.updateAccount(accountId, request);
      router.push(`/dashboard/accounts/${accountId}`);
    } catch (err) {
      console.error('Failed to update account:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update account. Please try again.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading account...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Account Not Found</h3>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Edit Account</h1>
              <p className="text-xs text-gray-600 mt-0.5">{account.accountNumber}</p>
            </div>
            <Link
              href={`/dashboard/accounts/${accountId}`}
              className="inline-flex items-center px-4 py-2 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Details
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Read-only Info */}
        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Account Information (Read-only)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Account Number:</span>
              <p className="font-mono font-medium">{account.accountNumber}</p>
            </div>
            <div>
              <span className="text-gray-500">Category:</span>
              <p className="font-medium">{account.accountCategory}</p>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <p className="font-medium">{account.accountType}</p>
            </div>
            <div>
              <span className="text-gray-500">Currency:</span>
              <p className="font-medium">{account.currency}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch ID</label>
                <input
                  type="text"
                  name="branchId"
                  value={formData.branchId || ''}
                  onChange={handleChange}
                  placeholder="Optional branch identifier"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term (Months)
                </label>
                <input
                  type="number"
                  name="termMonths"
                  value={formData.termMonths || ''}
                  onChange={handleChange}
                  min="1"
                  max="480"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maturity Date
                </label>
                <input
                  type="date"
                  name="maturityDate"
                  value={formData.maturityDate || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoRenew"
                  name="autoRenew"
                  checked={formData.autoRenew}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="autoRenew" className="ml-2 block text-sm text-gray-700">
                  Auto-renew at maturity
                </label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={4}
              placeholder="Any additional notes about this account"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Link
              href={`/dashboard/accounts/${accountId}`}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
