'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  applicationService,
  ApplicationContext,
  CreateApplicationPayload,
  LoanApplication,
  LOAN_PURPOSE_LABELS,
  LoanPurpose,
  FACILITY_TYPE_LABELS,
} from '@/services/api/application-service';
import { productService, LoanProduct, PRODUCT_TYPE_LABELS } from '@/services/api/product-service';
import { formatCurrency } from '@/lib/format';
import {
  partyService,
  PartyMember,
  PartyValidation,
  PARTY_ROLE_LABELS,
} from '@/services/api/party-service';

// ─── Types ─────────────────────────────────────────────────────

type WizardStep = 'product' | 'loan' | 'parties' | 'financial' | 'employment' | 'review';

const PERSONAL_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'product', label: 'Product' },
  { key: 'loan', label: 'Loan Details' },
  { key: 'financial', label: 'Financial Info' },
  { key: 'employment', label: 'Employment' },
  { key: 'review', label: 'Review & Submit' },
];

const BUSINESS_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'product', label: 'Product' },
  { key: 'loan', label: 'Facility Details' },
  { key: 'parties', label: 'People & Roles' },
  { key: 'financial', label: 'Financials' },
  { key: 'review', label: 'Review & Submit' },
];

const BUSINESS_PRODUCT_TYPES = [
  'BUSINESS_LOAN',
  'BUSINESS_LINE_OF_CREDIT',
  'WORKING_CAPITAL_LOAN',
  'EQUIPMENT_FINANCING',
  'COMMERCIAL_REAL_ESTATE',
  'CONSTRUCTION_LOAN',
  'TERM_LOAN',
  'OVERDRAFT',
  'REVOLVING_CREDIT',
];

const EMPLOYMENT_STATUSES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'BUSINESS_OWNER', label: 'Business Owner' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'HOMEMAKER', label: 'Homemaker' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const PROPERTY_TYPES = [
  { value: 'APARTMENT', label: 'Apartment / Flat' },
  { value: 'HOUSE', label: 'House' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'PLOT', label: 'Plot / Land' },
  { value: 'COMMERCIAL', label: 'Commercial Property' },
  { value: 'OTHER', label: 'Other' },
];

const VEHICLE_CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used / Pre-owned' },
  { value: 'CERTIFIED_PRE_OWNED', label: 'Certified Pre-Owned' },
];

const HOME_PURPOSES = ['HOME_PURCHASE', 'HOME_CONSTRUCTION', 'HOME_RENOVATION', 'HOME_REFINANCE'];
const VEHICLE_PURPOSES = ['VEHICLE_PURCHASE'];

