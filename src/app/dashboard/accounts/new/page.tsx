'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  accountService,
  type CreateAccountRequest,
  type AccountCategory,
  type AccountType,
  type AccountPartyRoleType,
  accountCategoryLabels,
  accountTypeLabels,
  partyRoleTypeLabels,
  getAccountTypesForCategory,
} from '@/services/api/accountService';
import { customerService, type Customer } from '@/services/api/customerService';
import { useAppSelector } from '@/store';
import config from '@/config';

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
];

interface SelectedParty {
  partyId: string;
  partyType: 'INDIVIDUAL' | 'BUSINESS' | 'CORPORATE';
  partyName: string;
  role: AccountPartyRoleType;
  ownershipPercentage: number;
  isPrimary: boolean;
}

export default function NewAccountPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedParties, setSelectedParties] = useState<SelectedParty[]>([]);

  const [formData, setFormData] = useState<CreateAccountRequest>({
    bankId: '',
    branchId: '',
    accountCategory: 'DEPOSIT',
    accountType: 'CURRENT_ACCOUNT',
    accountName: '',
    currencyCode: 'EUR',
    productId: '',
    interestRate: 0,
    openingBalance: 0,
    maturityDate: '',
    termMonths: undefined,
    autoRenew: false,
    notes: '',
  });

  const [availableTypes, setAvailableTypes] = useState<AccountType[]>([]);

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

  // Set bankId on mount
  useEffect(() => {
    const bankId = getBankId();
    setFormData(prev => ({ ...prev, bankId }));
  }, [getBankId]);

  // Update available types when category changes
  useEffect(() => {
    const types = getAccountTypesForCategory(formData.accountCategory);
    setAvailableTypes(types);
    // Reset to first type in category if current type doesn't belong
    if (!types.includes(formData.accountType)) {
      setFormData(prev => ({ ...prev, accountType: types[0] }));
    }
  }, [formData.accountCategory, formData.accountType]);

  // Search customers with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customerSearch.length >= 2) {
        setSearchLoading(true);
        try {
          const results = await customerService.searchCustomers({ searchTerm: customerSearch });
          setSearchResults(results);
          setShowSearchDropdown(true);
        } catch (err) {
          console.error('Customer search error:', err);
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch]);

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

  const handleSelectCustomer = (customer: Customer) => {
    const partyName = customerService.getCustomerName(customer);
    const isFirstParty = selectedParties.length === 0;

    // Check if already added
    if (selectedParties.some(p => p.partyId === customer.customerId)) {
      setError('This customer is already added to the account.');
      return;
    }

    const newParty: SelectedParty = {
      partyId: customer.customerId,
      partyType: customer.customerType,
      partyName,
      role: isFirstParty ? 'PRIMARY_HOLDER' : 'JOINT_HOLDER',
      ownershipPercentage: isFirstParty ? 100 : 0,
      isPrimary: isFirstParty,
    };

    setSelectedParties(prev => [...prev, newParty]);
    setCustomerSearch('');
    setShowSearchDropdown(false);
    setError(null);
  };

  const handleRemoveParty = (partyId: string) => {
    setSelectedParties(prev => {
      const updated = prev.filter(p => p.partyId !== partyId);
      // If we removed the primary, make the first remaining one primary
      if (updated.length > 0 && !updated.some(p => p.isPrimary)) {
        updated[0].isPrimary = true;
        updated[0].role = 'PRIMARY_HOLDER';
      }
      return updated;
    });
  };

  const handlePartyRoleChange = (partyId: string, role: AccountPartyRoleType) => {
    setSelectedParties(prev =>
      prev.map(p => {
        if (p.partyId === partyId) {
          return {
            ...p,
            role,
            isPrimary: role === 'PRIMARY_HOLDER',
          };
        }
        // If setting a new primary, demote others
        if (role === 'PRIMARY_HOLDER' && p.isPrimary) {
          return {
            ...p,
            role: 'JOINT_HOLDER',
            isPrimary: false,
          };
        }
        return p;
      })
    );
  };

  const handleOwnershipChange = (partyId: string, percentage: number) => {
    setSelectedParties(prev =>
      prev.map(p => (p.partyId === partyId ? { ...p, ownershipPercentage: percentage } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate at least one party for deposit accounts
    if (formData.accountCategory === 'DEPOSIT' && selectedParties.length === 0) {
      setError('Please add at least one customer/party to the account.');
      setLoading(false);
      return;
    }

    // Validate ownership percentages add up to 100
    const totalOwnership = selectedParties.reduce((sum, p) => sum + p.ownershipPercentage, 0);
    if (selectedParties.length > 0 && totalOwnership !== 100) {
      setError(`Ownership percentages must add up to 100%. Current total: ${totalOwnership}%`);
      setLoading(false);
      return;
    }

    try {
      // Find primary party
      const primaryParty = selectedParties.find(p => p.isPrimary);

      const request: CreateAccountRequest = {
        ...formData,
        bankId: getBankId(),
        maturityDate: formData.maturityDate || undefined,
        termMonths: formData.termMonths || undefined,
        productId: formData.productId || undefined,
        branchId: formData.branchId || undefined,
        // Add primary party info
        primaryPartyId: primaryParty?.partyId,
        primaryPartyType: primaryParty?.partyType,
      };

      const account = await accountService.createAccount(request);

      // Add additional party roles if more than one party
      for (const party of selectedParties) {
        if (!party.isPrimary || selectedParties.length > 1) {
          try {
            await accountService.addPartyRole(account.accountId, {
              partyId: party.partyId,
              partyType: party.partyType,
              role: party.role,
              ownershipPercentage: party.ownershipPercentage,
              isPrimary: party.isPrimary,
              startDate: new Date().toISOString().split('T')[0],
              canView: true,
              canTransact: party.role === 'PRIMARY_HOLDER' || party.role === 'JOINT_HOLDER',
              canManage: party.role === 'PRIMARY_HOLDER',
            });
          } catch (partyErr) {
            console.error('Failed to add party role:', partyErr);
          }
        }
      }

      router.push('/dashboard/accounts');
    } catch (err) {
      console.error('Failed to create account:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const showTermFields = ['TERM_DEPOSIT', 'NOTICE_ACCOUNT'].includes(formData.accountType);
  const showCreditFields = [
    'LOAN_ACCOUNT',
    'MORTGAGE_ACCOUNT',
    'LINE_OF_CREDIT',
    'REVOLVING_CREDIT',
    'CREDIT_CARD',
    'OVERDRAFT_ACCOUNT',
  ].includes(formData.accountType);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Create New Account</h1>
              <p className="text-xs text-gray-600 mt-0.5">Set up a new bank account</p>
            </div>
            <Link
              href="/dashboard/accounts"
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
              Back to Accounts
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Holder / Customer Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Account Holder(s)
              <span className="text-sm font-normal text-gray-500 ml-2">
                Link customers to this account
              </span>
            </h2>

            {/* Customer Search */}
            <div className="relative mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Customer
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Search by name, email, phone, or customer number..."
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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
                {searchLoading && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin h-5 w-5 border-2 border-primary-600 rounded-full border-t-transparent"></div>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map(customer => (
                    <button
                      key={customer.customerId}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {customerService.getCustomerName(customer)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {customer.customerNumber} • {customer.primaryEmail}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            customer.customerType === 'INDIVIDUAL'
                              ? 'bg-blue-100 text-blue-800'
                              : customer.customerType === 'BUSINESS'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {customerService.formatCustomerType(customer.customerType)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showSearchDropdown &&
                searchResults.length === 0 &&
                customerSearch.length >= 2 &&
                !searchLoading && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    No customers found matching &quot;{customerSearch}&quot;
                  </div>
                )}
            </div>

            {/* Selected Parties */}
            {selectedParties.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Selected Account Holders ({selectedParties.length})
                </label>
                {selectedParties.map(party => (
                  <div
                    key={party.partyId}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          party.partyType === 'INDIVIDUAL'
                            ? 'bg-blue-100 text-blue-600'
                            : party.partyType === 'BUSINESS'
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {party.partyType === 'INDIVIDUAL' ? '👤' : '🏢'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{party.partyName}</div>
                        <div className="text-sm text-gray-500">
                          {customerService.formatCustomerType(party.partyType)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Role Selection */}
                      <div>
                        <select
                          value={party.role}
                          onChange={e =>
                            handlePartyRoleChange(
                              party.partyId,
                              e.target.value as AccountPartyRoleType
                            )
                          }
                          className="text-sm px-2 py-1 border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                        >
                          {(Object.keys(partyRoleTypeLabels) as AccountPartyRoleType[]).map(
                            role => (
                              <option key={role} value={role}>
                                {partyRoleTypeLabels[role]}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {/* Ownership Percentage */}
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={party.ownershipPercentage}
                          onChange={e =>
                            handleOwnershipChange(party.partyId, parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          max="100"
                          className="w-16 text-sm px-2 py-1 border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                        />
                        <span className="ml-1 text-sm text-gray-500">%</span>
                      </div>

                      {/* Primary Badge */}
                      {party.isPrimary && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Primary
                        </span>
                      )}

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveParty(party.partyId)}
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Ownership Total */}
                {selectedParties.length > 1 && (
                  <div className="flex justify-end text-sm">
                    <span
                      className={`px-2 py-1 rounded ${
                        selectedParties.reduce((sum, p) => sum + p.ownershipPercentage, 0) === 100
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      Total Ownership:{' '}
                      {selectedParties.reduce((sum, p) => sum + p.ownershipPercentage, 0)}%
                      {selectedParties.reduce((sum, p) => sum + p.ownershipPercentage, 0) !== 100 &&
                        ' (must equal 100%)'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {selectedParties.length === 0 && (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="mt-2">Search and add customers to link them to this account</p>
              </div>
            )}
          </div>

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
                  placeholder="e.g., John Doe Current Account"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency <span className="text-red-500">*</span>
                </label>
                <select
                  name="currencyCode"
                  value={formData.currencyCode}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                >
                  {CURRENCY_OPTIONS.map(curr => (
                    <option key={curr.value} value={curr.value}>
                      {curr.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="accountCategory"
                  value={formData.accountCategory}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                >
                  {(['DEPOSIT', 'CREDIT', 'OPERATIONAL'] as AccountCategory[]).map(cat => (
                    <option key={cat} value={cat}>
                      {accountCategoryLabels[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                >
                  {availableTypes.map(type => (
                    <option key={type} value={type}>
                      {accountTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening Balance
                </label>
                <input
                  type="number"
                  name="openingBalance"
                  value={formData.openingBalance}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
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
            </div>
          </div>

          {/* Term Deposit Fields */}
          {showTermFields && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Term Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    max="360"
                    placeholder="e.g., 12"
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
          )}

          {/* Credit Account Fields */}
          {showCreditFields && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Credit Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    placeholder="e.g., 60 for 5-year loan"
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
              </div>
            </div>
          )}

          {/* Optional Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                <input
                  type="text"
                  name="productId"
                  value={formData.productId || ''}
                  onChange={handleChange}
                  placeholder="Link to a product"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any additional notes about this account"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/dashboard/accounts"
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
