'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productService, type CreateProductRequest } from '@/services/api/productService';
import { useAppSelector } from '@/store';
import config from '@/config';

const PRODUCT_CATEGORIES = [
  { value: 'PERSONAL_CONSUMER', label: 'Personal & Consumer' },
  { value: 'BUSINESS_SME', label: 'Business & SME' },
  { value: 'SPECIALIZED_IRISH', label: 'Specialized Irish' },
];

const PRODUCT_TYPES_BY_CATEGORY: Record<string, { value: string; label: string }[]> = {
  PERSONAL_CONSUMER: [
    { value: 'PERSONAL_LOAN', label: 'Personal loan' },
    { value: 'PCP', label: 'Personal contract purchase (PCP)' },
    { value: 'HIRE_PURCHASE', label: 'Hire purchase (HP)' },
    { value: 'CREDIT_CARD', label: 'Credit card' },
    { value: 'OVERDRAFT', label: 'Overdraft' },
    { value: 'BNPL', label: 'Buy now pay later (BNPL)' },
    { value: 'MORTGAGE', label: 'Mortgage' },
  ],
  BUSINESS_SME: [
    { value: 'SME_TERM_LOAN', label: 'SME term loan' },
    { value: 'BUSINESS_OVERDRAFT', label: 'Business overdraft' },
    { value: 'INVOICE_FINANCE', label: 'Invoice finance / factoring' },
    { value: 'BUSINESS_CREDIT_CARD', label: 'Business credit card' },
    { value: 'COMMERCIAL_MORTGAGE', label: 'Commercial mortgage' },
    { value: 'ASSET_LEASING', label: 'Asset leasing / equipment finance' },
  ],
  SPECIALIZED_IRISH: [
    { value: 'AGRI_LOAN', label: 'Agri loan' },
    { value: 'CREDIT_UNION_LOAN', label: 'Credit union loan' },
    { value: 'GREEN_LOAN', label: 'Green loan / sustainable finance' },
    { value: 'MICROFINANCE', label: 'Microfinance / micro loan' },
  ],
};

const INTEREST_TYPES = [
  { value: 'FIXED', label: 'Fixed rate' },
  { value: 'VARIABLE', label: 'Variable rate' },
  { value: 'HYBRID', label: 'Hybrid (fixed and variable)' },
];

const REPAYMENT_FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
];

const REGULATORY_BODIES = [
  { value: 'CBI', label: 'Central Bank of Ireland (CBI)' },
  { value: 'CCPC', label: 'Competition & Consumer Protection Commission (CCPC)' },
  { value: 'ECB', label: 'European Central Bank (ECB)' },
  { value: 'EBA', label: 'European Banking Authority (EBA)' },
];

const CUSTOMER_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual customers' },
  { value: 'BUSINESS', label: 'Business customers' },
];

type TabId = 'basic' | 'financial' | 'eligibility' | 'features' | 'irish';

const TABS: { id: TabId; label: string }[] = [
  { id: 'basic', label: 'Basic information' },
  { id: 'financial', label: 'Pricing and terms' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'features', label: 'Features' },
  { id: 'irish', label: 'Irish and EU details' },
];

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  border: '1px solid var(--rm-border)',
  color: 'var(--rm-text)',
};

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return apiMessage || fallback;
}

