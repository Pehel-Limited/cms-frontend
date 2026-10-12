'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAIPreferences } from '@/lib/ai-preferences';
import { PageHero } from '@/components/ui/PageHero';
import {
  applicationService,
  ApplicationContext,
  CreateApplicationPayload,
  LoanApplication,
  LOAN_PURPOSE_LABELS,
  LoanPurpose,
  FACILITY_TYPE_LABELS,
  INTENT_TO_LOAN_PURPOSE,
  getPurposeOptions,
  isPurposeAllowed,
} from '@/services/api/application-service';
import {
  productService,
  LoanProduct,
  RatePlan,
  PRODUCT_TYPE_LABELS,
  filterProductsForSegment,
} from '@/services/api/product-service';
import { documentExtractionService, DocumentType, DocumentExtractionResult } from '@/services/api/document-extraction-service';
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
  { key: 'loan', label: 'Loan details' },
  { key: 'financial', label: 'Financial information' },
  { key: 'employment', label: 'Employment' },
  { key: 'review', label: 'Review and submit' },
];

const BUSINESS_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'product', label: 'Product' },
  { key: 'loan', label: 'Loan details' },
  { key: 'parties', label: 'People and roles' },
  { key: 'financial', label: 'Financials' },
  { key: 'review', label: 'Review and submit' },
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

/** Product types whose price varies by LTV band / fixed-term tier, so the
    customer picks a plan. All others carry a single bank-set rate. */
const RATE_PLAN_PRODUCT_TYPES = new Set(['MORTGAGE', 'HOME_LOAN', 'COMMERCIAL_MORTGAGE']);

// ─── Page ──────────────────────────────────────────────────────

