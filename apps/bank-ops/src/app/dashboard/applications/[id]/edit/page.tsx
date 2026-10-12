'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import { productService, type Product } from '@/services/api/productService';
import { customerService, type Customer } from '@/services/api/customerService';
import { STATUS_CONFIG, type LomsApplicationStatus } from '@/types/loms';
import config from '@/config';
import { formatCurrency } from '@/lib/format';
import DynamicProductFields, {
  type FormValues,
} from '@/components/applications/DynamicProductFields';
import { getProductFieldConfig } from '@/config/productFieldConfig';

/* Status wording is taken from the shared LOMS status configuration. */
const statusLabel = (status?: string): string => {
  if (!status) return 'Unknown';
  return STATUS_CONFIG[status as LomsApplicationStatus]?.label ?? status.replace(/_/g, ' ');
};

const fieldCls = 'w-full rounded-xl px-3.5 py-2.5 text-base transition-colors';
const baseStyle: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  color: 'var(--rm-text)',
  border: '1px solid var(--rm-border)',
};
const invalidStyle: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  color: 'var(--rm-text)',
  border: '1px solid rgba(239,68,68,0.55)',
};
const cardStyle: React.CSSProperties = { backgroundColor: 'var(--rm-card)' };

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" style={{ color: '#dc2626' }}>
        {' '}
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
      {message}
    </p>
  );
}

/* Label + control + inline error scaffolding for the loan request fields. */
function describedBy(id: string, error?: string, hint?: boolean) {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
}

