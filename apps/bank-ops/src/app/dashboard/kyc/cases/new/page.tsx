'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  kycService,
  type CreateKycCaseRequest,
  type DiligenceLevel,
} from '@/services/api/kycService';
import { customerService, type Customer } from '@/services/api/customerService';

const SEGMENT_OPTIONS = [
  {
    value: 'INDIVIDUAL',
    label: 'Individual',
    description: 'Natural person opening a personal account',
  },
  {
    value: 'SOLE_TRADER',
    label: 'Sole trader',
    description: 'Self-employed individual trading under their own name',
  },
  {
    value: 'COMPANY',
    label: 'Company (Ltd or PLC)',
    description: 'Private or public limited company',
  },
  {
    value: 'PARTNERSHIP',
    label: 'Partnership',
    description: 'General or limited partnership',
  },
  { value: 'TRUST', label: 'Trust', description: 'Express trust or similar legal arrangement' },
  {
    value: 'CHARITY',
    label: 'Charity or non-profit',
    description: 'Registered charity or non-profit organisation',
  },
  {
    value: 'CLUB_ASSOCIATION',
    label: 'Club or association',
    description: 'Unincorporated association or club',
  },
];

const CASE_TYPE_OPTIONS = [
  {
    value: 'ONBOARDING',
    label: 'Onboarding',
    description: 'New customer KYC during account opening',
  },
  {
    value: 'PERIODIC_REVIEW',
    label: 'Periodic review',
    description: 'Scheduled review based on risk tier',
  },
  {
    value: 'EVENT_DRIVEN',
    label: 'Event driven',
    description: 'Triggered by unusual activity or a change in circumstances',
  },
  {
    value: 'REMEDIATION',
    label: 'Remediation',
    description: 'Fixing incomplete or outdated KYC records',
  },
];

const DILIGENCE_OPTIONS: { value: DiligenceLevel; description: string }[] = [
  { value: 'SDD', description: 'Low-risk customers with minimal verification' },
  { value: 'CDD', description: 'Standard verification for most customers' },
  { value: 'EDD', description: 'High-risk customers requiring additional checks' },
];

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return apiMessage || fallback;
}

