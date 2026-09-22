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
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
];

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  border: '1px solid var(--rm-border)',
  color: 'var(--rm-text)',
};

const INPUT_CLASS = 'w-full rounded-xl px-4 py-2.5 text-sm';

function errorInputStyle(hasError: boolean): React.CSSProperties {
  return {
    ...INPUT_STYLE,
    border: `1px solid ${hasError ? 'rgba(239,68,68,0.6)' : 'var(--rm-border)'}`,
  };
}

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedParties, setSelectedParties] = useState<SelectedParty[]>([]);

  const [formData, setFormData] = useState<CreateAccountRequest>({
    bankId: '',
    branchId: '',
    accountCategory: 'DEPOSIT',
    accountType: 'CURRENT_ACCOUNT',
    accountName: '',
    currencyCode: config.bank.defaultCurrency || 'EUR',
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
          return JSON.parse(userDataStr).bankId || config.bank.defaultBankId;
        } catch {
          return config.bank.defaultBankId;
        }
      }
    }
    return config.bank.defaultBankId;
  }, [user?.bankId]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, bankId: getBankId() }));
  }, [getBankId]);

  useEffect(() => {
    const types = getAccountTypesForCategory(formData.accountCategory);
    setAvailableTypes(types);
    if (!types.includes(formData.accountType)) {
      setFormData(prev => ({ ...prev, accountType: types[0] }));
    }
  }, [formData.accountCategory, formData.accountType]);

  // Debounced customer search — failures are scoped so the form keeps its input.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customerSearch.length >= 2) {
        setSearchLoading(true);
        setSearchError(null);
        try {
          const results = await customerService.searchCustomers({ searchTerm: customerSearch });
          setSearchResults(results || []);
          setShowSearchDropdown(true);
        } catch (err) {
          console.error('Customer search error:', err);
          setSearchResults([]);
          setShowSearchDropdown(true);
          setSearchError(
            'The customer search is unavailable right now. You can still save the account and link holders later.'
          );
        } finally {
          setSearchLoading(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
        setSearchError(null);
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
            ? (value === '' ? undefined : parseFloat(value) || 0)
            : value,
    }));
    setFieldErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSelectCustomer = (customer: Customer) => {
    const partyName = customerService.getCustomerName(customer);
    const isFirstParty = selectedParties.length === 0;

    if (selectedParties.some(p => p.partyId === customer.customerId)) {
      setError('That customer is already linked to this account.');
      return;
    }

    setSelectedParties(prev => [
      ...prev,
      {
        partyId: customer.customerId,
        partyType: customer.customerType,
        partyName,
        role: isFirstParty ? 'PRIMARY_HOLDER' : 'JOINT_HOLDER',
        ownershipPercentage: isFirstParty ? 100 : 0,
        isPrimary: isFirstParty,
      },
    ]);
    setCustomerSearch('');
    setSearchResults([]);
    setShowSearchDropdown(false);
    setError(null);
    setFieldErrors(prev => {
      if (!prev.parties) return prev;
      const next = { ...prev };
      delete next.parties;
      return next;
    });
  };

  const handleRemoveParty = (partyId: string) => {
    setSelectedParties(prev => {
      const updated = prev.filter(p => p.partyId !== partyId);
      if (updated.length > 0 && !updated.some(p => p.isPrimary)) {
        updated[0] = { ...updated[0], isPrimary: true, role: 'PRIMARY_HOLDER' };
      }
      return updated;
    });
  };

  const handlePartyRoleChange = (partyId: string, role: AccountPartyRoleType) => {
    setSelectedParties(prev =>
      prev.map(p => {
        if (p.partyId === partyId) return { ...p, role, isPrimary: role === 'PRIMARY_HOLDER' };
        if (role === 'PRIMARY_HOLDER' && p.isPrimary)
          return { ...p, role: 'JOINT_HOLDER' as AccountPartyRoleType, isPrimary: false };
        return p;
      })
    );
  };

  const handleOwnershipChange = (partyId: string, percentage: number) => {
    setSelectedParties(prev =>
      prev.map(p => (p.partyId === partyId ? { ...p, ownershipPercentage: percentage } : p))
    );
  };

  const totalOwnership = selectedParties.reduce((sum, p) => sum + (p.ownershipPercentage || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const errors: Record<string, string> = {};
    if (!formData.accountName || !formData.accountName.trim())
      errors.accountName = 'An account name is required.';
    if (!formData.currencyCode) errors.currencyCode = 'A currency is required.';
    if (formData.accountCategory === 'DEPOSIT' && selectedParties.length === 0)
      errors.parties = 'A deposit account needs at least one customer linked to it.';
    if (selectedParties.length > 0 && totalOwnership !== 100)
      errors.ownership = `Ownership must add up to 100%. It currently totals ${totalOwnership}%.`;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(
        `${Object.keys(errors).length} item${Object.keys(errors).length === 1 ? '' : 's'} need attention. Nothing was submitted and your input has been kept.`
      );
      setLoading(false);
      document.getElementById(errors.accountName ? 'new-accountName' : 'new-party-search')?.focus();
      return;
    }

    try {
      const primaryParty = selectedParties.find(p => p.isPrimary);

      const request: CreateAccountRequest = {
        ...formData,
        accountName: formData.accountName.trim(),
        bankId: getBankId(),
        maturityDate: formData.maturityDate || undefined,
        termMonths: formData.termMonths || undefined,
        productId: formData.productId || undefined,
        branchId: formData.branchId || undefined,
        primaryPartyId: primaryParty?.partyId,
        primaryPartyType: primaryParty?.partyType,
      };

      const account = await accountService.createAccount(request);

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
      // Input is preserved — only the banner reports the failure.
      setError(
        err instanceof Error
          ? `${err.message} Nothing was created and your input has been kept.`
          : 'We could not create this account. Nothing was submitted and your input has been kept.'
      );
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
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-3xl p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <Link
          href="/dashboard/accounts"
          className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to accounts
        </Link>
        <h1
          className="mt-4 text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          Open an account
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
          Set up a deposit, credit or operational account and link its holders.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-3xl px-6 py-5 flex items-start gap-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
        >
          <svg
            className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm" style={{ color: 'var(--rm-text)' }}>
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Holders */}
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Account holders
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            Search for a customer to link them to this account.
          </p>

          <div className="relative mt-5">
            <label
              htmlFor="new-party-search"
              className="block text-sm mb-1.5"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Search customers
            </label>
            <input
              id="new-party-search"
              type="search"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Name, email, phone or customer number"
              aria-describedby="new-party-search-status"
              aria-invalid={fieldErrors.parties ? true : undefined}
              className={INPUT_CLASS}
              style={errorInputStyle(!!fieldErrors.parties)}
            />
            <p
              id="new-party-search-status"
              role="status"
              className="text-xs mt-1.5"
              style={{ color: 'var(--rm-text-muted)' }}
            >
              {searchLoading
                ? 'Searching…'
                : customerSearch.length < 2
                  ? 'Type at least two characters to search.'
                  : showSearchDropdown
                    ? `${searchResults.length} match${searchResults.length === 1 ? '' : 'es'} found.`
                    : ''}
            </p>

            {fieldErrors.parties && (
              <p role="alert" className="text-xs mt-1.5 text-red-700 dark:text-red-300">
                {fieldErrors.parties}
              </p>
            )}

            {searchError && (
              <p
                role="alert"
                className="rounded-2xl px-5 py-4 text-sm mt-3"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
              >
                {searchError}
              </p>
            )}

            {showSearchDropdown && searchResults.length > 0 && (
              <ul
                className="absolute z-10 mt-2 w-full overflow-y-auto rounded-2xl shadow-lg"
                style={{ maxHeight: '16rem', backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
              >
                {searchResults.map(customer => (
                  <li key={customer.customerId} style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <button
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full px-5 py-4 text-left transition-opacity hover:opacity-80"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span
                            className="block truncate text-base font-medium"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {customerService.getCustomerName(customer)}
                          </span>
                          <span
                            className="block truncate text-sm"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            {customer.customerNumber} · {customer.primaryEmail}
                          </span>
                        </span>
                        <span
                          className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--rm-accent-muted)',
                            color: 'var(--rm-accent)',
                          }}
                        >
                          {customerService.formatCustomerType(customer.customerType)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showSearchDropdown &&
              searchResults.length === 0 &&
              customerSearch.length >= 2 &&
              !searchLoading &&
              !searchError && (
                <p
                  className="mt-2 rounded-2xl px-5 py-4 text-sm"
                  style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-muted)' }}
                >
                  No customers match “{customerSearch}”.
                </p>
              )}
          </div>

          {/* Selected holders */}
          {selectedParties.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm mb-3" style={{ color: 'var(--rm-text-secondary)' }}>
                Linked holders ({selectedParties.length})
              </h3>
              <ul className="space-y-3">
                {selectedParties.map(party => (
                  <li
                    key={party.partyId}
                    className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-base font-medium truncate"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {party.partyName}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {customerService.formatCustomerType(party.partyType)}
                        {party.isPrimary && ' · primary holder'}
                      </p>
                    </div>

                    <div className="flex items-end gap-3 flex-wrap">
                      <div>
                        <label
                          htmlFor={`party-role-${party.partyId}`}
                          className="block text-xs mb-1"
                          style={{ color: 'var(--rm-text-muted)' }}
                        >
                          Role
                        </label>
                        <select
                          id={`party-role-${party.partyId}`}
                          value={party.role}
                          onChange={e =>
                            handlePartyRoleChange(
                              party.partyId,
                              e.target.value as AccountPartyRoleType
                            )
                          }
                          className="rounded-xl px-3 py-2 text-sm"
                          style={INPUT_STYLE}
                        >
                          {(Object.keys(partyRoleTypeLabels) as AccountPartyRoleType[]).map(role => (
                            <option key={role} value={role}>
                              {partyRoleTypeLabels[role]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`party-ownership-${party.partyId}`}
                          className="block text-xs mb-1"
                          style={{ color: 'var(--rm-text-muted)' }}
                        >
                          Ownership %
                        </label>
                        <input
                          id={`party-ownership-${party.partyId}`}
                          type="number"
                          value={party.ownershipPercentage}
                          onChange={e =>
                            handleOwnershipChange(party.partyId, parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          max="100"
                          aria-invalid={fieldErrors.ownership ? true : undefined}
                          aria-describedby={fieldErrors.ownership ? 'ownership-error' : undefined}
                          className="w-24 rounded-xl px-3 py-2 text-sm tabular-nums"
                          style={errorInputStyle(!!fieldErrors.ownership)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveParty(party.partyId)}
                        aria-label={`Remove ${party.partyName} from this account`}
                        className="rounded-full p-2 text-red-600 dark:text-red-400 transition-opacity hover:opacity-80"
                        style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <p
                id="ownership-error"
                role={fieldErrors.ownership ? 'alert' : undefined}
                className={
                  fieldErrors.ownership
                    ? 'mt-3 text-sm tabular-nums text-red-700 dark:text-red-300'
                    : 'mt-3 text-sm tabular-nums'
                }
                style={fieldErrors.ownership ? undefined : { color: 'var(--rm-text-muted)' }}
              >
                {fieldErrors.ownership || `Total ownership: ${totalOwnership}%`}
              </p>
            </div>
          ) : (
            <div
              className="mt-6 rounded-2xl py-10 text-center"
              style={{ border: '1px dashed var(--rm-border)' }}
            >
              <svg
                className="mx-auto h-8 w-8"
                style={{ color: 'var(--rm-text-muted)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.6}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3"
                />
              </svg>
              <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                No holders linked yet. Search above to add one.
              </p>
            </div>
          )}
        </section>

        {/* Basic information */}
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Account details
          </h2>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="new-accountName"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Account name
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </label>
              <input
                id="new-accountName"
                type="text"
                name="accountName"
                value={formData.accountName}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={fieldErrors.accountName ? true : undefined}
                aria-describedby={fieldErrors.accountName ? 'new-accountName-error' : undefined}
                placeholder="For example, Anne Kelly current account"
                className={INPUT_CLASS}
                style={errorInputStyle(!!fieldErrors.accountName)}
              />
              {fieldErrors.accountName && (
                <p
                  id="new-accountName-error"
                  role="alert"
                  className="text-xs mt-1.5 text-red-700 dark:text-red-300"
                >
                  {fieldErrors.accountName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="new-currencyCode"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Currency
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </label>
              <select
                id="new-currencyCode"
                name="currencyCode"
                value={formData.currencyCode}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={fieldErrors.currencyCode ? true : undefined}
                aria-describedby={fieldErrors.currencyCode ? 'new-currencyCode-error' : undefined}
                className={INPUT_CLASS}
                style={errorInputStyle(!!fieldErrors.currencyCode)}
              >
                {CURRENCY_OPTIONS.map(curr => (
                  <option key={curr.value} value={curr.value}>
                    {curr.label}
                  </option>
                ))}
              </select>
              {fieldErrors.currencyCode && (
                <p
                  id="new-currencyCode-error"
                  role="alert"
                  className="text-xs mt-1.5 text-red-700 dark:text-red-300"
                >
                  {fieldErrors.currencyCode}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="new-accountCategory"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Category
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </label>
              <select
                id="new-accountCategory"
                name="accountCategory"
                value={formData.accountCategory}
                onChange={handleChange}
                required
                aria-required="true"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              >
                {(['DEPOSIT', 'CREDIT', 'OPERATIONAL'] as AccountCategory[]).map(cat => (
                  <option key={cat} value={cat}>
                    {accountCategoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-accountType"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Type
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </label>
              <select
                id="new-accountType"
                name="accountType"
                value={formData.accountType}
                onChange={handleChange}
                required
                aria-required="true"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              >
                {availableTypes.map(type => (
                  <option key={type} value={type}>
                    {accountTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-openingBalance"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Opening balance
              </label>
              <input
                id="new-openingBalance"
                type="number"
                name="openingBalance"
                value={formData.openingBalance ?? ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                className={`${INPUT_CLASS} tabular-nums`}
                style={INPUT_STYLE}
              />
            </div>

            <div>
              <label
                htmlFor="new-interestRate"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Interest rate (%)
              </label>
              <input
                id="new-interestRate"
                type="number"
                name="interestRate"
                value={formData.interestRate ?? ''}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
                className={`${INPUT_CLASS} tabular-nums`}
                style={INPUT_STYLE}
              />
            </div>
          </div>
        </section>

        {/* Term details */}
        {showTermFields && (
          <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Term details
            </h2>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="term-termMonths"
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--rm-text-secondary)' }}
                >
                  Term (months)
                </label>
                <input
                  id="term-termMonths"
                  type="number"
                  name="termMonths"
                  value={formData.termMonths ?? ''}
                  onChange={handleChange}
                  min="1"
                  max="360"
                  className={`${INPUT_CLASS} tabular-nums`}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <label
                  htmlFor="term-maturityDate"
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--rm-text-secondary)' }}
                >
                  Maturity date
                </label>
                <input
                  id="term-maturityDate"
                  type="date"
                  name="maturityDate"
                  value={formData.maturityDate || ''}
                  onChange={handleChange}
                  className={INPUT_CLASS}
                  style={INPUT_STYLE}
                />
              </div>
              <div className="flex items-center md:col-span-2">
                <label htmlFor="term-autoRenew" className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    id="term-autoRenew"
                    type="checkbox"
                    name="autoRenew"
                    checked={!!formData.autoRenew}
                    onChange={handleChange}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--rm-accent)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    Auto-renew at maturity
                  </span>
                </label>
              </div>
            </div>
          </section>
        )}

        {/* Credit details */}
        {showCreditFields && (
          <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Credit details
            </h2>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="credit-termMonths"
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--rm-text-secondary)' }}
                >
                  Term (months)
                </label>
                <input
                  id="credit-termMonths"
                  type="number"
                  name="termMonths"
                  value={formData.termMonths ?? ''}
                  onChange={handleChange}
                  min="1"
                  max="480"
                  className={`${INPUT_CLASS} tabular-nums`}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <label
                  htmlFor="credit-maturityDate"
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--rm-text-secondary)' }}
                >
                  Maturity date
                </label>
                <input
                  id="credit-maturityDate"
                  type="date"
                  name="maturityDate"
                  value={formData.maturityDate || ''}
                  onChange={handleChange}
                  className={INPUT_CLASS}
                  style={INPUT_STYLE}
                />
              </div>
            </div>
          </section>
        )}

        {/* Additional information */}
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Additional information
          </h2>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="new-branchId"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Branch ID
              </label>
              <input
                id="new-branchId"
                type="text"
                name="branchId"
                value={formData.branchId || ''}
                onChange={handleChange}
                placeholder="Optional branch identifier"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label
                htmlFor="new-productId"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Product ID
              </label>
              <input
                id="new-productId"
                type="text"
                name="productId"
                value={formData.productId || ''}
                onChange={handleChange}
                placeholder="Optional link to a product"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="new-notes"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Notes
              </label>
              <textarea
                id="new-notes"
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                placeholder="Anything worth recording about this account"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-3 flex-wrap">
          <Link
            href="/dashboard/accounts"
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  );
}
