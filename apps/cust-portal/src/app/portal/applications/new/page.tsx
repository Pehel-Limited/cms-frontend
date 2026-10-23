'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAIPreferences } from '@/lib/ai-preferences';
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
import { formatCurrency, getCurrencySymbol } from '@/lib/format';
import { useBankQuote } from '@/components/applications/QuoteFigures';
import type { Quote } from '@/services/api/quote-service';
import {
  ApplicationRail,
  ApplicationMobileProgress,
} from '@/components/applications/ApplicationRail';
import Glyph from '@/components/ui/Glyph';
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

/* The headline for each step, kept apart from its validation. The rail carries
   position; this carries the one sentence that tells the customer what the step
   is for before they meet the fields. */
const STEP_META: Record<WizardStep, { title: string; subtitle: string; glyph: string }> = {
  product: {
    title: 'Find your fit',
    subtitle:
      'Choose the product you want to apply for. Every option shown here is open to you.',
    glyph: 'doc',
  },
  loan: {
    title: 'Shape the loan',
    subtitle:
      'Set the amount, term and purpose. Your indicative repayment updates from the bank as you type.',
    glyph: 'bank',
  },
  parties: {
    title: 'Who signs for the company',
    subtitle:
      'Confirm the people linked to your business and choose at least two authorised signatories.',
    glyph: 'joint',
  },
  financial: {
    title: 'Show us the numbers',
    subtitle:
      'Optional, but it helps us assess faster. Add whatever you are comfortable sharing.',
    glyph: 'chart',
  },
  employment: {
    title: 'Tell us about your work',
    subtitle:
      'Optional. Add employment details if you want us to take them into account.',
    glyph: 'user',
  },
  review: {
    title: 'One last look',
    subtitle:
      'Check your answers against the bank’s figures, then accept the declarations to submit.',
    glyph: 'shield',
  },
};

const quoteMoney = (amount: number) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);

