'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  accountService,
  type AccountResponse,
  type UpdateAccountRequest,
  accountCategoryLabels,
  accountStatusLabels,
  accountTypeLabels,
} from '@/services/api/accountService';

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

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EditAccountPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

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
    setLoading(true);
    setLoadError(null);
    try {
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
      setLoadError('We could not load this account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) loadAccount();
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
            ? (value === '' ? undefined : parseFloat(value) || 0)
            : value,
    }));
    if (name === 'accountName') setNameError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.accountName || !formData.accountName.trim()) {
      setNameError('An account name is required.');
      document.getElementById('edit-accountName')?.focus();
      return;
    }
    setNameError(null);
    setSaving(true);

    try {
      const request: UpdateAccountRequest = {
        ...formData,
        accountName: formData.accountName.trim(),
        maturityDate: formData.maturityDate || undefined,
        termMonths: formData.termMonths || undefined,
        branchId: formData.branchId || undefined,
        notes: formData.notes || undefined,
      };

      await accountService.updateAccount(accountId, request);
      router.push(`/dashboard/accounts/${accountId}`);
    } catch (err) {
      console.error('Failed to update account:', err);
      // Input is preserved — only the banner reports the failure.
      setSubmitError(
        err instanceof Error
          ? `${err.message} Your changes are still here — nothing was saved.`
          : 'We could not save these changes. Your input has been kept — please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <p role="status" className="sr-only">
          Loading account
        </p>
        <div className="h-28 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }} />
        <div className="h-40 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }} />
        <div className="h-80 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }} />
      </div>
    );
  }

  if (loadError || !account) {
    return (
      <div className="rounded-3xl p-7 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          Account unavailable
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }} role="alert">
          {loadError || 'We could not find this account.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={loadAccount}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            Try again
          </button>
          <Link
            href="/dashboard/accounts"
            className="rounded-full px-5 py-2.5 text-sm font-medium"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            Back to accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-3xl p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <Link
          href={`/dashboard/accounts/${accountId}`}
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
          Back to account
        </Link>
        <h1
          className="mt-4 text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          Edit account
        </h1>
        <p className="text-sm mt-1 tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
          {account.accountNumber} · {accountStatusLabels[account.status]}
        </p>
      </header>

      {submitError && (
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
            {submitError}
          </p>
        </div>
      )}

      {/* Read-only facts */}
      <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          Account information
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
          These details are set when the account is opened and cannot be edited here.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Fact label="Account number" value={account.accountNumber} />
          <Fact label="Category" value={accountCategoryLabels[account.accountCategory]} />
          <Fact label="Type" value={accountTypeLabels[account.accountType]} />
          <Fact label="Currency" value={account.currency} />
          <Fact label="Opened" value={account.openedAt ? formatDate(account.openedAt) : 'Not yet opened'} />
        </dl>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Editable details
          </h2>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="edit-accountName"
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
                id="edit-accountName"
                type="text"
                name="accountName"
                value={formData.accountName || ''}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'edit-accountName-error' : undefined}
                className={INPUT_CLASS}
                style={errorInputStyle(!!nameError)}
              />
              {nameError && (
                <p
                  id="edit-accountName-error"
                  role="alert"
                  className="text-xs mt-1.5 text-red-700 dark:text-red-300"
                >
                  {nameError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-branchId"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Branch ID
              </label>
              <input
                id="edit-branchId"
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
                htmlFor="edit-interestRate"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Interest rate (%)
              </label>
              <input
                id="edit-interestRate"
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

            <div>
              <label
                htmlFor="edit-termMonths"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Term (months)
              </label>
              <input
                id="edit-termMonths"
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
                htmlFor="edit-maturityDate"
                className="block text-sm mb-1.5"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Maturity date
              </label>
              <input
                id="edit-maturityDate"
                type="date"
                name="maturityDate"
                value={formData.maturityDate || ''}
                onChange={handleChange}
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </div>

            <div className="flex items-center">
              <label
                htmlFor="edit-autoRenew"
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <input
                  id="edit-autoRenew"
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

        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Notes
          </h2>
          <div className="mt-5">
            <label htmlFor="edit-notes" className="sr-only">
              Notes
            </label>
            <textarea
              id="edit-notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={4}
              placeholder="Anything worth recording about this account"
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </div>
        </section>

        <div className="flex justify-end gap-3 flex-wrap">
          <Link
            href={`/dashboard/accounts/${accountId}`}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
  );
}