export default function NewKycCasePage() {
  const router = useRouter();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState<CreateKycCaseRequest>({
    customerSegment: 'INDIVIDUAL',
    caseType: 'ONBOARDING',
    requiredDiligence: undefined,
    triggerReason: '',
  });

  const searchCustomers = async (term: string) => {
    setSearching(true);
    setSearchError(null);
    try {
      const results = await customerService.searchCustomers({ searchTerm: term });
      setCustomers(results ?? []);
      setSearched(true);
    } catch (error) {
      console.error('Failed to search customers:', error);
      setCustomers([]);
      setSearched(true);
      setSearchError(errorMessage(error, 'We could not search customers. Please try again.'));
    } finally {
      setSearching(false);
    }
  };

  // Debounced search so every keystroke does not hit the API.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = customerSearch.trim();
    if (term.length < 2) {
      setCustomers([]);
      setSearched(false);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => searchCustomers(term), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [customerSearch]);

  const triggerReasonRequired = formData.caseType !== 'ONBOARDING';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCustomerError(null);

    if (!selectedCustomer) {
      setCustomerError('Select the customer this case belongs to.');
      setFormError('The case cannot be created until a customer is selected.');
      document.getElementById('customer-search')?.focus();
      return;
    }
    if (triggerReasonRequired && !formData.triggerReason?.trim()) {
      setFormError('A trigger reason is required for this case type.');
      document.getElementById('trigger-reason')?.focus();
      return;
    }

    try {
      setSubmitting(true);
      const request: CreateKycCaseRequest = {
        ...formData,
        triggerReason: formData.triggerReason?.trim() || undefined,
        customerId: selectedCustomer.customerId,
      };
      const kycCase = await kycService.createCase(request);
      router.push(`/dashboard/kyc/cases/${kycCase.caseId}`);
    } catch (error) {
      console.error('Failed to create KYC case:', error);
      // Scoped to the form: everything the user typed stays put.
      setFormError(errorMessage(error, 'We could not create the case. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateKycCaseRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value || undefined }));
  };

  const triggerReasonError =
    triggerReasonRequired && formError?.includes('trigger reason') ? formError : null;

  return (
    <div className="space-y-6" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <Link
            href="/dashboard/kyc/cases"
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            style={{ color: 'var(--rm-text-muted)' }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Back to cases
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            New KYC case
          </h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Start an onboarding, periodic or event-driven KYC and AML review for a customer.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* ══ Form-level error ══ */}
        {formError && !triggerReasonError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-3xl p-6"
            style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0"
              style={{ color: '#b91c1c' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                {formError}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                Nothing was saved — your answers are still here.
              </p>
            </div>
          </div>
        )}

        {/* ══ Customer ══ */}
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Customer
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Required. The case is created against this customer record.
          </p>

          {selectedCustomer ? (
            <div
              className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5"
              style={{ backgroundColor: 'var(--rm-accent-muted)' }}
            >
              <div className="min-w-0">
                <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {customerService.getCustomerName(selectedCustomer)}
                </p>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  {selectedCustomer.customerNumber}
                  {selectedCustomer.primaryEmail ? ` · ${selectedCustomer.primaryEmail}` : ''}
                </p>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {selectedCustomer.customerType === 'INDIVIDUAL'
                    ? 'Individual'
                    : selectedCustomer.customerType === 'BUSINESS'
                      ? 'Business'
                      : 'Corporate'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerError(null);
                  setCustomerSearch('');
                }}
                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
              >
                Change customer
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <label
                htmlFor="customer-search"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                Search customers
                <span aria-hidden="true" style={{ color: '#b91c1c' }}>
                  {' '}
                  *
                </span>
              </label>
              <input
                id="customer-search"
                type="search"
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  if (customerError) setCustomerError(null);
                }}
                placeholder="Name, email or customer number"
                required
                aria-required="true"
                autoComplete="off"
                aria-invalid={customerError ? true : undefined}
                aria-describedby={
                  customerError
                    ? 'customer-search-error'
                    : searching
                      ? 'customer-search-status'
                      : 'customer-search-hint'
                }
                className="w-full rounded-xl px-3.5 py-2.5 text-base"
                style={{
                  backgroundColor: 'var(--rm-input)',
                  border: `1px solid ${customerError ? 'rgba(239,68,68,0.75)' : 'var(--rm-border)'}`,
                  color: 'var(--rm-text)',
                }}
              />
              <p id="customer-search-hint" className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Type at least two characters to search.
              </p>
              {customerError && (
                <p id="customer-search-error" role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
                  {customerError}
                </p>
              )}
              <p id="customer-search-status" role="status" className="sr-only">
                {searching ? 'Searching customers' : ''}
              </p>

              {searchError && (
                <div
                  role="alert"
                  className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl p-4"
                  style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
                >
                  <p className="min-w-0 flex-1 text-sm" style={{ color: 'var(--rm-text)' }}>
                    {searchError}
                  </p>
                  <button
                    type="button"
                    onClick={() => searchCustomers(customerSearch.trim())}
                    className="rounded-full px-4 py-2 text-sm font-semibold"
                    style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
                  >
                    Try again
                  </button>
                </div>
              )}

              {searching && !searchError && (
                <ul className="mt-3 space-y-2" aria-hidden="true">
                  {[0, 1, 2].map(i => (
                    <li
                      key={i}
                      className="h-14 animate-pulse rounded-2xl"
                      style={{ backgroundColor: 'var(--rm-card-hover)' }}
                    />
                  ))}
                </ul>
              )}

              {!searching && !searchError && searched && customers.length === 0 && (
                <p
                  className="mt-3 rounded-2xl p-4 text-sm"
                  style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-muted)' }}
                >
                  No customers match “{customerSearch.trim()}”. Try a different name, email or
                  customer number.
                </p>
              )}

              {!searching && customers.length > 0 && (
                <>
                  <p className="mt-3 text-sm tabular-nums" role="status" style={{ color: 'var(--rm-text-muted)' }}>
                    {customers.length} match{customers.length === 1 ? '' : 'es'}
                  </p>
                  <ul
                    id="customer-results"
                    className="mt-2 max-h-72 space-y-2 overflow-y-auto"
                    aria-label="Customer search results"
                  >
                    {customers.map(customer => (
                      <li key={customer.customerId}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomers([]);
                            setSearched(false);
                            setCustomerSearch('');
                            setCustomerError(null);
                            setFormError(null);
                            // Segment follows the customer type so the two stay consistent.
                            handleChange(
                              'customerSegment',
                              customer.customerType === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'COMPANY'
                            );
                          }}
                          className="w-full rounded-2xl px-4 py-3 text-left transition-opacity hover:opacity-80"
                          style={{ backgroundColor: 'var(--rm-input)' }}
                        >
                          <span className="block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {customerService.getCustomerName(customer)}
                          </span>
                          <span className="mt-0.5 block text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {customer.customerNumber}
                            {customer.primaryEmail ? ` · ${customer.primaryEmail}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>

        {/* ══ Segment ══ */}
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <fieldset>
            <legend className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Customer segment
            </legend>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Required. The segment drives the KYC requirements under EU and Irish AML rules.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {SEGMENT_OPTIONS.map(option => (
                <RadioCard
                  key={option.value}
                  name="customerSegment"
                  value={option.value}
                  checked={formData.customerSegment === option.value}
                  onChange={v => handleChange('customerSegment', v)}
                  title={option.label}
                  description={option.description}
                />
              ))}
            </div>
          </fieldset>
        </section>

        {/* ══ Case type ══ */}
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <fieldset>
            <legend className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Case type
            </legend>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Required. Why this review is being opened.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {CASE_TYPE_OPTIONS.map(option => (
                <RadioCard
                  key={option.value}
                  name="caseType"
                  value={option.value}
                  checked={formData.caseType === option.value}
                  onChange={v => handleChange('caseType', v)}
                  title={option.label}
                  description={option.description}
                />
              ))}
            </div>
          </fieldset>
        </section>

        {/* ══ Diligence ══ */}
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <fieldset>
            <legend className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Due diligence level
            </legend>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Optional. Leave on auto-determine to let the risk assessment set the level; override
              only where a specific regulatory requirement applies.
            </p>
            <div className="mt-4 space-y-3">
              <RadioCard
                name="requiredDiligence"
                value=""
                checked={!formData.requiredDiligence}
                onChange={() => handleChange('requiredDiligence', '')}
                title="Auto-determine"
                description="Set from the customer segment and risk factors during assessment"
              />
              {DILIGENCE_OPTIONS.map(option => (
                <RadioCard
                  key={option.value}
                  name="requiredDiligence"
                  value={option.value}
                  checked={formData.requiredDiligence === option.value}
                  onChange={v => handleChange('requiredDiligence', v)}
                  title={`${kycService.getDiligenceLabel(option.value)} (${option.value})`}
                  description={option.description}
                  badge={option.value}
                  badgeClass={kycService.getDiligenceColor(option.value)}
                />
              ))}
            </div>
          </fieldset>
        </section>

        {/* ══ Trigger reason ══ */}
        {triggerReasonRequired && (
          <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
            <label
              htmlFor="trigger-reason"
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Trigger reason
              <span aria-hidden="true" style={{ color: '#b91c1c' }}>
                {' '}
                *
              </span>
            </label>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Required for {formData.caseType === 'PERIODIC_REVIEW' ? 'periodic review' : formData.caseType === 'EVENT_DRIVEN' ? 'event driven' : 'remediation'} cases.
            </p>
            <textarea
              id="trigger-reason"
              name="triggerReason"
              rows={3}
              value={formData.triggerReason || ''}
              onChange={e => {
                handleChange('triggerReason', e.target.value);
                if (formError) setFormError(null);
              }}
              required
              aria-required="true"
              aria-invalid={triggerReasonError ? true : undefined}
              aria-describedby={triggerReasonError ? 'trigger-reason-error' : 'trigger-reason-hint'}
              placeholder="Describe why this review is being opened"
              className="mt-4 w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: `1px solid ${triggerReasonError ? 'rgba(239,68,68,0.75)' : 'var(--rm-border)'}`,
                color: 'var(--rm-text)',
              }}
            />
            {triggerReasonError ? (
              <p id="trigger-reason-error" role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
                {triggerReasonError}
              </p>
            ) : (
              <p id="trigger-reason-hint" className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                This is stored on the case audit trail.
              </p>
            )}
          </section>
        )}

        {/* ══ Submit ══ */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/dashboard/kyc/cases"
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {submitting ? 'Creating…' : 'Create case'}
          </button>
        </div>
        {!selectedCustomer && (
          <p className="text-right text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            A customer must be selected before the case can be created.
          </p>
        )}
      </form>
    </div>
  );
}

// ============================================================================
// Shared controls
// ============================================================================

function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  badge,
  badgeClass,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description: string;
  badge?: string;
  badgeClass?: string;
}) {
  const controlId = `${name}-${value || 'auto'}`;
  return (
    <label
      htmlFor={controlId}
      className="flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-colors"
      style={{ backgroundColor: checked ? 'var(--rm-accent-muted)' : 'var(--rm-input)' }}
    >
      <input
        id={controlId}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={e => onChange(e.target.value)}
        className="mt-1 h-4 w-4 shrink-0"
        style={{ accentColor: 'var(--rm-accent)' }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {badge && badgeClass && (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${badgeClass}`}
            >
              {badge}
            </span>
          )}
          <span className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
            {title}
          </span>
        </span>
        <span className="mt-0.5 block text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {description}
        </span>
      </span>
    </label>
  );
}