export default function NewApplicationPage() {
  const router = useRouter();
  const { preferences, ready } = useAIPreferences();
  const searchParams = useSearchParams();
  const preselectedCode = searchParams.get('product');
  // Carried over from a confirmed Rayva AI Credit Assistant journey — lets us
  // prefill the wizard instead of making the customer re-enter details.
  const prefillAmount = searchParams.get('amount');
  const prefillPurpose = searchParams.get('purpose');
  const prefillTargetDate = searchParams.get('targetDate');
  // Continuing an existing DRAFT/RETURNED application — reload its saved
  // product + form data instead of starting the wizard from scratch.
  const resumeId = searchParams.get('resume');

  // State
  const [step, setStep] = useState<WizardStep>(preselectedCode || resumeId ? 'loan' : 'product');
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedApp, setSavedApp] = useState<LoanApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* A failed product load must not masquerade as "no products available" */
  const [productsError, setProductsError] = useState<string | null>(null);
  /* Only show field validation once the customer has tried to move on */
  const [attemptedNext, setAttemptedNext] = useState(false);

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

  const visibleProducts = useMemo(
    () => filterProductsForSegment(products, appContext?.segment),
    [products, appContext]
  );

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
      setProductsError(null);
      const data = await productService.getProducts();
      setProducts(data.filter(p => p.isOnlineApplicationEnabled !== false));

      if (resumeId) {
        try {
          const existing = await applicationService.getById(resumeId);
          setSavedApp(existing);
          const match = data.find(p => p.productId === existing.productId);
          if (match) setSelectedProduct(match);
          setForm(prev => ({
            ...prev,
            requestedAmount: existing.requestedAmount?.toString() ?? prev.requestedAmount,
            requestedTermMonths: existing.requestedTermMonths?.toString() ?? prev.requestedTermMonths,
            requestedInterestRate: existing.requestedInterestRate?.toString() ?? prev.requestedInterestRate,
            loanPurpose: existing.loanPurpose ?? prev.loanPurpose,
            loanPurposeDescription: existing.loanPurposeDescription ?? prev.loanPurposeDescription,
            statedAnnualIncome: existing.statedAnnualIncome?.toString() ?? prev.statedAnnualIncome,
            statedMonthlyIncome: existing.statedMonthlyIncome?.toString() ?? prev.statedMonthlyIncome,
            statedMonthlyExpenses: existing.statedMonthlyExpenses?.toString() ?? prev.statedMonthlyExpenses,
            employmentStatus: existing.employmentStatus ?? prev.employmentStatus,
            employerName: existing.employerName ?? prev.employerName,
            yearsWithEmployer: existing.yearsWithEmployer?.toString() ?? prev.yearsWithEmployer,
            jobTitle: existing.jobTitle ?? prev.jobTitle,
            businessAnnualRevenue: existing.businessAnnualRevenue?.toString() ?? prev.businessAnnualRevenue,
            businessVintageYears: existing.businessVintageYears?.toString() ?? prev.businessVintageYears,
            propertyAddress: existing.propertyAddress ?? prev.propertyAddress,
            propertyCity: existing.propertyCity ?? prev.propertyCity,
            propertyState: existing.propertyState ?? prev.propertyState,
            propertyPostalCode: existing.propertyPostalCode ?? prev.propertyPostalCode,
            propertyType: existing.propertyType ?? prev.propertyType,
            propertyValue: existing.propertyValue?.toString() ?? prev.propertyValue,
            downPaymentAmount: existing.downPaymentAmount?.toString() ?? prev.downPaymentAmount,
            vehicleMake: existing.vehicleMake ?? prev.vehicleMake,
            vehicleModel: existing.vehicleModel ?? prev.vehicleModel,
            vehicleYear: existing.vehicleYear?.toString() ?? prev.vehicleYear,
            vehicleCondition: existing.vehicleCondition ?? prev.vehicleCondition,
            vehicleValue: existing.vehicleValue?.toString() ?? prev.vehicleValue,
          }));
          setStep('loan');
        } catch (err: any) {
          setError(err.message || 'Failed to load your saved application');
        }
      } else if (preselectedCode) {
        const match = data.find(p => p.productCode === preselectedCode);
        if (match) {
          setSelectedProduct(match);
          const mappedPurpose = prefillPurpose ? INTENT_TO_LOAN_PURPOSE[prefillPurpose] : undefined;
          const carriedPurpose =
            mappedPurpose && isPurposeAllowed(match.productType, mappedPurpose)
              ? mappedPurpose
              : undefined;
          setForm(prev => ({
            ...prev,
            requestedAmount: prefillAmount || match.defaultLoanAmount?.toString() || '',
            requestedTermMonths: match.defaultTermMonths?.toString() || '',
            requestedInterestRate: RATE_PLAN_PRODUCT_TYPES.has(match.productType)
              ? ''
              : match.defaultInterestRate?.toString() || '',
            loanPurpose: carriedPurpose || prev.loanPurpose,
            loanPurposeDescription: prefillTargetDate
              ? `Target date: ${prefillTargetDate}`
              : prev.loanPurposeDescription,
          }));
        }
      }
    } catch (err: unknown) {
      setProductsError(
        err instanceof Error
          ? err.message
          : 'We couldn’t load the products available to apply for.'
      );
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
      // A plan-priced product has no single default to preselect — leaving it
      // empty keeps the picker's placeholder and the submitted rate in agreement.
      requestedInterestRate: RATE_PLAN_PRODUCT_TYPES.has(p.productType)
        ? ''
        : p.defaultInterestRate?.toString() || prev.requestedInterestRate,
      loanPurpose: isPurposeAllowed(p.productType, prev.loanPurpose) ? prev.loanPurpose : '',
    }));
    setStep('loan');
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // Applies a customer-confirmed subset of an AI document-extraction draft —
  // never called automatically, only from the explicit "Apply" action after
  // the customer reviews the extracted values (AI_roadmap.md §15.1).
  function applyExtractedFields(patch: Record<string, string>) {
    setForm(prev => ({ ...prev, ...patch }));
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

  /* Field-level validation for the loan step. Messages are tied to each input
     via aria-describedby and only surfaced once the customer tries to move on,
     so the form never shouts before they have finished typing. */
  const loanErrors = useMemo(() => {
    const errs: {
      requestedAmount?: string;
      requestedTermMonths?: string;
      loanPurpose?: string;
    } = {};
    if (!selectedProduct) return errs;

    const rawAmount = form.requestedAmount.trim();
    if (!rawAmount) {
      errs.requestedAmount = 'Enter the amount you want to borrow.';
    } else {
      const amount = Number(rawAmount);
      if (Number.isNaN(amount)) {
        errs.requestedAmount = 'Enter the amount as a number.';
      } else if (
        amount < selectedProduct.minLoanAmount ||
        amount > selectedProduct.maxLoanAmount
      ) {
        errs.requestedAmount = `Enter an amount between ${formatCurrency(
          selectedProduct.minLoanAmount
        )} and ${formatCurrency(selectedProduct.maxLoanAmount)}.`;
      }
    }

    const rawTerm = form.requestedTermMonths.trim();
    if (!rawTerm) {
      errs.requestedTermMonths = 'Enter how many months you want to borrow for.';
    } else {
      const term = Number(rawTerm);
      if (!Number.isInteger(term)) {
        errs.requestedTermMonths = 'Enter the term as a whole number of months.';
      } else if (
        term < selectedProduct.minTermMonths ||
        term > selectedProduct.maxTermMonths
      ) {
        errs.requestedTermMonths = `Enter a term between ${selectedProduct.minTermMonths} and ${selectedProduct.maxTermMonths} months.`;
      }
    }

    if (!form.loanPurpose) {
      errs.loanPurpose = 'Choose what the loan is for.';
    }

    return errs;
  }, [form.requestedAmount, form.requestedTermMonths, form.loanPurpose, selectedProduct]);

  const hasLoanErrors = Object.keys(loanErrors).length > 0;

  function canGoNext(): boolean {
    switch (step) {
      case 'product':
        return !!selectedProduct;
      case 'loan':
        return !hasLoanErrors;
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
    if (!canGoNext()) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    const i = stepIndex;
    if (i < STEPS.length - 1) setStep(STEPS[i + 1].key);
  }

  function goBack() {
    setAttemptedNext(false);
    const i = stepIndex;
    if (i > 0) setStep(STEPS[i - 1].key);
  }

  function goToStep(key: WizardStep) {
    setAttemptedNext(false);
    setStep(key);
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
          type="button"
        >
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div>
          <h1 className="serif text-[26px] font-medium leading-tight tracking-tight sm:text-[30px]" style={{ color: 'var(--text-primary)' }}>
            New application
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {savedApp
              ? `Draft saved — ${savedApp.applicationNumber || 'no reference yet'}`
              : 'Fill in the details to apply for a loan'}
          </p>
        </div>
      </div>

      <section className="panel mb-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="panel-title">Your application</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{STEPS[stepIndex]?.label ?? 'Choose a product'} is your focus now. Review everything before you submit.</p>
          </div>
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">Step {stepIndex + 1} of {STEPS.length}</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-border)]" role="progressbar" aria-label="Application steps completed" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={Math.max(0, stepIndex)}><div className="h-full rounded-full bg-[var(--brand)] transition-all" style={{ width: `${Math.max(0, stepIndex) / STEPS.length * 100}%` }} /></div>
        {ready && preferences.documents && step === 'product' && <details className="mt-5 rounded-xl bg-[var(--surface-input)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--brand)]">Prefill from a bank statement or payslip</summary>
          <p className="my-3 text-sm leading-6 text-[var(--text-secondary)]">Upload a document, check the extracted information, then apply the suggested values to your draft. You can edit every field.</p>
          <div className="grid gap-3 lg:grid-cols-2"><DocumentExtractionUpload documentType="BANK_STATEMENT" onApplyExtracted={applyExtractedFields} /><DocumentExtractionUpload documentType="PAYSLIP" onApplyExtracted={applyExtractedFields} /></div>
          <p className="text-xs text-[var(--text-secondary)]">Tax document extraction is not available yet. Document reading helps prepare your application; it does not determine eligibility.</p>
        </details>}
      </section>

      {/* Stepper — plain step position, no scoring */}
      <nav
        className="no-scrollbar mb-6 overflow-x-auto"
        aria-label={`Application steps: step ${stepIndex + 1} of ${STEPS.length}, ${
          stepIndex >= 0 ? STEPS[stepIndex].label : ''
        }`}
        tabIndex={0}
      >
        <p className="mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Step {stepIndex + 1} of {STEPS.length}
          {stepIndex >= 0 ? ` · ${STEPS[stepIndex].label}` : ''}
        </p>
        <ol className="flex min-w-max items-center gap-1 sm:min-w-0">
          {STEPS.map((s, i) => {
            const isActive = i === stepIndex;
            const isComplete = i < stepIndex;
            return (
              <li key={s.key} className="flex flex-1 items-center">
                <button
                  onClick={() => {
                    if (isComplete) goToStep(s.key);
                  }}
                  disabled={!isComplete && !isActive}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${i + 1} of ${STEPS.length}: ${s.label}${
                    isComplete ? ' (completed)' : isActive ? ' (current step)' : ' (not reached yet)'
                  }`}
                  className="flex items-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-default"
                  style={{
                    color: isActive || isComplete ? 'var(--brand-on-soft)' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                  type="button"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors"
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
                    aria-hidden="true"
                  >
                    {isComplete ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="mx-2 h-0.5 flex-1 rounded-full"
                    aria-hidden="true"
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

      {/* Error — the customer's answers are never cleared on a failed save */}
      {error && (
        <div className="alert alert-error mb-5" role="alert">
          <span>
            {error} Your answers have been kept — you can try again.
          </span>
        </div>
      )}

      {/* Step Content */}
      <div className="card p-6">
        {step === 'product' && (
          <StepProduct
            products={visibleProducts}
            loading={loadingProducts}
            selected={selectedProduct}
            onSelect={selectProduct}
            error={productsError}
            onRetry={loadProducts}
          />
        )}

        {step === 'loan' && selectedProduct && (
          <StepLoan
            form={form}
            product={selectedProduct}
            onChange={handleChange}
            isBusiness={isBusiness}
            errors={attemptedNext ? loanErrors : {}}
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
          <StepFinancial
            form={form}
            onChange={handleChange}
            isBusiness={isBusiness}
            onApplyExtracted={applyExtractedFields}
          />
        )}

        {step === 'employment' && (
          <StepEmployment form={form} onChange={handleChange} onApplyExtracted={applyExtractedFields} />
        )}

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
            <button onClick={goBack} className="btn btn-ghost" type="button">
              <span aria-hidden="true">&larr;</span> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step !== 'review' && selectedProduct && (
            <button
              onClick={saveDraft}
              disabled={saving || !canGoNext()}
              className="btn btn-ghost"
              type="button"
            >
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
              className="btn btn-primary"
              type="button"
              aria-describedby={
                declarations.informationAccurate &&
                declarations.consentCreditCheck &&
                declarations.termsAccepted
                  ? undefined
                  : 'declarations-hint'
              }
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          ) : (
            /* Stays clickable on the loan step so missing or out-of-range
               values are explained next to the field instead of silently
               disabling the way forward. */
            <button
              onClick={goNext}
              disabled={step !== 'loan' && !canGoNext()}
              className="btn btn-primary"
              type="button"
            >
              Continue <span aria-hidden="true">&rarr;</span>
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
  error,
  onRetry,
}: {
  products: LoanProduct[];
  loading: boolean;
  selected: LoanProduct | null;
  onSelect: (p: LoanProduct) => void;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <h2 className="section-title">Choose a product</h2>
        <p className="sr-only" role="status">Loading products…</p>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">Choose a product</h2>
      <p className="field-hint">Select the loan product you want to apply for.</p>

      {error && (
        <div className="alert alert-error mt-4 flex-col sm:flex-row sm:items-center" role="alert">
          <p className="flex-1">{error}</p>
          <button onClick={onRetry} className="btn btn-sm btn-outline shrink-0" type="button">
            Try again
          </button>
        </div>
      )}

      {!error && products.length === 0 ? (
        <div className="empty-state mt-4">
          <div className="empty-state-icon">
            <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h3 className="empty-state-title">No products available</h3>
          <p className="empty-state-text">
            There are no loan products open for online application right now. Contact your
            relationship manager to discuss your options.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {products.map(p => {
            const isSelected = selected?.productId === p.productId;
            return (
              <li key={p.productId}>
                <button
                  onClick={() => onSelect(p)}
                  aria-pressed={isSelected}
                  className="w-full rounded-xl border-2 px-5 py-4 text-left transition-all"
                  style={{
                    borderColor: isSelected ? 'var(--brand)' : 'var(--surface-border)',
                    backgroundColor: isSelected ? 'var(--brand-soft)' : 'transparent',
                  }}
                  type="button"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {p.productName}
                      </h3>
                      <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {PRODUCT_TYPE_LABELS[p.productType] || p.productType}
                        {p.shortDescription && ` — ${p.shortDescription}`}
                      </p>
                    </div>
                    <div className="text-right text-sm" style={{ color: 'var(--text-muted)' }}>
                      <p className="tabular-nums">
                        {formatCurrency(p.minLoanAmount)} – {formatCurrency(p.maxLoanAmount)}
                      </p>
                      <p className="tabular-nums">
                        {p.minInterestRate}% – {p.maxInterestRate}% p.a.
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StepLoan({
  form,
  product,
  onChange,
  isBusiness,
  errors,
}: {
  form: Record<string, string>;
  product: LoanProduct;
  isBusiness: boolean;
  errors: { requestedAmount?: string; requestedTermMonths?: string; loanPurpose?: string };
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
}) {
  const isHomePurpose = HOME_PURPOSES.includes(form.loanPurpose);
  const isVehiclePurpose = VEHICLE_PURPOSES.includes(form.loanPurpose);

  // A purpose carried in from a saved draft (or set by an RM) can sit outside
  // the selected product's list — keep it selectable rather than dropping the
  // customer's answer.
  const allowedPurposes = getPurposeOptions(product.productType);
  const purposeOptions =
    form.loanPurpose && !allowedPurposes.includes(form.loanPurpose as LoanPurpose)
      ? [...allowedPurposes, form.loanPurpose as LoanPurpose]
      : allowedPurposes;

  // Admin-managed rate plans (LTV bands / fixed-term tiers) are only offered
  // for mortgages — every other product carries one bank-set rate that the
  // customer is shown rather than asked to choose.
  const canChooseRate = RATE_PLAN_PRODUCT_TYPES.has(product.productType);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [loadingRatePlans, setLoadingRatePlans] = useState(canChooseRate);

  useEffect(() => {
    if (!canChooseRate) {
      setRatePlans([]);
      return;
    }
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
  }, [product.productCode, canChooseRate]);

  const shownRate = form.requestedInterestRate || String(product.defaultInterestRate ?? '');

  return (
    <div>
      <h2 className="section-title">Loan details</h2>
      <p className="field-hint">
        Applying for{' '}
        <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {product.productName}
        </span>
        . Fields marked <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Amount */}
        <div>
          <label className="field-label" htmlFor="requestedAmount">
            Loan amount{' '}
            <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
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
            className="input tabular-nums"
            required
            aria-required="true"
            aria-invalid={errors.requestedAmount ? true : undefined}
            aria-describedby="requestedAmount-hint"
          />
          {errors.requestedAmount ? (
            <p
              id="requestedAmount-hint"
              className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-300"
              role="alert"
            >
              {errors.requestedAmount}
            </p>
          ) : (
            <p id="requestedAmount-hint" className="field-hint">
              Between {formatCurrency(product.minLoanAmount)} and{' '}
              {formatCurrency(product.maxLoanAmount)}
            </p>
          )}
        </div>

        {/* Term */}
        <div>
          <label className="field-label" htmlFor="requestedTermMonths">
            Term (months){' '}
            <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
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
            className="input tabular-nums"
            required
            aria-required="true"
            aria-invalid={errors.requestedTermMonths ? true : undefined}
            aria-describedby="requestedTermMonths-hint"
          />
          {errors.requestedTermMonths ? (
            <p
              id="requestedTermMonths-hint"
              className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-300"
              role="alert"
            >
              {errors.requestedTermMonths}
            </p>
          ) : (
            <p id="requestedTermMonths-hint" className="field-hint">
              Between {product.minTermMonths} and {product.maxTermMonths} months
            </p>
          )}
        </div>

        {/* Interest Rate */}
        <div>
          <label className="field-label" htmlFor="requestedInterestRate">
            Interest rate
          </label>
          {loadingRatePlans ? (
            <div className="skeleton h-10" aria-hidden="true" />
          ) : canChooseRate && ratePlans.length > 0 ? (
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
                    {plan.label} — {plan.interestRate}%{plan.isGreen ? ' (green rate)' : ''}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Choose the LTV or fixed-term rate plan that applies to you.
              </p>
            </>
          ) : (
            <>
              {/* Bank-set rate, not customer-editable — kept as a readonly input so
                  the visible <label htmlFor> points at a real form control. */}
              <input
                id="requestedInterestRate"
                type="text"
                name="requestedInterestRate"
                value={shownRate ? `${shownRate}% p.a.` : 'To be confirmed'}
                readOnly
                aria-readonly="true"
                className="input tabular-nums"
              />
              <p className="field-hint">
                {canChooseRate
                  ? 'The bank has not published rate plans for this product yet.'
                  : 'This product has one rate, set by the bank.'}
              </p>
            </>
          )}
        </div>

        {/* Loan Purpose */}
        <div>
          <label className="field-label" htmlFor="loanPurpose">
            Loan purpose{' '}
            <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <select
            id="loanPurpose"
            name="loanPurpose"
            value={form.loanPurpose}
            onChange={onChange}
            className="select"
            required
            aria-required="true"
            aria-invalid={errors.loanPurpose ? true : undefined}
            aria-describedby="loanPurpose-hint"
          >
            <option value="">Select purpose…</option>
            {purposeOptions.map(key => (
              <option key={key} value={key}>
                {LOAN_PURPOSE_LABELS[key]}
              </option>
            ))}
          </select>
          {errors.loanPurpose ? (
            <p
              id="loanPurpose-hint"
              className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-300"
              role="alert"
            >
              {errors.loanPurpose}
            </p>
          ) : (
            <p id="loanPurpose-hint" className="field-hint">
              Only the purposes available for {product.productName} are listed.
            </p>
          )}
        </div>

        {/* Business: how the borrowing is structured */}
        {isBusiness && (
          <div>
            <label className="field-label" htmlFor="facilityType">
              Type of loan
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
          <h3 className="section-title">Property details</h3>
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
          <h3 className="section-title">Vehicle details</h3>
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

// ─── AI document extraction (upload + review, AI_roadmap.md §15.1) ────
//
// Lets the customer upload a bank statement or payslip and get back a
// DRAFT of extracted values to review before applying them to the form.
// Nothing is ever applied automatically — the customer must press "Apply"
// after seeing exactly what was read.

/* Extracted field names arrive as raw camelCase API keys — show them as plain
   sentence-case words rather than leaking the payload shape into the UI. */
function humaniseFieldKey(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* The model echoes figures exactly as they are printed on the page, so an
   amount regularly arrives as "1,38,283.50" or "₹4,850.20" — a bare Number()
   of that is NaN, which silently drops the value rather than failing loudly. */
function parseAmount(value: unknown): number | null {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  if (!/^\d/.test(cleaned) && !/^-\d/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

// Parses a date the model echoes verbatim, e.g. "01/04/2026" or "01 Apr 2026".
// Returns null for anything unparseable so callers fall back gracefully.
function parseStatementDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const s = value.trim();
  const num = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (num) {
    const d = new Date(Number(num[3]), Number(num[2]) - 1, Number(num[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

// Number of calendar months a bank statement's transactions cover. The model
// reads a statement that can span 1-6+ months, so a monthly-expense figure must
// be an average, not the raw period total (AI_roadmap §15.1 "produce the figure
// deterministically"). Prefers the printed statement period; falls back to the
// distinct months present in the transaction list (always ≥ 1).
function statementMonthsCovered(fields: Record<string, unknown>): number {
  const start = parseStatementDate(fields.statementPeriodStart);
  const end = parseStatementDate(fields.statementPeriodEnd);
  if (start && end && end.getTime() >= start.getTime()) {
    return (end.getFullYear() - start.getFullYear()) * 12
      + (end.getMonth() - start.getMonth()) + 1;
  }
  const tx = Array.isArray(fields.transactions) ? fields.transactions : [];
  const distinct = new Set<number>();
  for (const txObj of tx) {
    if (txObj && typeof txObj === 'object') {
      const d = parseStatementDate((txObj as Record<string, unknown>).date);
      if (d) distinct.add(d.getFullYear() * 12 + d.getMonth());
    }
  }
  return Math.max(distinct.size, 1);
}

function extractedFieldPatch(
  documentType: DocumentType,
  fields: Record<string, unknown>
): Record<string, string> {
  if (documentType === 'PAYSLIP') {
    const patch: Record<string, string> = {};
    if (typeof fields.employerName === 'string') patch.employerName = fields.employerName;
    const monthlyIncome = parseAmount(fields.netPay) ?? parseAmount(fields.grossPay);
    if (monthlyIncome != null) patch.statedMonthlyIncome = monthlyIncome.toFixed(2);
    return patch;
  }

  // BANK_STATEMENT: estimate MONTHLY expenses. Sum the debit transactions, then
  // divide by how many months the statement covers — a statement routinely
  // spans 1-6 months, so the raw debit total is NOT a monthly figure. Without
  // this the applied value was the whole-period total (~19,317) instead of the
  // monthly average (~3,220), which is what made the fetched amount "grossly
  // incorrect".
  const transactions = Array.isArray(fields.transactions) ? fields.transactions : [];
  const totalDebits = transactions.reduce((sum: number, tx) => {
    if (!tx || typeof tx !== 'object') return sum;
    const t = tx as Record<string, unknown>;
    if (String(t.type).toUpperCase() !== 'DEBIT') return sum;
    const amount = parseAmount(t.amount);
    return amount == null ? sum : sum + Math.abs(amount);
  }, 0);
  if (totalDebits <= 0) return {};
  const monthlyExpenses = totalDebits / statementMonthsCovered(fields);
  return { statedMonthlyExpenses: monthlyExpenses.toFixed(2) };
}

function DocumentExtractionUpload({
  documentType,
  onApplyExtracted,
}: {
  documentType: DocumentType;
  onApplyExtracted: (patch: Record<string, string>) => void;
}) {
  const { preferences, ready } = useAIPreferences();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DocumentExtractionResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const label = documentType === 'PAYSLIP' ? 'payslip' : 'bank statement';

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [uploading]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a PDF, JPG, PNG or WebP file up to 10 MB.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setDraft(null);
    setApplied(false);
    setElapsedSeconds(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await documentExtractionService.extract(documentType, file, controller.signal);
      if (result.status !== 'DRAFT') {
        setUploadError(result.errorMessage || result.warnings[0] || 'Could not read this document.');
      } else {
        setDraft(result);
      }
    } catch (err) {
      // A cancel is an expected outcome at this length, not an error to report.
      if (!controller.signal.aborted) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      abortRef.current = null;
      setUploading(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleApply() {
    if (!draft) return;
    onApplyExtracted(extractedFieldPatch(documentType, draft.extractedFields));
    setApplied(true);
  }

  if (!ready || !preferences.documents) return null;

  return (
    <div
      className="mb-6 rounded-xl border border-dashed bg-[var(--brand-soft)] p-5"
      style={{ borderColor: 'var(--surface-border-strong)' }}
    >
      <p className="field-label mb-1">
        Upload a {label} <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
      </p>
      <p className="field-hint mb-3">
        We&apos;ll read it and suggest values below for you to review — nothing is filled in
        automatically. PDF, JPG, PNG or WebP, up to 10 MB.
      </p>
      <label className="btn btn-ghost btn-sm inline-block cursor-pointer">
        {uploading ? 'Reading…' : `Choose ${label} file`}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={uploading}
          onChange={handleFileSelected}
        />
      </label>

      {uploading && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{ backgroundColor: 'var(--surface-input)' }}
          role="status"
          aria-live="polite"
        >
          <p
            className="flex items-center gap-2 text-base font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Reading your {label}
          </p>
          <p className="field-hint mt-2">
            We&apos;re pulling the figures out for you to check — this usually takes under a minute.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {elapsedSeconds}s elapsed
            </span>
            <button type="button" onClick={handleCancel} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <p
          className="mt-3 text-sm font-medium text-red-600 dark:text-red-300"
          role="alert"
        >
          {uploadError}
        </p>
      )}

      {draft && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{ backgroundColor: 'var(--surface-input)' }}
        >
          <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
            Extracted values (draft)
          </p>
          <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {Object.entries(draft.extractedFields)
              .filter(([key]) => key !== 'transactions')
              .map(([key, value]) => (
                <li key={key} className="flex flex-wrap justify-between gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>{humaniseFieldKey(key)}</span>
                  <span className="font-medium tabular-nums">{String(value)}</span>
                </li>
              ))}
          </ul>
          {draft.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {draft.warnings.map((w, i) => (
                <li key={i}>
                  <span aria-hidden="true">⚠ </span>
                  {w}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleApply}
            disabled={applied}
            className="btn btn-primary btn-sm mt-4"
          >
            {applied ? (
              <>
                Applied <span aria-hidden="true">✓</span>
                <span className="sr-only">— suggested values copied into the form</span>
              </>
            ) : (
              'Apply suggested values'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function StepFinancial({
  form,
  onChange,
  isBusiness,
  onApplyExtracted,
}: {
  form: Record<string, string>;
  isBusiness: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  onApplyExtracted: (patch: Record<string, string>) => void;
}) {
  return (
    <div>
      <h2 className="section-title">
        {isBusiness ? 'Business and financial information' : 'Financial information'}
      </h2>
      <p className="field-hint">
        Every field on this step is optional. Providing them helps us assess your application.
      </p>

      <DocumentExtractionUpload documentType="BANK_STATEMENT" onApplyExtracted={onApplyExtracted} />

      {/* Business-specific fields */}
      {isBusiness && (
        <div className="mt-6">
          <h3 className="section-title mb-3">Business financials</h3>
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
                What the loan is for in your business
              </label>
              <textarea
                id="facilityPurposeDescription"
                name="facilityPurposeDescription"
                value={form.facilityPurposeDescription}
                onChange={onChange}
                rows={2}
                placeholder="Describe how you will use the loan in your business…"
                className="input resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Personal financial fields */}
      <div className="mt-6">
        {isBusiness && <h3 className="section-title mb-3">Personal financials</h3>}
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
  onApplyExtracted,
}: {
  form: Record<string, string>;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  onApplyExtracted: (patch: Record<string, string>) => void;
}) {
  return (
    <div>
      <h2 className="section-title">Employment details</h2>
      <p className="field-hint">
        Every field on this step is optional. Add your employment details if you want us to take
        them into account.
      </p>

      <DocumentExtractionUpload documentType="PAYSLIP" onApplyExtracted={onApplyExtracted} />

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
      <div className="space-y-3" aria-busy="true">
        <h2 className="section-title">People and roles</h2>
        <p className="sr-only" role="status">Loading the people linked to your company…</p>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-14" />
        ))}
      </div>
    );
  }

  const active = members.filter(m => m.isActive);
  const summary = validation?.summary;

  return (
    <div>
      <h2 className="section-title">People and roles</h2>
      <p className="field-hint">
        Confirm the directors, shareholders, beneficial owners and signatories linked to your
        company.
      </p>

      {/* Validation Banner — also carries the "you can still proceed" note so the
          same information is not restated twice on the step. */}
      {validation && (
        <div
          className={`alert mt-4 items-start ${validation.isComplete ? 'alert-success' : 'alert-warning'}`}
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {validation.isComplete ? '✓' : '⚠'}
          </span>
          <div className="flex-1">
            <h3 className="text-base font-semibold">
              {validation.isComplete ? 'All party requirements met' : 'Requirements not yet met'}
            </h3>
            {!validation.isComplete && validation.issues.length > 0 && (
              <ul className="mt-1.5 list-inside list-disc text-sm">
                {validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
            {!validation.isComplete && (
              <p className="mt-2 text-sm">
                You can still continue, but your application may need additional review.
              </p>
            )}
            {summary && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums opacity-90">
                <li>
                  {summary.directors} {summary.directors === 1 ? 'director' : 'directors'}
                </li>
                <li>
                  {summary.shareholders} {summary.shareholders === 1 ? 'shareholder' : 'shareholders'}
                </li>
                <li>
                  {summary.ubos} beneficial {summary.ubos === 1 ? 'owner' : 'owners'} (
                  {summary.totalUboOwnership}% ownership)
                </li>
                <li>
                  {summary.signatories} {summary.signatories === 1 ? 'signatory' : 'signatories'}
                </li>
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Members list */}
      {active.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {active.map(m => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4"
              style={{
                backgroundColor: 'var(--surface-input)',
                borderColor: 'var(--surface-border)',
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                  aria-hidden="true"
                >
                  {(m.customerName || '?')[0]}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                    {m.customerName || 'Name not provided'}
                  </p>
                  {m.customerEmail && (
                    <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                      {m.customerEmail}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-neutral">{PARTY_ROLE_LABELS[m.role] || m.role}</span>
                {m.ownershipPercentage != null && (
                  <span className="badge badge-neutral tabular-nums">
                    {m.ownershipPercentage}% owned
                  </span>
                )}
                {m.isAuthorizedSignatory && <span className="badge badge-info">Signatory</span>}
                {m.isBeneficialOwner && <span className="badge badge-info">Beneficial owner</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state mt-4">
          <div className="empty-state-icon">
            <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          </div>
          <h3 className="empty-state-title">No people linked to your company</h3>
          <p className="empty-state-text">
            Add your directors, shareholders and signatories before submitting this application.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a
          href="/portal/company/parties"
          target="_blank"
          rel="noopener noreferrer"
          className="link-arrow"
        >
          Manage people and roles <span data-arrow aria-hidden="true">→</span>
        </a>
        <button onClick={onRefresh} className="btn btn-ghost btn-sm" type="button">
          <span aria-hidden="true">↻</span> Refresh
        </button>
      </div>
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
      title: 'Loan details',
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
          label: 'Interest rate',
          value: form.requestedInterestRate
            ? `${form.requestedInterestRate}% p.a.`
            : 'Set by the bank',
        },
        {
          label: 'Purpose',
          value: LOAN_PURPOSE_LABELS[form.loanPurpose as LoanPurpose] || form.loanPurpose || '—',
        },
        { label: 'Description', value: form.loanPurposeDescription || '—' },
        ...(isBusiness && form.facilityType
          ? [
              {
                label: 'Type of loan',
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
            title: 'Property details',
            items: [
              { label: 'Address', value: form.propertyAddress || '—' },
              { label: 'City', value: form.propertyCity || '—' },
              { label: 'County / state', value: form.propertyState || '—' },
              { label: 'Postal code', value: form.propertyPostalCode || '—' },
              {
                label: 'Type',
                value: PROPERTY_TYPES.find(t => t.value === form.propertyType)?.label || '—',
              },
              {
                label: 'Estimated value',
                value: form.propertyValue ? formatCurrency(parseFloat(form.propertyValue)) : '—',
              },
              {
                label: 'Deposit',
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
            title: 'Vehicle details',
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
                label: 'Estimated value',
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
            title: 'Business financials',
            items: [
              {
                label: 'Annual revenue',
                value: form.businessAnnualRevenue
                  ? formatCurrency(parseFloat(form.businessAnnualRevenue))
                  : '—',
              },
              {
                label: 'Business vintage',
                value: form.businessVintageYears ? `${form.businessVintageYears} years` : '—',
              },
              { label: 'Loan use', value: form.facilityPurposeDescription || '—' },
            ],
          },
        ]
      : []),
    {
      title: 'Financial information',
      items: [
        {
          label: 'Annual income',
          value: form.statedAnnualIncome
            ? formatCurrency(parseFloat(form.statedAnnualIncome))
            : '—',
        },
        {
          label: 'Monthly income',
          value: form.statedMonthlyIncome
            ? formatCurrency(parseFloat(form.statedMonthlyIncome))
            : '—',
        },
        {
          label: 'Monthly expenses',
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
        { label: 'Job title', value: form.jobTitle || '—' },
        { label: 'Years with employer', value: form.yearsWithEmployer ? `${form.yearsWithEmployer} years` : '—' },
      ],
    },
  ];

  return (
    <div>
      <h2 className="section-title">Review your application</h2>
      <p className="field-hint">Check everything below, then accept the declarations to submit.</p>

      <div className="mt-6 space-y-6">
        {sections.map(section => (
          <section key={section.title} aria-label={section.title}>
            <h3
              className="mb-3 border-b pb-2 text-base font-semibold"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--surface-border)' }}
            >
              {section.title}
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {section.items.map(item => (
                <div key={item.label} className="flex justify-between gap-4 sm:block">
                  <dt className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {item.label}
                  </dt>
                  <dd
                    className="text-base font-medium tabular-nums sm:mt-0.5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {/* ─── Declarations & Consent ─────────────────────── */}
      <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--surface-border)' }}>
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Declarations and consent
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          All three declarations are required before you can submit.
        </p>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declarations.informationAccurate}
              onChange={e => onDeclarationChange('informationAccurate', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
              style={{ borderColor: 'var(--surface-border-strong)' }}
              required
              aria-required="true"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              I declare that all information provided in this application is true, accurate, and
              complete to the best of my knowledge.{' '}
              <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declarations.consentCreditCheck}
              onChange={e => onDeclarationChange('consentCreditCheck', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
              style={{ borderColor: 'var(--surface-border-strong)' }}
              required
              aria-required="true"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              I consent to the bank performing credit checks, verifying my identity, and sharing my
              information with credit bureaus and regulatory authorities as required.{' '}
              <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declarations.termsAccepted}
              onChange={e => onDeclarationChange('termsAccepted', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
              style={{ borderColor: 'var(--surface-border-strong)' }}
              required
              aria-required="true"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              I have read and agree to the terms and conditions, privacy policy, and the
              product-specific disclosures.{' '}
              <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </span>
          </label>
        </div>

        {(!declarations.informationAccurate ||
          !declarations.consentCreditCheck ||
          !declarations.termsAccepted) && (
          <p
            id="declarations-hint"
            className="mt-4 text-sm text-amber-600 dark:text-amber-400"
            role="status"
          >
            Accept all three declarations to enable “Submit application”.
          </p>
        )}
      </div>
    </div>
  );
}
