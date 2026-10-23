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
  INTENT_TO_LOAN_PURPOSE,
  getPurposeOptions,
  isPurposeAllowed,
} from '@/services/api/application-service';
import {
  productService,
  LoanProduct,
  RatePlan,
} from '@/services/api/product-service';
import { documentExtractionService, DocumentType, DocumentExtractionResult } from '@/services/api/document-extraction-service';
import { statementAnalysisService, type CashFlowAnalysis } from '@/services/api/statement-analysis-service';
import { customerService } from '@/services/api/customer-service';
import { formatCurrency } from '@/lib/format';
import { useBankQuote, QuoteFigures, QuoteHeadline } from '@/components/applications/QuoteFigures';
import type { Quote } from '@/services/api/quote-service';
import {
  partyService,
  PartyMember,
  PartyValidation,
  PARTY_ROLE_LABELS,
  MIN_SIGNATORIES,
  partySummaryCounts,
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
  /* Distinct from "the company has no people": a lookup that failed must not be shown as a
     statement about the customer's own company. */
  const [partyError, setPartyError] = useState<string | null>(null);
  /* Customer ids of the officers chosen to sign. Held apart from the register because it is
     a choice about this application, not a fact about the company. */
  const [signatoryIds, setSignatoryIds] = useState<string[]>([]);

  /* Which range of lending this customer is in. Taken from the customer record — the same
     LendingSegment decision the BFF applies when it accepts or refuses parties — so the steps
     shown here cannot disagree with the endpoints the wizard later calls. This was a list of
     product types, which had drifted badly: only 1 of the 11 products open to business customers
     was in it, so a company or sole trader choosing any other was asked for employment details,
     while OVERDRAFT, which is personal-only, sent a private customer through "People and roles". */
  const isBusiness = useMemo(() => {
    if (appContext) return appContext.isBusiness;
    return selectedProduct?.eligibleCustomerTypes?.some(t => t.toUpperCase() === 'BUSINESS') ?? false;
  }, [appContext, selectedProduct]);

  const STEPS = isBusiness ? BUSINESS_STEPS : PERSONAL_STEPS;

  /* A company's income is the company's, and it is asked for as revenue on this same step —
     annual income, monthly income and expenses describe a person, so asking a limited company
     for them invites somebody to enter a director's salary as the borrower's income. A sole
     trader is the exception: there is no distance between the trade and the person, so their
     household figures are the affordability answer. */
  const showPersonalFinancials =
    !isBusiness || appContext?.customerSubtype?.toUpperCase() === 'SOLE_TRADER';

  // Already filtered to the customer's segment by the catalogue endpoint.
  const visibleProducts = useMemo(() => products, [products]);

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
    businessMonthlyIncome: '',
    businessMonthlyExpenses: '',
    businessVintageYears: '',
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

  /* The repayment the bank would actually charge for these figures. Asked here rather than
     per-step so the same quote is on screen while the amount is being typed and again when the
     customer signs the declarations — and so the two can never disagree. */
  const { quote, quoting, quoteError, retry: retryQuote } = useBankQuote(
    selectedProduct?.productCode ?? null,
    Number(form.requestedAmount),
    Number(form.requestedTermMonths)
  );

  /* Which fields came from the customer record rather than from this sitting-down, so the step
     can say so beside each one. A field the customer then edits stops being labelled. */
  const [seededFromProfile, setSeededFromProfile] = useState<Record<string, string>>({});

  // Load products + context
  useEffect(() => {
    loadProducts();
    loadContext();
    loadProfileDefaults();
  }, []);

  // Load parties when entering parties step
  useEffect(() => {
    if (step === 'parties' && isBusiness) {
      loadParties();
    }
  }, [step, isBusiness]);

  // Restore a signatory choice already saved against the draft
  useEffect(() => {
    if (step !== 'parties' || !savedApp) return;
    let active = true;
    partyService
      .getSignatories(savedApp.applicationId)
      .then(ids => {
        if (active) setSignatoryIds(ids ?? []);
      })
      .catch(() => {
        /* Nothing chosen yet is indistinguishable from a failed read here; the step simply
           starts with nothing ticked and the customer chooses. */
      });
    return () => {
      active = false;
    };
  }, [step, savedApp]);

  async function loadContext() {
    try {
      const ctx = await applicationService.getContext();
      setAppContext(ctx);
    } catch {
      // Context not available — default to personal
    }
  }

  /* The bank already holds this customer's employer, job and income, so asking them to type it
     in again is work we invented. Only fields still empty are seeded — a resumed draft's own
     answers win — and the steps say where the values came from, so anything out of date can be
     corrected in place. */
  async function loadProfileDefaults() {
    try {
      const me = await customerService.getMyProfile();
      const seeded = {
        employmentStatus: me.employmentStatus || '',
        employerName: me.employerName || '',
        jobTitle: me.occupation || '',
        statedAnnualIncome: me.annualIncome ? String(me.annualIncome) : '',
      };
      if (!Object.values(seeded).some(Boolean)) return;
      setSeededFromProfile(seeded);
      setForm(prev => ({
        ...prev,
        employmentStatus: prev.employmentStatus || seeded.employmentStatus,
        employerName: prev.employerName || seeded.employerName,
        jobTitle: prev.jobTitle || seeded.jobTitle,
        statedAnnualIncome: prev.statedAnnualIncome || seeded.statedAnnualIncome,
      }));
    } catch {
      // No profile readable — the steps start blank, exactly as they always did.
    }
  }

  async function loadParties() {
    setLoadingParties(true);
    setPartyError(null);
    /* Two requests, deliberately not Promise.all: with the pair, a failed validation call
       discarded members that had arrived, so a company with a director on file could still
       be shown as having none. Validation only adds warnings, so losing it is survivable. */
    try {
      setPartyMembers(await partyService.listParties());
    } catch (err: any) {
      setPartyMembers([]);
      setPartyError(
        err?.status === 403
          ? 'We could not match your login to a company, so we cannot see who acts for it.'
          : 'We could not read the people linked to your company just now.'
      );
    }
    try {
      setPartyValidation(await partyService.validateParties());
    } catch {
      setPartyValidation(null);
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
            businessMonthlyIncome: existing.businessMonthlyIncome?.toString() ?? prev.businessMonthlyIncome,
            businessMonthlyExpenses: existing.businessMonthlyExpenses?.toString() ?? prev.businessMonthlyExpenses,
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
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    /* Once the customer has typed in a field it is their answer, not ours to attribute
       to their record. */
    setSeededFromProfile(prev => (prev[name] ? { ...prev, [name]: '' } : prev));
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
      if (form.businessMonthlyIncome)
        payload.businessMonthlyIncome = parseFloat(form.businessMonthlyIncome);
      if (form.businessMonthlyExpenses)
        payload.businessMonthlyExpenses = parseFloat(form.businessMonthlyExpenses);
      if (form.businessVintageYears)
        payload.businessVintageYears = parseInt(form.businessVintageYears, 10);
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
      setError(readableError(err.message, 'We could not save your application.'));
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
        /* Two named signatories are required before the application can move on — the same
           minimum the server enforces on save, so the two cannot disagree about when the
           customer is allowed through. */
        return signatoryIds.length >= MIN_SIGNATORIES;
      case 'financial':
        return true; // optional
      case 'employment':
        return true; // optional
      default:
        return false;
    }
  }

  /**
   * Records the chosen signatories, creating the draft first if the customer has not
   * reached a save yet — there is nowhere to attach a choice to before an application exists.
   */
  async function persistSignatories(): Promise<boolean> {
    if (!selectedProduct) return false;
    try {
      let app = savedApp;
      if (!app) {
        app = await applicationService.create(
          buildPayload(),
          isBusiness ? 'BUSINESS' : undefined
        );
        setSavedApp(app);
      }
      await partyService.setSignatories(app.applicationId, signatoryIds);
      return true;
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(readableError(e.message, 'We could not record who is signing.'));
      return false;
    }
  }

  async function goNext() {
    if (!canGoNext()) {
      setAttemptedNext(true);
      /* The button stays clickable on the loan step deliberately, so the reason reads next to
         the field rather than as a dead control — but on a step taller than the viewport that
         field can be off screen, so bring it to the customer instead. */
      const firstError = step === 'loan' ? Object.keys(loanErrors)[0] : undefined;
      if (firstError) {
        (document.getElementsByName(firstError)[0] as HTMLElement | undefined)?.focus();
      }
      return;
    }
    if (step === 'parties' && !(await persistSignatories())) return;
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

      {/* What the figures typed so far actually cost. Step position is carried by the
          stepper below, so it is not restated here, and the document uploads live on the
          two steps whose fields they fill rather than on a step with none. */}
      {selectedProduct && step !== 'product' && (quote || quoting || quoteError) && (
        <section className="panel mb-6 px-5 py-4" aria-label="Indicative repayment">
          <QuoteHeadline
            quote={quote}
            quoting={quoting}
            quoteError={quoteError}
            onRetry={retryQuote}
          />
        </section>
      )}

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
            error={partyError}
            signatoryIds={signatoryIds}
            showShortfall={attemptedNext}
            onToggleSignatory={customerId =>
              setSignatoryIds(prev =>
                prev.includes(customerId)
                  ? prev.filter(id => id !== customerId)
                  : [...prev, customerId]
              )
            }
            onRefresh={loadParties}
          />
        )}

        {step === 'financial' && (
          <StepFinancial
            form={form}
            onChange={handleChange}
            isBusiness={isBusiness}
            showPersonalFinancials={showPersonalFinancials}
            seededFromProfile={seededFromProfile}
            onApplyExtracted={applyExtractedFields}
          />
        )}

        {step === 'employment' && (
          <StepEmployment
            form={form}
            onChange={handleChange}
            seededFromProfile={seededFromProfile}
            onApplyExtracted={applyExtractedFields}
          />
        )}

        {step === 'review' && selectedProduct && (
          <StepReview
            form={form}
            product={selectedProduct}
            isBusiness={isBusiness}
            showPersonalFinancials={showPersonalFinancials}
            quote={quote}
            signatories={partyMembers
              .filter(m => signatoryIds.includes(m.customerId))
              .map(m => m.customerName || 'Unnamed officer')}
            declarations={declarations}
            onEdit={goToStep}
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
              /* Saving work in progress must not wait for the step to validate — otherwise the
                 only way to keep what you have typed is to finish it first. */
              disabled={saving}
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
            /* Stays clickable on the steps that explain themselves — the loan step names the
               field, the parties step counts what is still needed — so a missing answer reads
               as a reason rather than as a dead button. */
            <button
              onClick={goNext}
              disabled={step !== 'loan' && step !== 'parties' && !canGoNext()}
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

/**
 * Shown once per step when values were carried in from the customer's own record instead of
 * being asked for. Saying where they came from is what makes a pre-filled form trustworthy —
 * an unexplained figure the customer did not type looks like the bank putting words in their
 * mouth, and this one is about to be signed as accurate.
 */
function ProfileSeededNote() {
  return (
    <p
      className="mt-3 rounded-xl px-4 py-2.5 text-sm"
      style={{ background: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
    >
      Some of this came from the details on your account, so you did not have to type it. Change
      anything that is out of date.
    </p>
  );
}

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
                      {/* The description alone: the product type label is nearly always the
                          product's own name again, which read as the name twice. */}
                      {p.shortDescription && (
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                          {p.shortDescription}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm" style={{ color: 'var(--text-muted)' }}>
                      <p className="tabular-nums">
                        {formatCurrency(p.minLoanAmount)} – {formatCurrency(p.maxLoanAmount)}
                      </p>
                      <p className="tabular-nums">
                        {p.minInterestRate === p.maxInterestRate
                          ? `${p.minInterestRate}% p.a.`
                          : `${p.minInterestRate}% – ${p.maxInterestRate}% p.a.`}
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
/**
 * An HTTP status name is not something the customer can act on, and it reads worse than nothing
 * in the error banner. A real sentence from the API — "At least 2 signatories must be selected" —
 * is kept.
 */
function readableError(message: string | undefined, fallback: string): string {
  const text = message?.trim();
  if (!text) return fallback;
  return /^(internal server error|bad request|unauthorized|forbidden|not found|method not allowed|request failed|http\b)/i.test(text)
    ? fallback
    : text;
}

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

/**
 * A payslip is one document about one pay period, so it still applies on its own. Bank statements
 * are aggregated across every source by the analysis service instead — averaging them here as well
 * would put two different calculations of the same figure in the same form.
 */
function extractedFieldPatch(fields: Record<string, unknown>): Record<string, string> {
  const patch: Record<string, string> = {};
  if (typeof fields.employerName === 'string') patch.employerName = fields.employerName;
  const monthlyIncome = parseAmount(fields.netPay) ?? parseAmount(fields.grossPay);
  if (monthlyIncome != null) patch.statedMonthlyIncome = monthlyIncome.toFixed(2);
  return patch;
}

/**
 * Every statement the application has, analysed as one picture: the accounts the customer holds
 * with the bank (only after they tick the consent box) plus any number of statements they upload
 * from other institutions. Totals are summed from transaction lines by the service — the model
 * reads the lines, it does not add them up — and stay a draft until the customer applies them.
 */
function StatementSources({
  isBusiness,
  showPersonalFinancials,
  onApplyExtracted,
}: {
  isBusiness: boolean;
  showPersonalFinancials: boolean;
  onApplyExtracted: (patch: Record<string, string>) => void;
}) {
  const { preferences, ready } = useAIPreferences();
  const [documents, setDocuments] = useState<DocumentExtractionResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useBankRecords, setUseBankRecords] = useState(false);
  const [windowMonths, setWindowMonths] = useState(6);
  const [analysis, setAnalysis] = useState<CashFlowAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [applied, setApplied] = useState(false);
  const uploadRef = useRef<AbortController | null>(null);
  const analysisRef = useRef<AbortController | null>(null);

  const hasStatementSource = documents.length > 0 || useBankRecords;

  useEffect(() => {
    if (!ready || !preferences.documents) return;
    let cancelled = false;
    documentExtractionService
      .list('BANK_STATEMENT')
      .then(docs => !cancelled && setDocuments(docs))
      .catch(() => {
        /* Nothing on file yet is the common case here and is not worth an error state. */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, preferences.documents]);

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [uploading]);

  // Re-run whenever the evidence base changes: a new upload, a withdrawal, consent, or the period.
  useEffect(() => {
    if (!ready || !preferences.documents || !hasStatementSource) {
      setAnalysis(null);
      return;
    }
    analysisRef.current?.abort();
    const controller = new AbortController();
    analysisRef.current = controller;
    setAnalysing(true);
    setApplied(false);
    statementAnalysisService
      .cashFlow({
        windowMonths,
        useBankRecords,
        consentGranted: useBankRecords,
        signal: controller.signal,
      })
      .then(result => {
        if (controller.signal.aborted) return;
        setAnalysis(result);
        setError(null);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setAnalysis(null);
        setError(err instanceof Error ? err.message : 'Could not analyse your statements.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        analysisRef.current = null;
        setAnalysing(false);
      });
    return () => controller.abort();
  }, [ready, preferences.documents, hasStatementSource, useBankRecords, windowMonths, documents]);

  async function refreshDocuments() {
    try {
      setDocuments(await documentExtractionService.list('BANK_STATEMENT'));
    } catch {
      // The upload response already carries the draft, so a failed refresh is cosmetic.
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (
      file.size > 10 * 1024 * 1024 ||
      !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ) {
      setError('Choose a PDF, JPG, PNG or WebP file up to 10 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    setElapsedSeconds(0);
    const controller = new AbortController();
    uploadRef.current = controller;
    try {
      const result = await documentExtractionService.extract('BANK_STATEMENT', file, controller.signal);
      if (result.status !== 'DRAFT') {
        setError(result.errorMessage || result.warnings[0] || 'Could not read this document.');
      }
      await refreshDocuments();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      uploadRef.current = null;
      setUploading(false);
    }
  }

  async function handleRemove(documentKey: string) {
    try {
      await documentExtractionService.remove('BANK_STATEMENT', documentKey);
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that statement.');
    }
  }

  function handleApply() {
    if (!analysis) return;
    const showsPersonalMonthly = !isBusiness || showPersonalFinancials;
    const allowed = new Set<string>();
    if (isBusiness) {
      allowed.add('businessAnnualRevenue');
      // A sole trader's receipts are their income, so the monthly pair goes to the personal fields
      // they can see. For a company they are trading figures and must not land in stated income,
      // which the bank divides its debt-to-income ratio by.
      if (!showsPersonalMonthly) {
        allowed.add('businessMonthlyIncome');
        allowed.add('businessMonthlyExpenses');
      }
    }
    if (showsPersonalMonthly) {
      allowed.add('statedAnnualIncome');
      allowed.add('statedMonthlyIncome');
      allowed.add('statedMonthlyExpenses');
    }
    const patch = Object.fromEntries(
      Object.entries(analysis.suggestedFields).filter(([key]) => allowed.has(key))
    );
    if (Object.keys(patch).length === 0) return;
    onApplyExtracted(patch);
    setApplied(true);
  }

  if (!ready || !preferences.documents) return null;

  const totals = analysis?.byCurrency ?? [];
  const readableCount = documents.length + (useBankRecords ? 1 : 0);

  return (
    <div
      className="mb-6 rounded-xl border bg-[var(--brand-soft)] p-5"
      style={{ borderColor: 'var(--surface-border-strong)' }}
    >
      <p className="field-label mb-1">
        Your income and expenditure <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
      </p>
      <p className="field-hint mb-4">
        Show us as much of your banking as you like — from us and from other banks — and we&apos;ll
        work out your monthly income, outgoings and turnover from the transaction lines. Nothing is
        entered on the form until you apply it.
      </p>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          checked={useBankRecords}
          onChange={e => setUseBankRecords(e.target.checked)}
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            Use the accounts I hold with the bank
          </span>
          <span className="mt-0.5 block field-hint">
            We read your transaction history for this application only. It does not change any
            account, limit or standing instruction.
          </span>
        </span>
      </label>

      <div className="mt-4">
        <p className="field-label mb-2">Statements from other banks</p>
        {documents.length > 0 && (
          <ul className="mb-3 space-y-2">
            {documents.map((doc, i) => {
              const institution = String(doc.extractedFields.institutionName ?? '').trim();
              const start = String(doc.extractedFields.statementPeriodStart ?? '');
              const end = String(doc.extractedFields.statementPeriodEnd ?? '');
              const lineCount = Array.isArray(doc.extractedFields.transactions)
                ? doc.extractedFields.transactions.length
                : 0;
              return (
                <li
                  key={doc.documentKey ?? `unnamed-${i}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2"
                  style={{ backgroundColor: 'var(--surface-input)' }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {institution || 'Statement with no readable bank name'}
                    </span>
                    <span className="block text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {start && end ? `${start} to ${end}` : 'Period not read'} ·{' '}
                      {lineCount === 0
                        ? 'no lines read'
                        : `${lineCount} transaction line${lineCount === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => doc.documentKey && handleRemove(doc.documentKey)}
                    disabled={!doc.documentKey}
                    className="btn btn-ghost btn-sm"
                  >
                    Remove
                    <span className="sr-only">: {institution || 'this statement'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <label className="btn btn-ghost btn-sm inline-block cursor-pointer">
          {uploading ? 'Reading…' : 'Add a statement'}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={handleFileSelected}
          />
        </label>
        {uploading && (
          <div className="mt-3 flex items-center justify-between gap-3" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Reading this statement
              <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {elapsedSeconds}s
              </span>
            </p>
            <button type="button" onClick={() => uploadRef.current?.abort()} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        )}
      </div>

      {hasStatementSource && (
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="field-label" htmlFor="analysisWindow">
              Period to review
            </label>
            <select
              id="analysisWindow"
              value={windowMonths}
              onChange={e => setWindowMonths(Number(e.target.value))}
              className="input"
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      {analysing && (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }} role="status">
          Adding up the transaction lines…
        </p>
      )}

      {analysis && !analysing && (
        <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: 'var(--surface-input)' }}>
          <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
            {readableCount > 1
              ? `Combined picture from ${readableCount} sources`
              : 'From your transaction lines'}
          </p>
          {totals.map(group => (
            <div key={group.currency} className="mt-3">
              {totals.length > 1 && (
                <p className="field-label mb-2">{group.currency}</p>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <AnalysisFigure label="Monthly in" value={group.suggestedFields[isBusiness && !showPersonalFinancials ? 'businessMonthlyIncome' : 'statedMonthlyIncome']} currency={group.currency} />
                <AnalysisFigure label="Monthly out" value={group.suggestedFields[isBusiness && !showPersonalFinancials ? 'businessMonthlyExpenses' : 'statedMonthlyExpenses']} currency={group.currency} />
                <AnalysisFigure label="Net over the period" value={String(group.net)} currency={group.currency} />
                {isBusiness && (
                  <AnalysisFigure
                    label="Turnover, annualised"
                    value={group.suggestedFields.businessAnnualRevenue}
                    currency={group.currency}
                  />
                )}
              </dl>
              <p className="field-hint mt-2">
                Across {group.monthsCovered} month{group.monthsCovered === 1 ? '' : 's'} with activity.
              </p>
            </div>
          ))}

          {analysis.sources.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {analysis.sources.map((source, i) => (
                <li key={`${source.label}-${source.currency}-${i}`} className="flex flex-wrap justify-between gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>{source.label}</span>
                  <span className="tabular-nums">
                    {formatAmount(source.credits, source.currency)} in ·{' '}
                    {formatAmount(source.debits, source.currency)} out · {source.lineCount} lines{' '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      ({source.firstDate}–{source.lastDate})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {analysis.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {analysis.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          )}

          <p className="field-hint mt-3">{analysis.basis}</p>

          <button
            type="button"
            onClick={handleApply}
            disabled={applied || Object.keys(analysis.suggestedFields).length === 0}
            className="btn btn-primary btn-sm mt-4"
          >
            {applied ? (
              <>
                Applied <span aria-hidden="true">✓</span>
                <span className="sr-only">— figures copied into the form</span>
              </>
            ) : (
              'Apply to the form'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function AnalysisFigure({
  label,
  value,
  currency,
}: {
  label: string;
  value?: string;
  currency: string;
}) {
  const amount = value == null ? NaN : Number(value);
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {Number.isFinite(amount) ? formatAmount(amount, currency) : '—'}
      </dd>
    </div>
  );
}

/**
 * A statement may be in any currency, including one we could not read on the page, so an
 * unrecognised code is shown as a suffix rather than passed to Intl, which rejects it.
 */
function formatAmount(amount: number, currency: string): string {
  return /^[A-Z]{3}$/.test(currency) && currency !== 'UNKNOWN'
    ? formatCurrency(amount, currency)
    : `${new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
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
    onApplyExtracted(extractedFieldPatch(draft.extractedFields));
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
  showPersonalFinancials,
  seededFromProfile,
  onApplyExtracted,
}: {
  form: Record<string, string>;
  isBusiness: boolean;
  showPersonalFinancials: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  seededFromProfile: Record<string, string>;
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

      {seededFromProfile.statedAnnualIncome && <ProfileSeededNote />}

      <StatementSources
        isBusiness={isBusiness}
        showPersonalFinancials={showPersonalFinancials}
        onApplyExtracted={onApplyExtracted}
      />

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
              <label className="field-label" htmlFor="businessMonthlyIncome">
                Monthly money in
              </label>
              <input
                id="businessMonthlyIncome"
                type="number"
                name="businessMonthlyIncome"
                value={form.businessMonthlyIncome}
                onChange={onChange}
                placeholder="e.g. 210000"
                className="input"
              />
              <p className="field-hint">Average paid into the business accounts each month</p>
            </div>
            <div>
              <label className="field-label" htmlFor="businessMonthlyExpenses">
                Monthly money out
              </label>
              <input
                id="businessMonthlyExpenses"
                type="number"
                name="businessMonthlyExpenses"
                value={form.businessMonthlyExpenses}
                onChange={onChange}
                placeholder="e.g. 145000"
                className="input"
              />
              <p className="field-hint">Average paid out of them each month</p>
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

      {/* Personal financial fields. A company's affordability is its trading figures, asked
          for above; these three describe a person. */}
      {showPersonalFinancials && (
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
      )}
    </div>
  );
}

function StepEmployment({
  form,
  onChange,
  seededFromProfile,
  onApplyExtracted,
}: {
  form: Record<string, string>;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  seededFromProfile: Record<string, string>;
  onApplyExtracted: (patch: Record<string, string>) => void;
}) {
  const anySeeded = !!(
    seededFromProfile.employmentStatus ||
    seededFromProfile.employerName ||
    seededFromProfile.jobTitle
  );
  return (
    <div>
      <h2 className="section-title">Employment details</h2>
      <p className="field-hint">
        Every field on this step is optional. Add your employment details if you want us to take
        them into account.
      </p>

      {anySeeded && <ProfileSeededNote />}

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
  error,
  signatoryIds,
  showShortfall,
  onToggleSignatory,
  onRefresh,
}: {
  members: PartyMember[];
  validation: PartyValidation | null;
  loading: boolean;
  error: string | null;
  signatoryIds: string[];
  showShortfall: boolean;
  onToggleSignatory: (customerId: string) => void;
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
                {partySummaryCounts(summary).map(text => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Who signs. Only an officer the company register already records as an authorised
          signatory can be chosen; the others stay listed so the customer can see why somebody
          is not on the list rather than finding them missing. */}
      {active.length > 0 ? (
        <fieldset className="mt-5 border-0 p-0">
          <legend className="field-label">Who will sign this application</legend>
          <p
            className="mb-3 mt-1 text-sm"
            style={{
              color:
                showShortfall && signatoryIds.length < MIN_SIGNATORIES
                  ? 'var(--down, #b42318)'
                  : 'var(--text-muted)',
            }}
            role={showShortfall && signatoryIds.length < MIN_SIGNATORIES ? 'alert' : undefined}
          >
            Choose at least {MIN_SIGNATORIES}.{' '}
            {signatoryIds.length >= MIN_SIGNATORIES
              ? `${signatoryIds.length} selected.`
              : `${signatoryIds.length} selected — pick ${MIN_SIGNATORIES - signatoryIds.length} more.`}
          </p>
          <ul className="space-y-3">
            {active.map(m => {
              const canSign = !!m.isAuthorizedSignatory;
              const chosen = signatoryIds.includes(m.customerId);
              const details = (
                <>
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="badge badge-neutral">{PARTY_ROLE_LABELS[m.role] || m.role}</span>
                    {m.ownershipPercentage != null && (
                      <span className="badge badge-neutral tabular-nums">
                        {m.ownershipPercentage}% owned
                      </span>
                    )}
                    {m.isAuthorizedSignatory && <span className="badge badge-info">Signatory</span>}
                    {m.isBeneficialOwner && <span className="badge badge-info">Beneficial owner</span>}
                  </div>
                </>
              );

              /* Three fixed columns — marker, person, badges — shared by both kinds of row, so
                 the name starts in the same place whether or not the officer can be selected.
                 Letting the marker take flexible space instead slid every avatar to a different
                 x, and left the unselectable rows out of line with the rest. */
              const columns = '1rem minmax(0, 1fr) auto';

              if (!canSign) {
                return (
                  <li
                    key={m.id}
                    className="grid items-center gap-3 rounded-xl border px-5 py-4 opacity-60"
                    style={{
                      gridTemplateColumns: columns,
                      backgroundColor: 'var(--surface-input)',
                      borderColor: 'var(--surface-border)',
                    }}
                  >
                    <span aria-hidden="true" />
                    {details}
                  </li>
                );
              }

              return (
                <li key={m.id}>
                  <label
                    className="grid cursor-pointer items-center gap-3 rounded-xl border-2 px-5 py-4 transition-colors"
                    style={{
                      gridTemplateColumns: columns,
                      borderColor: chosen ? 'var(--brand)' : 'var(--surface-border)',
                      backgroundColor: chosen ? 'var(--brand-soft)' : 'var(--surface-input)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={chosen}
                      onChange={() => onToggleSignatory(m.customerId)}
                      className="h-4 w-4 shrink-0 rounded"
                      style={{ accentColor: 'var(--brand)' }}
                      aria-label={`${m.customerName || 'This officer'} signs this application`}
                    />
                    {details}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : error ? (
        <div className="alert alert-warning mt-4" role="alert">
          <div className="flex-1">
            <p className="text-sm font-semibold">{error}</p>
            <p className="mt-1 text-sm">
              Nothing you have entered is lost. Try again, or continue and this can be picked up
              with your relationship manager.
            </p>
            <button onClick={onRefresh} className="btn btn-ghost btn-sm mt-3" type="button">
              <span aria-hidden="true">↻</span> Try again
            </button>
          </div>
        </div>
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
          <h3 className="empty-state-title">No people recorded for your company yet</h3>
          {/* The step never gated submission — canGoNext passes it and a failed party link is
              caught as non-blocking — so the copy no longer claims it must be done first. */}
          <p className="empty-state-text">
            You can continue now and add directors, shareholders and signatories later, or manage
            them here first.
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
  showPersonalFinancials,
  quote,
  signatories,
  declarations,
  onEdit,
  onDeclarationChange,
}: {
  form: Record<string, string>;
  product: LoanProduct;
  isBusiness: boolean;
  showPersonalFinancials: boolean;
  quote: Quote | null;
  signatories: string[];
  declarations: {
    informationAccurate: boolean;
    consentCreditCheck: boolean;
    termsAccepted: boolean;
  };
  onEdit: (step: WizardStep) => void;
  onDeclarationChange: (key: string, val: boolean) => void;
}) {
  const isHomePurpose = HOME_PURPOSES.includes(form.loanPurpose);
  const isVehiclePurpose = VEHICLE_PURPOSES.includes(form.loanPurpose);
  const acceptedDeclarations = Object.values(declarations).filter(Boolean).length;

  /* An optional answer left blank is not a fact about the customer, and a page of em-dashes
     reads as a form with holes in it rather than one they chose to skip. Empty rows are
     dropped; a section that ends up with nothing offers to be filled. */
  const row = (label: string, value: string | null | undefined) =>
    value && value.trim() ? { label, value } : null;
  const money = (raw?: string) => (raw ? formatCurrency(parseFloat(raw)) : null);

  const sections: {
    title: string;
    step: WizardStep;
    items: { label: string; value: string }[];
  }[] = [
    {
      title: 'Loan',
      step: 'loan',
      items: [
        { label: 'Product', value: product.productName },
        {
          label: 'Amount',
          value: money(form.requestedAmount) ?? '—',
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
          value:
            LOAN_PURPOSE_LABELS[form.loanPurpose as LoanPurpose] || form.loanPurpose || '—',
        },
        row('Description', form.loanPurposeDescription),
      ].filter(Boolean) as { label: string; value: string }[],
    },
    // Property section (conditional)
    ...(isHomePurpose
      ? [
          {
            title: 'Property details',
            step: 'loan' as WizardStep,
            items: [
              row('Address', form.propertyAddress),
              row('City', form.propertyCity),
              row('County / state', form.propertyState),
              row('Postal code', form.propertyPostalCode),
              row(
                'Type',
                PROPERTY_TYPES.find(t => t.value === form.propertyType)?.label
              ),
              row('Estimated value', money(form.propertyValue)),
              row('Deposit', money(form.downPaymentAmount)),
            ].filter(Boolean) as { label: string; value: string }[],
          },
        ]
      : []),
    // Vehicle section (conditional)
    ...(isVehiclePurpose
      ? [
          {
            title: 'Vehicle details',
            step: 'loan' as WizardStep,
            items: [
              row('Make', form.vehicleMake),
              row('Model', form.vehicleModel),
              row('Year', form.vehicleYear),
              row(
                'Condition',
                VEHICLE_CONDITIONS.find(c => c.value === form.vehicleCondition)?.label
              ),
              row('Estimated value', money(form.vehicleValue)),
            ].filter(Boolean) as { label: string; value: string }[],
          },
        ]
      : []),
    // Business financials section (conditional)
    ...(isBusiness
      ? [
          {
            title: 'Business financials',
            step: 'financial' as WizardStep,
            items: [
              row('Annual revenue', money(form.businessAnnualRevenue)),
              row('Monthly money in', money(form.businessMonthlyIncome)),
              row('Monthly money out', money(form.businessMonthlyExpenses)),
              row('Business vintage', form.businessVintageYears ? `${form.businessVintageYears} years` : null),
              row('Loan use', form.facilityPurposeDescription),
            ].filter(Boolean) as { label: string; value: string }[],
          },
        ]
      : []),
    // The people named to sign, so the customer sees who is bound before accepting
    ...(isBusiness && signatories.length > 0
      ? [
          {
            title: 'Signing for the company',
            step: 'parties' as WizardStep,
            items: signatories.map((name, i) => ({ label: `Signatory ${i + 1}`, value: name })),
          },
        ]
      : []),
    // Personal figures are only ever asked of a person — see StepFinancial
    ...(showPersonalFinancials
      ? [
          {
            title: 'Financial information',
            step: 'financial' as WizardStep,
            items: [
              row('Annual income', money(form.statedAnnualIncome)),
              row('Monthly income', money(form.statedMonthlyIncome)),
              row('Monthly expenses', money(form.statedMonthlyExpenses)),
            ].filter(Boolean) as { label: string; value: string }[],
          },
        ]
      : []),
    {
      title: 'Employment',
      step: 'employment',
      items: [
        row('Status', EMPLOYMENT_STATUSES.find(s => s.value === form.employmentStatus)?.label),
        row('Employer', form.employerName),
        row('Job title', form.jobTitle),
        row('Years with employer', form.yearsWithEmployer ? `${form.yearsWithEmployer} years` : null),
      ].filter(Boolean) as { label: string; value: string }[],
    },
  ];

  return (
    <div>
      <h2 className="section-title">Review your application</h2>
      <p className="field-hint">Check everything below, then accept the declarations to submit.</p>

      {/* The number the whole application resolves to, restated here so the customer signs
          the declarations against it rather than against a figure two steps back. */}
      {quote && (
        <div className="mt-5 rounded-2xl p-4 sm:p-5" style={{ background: 'var(--surface-input)' }}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            What you would be repaying
          </h3>
          <QuoteFigures quote={quote} />
        </div>
      )}

      <div className="mt-6 space-y-6">
        {sections.map(section => (
          <section key={section.title} aria-label={section.title}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: 'var(--surface-border)' }}>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {section.title}
              </h3>
              <button
                type="button"
                onClick={() => onEdit(section.step)}
                className="link-arrow text-sm"
              >
                {section.items.length ? 'Edit' : 'Add'}{' '}
                <span className="sr-only">{section.title}</span>
                <span data-arrow aria-hidden="true">→</span>
              </button>
            </div>
            {section.items.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Not added — it is optional, but it helps us assess your application.
              </p>
            ) : (
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
            )}
          </section>
        ))}
      </div>

      {/* ─── Declarations & Consent ─────────────────────── */}
      <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--surface-border)' }}>
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Declarations and consent
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }} id="declarations-hint">
          {acceptedDeclarations === 3
            ? 'All three accepted — you can submit.'
            : `${acceptedDeclarations} of 3 accepted. Accept all three to submit.`}
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