// ─── Page ──────────────────────────────────────────────────────

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCode = searchParams.get('product');

  // State
  const [step, setStep] = useState<WizardStep>(preselectedCode ? 'loan' : 'product');
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedApp, setSavedApp] = useState<LoanApplication | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Party state (business applications)
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [partyValidation, setPartyValidation] = useState<PartyValidation | null>(null);
  const [loadingParties, setLoadingParties] = useState(false);

  // Determine if this is a business application
  const isBusiness = useMemo(() => {
    if (!selectedProduct) return appContext?.isBusiness ?? false;
    return BUSINESS_PRODUCT_TYPES.includes(selectedProduct.productType);
  }, [selectedProduct, appContext]);

  const STEPS = isBusiness ? BUSINESS_STEPS : PERSONAL_STEPS;

  // Form data
  const [form, setForm] = useState({
    requestedAmount: '',
    requestedTermMonths: '',
    requestedInterestRate: '',
    loanPurpose: '' as string,
    loanPurposeDescription: '',
    statedAnnualIncome: '',
    statedMonthlyIncome: '',
    statedMonthlyExpenses: '',
    employmentStatus: '',
    employerName: '',
    yearsWithEmployer: '',
    jobTitle: '',
    // Business-specific
    businessAnnualRevenue: '',
    businessVintageYears: '',
    facilityType: '',
    facilityPurposeDescription: '',
    // Property (HOME_PURCHASE, HOME_CONSTRUCTION, HOME_RENOVATION, HOME_REFINANCE)
    propertyAddress: '',
    propertyCity: '',
    propertyState: '',
    propertyPostalCode: '',
    propertyType: '',
    propertyValue: '',
    downPaymentAmount: '',
    // Vehicle (VEHICLE_PURCHASE)
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleCondition: '',
    vehicleValue: '',
  });

  // Declarations & consent
  const [declarations, setDeclarations] = useState({
    informationAccurate: false,
    consentCreditCheck: false,
    termsAccepted: false,
  });

  // Load products + context
  useEffect(() => {
    loadProducts();
    loadContext();
  }, []);

  // Load parties when entering parties step
  useEffect(() => {
    if (step === 'parties' && isBusiness) {
      loadParties();
    }
  }, [step, isBusiness]);

  async function loadContext() {
    try {
      const ctx = await applicationService.getContext();
      setAppContext(ctx);
    } catch {
      // Context not available — default to personal
    }
  }

  async function loadParties() {
    try {
      setLoadingParties(true);
      const [members, val] = await Promise.all([
        partyService.listParties(),
        partyService.validateParties(),
      ]);
      setPartyMembers(members);
      setPartyValidation(val);
    } catch {
      // Party data not available — may not be a business customer
    } finally {
      setLoadingParties(false);
    }
  }

  async function loadProducts() {
    try {
      setLoadingProducts(true);
      const data = await productService.getProducts();
      setProducts(data.filter(p => p.isOnlineApplicationEnabled !== false));

      if (preselectedCode) {
        const match = data.find(p => p.productCode === preselectedCode);
        if (match) {
          setSelectedProduct(match);
          setForm(prev => ({
            ...prev,
            requestedAmount: match.defaultLoanAmount?.toString() || '',
            requestedTermMonths: match.defaultTermMonths?.toString() || '',
            requestedInterestRate: match.defaultInterestRate?.toString() || '',
          }));
        }
      }
    } catch {
      // Products failed to load — user can still manually proceed
    } finally {
      setLoadingProducts(false);
    }
  }

  function selectProduct(p: LoanProduct) {
    setSelectedProduct(p);
    setForm(prev => ({
      ...prev,
      requestedAmount: p.defaultLoanAmount?.toString() || prev.requestedAmount,
      requestedTermMonths: p.defaultTermMonths?.toString() || prev.requestedTermMonths,
      requestedInterestRate: p.defaultInterestRate?.toString() || prev.requestedInterestRate,
    }));
    setStep('loan');
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function buildPayload(): CreateApplicationPayload {
    const payload: CreateApplicationPayload = {
      productId: selectedProduct!.productId,
      requestedAmount: parseFloat(form.requestedAmount),
      requestedTermMonths: parseInt(form.requestedTermMonths, 10),
      requestedInterestRate: form.requestedInterestRate
        ? parseFloat(form.requestedInterestRate)
        : undefined,
      loanPurpose: form.loanPurpose,
      loanPurposeDescription: form.loanPurposeDescription || undefined,
      statedAnnualIncome: form.statedAnnualIncome ? parseFloat(form.statedAnnualIncome) : undefined,
      statedMonthlyIncome: form.statedMonthlyIncome
        ? parseFloat(form.statedMonthlyIncome)
        : undefined,
      statedMonthlyExpenses: form.statedMonthlyExpenses
        ? parseFloat(form.statedMonthlyExpenses)
        : undefined,
      employmentStatus: form.employmentStatus || undefined,
      employerName: form.employerName || undefined,
      yearsWithEmployer: form.yearsWithEmployer ? parseInt(form.yearsWithEmployer, 10) : undefined,
      jobTitle: form.jobTitle || undefined,
    };

    // Business fields
    if (isBusiness) {
      if (form.businessAnnualRevenue)
        payload.businessAnnualRevenue = parseFloat(form.businessAnnualRevenue);
      if (form.businessVintageYears)
        payload.businessVintageYears = parseInt(form.businessVintageYears, 10);
      if (form.facilityType) payload.facilityType = form.facilityType;
      if (form.facilityPurposeDescription)
        payload.facilityPurposeDescription = form.facilityPurposeDescription;
    }

    // Property fields (HOME purposes)
    if (HOME_PURPOSES.includes(form.loanPurpose)) {
      if (form.propertyAddress) payload.propertyAddress = form.propertyAddress;
      if (form.propertyCity) payload.propertyCity = form.propertyCity;
      if (form.propertyState) payload.propertyState = form.propertyState;
      if (form.propertyPostalCode) payload.propertyPostalCode = form.propertyPostalCode;
      if (form.propertyType) payload.propertyType = form.propertyType;
      if (form.propertyValue) payload.propertyValue = parseFloat(form.propertyValue);
      if (form.downPaymentAmount) payload.downPaymentAmount = parseFloat(form.downPaymentAmount);
    }

    // Vehicle fields
    if (VEHICLE_PURPOSES.includes(form.loanPurpose)) {
      if (form.vehicleMake) payload.vehicleMake = form.vehicleMake;
      if (form.vehicleModel) payload.vehicleModel = form.vehicleModel;
      if (form.vehicleYear) payload.vehicleYear = parseInt(form.vehicleYear, 10);
      if (form.vehicleCondition) payload.vehicleCondition = form.vehicleCondition;
      if (form.vehicleValue) payload.vehicleValue = parseFloat(form.vehicleValue);
    }

    return payload;
  }

  async function saveDraft() {
    if (!selectedProduct) return;
    try {
      setSaving(true);
      setError(null);
      const payload = buildPayload();
      if (savedApp) {
        const updated = await applicationService.update(savedApp.applicationId, payload);
        setSavedApp(updated);
      } else {
        const created = await applicationService.create(payload);
        setSavedApp(created);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }

  async function submitApplication() {
    if (!selectedProduct) return;
    try {
      setSubmitting(true);
      setError(null);

      let appId: string;
      if (savedApp) {
        // Update before submit
        const updated = await applicationService.update(savedApp.applicationId, buildPayload());
        appId = updated.applicationId;
      } else {
        const created = await applicationService.create(
          buildPayload(),
          isBusiness ? 'BUSINESS' : undefined
        );
        appId = created.applicationId;
      }

      // For business applications, link parties before submitting
      if (isBusiness) {
        try {
          await partyService.linkParties(appId);
        } catch {
          // Non-blocking — parties may already be linked or not required
        }
      }

      await applicationService.submit(appId);
      router.push(`/portal/applications/${appId}?submitted=1`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.findIndex(s => s.key === step);

  function canGoNext(): boolean {
    switch (step) {
      case 'product':
        return !!selectedProduct;
      case 'loan':
        return !!(form.requestedAmount && form.requestedTermMonths && form.loanPurpose);
      case 'parties':
        return true; // can proceed with warnings
      case 'financial':
        return true; // optional
      case 'employment':
        return true; // optional
      default:
        return false;
    }
  }

  function goNext() {
    const i = stepIndex;
    if (i < STEPS.length - 1) setStep(STEPS[i + 1].key);
  }

  function goBack() {
    const i = stepIndex;
    if (i > 0) setStep(STEPS[i - 1].key);
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/portal/applications')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">New Application</h2>
          <p className="text-sm text-gray-500">
            {savedApp
              ? `Draft saved — ${savedApp.applicationNumber || 'No number yet'}`
              : 'Fill in the details to apply for a loan'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const isActive = i === stepIndex;
            const isComplete = i < stepIndex;
            return (
              <div key={s.key} className="flex-1 flex items-center">
                <button
                  onClick={() => {
                    if (isComplete) setStep(s.key);
                  }}
                  disabled={!isComplete && !isActive}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary-700'
                      : isComplete
                        ? 'text-primary-600 cursor-pointer'
                        : 'text-gray-400 cursor-default'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isActive
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : isComplete
                          ? 'border-primary-600 bg-primary-50 text-primary-600'
                          : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {isComplete ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${i < stepIndex ? 'bg-primary-300' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {step === 'product' && (
          <StepProduct
            products={products}
            loading={loadingProducts}
            selected={selectedProduct}
            onSelect={selectProduct}
          />
        )}

        {step === 'loan' && selectedProduct && (
          <StepLoan
            form={form}
            product={selectedProduct}
            onChange={handleChange}
            isBusiness={isBusiness}
          />
        )}

        {step === 'parties' && (
          <StepParties
            members={partyMembers}
            validation={partyValidation}
            loading={loadingParties}
            onRefresh={loadParties}
          />
        )}

        {step === 'financial' && (
          <StepFinancial form={form} onChange={handleChange} isBusiness={isBusiness} />
        )}

        {step === 'employment' && <StepEmployment form={form} onChange={handleChange} />}

        {step === 'review' && selectedProduct && (
          <StepReview
            form={form}
            product={selectedProduct}
            isBusiness={isBusiness}
            declarations={declarations}
            onDeclarationChange={(key, val) => setDeclarations(prev => ({ ...prev, [key]: val }))}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {stepIndex > 0 && (
            <button
              onClick={goBack}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              &larr; Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step !== 'review' && selectedProduct && (
            <button
              onClick={saveDraft}
              disabled={saving || !canGoNext()}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : savedApp ? 'Update Draft' : 'Save Draft'}
            </button>
          )}
          {step === 'review' ? (
            <button
              onClick={submitApplication}
              disabled={
                submitting ||
                !declarations.informationAccurate ||
                !declarations.consentCreditCheck ||
                !declarations.termsAccepted
              }
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Continue &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step Components ───────────────────────────────────────────

function StepProduct({
  products,
  loading,
  selected,
  onSelect,
}: {
  products: LoanProduct[];
  loading: boolean;
  selected: LoanProduct | null;
  onSelect: (p: LoanProduct) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Choose a Product</h3>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">Choose a Product</h3>
      <p className="text-sm text-gray-500 mt-1">Select the loan product you want to apply for.</p>
      <div className="mt-4 space-y-2">
        {products.map(p => (
          <button
            key={p.productId}
            onClick={() => onSelect(p)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selected?.productId === p.productId
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{p.productName}</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {PRODUCT_TYPE_LABELS[p.productType] || p.productType}
                  {p.shortDescription && ` — ${p.shortDescription}`}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>
                  {formatCurrency(p.minLoanAmount)} – {formatCurrency(p.maxLoanAmount)}
                </p>
                <p>
                  {p.minInterestRate}% – {p.maxInterestRate}% p.a.
                </p>
              </div>
            </div>
          </button>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No products available for online application.
          </p>
        )}
      </div>
    </div>
  );
}

function StepLoan({
  form,
  product,
  onChange,
  isBusiness,
}: {
  form: Record<string, string>;
  product: LoanProduct;
  isBusiness: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
}) {
  const isHomePurpose = HOME_PURPOSES.includes(form.loanPurpose);
  const isVehiclePurpose = VEHICLE_PURPOSES.includes(form.loanPurpose);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">
        {isBusiness ? 'Facility Details' : 'Loan Details'}
      </h3>
      <p className="text-sm text-gray-500 mt-1">
        Applying for <span className="font-medium text-gray-700">{product.productName}</span>
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isBusiness ? 'Facility Amount' : 'Loan Amount'} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="requestedAmount"
            value={form.requestedAmount}
            onChange={onChange}
            min={product.minLoanAmount}
            max={product.maxLoanAmount}
            placeholder={`${product.minLoanAmount} – ${product.maxLoanAmount}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Range: {formatCurrency(product.minLoanAmount)} – {formatCurrency(product.maxLoanAmount)}
          </p>
        </div>

        {/* Term */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Term (months) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="requestedTermMonths"
            value={form.requestedTermMonths}
            onChange={onChange}
            min={product.minTermMonths}
            max={product.maxTermMonths}
            placeholder={`${product.minTermMonths} – ${product.maxTermMonths}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Range: {product.minTermMonths} – {product.maxTermMonths} months
          </p>
        </div>

        {/* Interest Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preferred Interest Rate (% p.a.)
          </label>
          <input
            type="number"
            name="requestedInterestRate"
            value={form.requestedInterestRate}
            onChange={onChange}
            step="0.01"
            min={product.minInterestRate}
            max={product.maxInterestRate}
            placeholder={`${product.minInterestRate} – ${product.maxInterestRate}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Loan Purpose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isBusiness ? 'Facility Purpose' : 'Loan Purpose'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <select
            name="loanPurpose"
            value={form.loanPurpose}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select purpose...</option>
            {Object.entries(LOAN_PURPOSE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Business: Facility Type */}
        {isBusiness && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Facility Type</label>
            <select
              name="facilityType"
              value={form.facilityType}
              onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select type...</option>
              {Object.entries(FACILITY_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Purpose Description */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purpose Description
          </label>
          <textarea
            name="loanPurposeDescription"
            value={form.loanPurposeDescription}
            onChange={onChange}
            rows={2}
            maxLength={1000}
            placeholder="Briefly describe what you will use the loan for..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
        </div>
      </div>

      {/* ─── Property Details (HOME purposes) ─────────────── */}
      {isHomePurpose && (
        <div className="mt-8">
          <h4 className="text-md font-semibold text-gray-800 mb-1">Property Details</h4>
          <p className="text-sm text-gray-500 mb-4">
            Enter details about the property for your home loan.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Address
              </label>
              <input
                type="text"
                name="propertyAddress"
                value={form.propertyAddress}
                onChange={onChange}
                placeholder="e.g. 123 MG Road, Flat 4B"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="propertyCity"
                value={form.propertyCity}
                onChange={onChange}
                placeholder="e.g. Mumbai"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="propertyState"
                value={form.propertyState}
                onChange={onChange}
                placeholder="e.g. Maharashtra"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                name="propertyPostalCode"
                value={form.propertyPostalCode}
                onChange={onChange}
                placeholder="e.g. 400001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
              <select
                name="propertyType"
                value={form.propertyType}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select type...</option>
                {PROPERTY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Property Value
              </label>
              <input
                type="number"
                name="propertyValue"
                value={form.propertyValue}
                onChange={onChange}
                placeholder="e.g. 5000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Down Payment Amount
              </label>
              <input
                type="number"
                name="downPaymentAmount"
                value={form.downPaymentAmount}
                onChange={onChange}
                placeholder="e.g. 1000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Vehicle Details (VEHICLE purposes) ───────────── */}
      {isVehiclePurpose && (
        <div className="mt-8">
          <h4 className="text-md font-semibold text-gray-800 mb-1">Vehicle Details</h4>
          <p className="text-sm text-gray-500 mb-4">
            Enter details about the vehicle you plan to purchase.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make / Brand</label>
              <input
                type="text"
                name="vehicleMake"
                value={form.vehicleMake}
                onChange={onChange}
                placeholder="e.g. Maruti Suzuki"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                name="vehicleModel"
                value={form.vehicleModel}
                onChange={onChange}
                placeholder="e.g. Swift Dzire"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input
                type="number"
                name="vehicleYear"
                value={form.vehicleYear}
                onChange={onChange}
                min={2000}
                max={2030}
                placeholder="e.g. 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select
                name="vehicleCondition"
                value={form.vehicleCondition}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select condition...</option>
                {VEHICLE_CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Vehicle Value
              </label>
              <input
                type="number"
                name="vehicleValue"
                value={form.vehicleValue}
                onChange={onChange}
                placeholder="e.g. 800000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepFinancial({
  form,
  onChange,
  isBusiness,
}: {
  form: Record<string, string>;
  isBusiness: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">
        {isBusiness ? 'Business & Financial Information' : 'Financial Information'}
      </h3>
      <p className="text-sm text-gray-500 mt-1">
        Help us evaluate your application. All fields are optional but improve approval chances.
      </p>

      {/* Business-specific fields */}
      {isBusiness && (
        <div className="mt-6">
          <h4 className="text-md font-semibold text-gray-800 mb-3">Business Financials</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Revenue</label>
              <input
                type="number"
                name="businessAnnualRevenue"
                value={form.businessAnnualRevenue}
                onChange={onChange}
                placeholder="e.g. 50000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="mt-1 text-xs text-gray-400">Annual turnover of the business</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Vintage (Years)
              </label>
              <input
                type="number"
                name="businessVintageYears"
                value={form.businessVintageYears}
                onChange={onChange}
                min={0}
                max={200}
                placeholder="e.g. 5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                How many years the business has been operating
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facility Purpose Description
              </label>
              <textarea
                name="facilityPurposeDescription"
                value={form.facilityPurposeDescription}
                onChange={onChange}
                rows={2}
                placeholder="Describe how the facility will be used in your business operations..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Personal financial fields */}
      <div className={isBusiness ? 'mt-6' : 'mt-6'}>
        {isBusiness && (
          <h4 className="text-md font-semibold text-gray-800 mb-3">Personal Financials</h4>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Annual Income</label>
            <input
              type="number"
              name="statedAnnualIncome"
              value={form.statedAnnualIncome}
              onChange={onChange}
              placeholder="e.g. 1200000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income</label>
            <input
              type="number"
              name="statedMonthlyIncome"
              value={form.statedMonthlyIncome}
              onChange={onChange}
              placeholder="e.g. 100000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Expenses</label>
            <input
              type="number"
              name="statedMonthlyExpenses"
              value={form.statedMonthlyExpenses}
              onChange={onChange}
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepEmployment({
  form,
  onChange,
}: {
  form: Record<string, string>;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">Employment Details</h3>
      <p className="text-sm text-gray-500 mt-1">
        Provide your employment information. Optional but recommended.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
          <select
            name="employmentStatus"
            value={form.employmentStatus}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select status...</option>
            {EMPLOYMENT_STATUSES.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employer Name</label>
          <input
            type="text"
            name="employerName"
            value={form.employerName}
            onChange={onChange}
            placeholder="e.g. Tata Consultancy Services"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
          <input
            type="text"
            name="jobTitle"
            value={form.jobTitle}
            onChange={onChange}
            placeholder="e.g. Software Engineer"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Years with Employer
          </label>
          <input
            type="number"
            name="yearsWithEmployer"
            value={form.yearsWithEmployer}
            onChange={onChange}
            min={0}
            max={50}
            placeholder="e.g. 3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
    </div>
  );
}

function StepParties({
  members,
  validation,
  loading,
  onRefresh,
}: {
  members: PartyMember[];
  validation: PartyValidation | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">People &amp; Roles</h3>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const active = members.filter(m => m.isActive);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">People &amp; Roles</h3>
      <p className="text-sm text-gray-500 mt-1">
        Confirm the directors, shareholders, UBOs and signatories linked to your company.
      </p>

      {/* Validation Banner */}
      {validation && (
        <div
          className={`mt-4 rounded-lg border p-4 ${
            validation.isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`text-lg ${validation.isComplete ? 'text-green-600' : 'text-amber-500'}`}
            >
              {validation.isComplete ? '✓' : '⚠'}
            </span>
            <div className="flex-1">
              <h4
                className={`text-sm font-semibold ${validation.isComplete ? 'text-green-800' : 'text-amber-800'}`}
              >
                {validation.isComplete ? 'All party requirements met' : 'Requirements not yet met'}
              </h4>
              {!validation.isComplete && validation.issues.length > 0 && (
                <ul className="mt-1 text-sm list-disc list-inside text-amber-700">
                  {validation.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                <span>
                  {validation.summary.directors} Director
                  {validation.summary.directors !== 1 ? 's' : ''}
                </span>
                <span>
                  {validation.summary.shareholders} Shareholder
                  {validation.summary.shareholders !== 1 ? 's' : ''}
                </span>
                <span>
                  {validation.summary.ubos} UBO{validation.summary.ubos !== 1 ? 's' : ''} (
                  {validation.summary.totalUboOwnership}%)
                </span>
                <span>
                  {validation.summary.signatories} Signator
                  {validation.summary.signatories !== 1 ? 'ies' : 'y'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      {active.length > 0 ? (
        <div className="mt-4 space-y-2">
          {active.map(m => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                  {(m.customerName || '?')[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {m.customerName || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">{m.customerEmail || ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-0.5 bg-gray-200 rounded-full text-gray-700 font-medium">
                  {PARTY_ROLE_LABELS[m.role] || m.role}
                </span>
                {m.ownershipPercentage != null && (
                  <span className="text-gray-500">{m.ownershipPercentage}%</span>
                )}
                {m.isAuthorizedSignatory && (
                  <span className="text-green-600" title="Authorized Signatory">
                    ✍
                  </span>
                )}
                {m.isBeneficialOwner && (
                  <span className="text-blue-600" title="UBO">
                    ◆
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-400 text-3xl mb-2">👥</div>
          <p className="text-sm text-gray-500">No party members found for your company.</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        <a
          href="/portal/company/parties"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 hover:text-primary-800 font-medium underline"
        >
          Manage People &amp; Roles →
        </a>
        <button onClick={onRefresh} className="text-sm text-gray-500 hover:text-gray-700">
          ↻ Refresh
        </button>
      </div>

      {validation && !validation.isComplete && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
          You can still proceed, but your application may require additional review if party
          requirements are incomplete.
        </div>
      )}
    </div>
  );
}

function StepReview({
  form,
  product,
  isBusiness,
  declarations,
  onDeclarationChange,
}: {
  form: Record<string, string>;
  product: LoanProduct;
  isBusiness: boolean;
  declarations: {
    informationAccurate: boolean;
    consentCreditCheck: boolean;
    termsAccepted: boolean;
  };
  onDeclarationChange: (key: string, val: boolean) => void;
}) {
  const isHomePurpose = HOME_PURPOSES.includes(form.loanPurpose);
  const isVehiclePurpose = VEHICLE_PURPOSES.includes(form.loanPurpose);

  const sections = [
    {
      title: 'Product',
      items: [
        { label: 'Product', value: product.productName },
        { label: 'Type', value: PRODUCT_TYPE_LABELS[product.productType] || product.productType },
      ],
    },
    {
      title: isBusiness ? 'Facility Details' : 'Loan Details',
      items: [
        {
          label: 'Amount',
          value: form.requestedAmount ? formatCurrency(parseFloat(form.requestedAmount)) : '—',
        },
        {
          label: 'Term',
          value: form.requestedTermMonths ? `${form.requestedTermMonths} months` : '—',
        },
        {
          label: 'Interest Rate',
          value: form.requestedInterestRate
            ? `${form.requestedInterestRate}% p.a.`
            : 'Bank default',
        },
        {
          label: 'Purpose',
          value: LOAN_PURPOSE_LABELS[form.loanPurpose as LoanPurpose] || form.loanPurpose || '—',
        },
        { label: 'Description', value: form.loanPurposeDescription || '—' },
        ...(isBusiness && form.facilityType
          ? [
              {
                label: 'Facility Type',
                value: FACILITY_TYPE_LABELS[form.facilityType] || form.facilityType,
              },
            ]
          : []),
      ],
    },
    // Property section (conditional)
    ...(isHomePurpose
      ? [
          {
            title: 'Property Details',
            items: [
              { label: 'Address', value: form.propertyAddress || '—' },
              { label: 'City', value: form.propertyCity || '—' },
              { label: 'State', value: form.propertyState || '—' },
              { label: 'Postal Code', value: form.propertyPostalCode || '—' },
              {
                label: 'Type',
                value: PROPERTY_TYPES.find(t => t.value === form.propertyType)?.label || '—',
              },
              {
                label: 'Value',
                value: form.propertyValue ? formatCurrency(parseFloat(form.propertyValue)) : '—',
              },
              {
                label: 'Down Payment',
                value: form.downPaymentAmount
                  ? formatCurrency(parseFloat(form.downPaymentAmount))
                  : '—',
              },
            ],
          },
        ]
      : []),
    // Vehicle section (conditional)
    ...(isVehiclePurpose
      ? [
          {
            title: 'Vehicle Details',
            items: [
              { label: 'Make', value: form.vehicleMake || '—' },
              { label: 'Model', value: form.vehicleModel || '—' },
              { label: 'Year', value: form.vehicleYear || '—' },
              {
                label: 'Condition',
                value:
                  VEHICLE_CONDITIONS.find(c => c.value === form.vehicleCondition)?.label || '—',
              },
              {
                label: 'Value',
                value: form.vehicleValue ? formatCurrency(parseFloat(form.vehicleValue)) : '—',
              },
            ],
          },
        ]
      : []),
    // Business financials section (conditional)
    ...(isBusiness
      ? [
          {
            title: 'Business Financials',
            items: [
              {
                label: 'Annual Revenue',
                value: form.businessAnnualRevenue
                  ? formatCurrency(parseFloat(form.businessAnnualRevenue))
                  : '—',
              },
              {
                label: 'Business Vintage',
                value: form.businessVintageYears ? `${form.businessVintageYears} years` : '—',
              },
              { label: 'Facility Purpose', value: form.facilityPurposeDescription || '—' },
            ],
          },
        ]
      : []),
    {
      title: 'Financial Info',
      items: [
        {
          label: 'Annual Income',
          value: form.statedAnnualIncome
            ? formatCurrency(parseFloat(form.statedAnnualIncome))
            : '—',
        },
        {
          label: 'Monthly Income',
          value: form.statedMonthlyIncome
            ? formatCurrency(parseFloat(form.statedMonthlyIncome))
            : '—',
        },
        {
          label: 'Monthly Expenses',
          value: form.statedMonthlyExpenses
            ? formatCurrency(parseFloat(form.statedMonthlyExpenses))
            : '—',
        },
      ],
    },
    {
      title: 'Employment',
      items: [
        {
          label: 'Status',
          value: EMPLOYMENT_STATUSES.find(s => s.value === form.employmentStatus)?.label || '—',
        },
        { label: 'Employer', value: form.employerName || '—' },
        { label: 'Title', value: form.jobTitle || '—' },
        { label: 'Years', value: form.yearsWithEmployer ? `${form.yearsWithEmployer} years` : '—' },
      ],
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">Review Your Application</h3>
      <p className="text-sm text-gray-500 mt-1">
        Please review the details below before submitting.
      </p>

      <div className="mt-6 space-y-6">
        {sections.map(section => (
          <div key={section.title}>
            <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 mb-3">
              {section.title}
            </h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {section.items.map(item => (
                <div key={item.label} className="flex justify-between sm:block">
                  <dt className="text-xs text-gray-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* ─── Declarations & Consent ─────────────────────── */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Declarations & Consent</h4>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarations.informationAccurate}
              onChange={e => onDeclarationChange('informationAccurate', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              I declare that all information provided in this application is true, accurate, and
              complete to the best of my knowledge. <span className="text-red-500">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarations.consentCreditCheck}
              onChange={e => onDeclarationChange('consentCreditCheck', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              I consent to the bank performing credit checks, verifying my identity, and sharing my
              information with credit bureaus and regulatory authorities as required.{' '}
              <span className="text-red-500">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarations.termsAccepted}
              onChange={e => onDeclarationChange('termsAccepted', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to the terms and conditions, privacy policy, and the
              product-specific disclosures. <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {(!declarations.informationAccurate ||
          !declarations.consentCreditCheck ||
          !declarations.termsAccepted) && (
          <p className="mt-3 text-xs text-amber-600">
            All declarations must be accepted before you can submit.
          </p>
        )}
      </div>
    </div>
  );
}
