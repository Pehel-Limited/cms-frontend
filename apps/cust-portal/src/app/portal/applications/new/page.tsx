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
  INTENT_TO_LOAN_PURPOSE,
} from '@/services/api/application-service';
import { productService, LoanProduct, RatePlan, PRODUCT_TYPE_LABELS } from '@/services/api/product-service';
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
  // Carried over from a confirmed Rayva AI Credit Assistant journey — lets us
  // prefill the wizard instead of making the customer re-enter details.
  const prefillAmount = searchParams.get('amount');
  const prefillPurpose = searchParams.get('purpose');
  const prefillTargetDate = searchParams.get('targetDate');

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
          const mappedPurpose = prefillPurpose ? INTENT_TO_LOAN_PURPOSE[prefillPurpose] : undefined;
          setForm(prev => ({
            ...prev,
            requestedAmount: prefillAmount || match.defaultLoanAmount?.toString() || '',
            requestedTermMonths: match.defaultTermMonths?.toString() || '',
            requestedInterestRate: match.defaultInterestRate?.toString() || '',
            loanPurpose: mappedPurpose || prev.loanPurpose,
            loanPurposeDescription: prefillTargetDate
              ? `Target date: ${prefillTargetDate}`
              : prev.loanPurposeDescription,
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
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-7 flex items-center gap-3">
        <button
          onClick={() => router.push('/portal/applications')}
          className="icon-btn"
          aria-label="Back to applications"
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
          <h2 className="text-xl font-bold sm:text-2xl" style={{ color: 'var(--text-primary)' }}>
            New application
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {savedApp
              ? `Draft saved — ${savedApp.applicationNumber || 'No number yet'}`
              : 'Fill in the details to apply for a loan'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <nav className="mb-6 overflow-x-auto no-scrollbar" aria-label="Progress">
        <ol className="flex min-w-max items-center gap-1 sm:min-w-0">
          {STEPS.map((s, i) => {
            const isActive = i === stepIndex;
            const isComplete = i < stepIndex;
            return (
              <li key={s.key} className="flex flex-1 items-center">
                <button
                  onClick={() => {
                    if (isComplete) setStep(s.key);
                  }}
                  disabled={!isComplete && !isActive}
                  aria-current={isActive ? 'step' : undefined}
                  className="flex items-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-default"
                  style={{
                    color: isActive || isComplete ? 'var(--brand)' : 'var(--text-muted)',
                  }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors"
                    style={
                      isActive
                        ? { borderColor: 'var(--brand)', backgroundColor: 'var(--brand)', color: '#fff' }
                        : isComplete
                          ? {
                              borderColor: 'var(--brand)',
                              backgroundColor: 'var(--brand-soft)',
                              color: 'var(--brand-on-soft)',
                            }
                          : {
                              borderColor: 'var(--surface-border-strong)',
                              color: 'var(--text-muted)',
                            }
                    }
                  >
                    {isComplete ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="mx-2 h-0.5 flex-1 rounded-full"
                    style={{
                      backgroundColor:
                        i < stepIndex ? 'var(--brand)' : 'var(--surface-border-strong)',
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Error */}
      {error && (
        <div className="alert alert-error mb-5" role="alert">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="card p-6">
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
      <div className="mt-6 flex items-center justify-between gap-3">
        <div>
          {stepIndex > 0 && (
            <button onClick={goBack} className="btn btn-ghost">
              &larr; Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step !== 'review' && selectedProduct && (
            <button onClick={saveDraft} disabled={saving || !canGoNext()} className="btn btn-ghost">
              {saving ? 'Saving…' : savedApp ? 'Update draft' : 'Save draft'}
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
              className="btn bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          ) : (
            <button onClick={goNext} disabled={!canGoNext()} className="btn btn-primary">
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
        <h3 className="section-title">Choose a product</h3>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="section-title">Choose a product</h3>
      <p className="field-hint">Select the loan product you want to apply for.</p>
      <div className="mt-4 space-y-2">
        {products.map(p => {
          const isSelected = selected?.productId === p.productId;
          return (
            <button
              key={p.productId}
              onClick={() => onSelect(p)}
              aria-pressed={isSelected}
              className="w-full rounded-xl border-2 p-4 text-left transition-all"
              style={{
                borderColor: isSelected ? 'var(--brand)' : 'var(--surface-border)',
                backgroundColor: isSelected ? 'var(--brand-soft)' : 'transparent',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {p.productName}
                  </h4>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {PRODUCT_TYPE_LABELS[p.productType] || p.productType}
                    {p.shortDescription && ` — ${p.shortDescription}`}
                  </p>
                </div>
                <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                  <p>
                    {formatCurrency(p.minLoanAmount)} – {formatCurrency(p.maxLoanAmount)}
                  </p>
                  <p>
                    {p.minInterestRate}% – {p.maxInterestRate}% p.a.
                  </p>
                </div>
              </div>
            </button>
          );
        })}
        {products.length === 0 && (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
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

  // Admin-managed rate plans (LTV bands / fixed-term tiers / green discounts)
  // fetched live for this product, replacing the old static rate table.
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [loadingRatePlans, setLoadingRatePlans] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingRatePlans(true);
    productService
      .getRatePlans(product.productCode)
      .then(plans => {
        if (!cancelled) setRatePlans(plans);
      })
      .catch(() => {
        if (!cancelled) setRatePlans([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRatePlans(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.productCode]);

  return (
    <div>
      <h3 className="section-title">{isBusiness ? 'Facility details' : 'Loan details'}</h3>
      <p className="field-hint">
        Applying for{' '}
        <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {product.productName}
        </span>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Amount */}
        <div>
          <label className="field-label" htmlFor="requestedAmount">
            {isBusiness ? 'Facility amount' : 'Loan amount'} <span className="text-red-500">*</span>
          </label>
          <input
            id="requestedAmount"
            type="number"
            name="requestedAmount"
            value={form.requestedAmount}
            onChange={onChange}
            min={product.minLoanAmount}
            max={product.maxLoanAmount}
            placeholder={`${product.minLoanAmount} – ${product.maxLoanAmount}`}
            className="input"
          />
          <p className="field-hint">
            Range: {formatCurrency(product.minLoanAmount)} – {formatCurrency(product.maxLoanAmount)}
          </p>
        </div>

        {/* Term */}
        <div>
          <label className="field-label" htmlFor="requestedTermMonths">
            Term (months) <span className="text-red-500">*</span>
          </label>
          <input
            id="requestedTermMonths"
            type="number"
            name="requestedTermMonths"
            value={form.requestedTermMonths}
            onChange={onChange}
            min={product.minTermMonths}
            max={product.maxTermMonths}
            placeholder={`${product.minTermMonths} – ${product.maxTermMonths}`}
            className="input"
          />
          <p className="field-hint">
            Range: {product.minTermMonths} – {product.maxTermMonths} months
          </p>
        </div>

        {/* Interest Rate */}
        <div>
          <label className="field-label" htmlFor="requestedInterestRate">
            Interest rate
          </label>
          {loadingRatePlans ? (
            <div className="skeleton h-10" />
          ) : ratePlans.length > 0 ? (
            <>
              <select
                id="requestedInterestRate"
                name="requestedInterestRate"
                value={form.requestedInterestRate}
                onChange={onChange}
                className="select"
              >
                <option value="">Select a rate plan…</option>
                {ratePlans.map(plan => (
                  <option key={plan.ratePlanId} value={plan.interestRate}>
                    {plan.label} — {plan.interestRate}%{plan.isGreen ? ' 🌱' : ''}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Choose the LTV / fixed-term rate plan that applies to you.
              </p>
            </>
          ) : (
            <input
              id="requestedInterestRate"
              type="number"
              name="requestedInterestRate"
              value={form.requestedInterestRate}
              onChange={onChange}
              step="0.01"
              min={product.minInterestRate}
              max={product.maxInterestRate}
              placeholder={`${product.minInterestRate} – ${product.maxInterestRate}`}
              className="input"
            />
          )}
        </div>

        {/* Loan Purpose */}
        <div>
          <label className="field-label" htmlFor="loanPurpose">
            {isBusiness ? 'Facility purpose' : 'Loan purpose'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <select
            id="loanPurpose"
            name="loanPurpose"
            value={form.loanPurpose}
            onChange={onChange}
            className="select"
          >
            <option value="">Select purpose…</option>
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
            <label className="field-label" htmlFor="facilityType">
              Facility type
            </label>
            <select
              id="facilityType"
              name="facilityType"
              value={form.facilityType}
              onChange={onChange}
              className="select"
            >
              <option value="">Select type…</option>
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
          <label className="field-label" htmlFor="loanPurposeDescription">
            Purpose description
          </label>
          <textarea
            id="loanPurposeDescription"
            name="loanPurposeDescription"
            value={form.loanPurposeDescription}
            onChange={onChange}
            rows={2}
            maxLength={1000}
            placeholder="Briefly describe what you will use the loan for…"
            className="input resize-none"
          />
        </div>
      </div>

      {/* ─── Property Details (HOME purposes) ─────────────── */}
      {isHomePurpose && (
        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--surface-border)' }}>
          <h4 className="section-title">Property details</h4>
          <p className="field-hint mb-4">Enter details about the property for your home loan.</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="propertyAddress">
                Property address
              </label>
              <input
                id="propertyAddress"
                type="text"
                name="propertyAddress"
                value={form.propertyAddress}
                onChange={onChange}
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="propertyCity">
                City
              </label>
              <input
                id="propertyCity"
                type="text"
                name="propertyCity"
                value={form.propertyCity}
                onChange={onChange}
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="propertyState">
                County / State
              </label>
              <input
                id="propertyState"
                type="text"
                name="propertyState"
                value={form.propertyState}
                onChange={onChange}
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="propertyPostalCode">
                Postal code
              </label>
              <input
                id="propertyPostalCode"
                type="text"
                name="propertyPostalCode"
                value={form.propertyPostalCode}
                onChange={onChange}
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="propertyType">
                Property type
              </label>
              <select
                id="propertyType"
                name="propertyType"
                value={form.propertyType}
                onChange={onChange}
                className="select"
              >
                <option value="">Select type…</option>
                {PROPERTY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="propertyValue">
                Estimated property value
              </label>
              <input
                id="propertyValue"
                type="number"
                name="propertyValue"
                value={form.propertyValue}
                onChange={onChange}
                placeholder="e.g. 350000"
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="downPaymentAmount">
                Deposit amount
              </label>
              <input
                id="downPaymentAmount"
                type="number"
                name="downPaymentAmount"
                value={form.downPaymentAmount}
                onChange={onChange}
                placeholder="e.g. 50000"
                className="input"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Vehicle Details (VEHICLE purposes) ───────────── */}
      {isVehiclePurpose && (
        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--surface-border)' }}>
          <h4 className="section-title">Vehicle details</h4>
          <p className="field-hint mb-4">Enter details about the vehicle you plan to purchase.</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="vehicleMake">
                Make / brand
              </label>
              <input
                id="vehicleMake"
                type="text"
                name="vehicleMake"
                value={form.vehicleMake}
                onChange={onChange}
                placeholder="e.g. Volkswagen"
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleModel">
                Model
              </label>
              <input
                id="vehicleModel"
                type="text"
                name="vehicleModel"
                value={form.vehicleModel}
                onChange={onChange}
                placeholder="e.g. Golf"
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleYear">
                Year
              </label>
              <input
                id="vehicleYear"
                type="number"
                name="vehicleYear"
                value={form.vehicleYear}
                onChange={onChange}
                min={2000}
                max={2030}
                placeholder="e.g. 2024"
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleCondition">
                Condition
              </label>
              <select
                id="vehicleCondition"
                name="vehicleCondition"
                value={form.vehicleCondition}
                onChange={onChange}
                className="select"
              >
                <option value="">Select condition…</option>
                {VEHICLE_CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleValue">
                Estimated vehicle value
              </label>
              <input
                id="vehicleValue"
                type="number"
                name="vehicleValue"
                value={form.vehicleValue}
                onChange={onChange}
                placeholder="e.g. 30000"
                className="input"
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
      <h3 className="section-title">
        {isBusiness ? 'Business & financial information' : 'Financial information'}
      </h3>
      <p className="field-hint">
        Help us evaluate your application. All fields are optional but improve approval chances.
      </p>

      {/* Business-specific fields */}
      {isBusiness && (
        <div className="mt-6">
          <h4 className="section-title mb-3">Business financials</h4>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="businessAnnualRevenue">
                Annual revenue
              </label>
              <input
                id="businessAnnualRevenue"
                type="number"
                name="businessAnnualRevenue"
                value={form.businessAnnualRevenue}
                onChange={onChange}
                placeholder="e.g. 2500000"
                className="input"
              />
              <p className="field-hint">Annual turnover of the business</p>
            </div>
            <div>
              <label className="field-label" htmlFor="businessVintageYears">
                Business vintage (years)
              </label>
              <input
                id="businessVintageYears"
                type="number"
                name="businessVintageYears"
                value={form.businessVintageYears}
                onChange={onChange}
                min={0}
                max={200}
                placeholder="e.g. 5"
                className="input"
              />
              <p className="field-hint">How many years the business has been operating</p>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="facilityPurposeDescription">
                Facility purpose description
              </label>
              <textarea
                id="facilityPurposeDescription"
                name="facilityPurposeDescription"
                value={form.facilityPurposeDescription}
                onChange={onChange}
                rows={2}
                placeholder="Describe how the facility will be used in your business operations…"
                className="input resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Personal financial fields */}
      <div className="mt-6">
        {isBusiness && <h4 className="section-title mb-3">Personal financials</h4>}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="statedAnnualIncome">
              Annual income
            </label>
            <input
              id="statedAnnualIncome"
              type="number"
              name="statedAnnualIncome"
              value={form.statedAnnualIncome}
              onChange={onChange}
              placeholder="e.g. 60000"
              className="input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="statedMonthlyIncome">
              Monthly income
            </label>
            <input
              id="statedMonthlyIncome"
              type="number"
              name="statedMonthlyIncome"
              value={form.statedMonthlyIncome}
              onChange={onChange}
              placeholder="e.g. 5000"
              className="input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="statedMonthlyExpenses">
              Monthly expenses
            </label>
            <input
              id="statedMonthlyExpenses"
              type="number"
              name="statedMonthlyExpenses"
              value={form.statedMonthlyExpenses}
              onChange={onChange}
              placeholder="e.g. 2000"
              className="input"
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
      <h3 className="section-title">Employment details</h3>
      <p className="field-hint">
        Provide your employment information. Optional but recommended.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="employmentStatus">
            Employment status
          </label>
          <select
            id="employmentStatus"
            name="employmentStatus"
            value={form.employmentStatus}
            onChange={onChange}
            className="select"
          >
            <option value="">Select status…</option>
            {EMPLOYMENT_STATUSES.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="employerName">
            Employer name
          </label>
          <input
            id="employerName"
            type="text"
            name="employerName"
            value={form.employerName}
            onChange={onChange}
            placeholder="e.g. Acme Ltd"
            className="input"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="jobTitle">
            Job title
          </label>
          <input
            id="jobTitle"
            type="text"
            name="jobTitle"
            value={form.jobTitle}
            onChange={onChange}
            placeholder="e.g. Software Engineer"
            className="input"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="yearsWithEmployer">
            Years with employer
          </label>
          <input
            id="yearsWithEmployer"
            type="number"
            name="yearsWithEmployer"
            value={form.yearsWithEmployer}
            onChange={onChange}
            min={0}
            max={50}
            placeholder="e.g. 3"
            className="input"
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
        <h3 className="section-title">People &amp; roles</h3>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-14" />
        ))}
      </div>
    );
  }

  const active = members.filter(m => m.isActive);

  return (
    <div>
      <h3 className="section-title">People &amp; roles</h3>
      <p className="field-hint">
        Confirm the directors, shareholders, UBOs and signatories linked to your company.
      </p>

      {/* Validation Banner */}
      {validation && (
        <div
          className={`alert mt-4 items-start ${validation.isComplete ? 'alert-success' : 'alert-warning'}`}
        >
          <span className="text-lg leading-none">{validation.isComplete ? '✓' : '⚠'}</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold">
              {validation.isComplete ? 'All party requirements met' : 'Requirements not yet met'}
            </h4>
            {!validation.isComplete && validation.issues.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-sm">
                {validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-xs opacity-80">
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
      )}

      {/* Members list */}
      {active.length > 0 ? (
        <div className="mt-4 space-y-2">
          {active.map(m => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              style={{
                backgroundColor: 'var(--surface-input)',
                borderColor: 'var(--surface-border)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                >
                  {(m.customerName || '?')[0]}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {m.customerName || 'Unknown'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {m.customerEmail || ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="badge badge-neutral">{PARTY_ROLE_LABELS[m.role] || m.role}</span>
                {m.ownershipPercentage != null && (
                  <span style={{ color: 'var(--text-muted)' }}>{m.ownershipPercentage}%</span>
                )}
                {m.isAuthorizedSignatory && (
                  <span className="text-emerald-500" title="Authorized signatory">
                    ✍
                  </span>
                )}
                {m.isBeneficialOwner && (
                  <span className="text-blue-500" title="UBO">
                    ◆
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state mt-4">
          <div className="empty-state-icon text-2xl">👥</div>
          <p className="empty-state-text">No party members found for your company.</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-4">
        <a
          href="/portal/company/parties"
          target="_blank"
          rel="noopener noreferrer"
          className="link-arrow"
        >
          Manage people &amp; roles <span data-arrow aria-hidden="true">→</span>
        </a>
        <button onClick={onRefresh} className="btn btn-ghost btn-sm">
          ↻ Refresh
        </button>
      </div>

      {validation && !validation.isComplete && (
        <div className="alert alert-warning mt-4">
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
      <h3 className="section-title">Review your application</h3>
      <p className="field-hint">Please review the details below before submitting.</p>

      <div className="mt-6 space-y-6">
        {sections.map(section => (
          <div key={section.title}>
            <h4
              className="mb-3 border-b pb-2 text-sm font-semibold"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--surface-border)' }}
            >
              {section.title}
            </h4>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {section.items.map(item => (
                <div key={item.label} className="flex justify-between gap-4 sm:block">
                  <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.label}
                  </dt>
                  <dd
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* ─── Declarations & Consent ─────────────────────── */}
      <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--surface-border)' }}>
        <h4 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Declarations &amp; consent
        </h4>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declarations.informationAccurate}
              onChange={e => onDeclarationChange('informationAccurate', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
              style={{ borderColor: 'var(--surface-border-strong)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              I declare that all information provided in this application is true, accurate, and
              complete to the best of my knowledge. <span className="text-red-500">*</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declarations.consentCreditCheck}
              onChange={e => onDeclarationChange('consentCreditCheck', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
              style={{ borderColor: 'var(--surface-border-strong)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              I consent to the bank performing credit checks, verifying my identity, and sharing my
              information with credit bureaus and regulatory authorities as required.{' '}
              <span className="text-red-500">*</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declarations.termsAccepted}
              onChange={e => onDeclarationChange('termsAccepted', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
              style={{ borderColor: 'var(--surface-border-strong)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              I have read and agree to the terms and conditions, privacy policy, and the
              product-specific disclosures. <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {(!declarations.informationAccurate ||
          !declarations.consentCreditCheck ||
          !declarations.termsAccepted) && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            All declarations must be accepted before you can submit.
          </p>
        )}
      </div>
    </div>
  );
}