/** Maps a field name back to the tab that renders it. */
function tabForField(field: string): TabId {
  if (
    ['productCode', 'productName', 'productType', 'productCategory', 'eligibleCustomerTypes'].includes(
      field
    )
  )
    return 'basic';
  if (
    [
      'minLoanAmount',
      'maxLoanAmount',
      'minInterestRate',
      'maxInterestRate',
      'minTermMonths',
      'maxTermMonths',
    ].includes(field)
  )
    return 'financial';
  return 'basic';
}

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabId>('basic');

  const getBankId = (): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          return userData.bankId || config.bank.defaultBankId;
        } catch {
          return config.bank.defaultBankId;
        }
      }
    }
    return config.bank.defaultBankId;
  };

  const [formData, setFormData] = useState<Partial<CreateProductRequest>>({
    bankId: getBankId(),
    productCategory: 'PERSONAL_CONSUMER',
    productType: 'PERSONAL_LOAN',
    interestType: 'FIXED',
    repaymentFrequency: 'MONTHLY',
    eligibleCustomerTypes: ['INDIVIDUAL', 'BUSINESS'],
    minLoanAmount: 1000,
    maxLoanAmount: 50000,
    minInterestRate: 5.0,
    maxInterestRate: 15.0,
    minTermMonths: 6,
    maxTermMonths: 60,
    prepaymentAllowed: true,
    collateralRequired: false,
    isOnlineApplicationEnabled: true,
    isFeatured: false,
    autoApprovalEnabled: false,
    slaDays: 3,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFieldErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCustomerTypeChange = (type: string) => {
    const currentTypes = formData.eligibleCustomerTypes || [];
    setFieldErrors(prev => {
      if (!prev.eligibleCustomerTypes) return prev;
      const next = { ...prev };
      delete next.eligibleCustomerTypes;
      return next;
    });
    if (currentTypes.includes(type)) {
      setFormData(prev => ({
        ...prev,
        eligibleCustomerTypes: currentTypes.filter(t => t !== type),
      }));
    } else {
      setFormData(prev => ({ ...prev, eligibleCustomerTypes: [...currentTypes, type] }));
    }
  };

  const handleCategoryChange = (category: string) => {
    const productTypes = PRODUCT_TYPES_BY_CATEGORY[category] || [];
    setFormData(prev => ({
      ...prev,
      productCategory: category,
      productType: productTypes[0]?.value || '',
    }));
  };

  const validate = (): { errors: Record<string, string>; tab: TabId | null } => {
    const errors: Record<string, string> = {};
    let tab: TabId | null = null;
    const add = (field: string, message: string, on: TabId) => {
      if (!errors[field]) {
        errors[field] = message;
        if (!tab) tab = on;
      }
    };

    if (!formData.productCode?.trim()) add('productCode', 'A product code is required.', 'basic');
    if (!formData.productName?.trim()) add('productName', 'A product name is required.', 'basic');
    if (!formData.productType) add('productType', 'Choose a product type.', 'basic');
    if (!formData.eligibleCustomerTypes || formData.eligibleCustomerTypes.length === 0)
      add('eligibleCustomerTypes', 'Select at least one eligible customer type.', 'basic');

    if (formData.minLoanAmount == null)
      add('minLoanAmount', 'A minimum loan amount is required.', 'financial');
    if (formData.maxLoanAmount == null)
      add('maxLoanAmount', 'A maximum loan amount is required.', 'financial');
    if (
      formData.minLoanAmount != null &&
      formData.maxLoanAmount != null &&
      formData.maxLoanAmount < formData.minLoanAmount
    )
      add('maxLoanAmount', 'The maximum must be greater than or equal to the minimum.', 'financial');

    if (formData.minInterestRate == null)
      add('minInterestRate', 'A minimum interest rate is required.', 'financial');
    if (formData.maxInterestRate == null)
      add('maxInterestRate', 'A maximum interest rate is required.', 'financial');
    if (
      formData.minInterestRate != null &&
      formData.maxInterestRate != null &&
      formData.maxInterestRate < formData.minInterestRate
    )
      add('maxInterestRate', 'The maximum rate must be greater than or equal to the minimum.', 'financial');

    if (formData.minTermMonths == null)
      add('minTermMonths', 'A minimum term is required.', 'financial');
    if (formData.maxTermMonths == null)
      add('maxTermMonths', 'A maximum term is required.', 'financial');
    if (
      formData.minTermMonths != null &&
      formData.maxTermMonths != null &&
      formData.maxTermMonths < formData.minTermMonths
    )
      add('maxTermMonths', 'The maximum term must be greater than or equal to the minimum.', 'financial');

    return { errors, tab };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const { errors, tab } = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (tab) setActiveTab(tab);
      const firstField = Object.keys(errors)[0];
      setFormError('Some details need attention before this product can be created.');
      window.setTimeout(() => document.getElementById(firstField)?.focus(), 0);
      return;
    }

    try {
      setSaving(true);
      await productService.createProduct({ ...formData, bankId: getBankId() } as CreateProductRequest);
      router.push('/dashboard/products');
    } catch (err) {
      console.error('Failed to create product:', err);
      // Scoped to the banner — every field keeps its typed value.
      setFormError(errorMessage(err, 'We could not create the product. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActiveTab(TABS[next].id);
    document.getElementById(`new-product-tab-${TABS[next].id}`)?.focus();
  };

  const typeOptions = PRODUCT_TYPES_BY_CATEGORY[formData.productCategory || ''] || [];

  return (
    <div className="space-y-6" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            style={{ color: 'var(--rm-text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Back to products
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            New product
          </h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Add a lending product to the catalogue. Fields marked with an asterisk are required.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* ══ Errors ══ */}
        {formError && (
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
                Nothing was created — everything you typed is still here.
              </p>
            </div>
          </div>
        )}

        {/* ══ Tabs ══ */}
        <div
          role="tablist"
          aria-label="Product sections"
          className="flex flex-wrap gap-1 rounded-full p-1"
          style={{ backgroundColor: 'var(--rm-card)' }}
        >
          {TABS.map((tab, i) => {
            const selected = activeTab === tab.id;
            const errorCount = Object.keys(fieldErrors).filter(f => tabForField(f) === tab.id).length;
            return (
              <button
                key={tab.id}
                id={`new-product-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`new-product-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={e => onTabKeyDown(e, i)}
                className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: selected ? 'var(--rm-accent-muted)' : 'transparent',
                  color: selected ? 'var(--rm-accent)' : 'var(--rm-text-muted)',
                }}
              >
                {tab.label}
                {errorCount > 0 && (
                  <span className="ml-1.5 tabular-nums" style={{ color: '#b91c1c' }}>
                    {errorCount} to fix
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══ Panels ══ */}
        <section
          id={`new-product-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`new-product-tab-${activeTab}`}
          tabIndex={0}
          className="rounded-3xl p-6 sm:p-7"
          style={{ backgroundColor: 'var(--rm-card)' }}
        >
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextField
                  id="productCode"
                  label="Product code"
                  name="productCode"
                  value={formData.productCode}
                  onChange={handleInputChange}
                  placeholder="e.g. PL-001"
                  required
                  error={fieldErrors.productCode}
                />
                <TextField
                  id="productName"
                  label="Product name"
                  name="productName"
                  value={formData.productName}
                  onChange={handleInputChange}
                  placeholder="e.g. Personal loan"
                  required
                  error={fieldErrors.productName}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <SelectField
                  id="productCategory"
                  label="Product category"
                  name="productCategory"
                  value={formData.productCategory}
                  onChange={e => handleCategoryChange(e.target.value)}
                  options={PRODUCT_CATEGORIES}
                  required
                />
                <SelectField
                  id="productType"
                  label="Product type"
                  name="productType"
                  value={formData.productType}
                  onChange={handleInputChange}
                  options={typeOptions}
                  required
                  error={fieldErrors.productType}
                  hint="Options follow the selected category"
                />
              </div>

              <TextField
                id="shortDescription"
                label="Short description"
                name="shortDescription"
                value={formData.shortDescription}
                onChange={handleInputChange}
                placeholder="Brief description for product cards"
                hint="Shown on product cards"
              />

              <TextAreaField
                id="detailedDescription"
                label="Detailed description"
                name="detailedDescription"
                value={formData.detailedDescription}
                onChange={handleInputChange}
                rows={4}
                placeholder="Full product description"
              />

              <fieldset>
                <legend className="mb-2 block text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                  Eligible customer types
                  <span aria-hidden="true" style={{ color: '#b91c1c' }}>
                    {' '}
                    *
                  </span>
                </legend>
                <div className="flex flex-wrap gap-5">
                  {CUSTOMER_TYPES.map(type => (
                    <CheckboxField
                      key={type.value}
                      id={`customerType-${type.value}`}
                      name={type.value}
                      label={type.label}
                      checked={formData.eligibleCustomerTypes?.includes(type.value) || false}
                      onChange={() => handleCustomerTypeChange(type.value)}
                    />
                  ))}
                </div>
                {fieldErrors.eligibleCustomerTypes ? (
                  <p role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
                    {fieldErrors.eligibleCustomerTypes}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    At least one customer type must be able to apply.
                  </p>
                )}
              </fieldset>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <TextField
                  id="minLoanAmount"
                  label="Minimum loan amount"
                  name="minLoanAmount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  value={formData.minLoanAmount}
                  onChange={handleInputChange}
                  required
                  error={fieldErrors.minLoanAmount}
                />
                <TextField
                  id="maxLoanAmount"
                  label="Maximum loan amount"
                  name="maxLoanAmount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  value={formData.maxLoanAmount}
                  onChange={handleInputChange}
                  required
                  error={fieldErrors.maxLoanAmount}
                />
                <TextField
                  id="defaultLoanAmount"
                  label="Default loan amount"
                  name="defaultLoanAmount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  value={formData.defaultLoanAmount}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                <SelectField
                  id="interestType"
                  label="Interest type"
                  name="interestType"
                  value={formData.interestType}
                  onChange={handleInputChange}
                  options={INTEREST_TYPES}
                  required
                />
                <TextField
                  id="minInterestRate"
                  label="Minimum interest rate (%)"
                  name="minInterestRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.minInterestRate}
                  onChange={handleInputChange}
                  required
                  error={fieldErrors.minInterestRate}
                />
                <TextField
                  id="maxInterestRate"
                  label="Maximum interest rate (%)"
                  name="maxInterestRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.maxInterestRate}
                  onChange={handleInputChange}
                  required
                  error={fieldErrors.maxInterestRate}
                />
                <TextField
                  id="defaultInterestRate"
                  label="Default interest rate (%)"
                  name="defaultInterestRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.defaultInterestRate}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                <TextField
                  id="minTermMonths"
                  label="Minimum term (months)"
                  name="minTermMonths"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.minTermMonths}
                  onChange={handleInputChange}
                  required
                  error={fieldErrors.minTermMonths}
                />
                <TextField
                  id="maxTermMonths"
                  label="Maximum term (months)"
                  name="maxTermMonths"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.maxTermMonths}
                  onChange={handleInputChange}
                  required
                  error={fieldErrors.maxTermMonths}
                />
                <TextField
                  id="defaultTermMonths"
                  label="Default term (months)"
                  name="defaultTermMonths"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.defaultTermMonths}
                  onChange={handleInputChange}
                />
                <SelectField
                  id="repaymentFrequency"
                  label="Repayment frequency"
                  name="repaymentFrequency"
                  value={formData.repaymentFrequency}
                  onChange={handleInputChange}
                  options={REPAYMENT_FREQUENCIES}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <TextField
                  id="processingFee"
                  label="Processing fee"
                  name="processingFee"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={formData.processingFee}
                  onChange={handleInputChange}
                />
                <TextField
                  id="processingFeePercentage"
                  label="Processing fee (%)"
                  name="processingFeePercentage"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.processingFeePercentage}
                  onChange={handleInputChange}
                />
                <TextField
                  id="latePaymentFee"
                  label="Late payment fee"
                  name="latePaymentFee"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={formData.latePaymentFee}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {activeTab === 'eligibility' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextField
                  id="minCustomerAge"
                  label="Minimum customer age"
                  name="minCustomerAge"
                  type="number"
                  inputMode="numeric"
                  min="18"
                  max="100"
                  value={formData.minCustomerAge}
                  onChange={handleInputChange}
                />
                <TextField
                  id="maxCustomerAge"
                  label="Maximum customer age"
                  name="maxCustomerAge"
                  type="number"
                  inputMode="numeric"
                  min="18"
                  max="100"
                  value={formData.maxCustomerAge}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextField
                  id="minCreditScore"
                  label="Minimum credit score"
                  name="minCreditScore"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="900"
                  value={formData.minCreditScore}
                  onChange={handleInputChange}
                />
                <TextField
                  id="minAnnualIncome"
                  label="Minimum annual income"
                  name="minAnnualIncome"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1000"
                  value={formData.minAnnualIncome}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextField
                  id="minYearsInBusiness"
                  label="Minimum years in business"
                  name="minYearsInBusiness"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={formData.minYearsInBusiness}
                  onChange={handleInputChange}
                  hint="Applies to business lending"
                />
                <TextField
                  id="minBusinessRevenue"
                  label="Minimum business revenue"
                  name="minBusinessRevenue"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1000"
                  value={formData.minBusinessRevenue}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <fieldset>
                  <legend className="mb-3 block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    Product features
                  </legend>
                  <div className="space-y-3">
                    <CheckboxField
                      id="prepaymentAllowed"
                      name="prepaymentAllowed"
                      label="Prepayment allowed"
                      checked={formData.prepaymentAllowed || false}
                      onChange={handleInputChange}
                    />
                    <CheckboxField
                      id="collateralRequired"
                      name="collateralRequired"
                      label="Collateral required"
                      checked={formData.collateralRequired || false}
                      onChange={handleInputChange}
                    />
                    <CheckboxField
                      id="downPaymentRequired"
                      name="downPaymentRequired"
                      label="Down payment required"
                      checked={formData.downPaymentRequired || false}
                      onChange={handleInputChange}
                    />
                    <CheckboxField
                      id="requiresGuarantor"
                      name="requiresGuarantor"
                      label="Guarantor required"
                      checked={formData.requiresGuarantor || false}
                      onChange={handleInputChange}
                    />
                    <CheckboxField
                      id="isFeatured"
                      name="isFeatured"
                      label="Featured product"
                      checked={formData.isFeatured || false}
                      onChange={handleInputChange}
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-3 block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    Application settings
                  </legend>
                  <div className="space-y-3">
                    <CheckboxField
                      id="isOnlineApplicationEnabled"
                      name="isOnlineApplicationEnabled"
                      label="Online applications enabled"
                      checked={formData.isOnlineApplicationEnabled || false}
                      onChange={handleInputChange}
                    />
                    <CheckboxField
                      id="autoApprovalEnabled"
                      name="autoApprovalEnabled"
                      label="Auto-approval enabled"
                      checked={formData.autoApprovalEnabled || false}
                      onChange={handleInputChange}
                    />
                  </div>
                </fieldset>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <TextField
                  id="prepaymentPenaltyPercentage"
                  label="Prepayment penalty (%)"
                  name="prepaymentPenaltyPercentage"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.prepaymentPenaltyPercentage}
                  onChange={handleInputChange}
                />
                <TextField
                  id="loanToValueRatio"
                  label="Loan to value ratio (%)"
                  name="loanToValueRatio"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.loanToValueRatio}
                  onChange={handleInputChange}
                />
                <TextField
                  id="slaDays"
                  label="Decision SLA (days)"
                  name="slaDays"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.slaDays}
                  onChange={handleInputChange}
                />
              </div>

              {formData.autoApprovalEnabled && (
                <div
                  className="grid grid-cols-1 gap-5 rounded-2xl p-5 md:grid-cols-2"
                  style={{ backgroundColor: 'var(--rm-input)' }}
                >
                  <TextField
                    id="autoApprovalMaxAmount"
                    label="Auto-approval maximum amount"
                    name="autoApprovalMaxAmount"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={formData.autoApprovalMaxAmount}
                    onChange={handleInputChange}
                  />
                  <TextField
                    id="autoApprovalMinCreditScore"
                    label="Auto-approval minimum credit score"
                    name="autoApprovalMinCreditScore"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="900"
                    value={formData.autoApprovalMinCreditScore}
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'irish' && (
            <div className="space-y-6">
              <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--rm-accent-muted)' }}>
                <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                  Irish and EU banking details
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  Fields used for Irish and EU regulatory disclosure on this product.
                </p>
              </div>

              <SelectField
                id="regulatoryBody"
                label="Regulatory body"
                name="regulatoryBody"
                value={formData.regulatoryBody}
                onChange={handleInputChange}
                options={[{ value: '', label: 'Not set' }, ...REGULATORY_BODIES]}
              />

              <TextAreaField
                id="interestLogicDescription"
                label="Interest logic"
                name="interestLogicDescription"
                value={formData.interestLogicDescription}
                onChange={handleInputChange}
                rows={3}
                placeholder="e.g. reducing balance, flat rate calculation"
                hint="Describe how interest is calculated"
              />

              <TextAreaField
                id="principalStructure"
                label="Principal structure"
                name="principalStructure"
                value={formData.principalStructure}
                onChange={handleInputChange}
                rows={3}
                placeholder="e.g. equal monthly instalments, balloon payment at the end"
                hint="Describe how principal repayment is structured"
              />

              <TextAreaField
                id="marketingDescription"
                label="Marketing description"
                name="marketingDescription"
                value={formData.marketingDescription}
                onChange={handleInputChange}
                rows={3}
                placeholder="Marketing copy for product promotion"
              />

              <TextAreaField
                id="termsAndConditions"
                label="Terms and conditions"
                name="termsAndConditions"
                value={formData.termsAndConditions}
                onChange={handleInputChange}
                rows={4}
                placeholder="Key terms and conditions for this product"
              />
            </div>
          )}
        </section>

        {/* ══ Actions ══ */}
        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href="/dashboard/products"
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {saving ? 'Creating…' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Form controls — every one pairs a visible <label htmlFor> with its control
// and wires errors through aria-describedby / aria-invalid.
// ============================================================================

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

function TextField({
  id,
  label,
  name,
  value,
  onChange,
  type = 'text',
  required,
  error,
  hint,
  min,
  max,
  step,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  name: string;
  value: string | number | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: '#b91c1c' }}>
            {' '}
            *
          </span>
        )}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`w-full rounded-xl px-3.5 py-2.5 text-base ${type === 'number' ? 'tabular-nums' : ''}`}
        style={{ ...inputStyle, borderColor: error ? 'rgba(239,68,68,0.75)' : 'var(--rm-border)' }}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  name,
  value,
  onChange,
  options,
  required,
  error,
  hint,
}: {
  id: string;
  label: string;
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: '#b91c1c' }}>
            {' '}
            *
          </span>
        )}
      </label>
      <select
        id={id}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className="w-full rounded-xl px-3.5 py-2.5 text-base"
        style={{ ...inputStyle, borderColor: error ? 'rgba(239,68,68,0.75)' : 'var(--rm-border)' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  name,
  value,
  onChange,
  rows = 3,
  required,
  error,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: '#b91c1c' }}>
            {' '}
            *
          </span>
        )}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className="w-full rounded-xl px-3.5 py-2.5 text-base"
        style={{ ...inputStyle, borderColor: error ? 'rgba(239,68,68,0.75)' : 'var(--rm-border)' }}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CheckboxField({
  id,
  name,
  label,
  checked,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4"
        style={{ accentColor: 'var(--rm-accent)' }}
      />
      {label}
    </label>
  );
}