export default function EditApplicationPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const { user: currentUser } = useAppSelector(state => state.auth);
  const bankId = config.bank?.defaultBankId || '123e4567-e89b-12d3-a456-426614174000';

  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  /* Scoped: the customer panel is supplementary, so its failure must not
     blank the form or discard anything the RM has typed. */
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [requestedTermMonths, setRequestedTermMonths] = useState('');
  const [requestedInterestRate, setRequestedInterestRate] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanPurposeDescription, setLoanPurposeDescription] = useState('');

  // Product-specific additional fields (key-value map driven by productFieldConfig)
  const [additionalData, setAdditionalData] = useState<FormValues>({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setCustomerError(null);

      const [appData, productsData] = await Promise.all([
        applicationService.getApplication(applicationId),
        productService.getAllProducts(bankId),
      ]);

      setApplication(appData);
      setProducts(productsData);

      // Fetch full customer details — secondary, failures stay in their own panel.
      if (appData.customerId) {
        try {
          const customerData = await customerService.getCustomerById(appData.customerId);
          setCustomer(customerData);
        } catch (custErr) {
          console.error('Failed to load customer details:', custErr);
          setCustomer(null);
          setCustomerError('Customer details could not be loaded. The application form is unaffected.');
        }
      }

      // Populate form fields
      setSelectedProductId(appData.productId || '');
      setRequestedAmount(appData.requestedAmount?.toString() || '');
      setRequestedTermMonths(appData.requestedTermMonths?.toString() || '');
      // Interest rate is stored as a percentage (9.5 = 9.5%)
      setRequestedInterestRate(
        appData.requestedInterestRate != null ? appData.requestedInterestRate.toString() : ''
      );
      setLoanPurpose(appData.loanPurpose || '');
      setLoanPurposeDescription(appData.loanPurposeDescription || '');

      // Populate product-specific additional data from known application fields
      const initialAdditional: FormValues = {};
      const fieldMappings: Array<{ key: string; value: string | number | undefined | null }> = [
        { key: 'propertyAddress', value: appData.propertyAddress },
        { key: 'propertyCity', value: appData.propertyCity },
        { key: 'propertyState', value: appData.propertyState },
        { key: 'propertyValue', value: appData.propertyValue },
        { key: 'deposit_amount', value: appData.downPaymentAmount },
        { key: 'employmentStatus', value: appData.employmentStatus },
        { key: 'employerName', value: appData.employerName },
        { key: 'annualIncome', value: appData.statedAnnualIncome },
      ];

      for (const { key, value } of fieldMappings) {
        if (value != null && value !== '') {
          initialAdditional[key] = value.toString();
        }
      }

      // Also load any previously-saved additionalData from the response
      if ((appData as any).additionalData && typeof (appData as any).additionalData === 'object') {
        Object.assign(initialAdditional, (appData as any).additionalData);
      }

      setAdditionalData(initialAdditional);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  // Hooks must be called unconditionally (before any early returns)
  const selectedProduct = products.find(p => p.productId === selectedProductId);
  const productType = selectedProduct?.productType || '';
  const fieldConfig = useMemo(() => getProductFieldConfig(productType), [productType]);

  // Dynamic labels from product config
  const amountLabel = fieldConfig.amountLabel || 'Requested amount';
  const termLabel = fieldConfig.termLabel;
  const hideTerm = termLabel === '';

  // Handler for product-specific field changes
  const handleAdditionalChange = useCallback((key: string, value: string) => {
    setAdditionalData(prev => ({ ...prev, [key]: value }));
  }, []);

  /* Validation — every threshold comes from the selected product record. */
  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};

    if (!selectedProductId) {
      errs.selectedProductId = 'Choose the product for this application.';
    }

    const amount = parseFloat(requestedAmount);
    if (!requestedAmount.trim()) {
      errs.requestedAmount = `Enter the ${amountLabel.toLowerCase()}.`;
    } else if (Number.isNaN(amount) || amount <= 0) {
      errs.requestedAmount = 'Enter an amount greater than zero.';
    } else if (selectedProduct) {
      if (selectedProduct.minLoanAmount && amount < selectedProduct.minLoanAmount)
        errs.requestedAmount = `The minimum for this product is ${formatCurrency(selectedProduct.minLoanAmount)}.`;
      else if (selectedProduct.maxLoanAmount && amount > selectedProduct.maxLoanAmount)
        errs.requestedAmount = `The maximum for this product is ${formatCurrency(selectedProduct.maxLoanAmount)}.`;
    }

    if (!hideTerm) {
      const term = parseInt(requestedTermMonths, 10);
      if (!requestedTermMonths.trim()) {
        errs.requestedTermMonths = `Enter the ${termLabel?.toLowerCase() || 'term'}.`;
      } else if (Number.isNaN(term) || term <= 0) {
        errs.requestedTermMonths = 'Enter a whole number of months greater than zero.';
      } else if (selectedProduct) {
        if (selectedProduct.minTermMonths && term < selectedProduct.minTermMonths)
          errs.requestedTermMonths = `The minimum term is ${selectedProduct.minTermMonths} months.`;
        else if (selectedProduct.maxTermMonths && term > selectedProduct.maxTermMonths)
          errs.requestedTermMonths = `The maximum term is ${selectedProduct.maxTermMonths} months.`;
      }
    }

    if (requestedInterestRate.trim()) {
      const rate = parseFloat(requestedInterestRate);
      if (Number.isNaN(rate) || rate < 0) {
        errs.requestedInterestRate = 'Enter a rate of zero or more.';
      } else if (selectedProduct) {
        if (selectedProduct.minInterestRate != null && rate < selectedProduct.minInterestRate)
          errs.requestedInterestRate = `The minimum rate is ${selectedProduct.minInterestRate.toFixed(2)}%.`;
        else if (selectedProduct.maxInterestRate != null && rate > selectedProduct.maxInterestRate)
          errs.requestedInterestRate = `The maximum rate is ${selectedProduct.maxInterestRate.toFixed(2)}%.`;
      }
    }

    if (!loanPurpose) {
      errs.loanPurpose = 'Choose the purpose of the loan.';
    }

    return errs;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const key = Object.keys(errs).find(k => errs[k]);
    if (!key) return;
    const el = document.getElementById(`field-${key}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      const count = Object.keys(errs).length;
      setError(
        `${count} field${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention before this application can be saved.`
      );
      setSuccess(null);
      focusFirstError(errs);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updateData: any = {
        productId: selectedProductId,
        requestedAmount: parseFloat(requestedAmount),
        requestedTermMonths: parseInt(requestedTermMonths, 10) || undefined,
        loanPurpose,
      };

      if (requestedInterestRate) {
        updateData.requestedInterestRate = parseFloat(requestedInterestRate);
      }
      if (loanPurposeDescription) {
        updateData.loanPurposeDescription = loanPurposeDescription;
      }

      // Map product-specific fields back to known backend columns
      const knownPropertyKeys = [
        'propertyAddress',
        'propertyCity',
        'propertyState',
        'propertyPostalCode',
        'propertyType',
      ];
      for (const k of knownPropertyKeys) {
        if (additionalData[k]) updateData[k] = additionalData[k];
      }
      if (additionalData['propertyValue']) {
        updateData.propertyValue = parseFloat(additionalData['propertyValue']);
      }
      if (additionalData['deposit_amount'] || additionalData['downPaymentAmount']) {
        updateData.downPaymentAmount = parseFloat(
          additionalData['deposit_amount'] || additionalData['downPaymentAmount'] || '0'
        );
      }
      // Vehicle fields
      if (additionalData['vehicleMake']) updateData.vehicleMake = additionalData['vehicleMake'];
      if (additionalData['vehicleModel']) updateData.vehicleModel = additionalData['vehicleModel'];
      if (additionalData['vehicleYear'])
        updateData.vehicleYear = parseInt(additionalData['vehicleYear'], 10);
      if (additionalData['vehicleCondition'])
        updateData.vehicleCondition = additionalData['vehicleCondition'];
      if (additionalData['vehicleValue'])
        updateData.vehicleValue = parseFloat(additionalData['vehicleValue']);
      // Employment / income
      if (additionalData['employmentStatus'])
        updateData.employmentStatus = additionalData['employmentStatus'];
      if (additionalData['employerName']) updateData.employerName = additionalData['employerName'];
      if (additionalData['annualIncome'])
        updateData.statedAnnualIncome = parseFloat(additionalData['annualIncome']);

      // Store remaining product-specific fields as additionalData JSON
      const backendMappedKeys = new Set([
        ...knownPropertyKeys,
        'propertyValue',
        'deposit_amount',
        'downPaymentAmount',
        'vehicleMake',
        'vehicleModel',
        'vehicleYear',
        'vehicleCondition',
        'vehicleValue',
        'employmentStatus',
        'employerName',
        'annualIncome',
      ]);
      const extraData: Record<string, string> = {};
      for (const [k, v] of Object.entries(additionalData)) {
        if (!backendMappedKeys.has(k) && v) {
          extraData[k] = v;
        }
      }
      if (Object.keys(extraData).length > 0) {
        updateData.additionalData = extraData;
      }

      await applicationService.updateApplication(applicationId, updateData);
      setSuccess('Application updated. Returning to the application…');

      setTimeout(() => {
        router.push(`/dashboard/applications/${applicationId}`);
      }, 1500);
    } catch (err: unknown) {
      // Scoped to the save action — nothing typed is lost.
      setError(err instanceof Error ? err.message : 'Failed to update application');
    } finally {
      setSaving(false);
    }
  };

  // Get effective status - status and lomsStatus are now unified
  const effectiveStatus = application?.status || '';

  const canEdit =
    application &&
    [
      'DRAFT',
      'RETURNED',
      'SUBMITTED',
      'PENDING_KYC',
      'PENDING_CREDIT_CHECK',
      'IN_UNDERWRITING',
    ].includes(effectiveStatus) &&
    currentUser?.userId === application.createdByUserId;

  const hasEmployment = !!(
    customer &&
    (customer.employmentStatus ||
      customer.employerName ||
      customer.occupation ||
      customer.annualIncome != null ||
      customer.annualRevenue != null ||
      customer.netWorth != null)
  );
  const hasCompliance = !!(
    customer &&
    (customer.kycStatus ||
      customer.amlCheckStatus ||
      customer.creditScore != null ||
      customer.riskRating)
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
          <div className="h-4 w-40 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
          <div className="mt-4 h-8 w-64 max-w-full rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
          <div className="mt-3 h-4 w-80 max-w-full rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
        </div>
        {[0, 1].map(i => (
          <div key={i} className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
            <div className="h-6 w-48 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {[0, 1, 2, 3].map(j => (
                <div key={j} className="space-y-2">
                  <div className="h-3 w-24 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                  <div className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="sr-only" role="status">
          Loading application
        </p>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div role="alert" className="rounded-3xl p-6 sm:p-7 text-center" style={cardStyle}>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            We could not open this application for editing
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {error}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={loadData}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              Try again
            </button>
            <Link
              href={`/dashboard/applications/${applicationId}`}
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Back to application
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl p-6 sm:p-7 text-center" style={cardStyle}>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            This application cannot be edited
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Only the relationship manager who created it can edit an application, and only while it
            is a draft or still in review.
          </p>
          <Link
            href={`/dashboard/applications/${applicationId}`}
            className="mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            Back to application
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <header className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
        <Link
          href={`/dashboard/applications/${applicationId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to application
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          Edit application
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Application {application?.applicationNumber} · Status: {statusLabel(application?.status)}
        </p>
      </header>

      {success && (
        <p
          role="status"
          className="rounded-2xl px-5 py-4 text-sm"
          style={{ backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }}
        >
          {success}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl px-5 py-4"
          style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
        >
          <svg className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#dc2626' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm" style={{ color: '#b91c1c' }}>
            {error} Your entries were kept.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} noValidate className="space-y-6">
        {/* Customer details */}
        <section className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Customer details
            </h2>
            {customer && (
              <Link
                href={`/dashboard/customers/${customer.customerId}`}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
              >
                <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                View customer profile
              </Link>
            )}
          </div>

          {customerError && (
            <p
              role="alert"
              className="mt-4 rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309' }}
            >
              {customerError}
            </p>
          )}

          {customer && (
            <>
              <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Customer name
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {customerService.getCustomerName(customer)}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Customer number
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {customer.customerNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Customer type
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {customerService.formatCustomerType(customer.customerType)}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Email
                </dt>
                <dd className="mt-1 text-base break-words" style={{ color: 'var(--rm-text)' }}>
                  {customer.primaryEmail || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Phone
                </dt>
                <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                  {customer.primaryPhone || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Status
                </dt>
                <dd className="mt-1">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                    style={
                      customer.customerStatus === 'ACTIVE'
                        ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                        : { backgroundColor: 'rgba(127,127,127,0.14)', color: 'var(--rm-text-secondary)' }
                    }
                  >
                    {(customer.customerStatus || 'Unknown').replace(/_/g, ' ')}
                  </span>
                </dd>
              </div>

              {customer.addressLine1 && (
                <div className="md:col-span-2">
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Address
                  </dt>
                  <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                    {[
                      customer.addressLine1,
                      customer.addressLine2,
                      customer.city,
                      customer.stateProvince,
                      customer.postalCode,
                      customer.country,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </dd>
                </div>
              )}

              {customer.dateOfBirth && (
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Date of birth
                  </dt>
                  <dd className="mt-1 text-base tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {new Date(customer.dateOfBirth).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
              )}
              </dl>

              {hasEmployment && (
                <>
                  <h3 className="mt-6 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                    Employment and financial
                  </h3>
                  <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
                  {customer.employmentStatus && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Employment status
                      </dt>
                      <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                        {customer.employmentStatus.replace(/_/g, ' ')}
                      </dd>
                    </div>
                  )}
                  {customer.employerName && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Employer
                      </dt>
                      <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                        {customer.employerName}
                      </dd>
                    </div>
                  )}
                  {customer.occupation && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Occupation
                      </dt>
                      <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                        {customer.occupation}
                      </dd>
                    </div>
                  )}
                  {customer.annualIncome != null && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Annual income
                      </dt>
                      <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {formatCurrency(customer.annualIncome)}
                      </dd>
                    </div>
                  )}
                  {customer.annualRevenue != null && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Annual revenue
                      </dt>
                      <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {formatCurrency(customer.annualRevenue)}
                      </dd>
                    </div>
                  )}
                  {customer.netWorth != null && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Net worth
                      </dt>
                      <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {formatCurrency(customer.netWorth)}
                      </dd>
                    </div>
                  )}
                  </dl>
                </>
              )}

              {hasCompliance && (
                <>
                  <h3 className="mt-6 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                    KYC, AML and credit
                  </h3>
                  <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
                  {customer.kycStatus && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        KYC status
                      </dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                          style={
                            customer.kycStatus === 'COMPLETED' || customer.kycStatus === 'VERIFIED'
                              ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                              : { backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309' }
                          }
                        >
                          {customer.kycStatus.replace(/_/g, ' ')}
                        </span>
                        {customer.kycCompletionDate && (
                          <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                            {new Date(customer.kycCompletionDate).toLocaleDateString()}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {customer.amlCheckStatus && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        AML check
                      </dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                          style={
                            customer.amlCheckStatus === 'CLEAR' || customer.amlCheckStatus === 'COMPLETED'
                              ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                              : { backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309' }
                          }
                        >
                          {customer.amlCheckStatus.replace(/_/g, ' ')}
                        </span>
                        {customer.amlCheckDate && (
                          <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                            {new Date(customer.amlCheckDate).toLocaleDateString()}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {customer.creditScore != null && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Credit score
                      </dt>
                      <dd className="mt-1 flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                          {customer.creditScore}
                        </span>
                        {customer.creditScoreDate && (
                          <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                            as of {new Date(customer.creditScoreDate).toLocaleDateString()}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {customer.riskRating && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Risk rating
                      </dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                          style={
                            customer.riskRating === 'LOW'
                              ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                              : customer.riskRating === 'MEDIUM'
                                ? { backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309' }
                                : { backgroundColor: 'rgba(239,68,68,0.13)', color: '#b91c1c' }
                          }
                        >
                          {customer.riskRating.replace(/_/g, ' ')}
                        </span>
                        {customer.riskRatingDate && (
                          <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                            {new Date(customer.riskRatingDate).toLocaleDateString()}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  </dl>
                </>
              )}
            </>
          )}
        </section>

        {/* Loan request */}
        <section className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
          <h2 className="mb-5 text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Loan request details
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Product */}
            <div>
              <label htmlFor="field-selectedProductId" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                Product
                <RequiredMark />
              </label>
              <select
                id="field-selectedProductId"
                required
                aria-required="true"
                aria-invalid={fieldErrors.selectedProductId ? true : undefined}
                aria-describedby={describedBy('field-selectedProductId', fieldErrors.selectedProductId)}
                value={selectedProductId}
                onChange={e => {
                  setSelectedProductId(e.target.value);
                  // Purpose options differ per product, so reset the choice.
                  setLoanPurpose('');
                  setFieldErrors(prev => ({ ...prev, selectedProductId: '', loanPurpose: '' }));
                }}
                className={fieldCls}
                style={fieldErrors.selectedProductId ? invalidStyle : baseStyle}
              >
                <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.productId} value={product.productId}>
                    {product.productName}
                  </option>
                ))}
              </select>
              <FieldError id="field-selectedProductId-error" message={fieldErrors.selectedProductId} />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="field-requestedAmount" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                {amountLabel}
                <RequiredMark />
              </label>
              <input
                id="field-requestedAmount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                required
                aria-required="true"
                aria-invalid={fieldErrors.requestedAmount ? true : undefined}
                aria-describedby={
                  describedBy('field-requestedAmount', fieldErrors.requestedAmount, !!selectedProduct)
                }
                value={requestedAmount}
                onChange={e => {
                  setRequestedAmount(e.target.value);
                  setFieldErrors(prev => ({ ...prev, requestedAmount: '' }));
                }}
                className={fieldCls}
                style={fieldErrors.requestedAmount ? invalidStyle : baseStyle}
                placeholder="Enter amount"
              />
              {selectedProduct && (
                <p id="field-requestedAmount-hint" className="mt-1.5 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                  Allowed range: {formatCurrency(selectedProduct.minLoanAmount || 0)} to{' '}
                  {formatCurrency(selectedProduct.maxLoanAmount || 0)}
                </p>
              )}
              <FieldError id="field-requestedAmount-error" message={fieldErrors.requestedAmount} />
            </div>

            {/* Term */}
            {!hideTerm && (
              <div>
                <label htmlFor="field-requestedTermMonths" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  {termLabel || 'Term (months)'}
                  <RequiredMark />
                </label>
                <input
                  id="field-requestedTermMonths"
                  type="number"
                  min={1}
                  step="1"
                  inputMode="numeric"
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.requestedTermMonths ? true : undefined}
                  aria-describedby={
                    describedBy('field-requestedTermMonths', fieldErrors.requestedTermMonths, !!selectedProduct)
                  }
                  value={requestedTermMonths}
                  onChange={e => {
                    setRequestedTermMonths(e.target.value);
                    setFieldErrors(prev => ({ ...prev, requestedTermMonths: '' }));
                  }}
                  className={fieldCls}
                  style={fieldErrors.requestedTermMonths ? invalidStyle : baseStyle}
                  placeholder="Enter term"
                />
                {selectedProduct && (
                  <p id="field-requestedTermMonths-hint" className="mt-1.5 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                    Allowed range: {selectedProduct.minTermMonths} to {selectedProduct.maxTermMonths} months
                  </p>
                )}
                <FieldError
                  id="field-requestedTermMonths-error"
                  message={fieldErrors.requestedTermMonths}
                />
              </div>
            )}

            {/* Interest rate */}
            <div>
              <label htmlFor="field-requestedInterestRate" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                Interest rate (%)
              </label>
              <input
                id="field-requestedInterestRate"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                aria-invalid={fieldErrors.requestedInterestRate ? true : undefined}
                aria-describedby={
                  describedBy('field-requestedInterestRate', fieldErrors.requestedInterestRate, !!selectedProduct)
                }
                value={requestedInterestRate}
                onChange={e => {
                  setRequestedInterestRate(e.target.value);
                  setFieldErrors(prev => ({ ...prev, requestedInterestRate: '' }));
                }}
                className={fieldCls}
                style={fieldErrors.requestedInterestRate ? invalidStyle : baseStyle}
                placeholder="Enter interest rate"
              />
              {selectedProduct &&
                selectedProduct.minInterestRate != null &&
                selectedProduct.maxInterestRate != null && (
                  <p id="field-requestedInterestRate-hint" className="mt-1.5 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                    Allowed range: {selectedProduct.minInterestRate.toFixed(2)}% to{' '}
                    {selectedProduct.maxInterestRate.toFixed(2)}%
                  </p>
                )}
              <FieldError
                id="field-requestedInterestRate-error"
                message={fieldErrors.requestedInterestRate}
              />
            </div>

            {/* Purpose */}
            <div>
              <label htmlFor="field-loanPurpose" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                Loan purpose
                <RequiredMark />
              </label>
              <select
                id="field-loanPurpose"
                required
                aria-required="true"
                aria-invalid={fieldErrors.loanPurpose ? true : undefined}
                aria-describedby={describedBy('field-loanPurpose', fieldErrors.loanPurpose)}
                value={loanPurpose}
                onChange={e => {
                  setLoanPurpose(e.target.value);
                  setFieldErrors(prev => ({ ...prev, loanPurpose: '' }));
                }}
                className={fieldCls}
                style={fieldErrors.loanPurpose ? invalidStyle : baseStyle}
              >
                <option value="">Select purpose</option>
                {fieldConfig.purposeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FieldError id="field-loanPurpose-error" message={fieldErrors.loanPurpose} />
            </div>

            {/* Purpose description */}
            <div className="md:col-span-2">
              <label htmlFor="field-loanPurposeDescription" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                Purpose description
              </label>
              <textarea
                id="field-loanPurposeDescription"
                rows={2}
                value={loanPurposeDescription}
                onChange={e => setLoanPurposeDescription(e.target.value)}
                className={`${fieldCls} resize-y`}
                style={baseStyle}
                placeholder="Additional details about the loan purpose"
              />
            </div>
          </div>

          {/* Product-specific dynamic fields */}
          {productType && (
            <div
              role="group"
              aria-label="Product-specific details"
              className="mt-6"
            >
              <DynamicProductFields
                productType={productType}
                values={additionalData}
                onChange={handleAdditionalChange}
              />
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/applications/${applicationId}`)}
            disabled={saving}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        {saving && (
          <p className="sr-only" role="status">
            Saving changes
          </p>
        )}
      </form>
    </div>
  );
}