const COMMON_TERM_MONTHS = [12, 24, 36, 48, 60, 72, 84, 120, 180, 240, 300, 360];

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

  /* A failed save or submit can happen while the customer is at the bottom of a
     long step. Bring the explanation into view rather than leaving the button
     looking like it did nothing. */
  useEffect(() => {
    if (error) {
      document
        .getElementById('application-error')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

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

  const meta = STEP_META[step];
  const stepNumber = stepIndex + 1;
  const allDeclarationsAccepted =
    declarations.informationAccurate &&
    declarations.consentCreditCheck &&
    declarations.termsAccepted;

  return (
    <div className="mx-auto max-w-6xl">
      {/* The rail carries the studio on desktop; the phone gets a compact
          equivalent above the step. */}
      <div className="mb-4 flex items-center gap-3 lg:hidden">
        <button
          onClick={() => router.push('/portal/applications')}
          className="icon-btn"
          aria-label="Back to applications"
          type="button"
        >
          <Glyph name="chevron" className="h-4 w-4 rotate-90" strokeWidth={2} />
        </button>
        <p
          className="serif min-w-0 truncate text-[21px] font-medium leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          New application
        </p>
        {savedApp && <span className="chip ml-auto shrink-0 !py-1 !text-xs">Draft saved</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)]">
        <ApplicationRail
          steps={STEPS}
          activeIndex={stepIndex}
          onStepClick={i => goToStep(STEPS[i].key)}
          savedReference={savedApp?.applicationNumber || (savedApp ? 'Draft' : null)}
          productName={selectedProduct?.productName}
          quote={quote}
          quoting={quoting}
          quoteError={quoteError}
          onRetryQuote={retryQuote}
        />

        <div className="min-w-0">
          <ApplicationMobileProgress
            steps={STEPS}
            activeIndex={stepIndex}
            quote={quote}
            quoting={quoting}
          />

          {/* Error — the customer's answers are never cleared on a failed save */}
          {error && (
            <div id="application-error" className="alert alert-error mb-4" role="alert">
              <Glyph name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error} Your answers have been kept — you can try again.</span>
            </div>
          )}

          <section className="glass-panel-solid overflow-hidden" aria-labelledby="step-title">
            <header
              className="relative overflow-hidden border-b px-6 py-6 sm:px-8 sm:py-7"
              style={{ borderColor: 'var(--hairline)' }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, var(--brand-soft-strong), transparent 68%)',
                }}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: 'var(--brand-on-soft)' }}
                  >
                    Step {stepNumber} of {STEPS.length} · {STEPS[stepIndex]?.label}
                  </p>
                  <h1
                    id="step-title"
                    className="serif mt-2 text-[27px] font-medium leading-tight tracking-tight sm:text-[31px]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {meta.title}
                  </h1>
                  <p
                    className="mt-2 max-w-xl text-sm leading-6"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {meta.subtitle}
                  </p>
                </div>
                <span
                  className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:flex"
                  style={{
                    background: 'var(--brand-soft)',
                    color: 'var(--brand-on-soft)',
                    border: '1px solid var(--hairline)',
                  }}
                  aria-hidden="true"
                >
                  <Glyph name={meta.glyph} className="h-6 w-6" />
                </span>
              </div>
            </header>

            <div key={step} className="animate-slide-up px-6 py-6 sm:px-8 sm:py-7">
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
                  onValueChange={(name, value) => {
                    setForm(prev => ({ ...prev, [name]: value }));
                    setSeededFromProfile(prev =>
                      prev[name] ? { ...prev, [name]: '' } : prev
                    );
                  }}
                  errors={attemptedNext ? loanErrors : {}}
                  quote={quote}
                  quoting={quoting}
                  quoteError={quoteError}
                  onRetryQuote={retryQuote}
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
                  onDeclarationChange={(key, val) =>
                    setDeclarations(prev => ({ ...prev, [key]: val }))
                  }
                />
              )}

              {/* A resumed draft enters on 'loan' before its product has arrived.
                  Show the wait rather than an empty panel, and a way out if the
                  product could not be read at all. */}
              {step !== 'product' && !selectedProduct && (
                loadingProducts ? (
                  <div className="space-y-4" aria-busy="true">
                    <p className="sr-only" role="status">Loading your application’s product…</p>
                    <div className="skeleton h-40 rounded-[24px]" />
                    <div className="skeleton h-10 w-2/3" />
                    <div className="skeleton h-10 w-1/2" />
                  </div>
                ) : (
                  <div className="alert alert-error flex-col sm:flex-row sm:items-center" role="alert">
                    <p className="flex-1">
                      We could not load the product for this application. Your saved answers are
                      still here.
                    </p>
                    <button onClick={loadProducts} className="btn btn-sm btn-outline shrink-0" type="button">
                      Try again
                    </button>
                  </div>
                )
              )}
            </div>

            <footer
              className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 sm:px-8"
              style={{
                borderColor: 'var(--hairline)',
                backgroundColor: 'var(--glass-bg-strong)',
              }}
            >
              <div className="flex items-center gap-3">
                {stepIndex > 0 ? (
                  <button onClick={goBack} className="btn btn-ghost" type="button">
                    <span aria-hidden="true">&larr;</span> Back
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/portal/applications')}
                    className="btn btn-ghost"
                    type="button"
                  >
                    Cancel
                  </button>
                )}
                <span className="hidden text-xs sm:block" style={{ color: 'var(--text-muted)' }}>
                  Step {stepNumber} of {STEPS.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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

                {step === 'product' ? (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Select a product to continue
                  </span>
                ) : step === 'review' ? (
                  <button
                    onClick={submitApplication}
                    disabled={submitting || !allDeclarationsAccepted}
                    className="btn btn-primary"
                    type="button"
                    aria-describedby={allDeclarationsAccepted ? undefined : 'declarations-hint'}
                  >
                    {submitting ? 'Submitting…' : 'Submit application'}
                    {!submitting && <span aria-hidden="true">&rarr;</span>}
                  </button>
                ) : (
                  /* Stays clickable on the steps that explain themselves — the loan step names
                     the field, the parties step counts what is still needed — so a missing
                     answer reads as a reason rather than as a dead button. */
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
            </footer>
          </section>

          <p
            className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <Glyph name="shield" className="h-3.5 w-3.5" strokeWidth={1.8} />
            Your answers go only to the bank and stay attached to this application.
          </p>
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

/* Product families get a family glyph, not a per-product colour. The tile is
   always monochrome so the name and the figures stay the loudest things. */
function productGlyph(type?: string): string {
  const t = (type || '').toUpperCase();
  if (/MORTGAGE|HOME_LOAN|BRIDGE_LOAN|CONSTRUCTION_LOAN|GREEN_LOAN|COMMERCIAL_MORTGAGE|COMMERCIAL_REAL_ESTATE/.test(t)) {
    return 'rent';
  }
  if (/AUTO_LOAN|PCP|HIRE_PURCHASE|EQUIPMENT_FINANCING|ASSET_LEASING/.test(t)) return 'Transport';
  if (/CREDIT_CARD|BNPL|OVERDRAFT|REVOLVING/.test(t)) return 'current';
  if (/STUDENT|EDUCATION/.test(t)) return 'doc';
  if (/AGRI|FARM/.test(t)) return 'savings';
  return 'bank';
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
  const [query, setQuery] = useState('');

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <p className="sr-only" role="status">Loading products…</p>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-40 rounded-[24px]" />
        ))}
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q
    ? products.filter(p =>
        [p.productName, p.shortDescription, p.productType]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(q))
      )
    : products;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">Available to you</h2>
          <p className="field-hint">
            {products.length} lending {products.length === 1 ? 'option is' : 'options are'} open
            to you online.
          </p>
        </div>
        {products.length > 3 && (
          <div className="relative w-full sm:w-64">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              <Glyph name="search" className="h-4 w-4" strokeWidth={2} />
            </span>
            <input
              id="product-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="input !rounded-full py-2 pl-9 pr-4"
            />
          </div>
        )}
      </div>

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
            <Glyph name="bank" className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <h3 className="empty-state-title">No products available</h3>
          <p className="empty-state-text">
            There are no loan products open for online application right now. Contact your
            relationship manager to discuss your options.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state mt-4">
          <div className="empty-state-icon">
            <Glyph name="search" className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <h3 className="empty-state-title">Nothing matches “{query.trim()}”</h3>
          <p className="empty-state-text">
            Try a different name, or clear the search to see every product open to you.
          </p>
          <button onClick={() => setQuery('')} className="btn btn-secondary btn-sm mt-5" type="button">
            Clear search
          </button>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {shown.map(p => {
            const isSelected = selected?.productId === p.productId;
            const rate =
              p.minInterestRate === p.maxInterestRate
                ? `${p.minInterestRate}% p.a.`
                : `${p.minInterestRate}% – ${p.maxInterestRate}% p.a.`;

            return (
              <li key={p.productId}>
                <button
                  onClick={() => onSelect(p)}
                  aria-pressed={isSelected}
                  className="group w-full rounded-[24px] border p-5 text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: isSelected ? 'var(--brand)' : 'var(--hairline-strong)',
                    background: isSelected ? 'var(--brand-soft)' : 'var(--surface-card)',
                    boxShadow: isSelected
                      ? '0 12px 28px -20px rgba(69,32,75,.55)'
                      : 'var(--shadow-xs)',
                  }}
                  type="button"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        background: 'var(--brand-soft)',
                        color: 'var(--brand-on-soft)',
                        border: '1px solid var(--hairline)',
                      }}
                      aria-hidden="true"
                    >
                      <Glyph name={productGlyph(p.productType)} className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <h3
                          className="serif text-[19px] font-medium leading-snug"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {p.productName}
                        </h3>
                        <span className="badge badge-neutral">Open online</span>
                      </div>

                      {/* The description alone: the product type label is nearly always the
                          product's own name again, which read as the name twice. */}
                      {p.shortDescription && (
                        <p
                          className="mt-1 text-sm leading-6"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {p.shortDescription}
                        </p>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div
                          className="rounded-2xl px-3.5 py-3"
                          style={{ backgroundColor: 'var(--surface-input)' }}
                        >
                          <p
                            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Amount
                          </p>
                          <p
                            className="mt-1 text-sm font-semibold tabular-nums"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {formatCurrency(p.minLoanAmount)} – {formatCurrency(p.maxLoanAmount)}
                          </p>
                        </div>
                        <div
                          className="rounded-2xl px-3.5 py-3"
                          style={{ backgroundColor: 'var(--surface-input)' }}
                        >
                          <p
                            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Rate
                          </p>
                          <p
                            className="mt-1 text-sm font-semibold tabular-nums"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {rate}
                          </p>
                        </div>
                      </div>

                      <p
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: 'var(--brand-on-soft)' }}
                      >
                        Choose this product
                        <span
                          aria-hidden="true"
                          className="transition-transform duration-200 group-hover:translate-x-0.5"
                        >
                          →
                        </span>
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
  onValueChange,
  errors,
  quote,
  quoting,
  quoteError,
  onRetryQuote,
}: {
  form: Record<string, string>;
  product: LoanProduct;
  errors: { requestedAmount?: string; requestedTermMonths?: string; loanPurpose?: string };
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  onValueChange: (name: string, value: string) => void;
  quote: Quote | null;
  quoting: boolean;
  quoteError: string | null;
  onRetryQuote: () => void;
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
  const currencySymbol = getCurrencySymbol();

  const range = product.maxLoanAmount - product.minLoanAmount;
  const amountStep = range >= 200000 ? 5000 : range >= 50000 ? 1000 : range >= 10000 ? 500 : 100;
  const parsedAmount = Number(form.requestedAmount);
  const sliderValue = Number.isFinite(parsedAmount)
    ? Math.min(Math.max(parsedAmount, product.minLoanAmount), product.maxLoanAmount)
    : product.minLoanAmount;
  const sliderPercent =
    product.maxLoanAmount > product.minLoanAmount
      ? ((sliderValue - product.minLoanAmount) / range) * 100
      : 0;

  const inRangeTerms = COMMON_TERM_MONTHS.filter(
    t => t >= product.minTermMonths && t <= product.maxTermMonths
  );
  const quickTerms = Array.from(
    new Set([
      ...(inRangeTerms.length ? inRangeTerms.slice(0, 8) : [product.minTermMonths, product.maxTermMonths]),
      ...(Number(form.requestedTermMonths) >= product.minTermMonths &&
      Number(form.requestedTermMonths) <= product.maxTermMonths &&
      !inRangeTerms.includes(Number(form.requestedTermMonths))
        ? [Number(form.requestedTermMonths)]
        : []),
    ])
  );

  return (
    <div className="space-y-6">
      {/* ─── The amount composer and the number it produces ───
          On desktop the persistent rail already carries the quote; repeating the
          same dark card beside the field made the step feel twice as heavy. */}
      <div className="space-y-4">
        <div
          className="rounded-[24px] border p-5"
          style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <label className="field-label !mb-1" htmlFor="requestedAmount">
                Loan amount{' '}
                <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <p className="field-hint !mt-0">
                Between {formatCurrency(product.minLoanAmount)} and{' '}
                {formatCurrency(product.maxLoanAmount)}
              </p>
            </div>
            <span className="chip !py-1 !text-xs">{product.productName}</span>
          </div>

          <div className="relative mt-4">
            <span
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {currencySymbol}
            </span>
            <input
              id="requestedAmount"
              type="number"
              name="requestedAmount"
              value={form.requestedAmount}
              onChange={onChange}
              min={product.minLoanAmount}
              max={product.maxLoanAmount}
              placeholder="0"
              className="input no-spinner !rounded-2xl !py-3.5 pl-11 pr-4 text-[28px] font-bold tabular-nums sm:text-[32px]"
              required
              aria-required="true"
              aria-invalid={errors.requestedAmount ? true : undefined}
              aria-describedby="requestedAmount-hint"
            />
          </div>

          <div className="mt-5">
            <input
              type="range"
              min={product.minLoanAmount}
              max={product.maxLoanAmount}
              step={amountStep}
              value={sliderValue}
              onChange={e => onValueChange('requestedAmount', e.target.value)}
              className="range-brand w-full"
              style={{
                background: `linear-gradient(to right, var(--brand) ${sliderPercent}%, var(--hairline-strong) ${sliderPercent}%)`,
              }}
              aria-label="Loan amount slider"
              aria-valuetext={formatCurrency(sliderValue)}
            />
            <div
              className="mt-2 flex justify-between text-[11px] tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>{formatCurrency(product.minLoanAmount)}</span>
              <span>{formatCurrency(product.maxLoanAmount)}</span>
            </div>
          </div>

          {errors.requestedAmount ? (
            <p
              id="requestedAmount-hint"
              className="mt-2 text-sm font-medium text-red-600 dark:text-red-300"
              role="alert"
            >
              {errors.requestedAmount}
            </p>
          ) : (
            <p id="requestedAmount-hint" className="field-hint">
              Drag the slider or type the exact figure you need.
            </p>
          )}
        </div>

        <aside
          className="overflow-hidden rounded-[24px] p-5 text-white lg:hidden"
          style={{ background: 'var(--tile-active)', boxShadow: 'var(--tile-active-shadow)' }}
          aria-live="polite"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Your indicative repayment
          </p>

          {quote ? (
            <>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[32px] font-bold leading-none tracking-tight tabular-nums">
                  {quoteMoney(quote.monthlyRepayment)}
                </span>
                <span className="text-xs font-medium text-white/60">/ month</span>
              </p>
              <p className="mt-2 text-xs text-white/70">
                {quoteMoney(quote.totalRepayable)} over {quote.termMonths} months
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/55">APRC</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {quote.aprcAvailable ? `${quote.aprcPct}%` : 'Not published'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/55">
                    Cost of credit
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {quoteMoney(quote.costOfCredit)}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[10px] leading-4 text-white/50">
                Illustrative, not an offer. {quote.calculatedRatePct}% rate from{' '}
                {quote.rateProvenance === 'PRODUCT_RATE_PLAN'
                  ? 'a published rate plan'
                  : 'the product’s standard rate'}
                . Holds until{' '}
                {new Date(quote.expiresAt).toLocaleDateString('en-IE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                .
              </p>
              {quoting && (
                <p className="mt-2 text-[10px] text-white/50">Updating with your latest figures…</p>
              )}
            </>
          ) : quoteError ? (
            <>
              <p className="mt-3 text-sm text-white/80">{quoteError}</p>
              <button
                type="button"
                onClick={onRetryQuote}
                className="mt-3 text-xs font-semibold text-white underline underline-offset-4"
              >
                Try again
              </button>
            </>
          ) : quoting ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
              Getting your quote…
            </div>
          ) : (
            <p className="mt-3 text-sm leading-5 text-white/70">
              Enter an amount and term to see what the bank would quote.
            </p>
          )}
        </aside>
      </div>

      {/* ─── Term, rate, purpose ─── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            className="input no-spinner tabular-nums"
            required
            aria-required="true"
            aria-invalid={errors.requestedTermMonths ? true : undefined}
            aria-describedby="requestedTermMonths-hint"
          />
          {quickTerms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickTerms.map(term => {
                const active = form.requestedTermMonths === String(term);
                return (
                  <button
                    key={term}
                    type="button"
                    onClick={() => onValueChange('requestedTermMonths', String(term))}
                    aria-pressed={active}
                    className="rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors"
                    style={{
                      borderColor: active ? 'var(--brand)' : 'var(--hairline-strong)',
                      backgroundColor: active ? 'var(--brand-soft)' : 'transparent',
                      color: active ? 'var(--brand-on-soft)' : 'var(--text-secondary)',
                    }}
                  >
                    {term} mo
                  </button>
                );
              })}
            </div>
          )}
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

        <div>
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
        <section
          className="rounded-[24px] border p-5 sm:p-6"
          style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--brand-soft)',
                color: 'var(--brand-on-soft)',
                border: '1px solid var(--hairline)',
              }}
              aria-hidden="true"
            >
              <Glyph name="rent" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="section-title">Property details</h3>
              <p className="field-hint !mt-0.5">
                Optional. It helps us understand the security behind a home loan.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                className="input no-spinner tabular-nums"
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
                className="input no-spinner tabular-nums"
              />
            </div>
          </div>
        </section>
      )}

      {/* ─── Vehicle Details (VEHICLE purposes) ───────────── */}
      {isVehiclePurpose && (
        <section
          className="rounded-[24px] border p-5 sm:p-6"
          style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--brand-soft)',
                color: 'var(--brand-on-soft)',
                border: '1px solid var(--hairline)',
              }}
              aria-hidden="true"
            >
              <Glyph name="Transport" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="section-title">Vehicle details</h3>
              <p className="field-hint !mt-0.5">
                Optional. It helps us understand what the finance is secured against.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                className="input no-spinner tabular-nums"
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
                className="input no-spinner tabular-nums"
              />
            </div>
          </div>
        </section>
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
    <section
      className="overflow-hidden rounded-[24px] border"
      style={{
        borderColor: 'var(--hairline-strong)',
        background:
          'linear-gradient(135deg, var(--brand-soft), transparent 52%), var(--surface-card)',
      }}
      aria-labelledby="statement-sources-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--surface-card)',
              color: 'var(--brand-on-soft)',
              border: '1px solid var(--hairline)',
            }}
            aria-hidden="true"
          >
            <Glyph name="bank" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="statement-sources-title" className="section-title">
              Bring your banking into the application
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              Show us as much of your banking as you like — from us and from other banks — and
              we&apos;ll work out your monthly income, outgoings and turnover from the transaction
              lines. Nothing is entered on the form until you apply it.
            </p>
          </div>
        </div>
        <span className="chip !py-1 !text-xs">Optional</span>
      </div>

      <div className="border-t p-5 sm:p-6" style={{ borderColor: 'var(--hairline)' }}>
        <label
          className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors"
          style={{
            borderColor: useBankRecords ? 'var(--brand)' : 'var(--hairline)',
            backgroundColor: useBankRecords ? 'var(--brand-soft)' : 'var(--surface-input)',
          }}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={useBankRecords}
            onChange={e => setUseBankRecords(e.target.checked)}
          />
          <span
            aria-hidden="true"
            className="relative mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
            style={{
              backgroundColor: useBankRecords ? 'var(--brand)' : 'var(--hairline-strong)',
            }}
          >
            <span
              className="absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{
                left: 2,
                transform: useBankRecords ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Use the accounts I hold with the bank
            </span>
            <span className="mt-0.5 block field-hint">
              We read your transaction history for this application only. It does not change any
              account, limit or standing instruction.
            </span>
          </span>
        </label>

        <div className="mt-5">
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                    style={{
                      borderColor: 'var(--hairline)',
                      backgroundColor: 'var(--surface-card)',
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: 'var(--surface-input)',
                          color: 'var(--text-secondary)',
                        }}
                        aria-hidden="true"
                      >
                        <Glyph name="doc" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span
                          className="block truncate text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {institution || 'Statement with no readable bank name'}
                        </span>
                        <span
                          className="block text-xs tabular-nums"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {start && end ? `${start} to ${end}` : 'Period not read'} ·{' '}
                          {lineCount === 0
                            ? 'no lines read'
                            : `${lineCount} transaction line${lineCount === 1 ? '' : 's'}`}
                        </span>
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

          <label
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            style={{ borderColor: 'var(--hairline-strong)' }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
              aria-hidden="true"
            >
              <Glyph name="plus" className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {uploading ? 'Reading this statement…' : 'Add a statement'}
              </span>
              <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                PDF, JPG, PNG or WebP · up to 10 MB
              </span>
            </span>
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
              className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ backgroundColor: 'var(--surface-input)' }}
              role="status"
              aria-live="polite"
            >
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
              <button
                type="button"
                onClick={() => uploadRef.current?.abort()}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {hasStatementSource && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="field-label !mb-0 !mr-1">Period to review</p>
            <div className="segmented" role="group" aria-label="Statement period">
              {[3, 6, 12].map(months => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setWindowMonths(months)}
                  aria-pressed={windowMonths === months}
                  data-active={windowMonths === months ? 'true' : undefined}
                  className="segmented-item"
                >
                  Last {months} months
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300" role="alert">
            {error}
          </p>
        )}

        {analysing && (
          <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }} role="status">
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Adding up the transaction lines…
          </p>
        )}

        {analysis && !analysing && (
          <div
            className="mt-4 rounded-[20px] border p-4 sm:p-5"
            style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--surface-input)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {readableCount > 1
                  ? `Combined picture from ${readableCount} sources`
                  : 'From your transaction lines'}
              </p>
              <span className="chip !py-1 !text-xs">
                {applied ? 'Applied to the form' : 'Draft figures'}
              </span>
            </div>

            {totals.map(group => (
              <div key={group.currency} className="mt-4">
                {totals.length > 1 && <p className="field-label mb-2">{group.currency}</p>}
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <AnalysisFigure
                    label="Monthly in"
                    value={
                      group.suggestedFields[
                        isBusiness && !showPersonalFinancials
                          ? 'businessMonthlyIncome'
                          : 'statedMonthlyIncome'
                      ]
                    }
                    currency={group.currency}
                  />
                  <AnalysisFigure
                    label="Monthly out"
                    value={
                      group.suggestedFields[
                        isBusiness && !showPersonalFinancials
                          ? 'businessMonthlyExpenses'
                          : 'statedMonthlyExpenses'
                      ]
                    }
                    currency={group.currency}
                  />
                  <AnalysisFigure
                    label="Net over period"
                    value={String(group.net)}
                    currency={group.currency}
                  />
                  {isBusiness && (
                    <AnalysisFigure
                      label="Turnover, annualised"
                      value={group.suggestedFields.businessAnnualRevenue}
                      currency={group.currency}
                    />
                  )}
                </dl>
                <p className="field-hint mt-2">
                  Across {group.monthsCovered} month{group.monthsCovered === 1 ? '' : 's'} with
                  activity.
                </p>
              </div>
            ))}

            {analysis.sources.length > 0 && (
              <ul
                className="mt-4 space-y-1.5 border-t pt-3 text-sm"
                style={{ borderColor: 'var(--hairline)', color: 'var(--text-secondary)' }}
              >
                {analysis.sources.map((source, i) => (
                  <li
                    key={`${source.label}-${source.currency}-${i}`}
                    className="flex flex-wrap justify-between gap-2"
                  >
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
                  <Glyph name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Applied
                  <span className="sr-only">— figures copied into the form</span>
                </>
              ) : (
                'Apply to the form'
              )}
            </button>
          </div>
        )}
      </div>
    </section>
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
    <div
      className="min-w-0 rounded-xl border px-3 py-2.5"
      style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--surface-card)' }}
    >
      <dt
        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 truncate text-base font-bold tabular-nums"
        style={{ color: 'var(--text-primary)' }}
      >
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
    <section
      className="mb-6 overflow-hidden rounded-[24px] border"
      style={{
        borderColor: 'var(--hairline-strong)',
        background:
          'linear-gradient(135deg, var(--brand-soft), transparent 55%), var(--surface-card)',
      }}
      aria-labelledby="payslip-upload-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--surface-card)',
              color: 'var(--brand-on-soft)',
              border: '1px solid var(--hairline)',
            }}
            aria-hidden="true"
          >
            <Glyph name="doc" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="payslip-upload-title" className="section-title">
              Have a {label}?
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              We&apos;ll read it and suggest values below for you to review — nothing is filled in
              automatically.
            </p>
          </div>
        </div>
        <span className="chip !py-1 !text-xs">Optional</span>
      </div>

      <div className="border-t p-5" style={{ borderColor: 'var(--hairline)' }}>
        <label
          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          style={{ borderColor: 'var(--hairline-strong)' }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
            aria-hidden="true"
          >
            <Glyph name="plus" className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {uploading ? 'Reading…' : `Choose ${label} file`}
            </span>
            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
              PDF, JPG, PNG or WebP · up to 10 MB
            </span>
          </span>
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
            className="mt-3 rounded-2xl p-4"
            style={{ backgroundColor: 'var(--surface-input)' }}
            role="status"
            aria-live="polite"
          >
            <p
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Reading your {label}
            </p>
            <p className="field-hint mt-2">
              We&apos;re pulling the figures out for you to check — this usually takes under a
              minute.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {elapsedSeconds}s elapsed
              </span>
              <button type="button" onClick={handleCancel} className="btn btn-ghost btn-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300" role="alert">
            {uploadError}
          </p>
        )}

        {draft && (
          <div
            className="mt-3 rounded-2xl border p-4"
            style={{ backgroundColor: 'var(--surface-input)', borderColor: 'var(--hairline)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Extracted values
              </p>
              <span className="chip !py-1 !text-xs">
                {applied ? 'Applied to the form' : 'Draft — review first'}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                  <li key={i}>{w}</li>
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
                  <Glyph name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Applied
                  <span className="sr-only">— suggested values copied into the form</span>
                </>
              ) : (
                'Apply suggested values'
              )}
            </button>
          </div>
        )}
      </div>
    </section>
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
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Glyph name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
        All fields on this step are optional. Anything you share helps us assess the application.
      </p>

      {seededFromProfile.statedAnnualIncome && <ProfileSeededNote />}

      <StatementSources
        isBusiness={isBusiness}
        showPersonalFinancials={showPersonalFinancials}
        onApplyExtracted={onApplyExtracted}
      />

      {/* Business-specific fields */}
      {isBusiness && (
        <section
          className="rounded-[24px] border p-5 sm:p-6"
          style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--brand-soft)',
                color: 'var(--brand-on-soft)',
                border: '1px solid var(--hairline)',
              }}
              aria-hidden="true"
            >
              <Glyph name="chart" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="section-title">Business financials</h3>
              <p className="field-hint !mt-0.5">
                Trading figures for the business, not a director&apos;s salary.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                className="input no-spinner tabular-nums"
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
                className="input no-spinner tabular-nums"
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
                className="input no-spinner tabular-nums"
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
                className="input no-spinner tabular-nums"
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
        </section>
      )}

      {/* Personal financial fields. A company's affordability is its trading figures, asked
          for above; these three describe a person. */}
      {showPersonalFinancials && (
        <section
          className="rounded-[24px] border p-5 sm:p-6"
          style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--brand-soft)',
                color: 'var(--brand-on-soft)',
                border: '1px solid var(--hairline)',
              }}
              aria-hidden="true"
            >
              <Glyph name="user" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="section-title">
                {isBusiness ? 'Personal financials' : 'Your financial picture'}
              </h3>
              <p className="field-hint !mt-0.5">
                {isBusiness
                  ? 'Your own household figures, alongside the business.'
                  : 'The figures that describe your household.'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                className="input no-spinner tabular-nums"
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
                className="input no-spinner tabular-nums"
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
                className="input no-spinner tabular-nums"
              />
            </div>
          </div>
        </section>
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
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Glyph name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
        Optional. Add what you are comfortable sharing — it helps us understand your income.
      </p>

      {anySeeded && <ProfileSeededNote />}

      <DocumentExtractionUpload documentType="PAYSLIP" onApplyExtracted={onApplyExtracted} />

      <section
        className="rounded-[24px] border p-5 sm:p-6"
        style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--brand-soft)',
              color: 'var(--brand-on-soft)',
              border: '1px solid var(--hairline)',
            }}
            aria-hidden="true"
          >
            <Glyph name="user" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="section-title">Employment details</h3>
            <p className="field-hint !mt-0.5">
              Your work, as it stands today. You can change any of it later.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              className="input no-spinner tabular-nums"
            />
          </div>
        </div>
      </section>
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
        <p className="sr-only" role="status">Loading the people linked to your company…</p>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  const active = members.filter(m => m.isActive);
  const summary = validation?.summary;
  const shortfall = showShortfall && signatoryIds.length < MIN_SIGNATORIES;
  const chosenPercent = Math.min((signatoryIds.length / MIN_SIGNATORIES) * 100, 100);

  return (
    <div>
      {/* Validation Banner — also carries the "you can still proceed" note so the
          same information is not restated twice on the step. */}
      {validation && (
        <div
          className={`alert items-start ${validation.isComplete ? 'alert-success' : 'alert-warning'}`}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ border: '1px solid currentColor' }}
            aria-hidden="true"
          >
            <Glyph
              name={validation.isComplete ? 'check' : 'alert'}
              className="h-4 w-4"
              strokeWidth={2.4}
            />
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
              <ul className="mt-3 flex flex-wrap gap-1.5 text-sm tabular-nums">
                {partySummaryCounts(summary).map(text => (
                  <li
                    key={text}
                    className="rounded-full border border-current bg-white/30 px-2.5 py-1 dark:bg-white/10"
                  >
                    {text}
                  </li>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="field-label !mb-0">Who will sign this application</legend>
            <span
              className="chip !py-1 !text-xs"
              style={
                signatoryIds.length >= MIN_SIGNATORIES
                  ? { color: 'var(--up)' }
                  : undefined
              }
            >
              {signatoryIds.length} of {MIN_SIGNATORIES} chosen
            </span>
          </div>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={MIN_SIGNATORIES}
            aria-valuenow={Math.min(signatoryIds.length, MIN_SIGNATORIES)}
            aria-label="Authorised signatories chosen"
            style={{ backgroundColor: 'var(--hairline-strong)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${chosenPercent}%`,
                backgroundColor:
                  signatoryIds.length >= MIN_SIGNATORIES ? 'var(--up)' : 'var(--brand)',
              }}
            />
          </div>
          <p
            className="mb-3 mt-2 text-sm"
            style={{
              color: shortfall ? 'var(--down, #b42318)' : 'var(--text-muted)',
            }}
            role={shortfall ? 'alert' : undefined}
          >
            {signatoryIds.length >= MIN_SIGNATORIES
              ? `At least ${MIN_SIGNATORIES} chosen — ${signatoryIds.length} selected.`
              : `Choose at least ${MIN_SIGNATORIES}. ${signatoryIds.length} selected — pick ${
                  MIN_SIGNATORIES - signatoryIds.length
                } more.`}
          </p>

          <ul className="mt-2 space-y-2.5">
            {active.map(m => {
              const canSign = !!m.isAuthorizedSignatory;
              const chosen = signatoryIds.includes(m.customerId);

              const details = (
                <>
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: chosen ? 'var(--brand)' : 'var(--brand-soft)',
                      color: chosen ? '#fff' : 'var(--brand-on-soft)',
                    }}
                    aria-hidden="true"
                  >
                    {(m.customerName || '?')[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <p
                        className="min-w-0 truncate text-[15px] font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {m.customerName || 'Name not provided'}
                      </p>
                      {m.isAuthorizedSignatory ? (
                        <span className="badge badge-info">Signatory</span>
                      ) : (
                        <span className="badge badge-neutral">Not a recorded signatory</span>
                      )}
                    </div>
                    {m.customerEmail && (
                      <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {m.customerEmail}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="badge badge-neutral">
                        {PARTY_ROLE_LABELS[m.role] || m.role}
                      </span>
                      {m.ownershipPercentage != null && (
                        <span className="badge badge-neutral tabular-nums">
                          {m.ownershipPercentage}% owned
                        </span>
                      )}
                      {m.isBeneficialOwner && (
                        <span className="badge badge-info">Beneficial owner</span>
                      )}
                    </div>
                  </div>
                </>
              );

              if (!canSign) {
                return (
                  <li
                    key={m.id}
                    className="flex items-start gap-3 rounded-2xl border px-4 py-4 opacity-65"
                    style={{
                      backgroundColor: 'var(--surface-input)',
                      borderColor: 'var(--hairline)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Glyph name="shield" className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    {details}
                  </li>
                );
              }

              return (
                <li key={m.id}>
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-4 transition-all"
                    style={{
                      borderColor: chosen ? 'var(--brand)' : 'var(--hairline-strong)',
                      backgroundColor: chosen ? 'var(--brand-soft)' : 'var(--surface-input)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={chosen}
                      onChange={() => onToggleSignatory(m.customerId)}
                      className="mt-1 h-4 w-4 shrink-0 rounded"
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
              <Glyph name="swap" className="h-3.5 w-3.5" strokeWidth={2} />
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state mt-4">
          <div className="empty-state-icon">
            <Glyph name="joint" className="h-7 w-7" strokeWidth={1.5} />
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
          <Glyph name="swap" className="h-3.5 w-3.5" strokeWidth={2} />
          Refresh
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
    // Employment is a personal-flow step. A company journey has no such step,
    // so offering it here would send "Edit" to a screen outside the stepper.
    ...(!isBusiness
      ? [
          {
            title: 'Employment',
            step: 'employment' as WizardStep,
            items: [
              row('Status', EMPLOYMENT_STATUSES.find(s => s.value === form.employmentStatus)?.label),
              row('Employer', form.employerName),
              row('Job title', form.jobTitle),
              row(
                'Years with employer',
                form.yearsWithEmployer ? `${form.yearsWithEmployer} years` : null
              ),
            ].filter(Boolean) as { label: string; value: string }[],
          },
        ]
      : []),
  ];

  const declarationsList: { key: keyof typeof declarations; text: string }[] = [
    {
      key: 'informationAccurate',
      text: 'I declare that all information provided in this application is true, accurate, and complete to the best of my knowledge.',
    },
    {
      key: 'consentCreditCheck',
      text: 'I consent to the bank performing credit checks, verifying my identity, and sharing my information with credit bureaus and regulatory authorities as required.',
    },
    {
      key: 'termsAccepted',
      text: 'I have read and agree to the terms and conditions, privacy policy, and the product-specific disclosures.',
    },
  ];

  const submittedSteps = [
    { title: 'Submitted', detail: 'Your application reaches the bank.' },
    { title: 'Review', detail: 'Identity, documents and credit are assessed.' },
    { title: 'Decision', detail: 'The bank makes its lending decision.' },
    { title: 'Offer', detail: 'You receive an offer and sign if you accept.' },
  ];

  return (
    <div className="space-y-6">
      {/* The number the whole application resolves to, restated here so the customer signs
          the declarations against it rather than against a figure two steps back. */}
      <section
        className="relative overflow-hidden rounded-[28px] p-6 text-white"
        style={{ background: 'var(--tile-active)', boxShadow: 'var(--tile-active-shadow)' }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,.14), transparent 65%)' }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
              You are applying for
            </p>
            <h2 className="serif mt-2 text-[26px] font-medium leading-tight sm:text-[30px]">
              {product.productName}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {LOAN_PURPOSE_LABELS[form.loanPurpose as LoanPurpose] || form.loanPurpose || 'Purpose not set'}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Requested
            </p>
            <p className="mt-1 text-[32px] font-bold leading-none tracking-tight tabular-nums">
              {form.requestedAmount ? formatCurrency(parseFloat(form.requestedAmount)) : '—'}
            </p>
            <p className="mt-1.5 text-xs text-white/60">
              {form.requestedTermMonths ? `${form.requestedTermMonths} months` : 'Term not set'}
            </p>
          </div>
        </div>

        {quote ? (
          <div className="relative mt-6">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['Monthly repayment', quoteMoney(quote.monthlyRepayment)],
                ['Total cost of credit', quoteMoney(quote.costOfCredit)],
                ['Total repayable', quoteMoney(quote.totalRepayable)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">{label}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-white/50">
              Illustrative, not an offer. {quote.calculatedRatePct}% rate
              {quote.aprcAvailable ? `, APRC ${quote.aprcPct}%` : ''}. Quote{' '}
              {quote.quoteId.slice(0, 8)} holds until{' '}
              {new Date(quote.expiresAt).toLocaleDateString('en-IE', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              .
            </p>
          </div>
        ) : (
          <p className="relative mt-5 text-sm text-white/70">
            The bank&apos;s indicative figures will appear here once a quote is available.
          </p>
        )}
      </section>

      {/* What happens after submission — the process, not a promise about a decision. */}
      <section
        className="rounded-[24px] border p-5 sm:p-6"
        style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">What happens after you submit</h3>
          <span className="chip !py-1 !text-xs">You can track it here</span>
        </div>
        <ol className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {submittedSteps.map((item, i) => (
            <li key={item.title} className="relative">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold"
                style={{
                  borderColor: 'var(--hairline-strong)',
                  backgroundColor: 'var(--brand-soft)',
                  color: 'var(--brand-on-soft)',
                }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <p
                className="mt-2 text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.title}
              </p>
              <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Every answer, grouped and editable in place. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map(section => (
          <section
            key={section.title}
            aria-label={section.title}
            className="rounded-[24px] border p-5"
            style={{
              borderColor: 'var(--hairline-strong)',
              backgroundColor: 'var(--surface-card)',
            }}
          >
            <div
              className="mb-3 flex items-center justify-between gap-3 border-b pb-3"
              style={{ borderColor: 'var(--hairline)' }}
            >
              <h3 className="serif text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                {section.title}
              </h3>
              <button
                type="button"
                onClick={() => onEdit(section.step)}
                className="link-arrow !text-xs"
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
              <dl className="space-y-2.5">
                {section.items.map(item => (
                  <div key={item.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {item.label}
                    </dt>
                    <dd
                      className="text-right text-sm font-semibold tabular-nums"
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
      <section
        className="rounded-[24px] border p-5 sm:p-6"
        style={{ borderColor: 'var(--hairline-strong)', backgroundColor: 'var(--surface-card)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="section-title">Declarations and consent</h3>
            <p className="field-hint">
              Three confirmations and the application is on its way.
            </p>
          </div>
          <span
            className="chip !py-1 !text-xs"
            style={
              acceptedDeclarations === 3
                ? { color: 'var(--up)' }
                : undefined
            }
          >
            {acceptedDeclarations} of 3 accepted
          </span>
        </div>

        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={acceptedDeclarations}
          aria-label="Declarations accepted"
          style={{ backgroundColor: 'var(--hairline-strong)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(acceptedDeclarations / 3) * 100}%`,
              backgroundColor: acceptedDeclarations === 3 ? 'var(--up)' : 'var(--brand)',
            }}
          />
        </div>

        <div className="mt-4 space-y-3">
          {declarationsList.map(declaration => {
            const checked = declarations[declaration.key];
            return (
              <label
                key={declaration.key}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors"
                style={{
                  borderColor: checked ? 'var(--brand)' : 'var(--hairline-strong)',
                  backgroundColor: checked ? 'var(--brand-soft)' : 'var(--surface-input)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => onDeclarationChange(declaration.key, e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded"
                  style={{ accentColor: 'var(--brand)' }}
                  required
                  aria-required="true"
                />
                <span className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {declaration.text}{' '}
                  <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </span>
              </label>
            );
          })}
        </div>

        {acceptedDeclarations < 3 && (
          <p
            id="declarations-hint"
            className="mt-4 text-sm text-amber-600 dark:text-amber-400"
            role="status"
          >
            Accept all three declarations to enable “Submit application”.
          </p>
        )}
      </section>
    </div>
  );
}
