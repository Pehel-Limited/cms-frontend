'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applicationService, CreateApplicationRequest } from '@/services/api/applicationService';
import { productService, type Product } from '@/services/api/productService';
import { customerService, type Customer } from '@/services/api/customerService';
import ProductFormFields, {
  type ProductFormData,
  type ProductFormErrors,
  INITIAL_FORM_DATA,
  getProductCategory,
  getFieldLabels,
} from './ProductFormFields';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';
import config from '@/config';

// Editable customer fields for the verification step
interface CustomerEditData {
  firstName: string;
  middleName: string;
  lastName: string;
  businessName: string;
  businessLegalName: string;
  dateOfBirth: string;
  gender: string;
  primaryEmail: string;
  secondaryEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  mobilePhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  nationality: string;
  primaryIdentityType: string;
  primaryIdentityNumber: string;
  taxIdNumber: string;
  employmentStatus: string;
  employerName: string;
  occupation: string;
  annualIncome: string;
}

function customerToEditData(c: Customer): CustomerEditData {
  return {
    firstName: c.firstName || '',
    middleName: c.middleName || '',
    lastName: c.lastName || '',
    businessName: c.businessName || '',
    businessLegalName: c.businessLegalName || '',
    dateOfBirth: c.dateOfBirth || '',
    gender: c.gender || '',
    primaryEmail: c.primaryEmail || '',
    secondaryEmail: c.secondaryEmail || '',
    primaryPhone: c.primaryPhone || '',
    secondaryPhone: c.secondaryPhone || '',
    mobilePhone: c.mobilePhone || '',
    addressLine1: c.addressLine1 || '',
    addressLine2: c.addressLine2 || '',
    city: c.city || '',
    stateProvince: c.stateProvince || '',
    postalCode: c.postalCode || '',
    country: c.country || '',
    nationality: c.nationality || '',
    primaryIdentityType: c.primaryIdentityType || '',
    primaryIdentityNumber: c.primaryIdentityNumber || '',
    taxIdNumber: c.taxIdNumber || '',
    employmentStatus: c.employmentStatus || '',
    employerName: c.employerName || '',
    occupation: c.occupation || '',
    annualIncome: c.annualIncome?.toString() || '',
  };
}

/* ── Wizard steps ───────────────────────────────────────────────────── */
const STEPS = [
  { id: 'product', label: 'Product' },
  { id: 'customer', label: 'Customer' },
  { id: 'verify', label: 'Verify' },
  { id: 'details', label: 'Details' },
] as const;

/* ── Shared styling ─────────────────────────────────────────────────── */
const fieldCls = 'w-full rounded-xl px-4 py-2.5 text-base transition-colors';
const baseStyle: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  color: 'var(--rm-text)',
  border: '1px solid var(--rm-border)',
};
const cardStyle: React.CSSProperties = { backgroundColor: 'var(--rm-card)' };

const RISK_TONE_BY_NAME: Record<string, { bg: string; fg: string }> = {
  green: { bg: 'rgba(16,185,129,0.14)', fg: '#047857' },
  blue: { bg: 'rgba(14,165,233,0.14)', fg: '#0284c7' },
  yellow: { bg: 'rgba(245,158,11,0.15)', fg: '#b45309' },
  orange: { bg: 'rgba(249,115,22,0.15)', fg: '#c2410c' },
  red: { bg: 'rgba(239,68,68,0.13)', fg: '#b91c1c' },
  gray: { bg: 'rgba(127,127,127,0.14)', fg: 'var(--rm-text-secondary)' },
};

/* Control ids inside ProductFormFields — used to move focus to the first
   invalid field after a failed submit. */
const PRODUCT_FIELD_IDS: Partial<Record<keyof ProductFormData, string>> = {
  loanAmount: 'pf-amount',
  loanTerm: 'pf-term',
  interestRate: 'pf-rate',
  loanPurpose: 'pf-purpose',
  propertyAddress: 'pf-property-address',
  propertyCity: 'pf-property-city',
  propertyState: 'pf-property-state',
  propertyType: 'pf-property-type',
  propertyValue: 'pf-property-value',
  downPaymentAmount: 'pf-property-deposit',
  vehicleMake: 'pf-vehicle-make',
  vehicleModel: 'pf-vehicle-model',
  vehicleYear: 'pf-vehicle-year',
  vehicleCondition: 'pf-vehicle-condition',
  vehicleValue: 'pf-vehicle-value',
  assetDescription: 'pf-asset-description',
};

const CATEGORY_LABELS: Record<string, string> = {
  TERM_LOAN: 'Loan',
  MORTGAGE: 'Mortgage',
  VEHICLE_FINANCE: 'Vehicle finance',
  CREDIT_CARD: 'Credit card',
  OVERDRAFT: 'Overdraft',
  BNPL: 'Buy now pay later',
  INVOICE_ASSET_FINANCE: 'Finance facility',
};

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

function InlineAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
      style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
    >
      <svg className="h-5 w-5 shrink-0" style={{ color: '#dc2626' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-sm" style={{ color: '#b91c1c' }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto text-sm font-medium hover:underline"
          style={{ color: '#b91c1c' }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* ── Customer verification field descriptors ────────────────────────── */
interface CustomerFieldDef {
  key: keyof CustomerEditData;
  label: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'select';
  options?: { value: string; label: string }[];
  wide?: boolean;
  format?: (value: string) => string;
}

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];
const EMPLOYMENT_OPTIONS = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'BUSINESS_OWNER', label: 'Business owner' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
  { value: 'HOMEMAKER', label: 'Homemaker' },
];
const ID_TYPE_OPTIONS = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'DRIVERS_LICENSE', label: "Driver's licence" },
  { value: 'PPS_NUMBER', label: 'PPS number' },
  { value: 'TAX_ID', label: 'Tax ID' },
];

const optionLabel = (options: { value: string; label: string }[], value: string) =>
  options.find(o => o.value === value)?.label || value || '—';

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currencySymbol = getCurrencySymbol();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const preselectedProductId = searchParams.get('productId');
  const preselectedCustomerId = searchParams.get('customerId');
  const bankId = config.bank?.defaultBankId || '123e4567-e89b-12d3-a456-426614174000';

  /* Scoped error state — one failure never blanks the whole wizard. */
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);

  const [customerEditData, setCustomerEditData] = useState<CustomerEditData | null>(null);
  const [customerEdited, setCustomerEdited] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerSaveError, setCustomerSaveError] = useState<string | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<ProductFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const updateField = (field: keyof ProductFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const goToStep = (next: number) => {
    setStep(next);
    window.setTimeout(() => stepHeadingRef.current?.focus(), 0);
  };

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const data = await productService.getAllProducts(bankId);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setProductsError(
        err instanceof Error ? err.message : 'The product catalogue could not be loaded.'
      );
    } finally {
      setProductsLoading(false);
    }
  }, [bankId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (preselectedProductId && products.length > 0) {
      const product = products.find(p => p.productId === preselectedProductId);
      if (product) {
        setSelectedProduct(product);
        setFormData(prev => ({
          ...prev,
          loanAmount: product.defaultLoanAmount?.toString() || '',
          loanTerm: product.defaultTermMonths?.toString() || '',
          interestRate: product.defaultInterestRate?.toString() || '',
        }));
        // Automatically move to customer selection when a product is preselected
        setStep(2);
      }
    }
  }, [preselectedProductId, products]);

  const loadCustomerById = useCallback(
    async (customerId: string) => {
      try {
        setCustomerLoadError(null);
        const customer = await customerService.getCustomerById(customerId);
        setSelectedCustomer(customer);
        setCustomerEditData(customerToEditData(customer));
      } catch (err) {
        console.error('Failed to load customer:', err);
        setCustomerLoadError('We could not load this customer. Search for them instead.');
      }
    },
    []
  );

  useEffect(() => {
    if (preselectedCustomerId) {
      loadCustomerById(preselectedCustomerId);
    }
  }, [preselectedCustomerId, loadCustomerById]);

  const searchCustomers = async (term: string) => {
    if (!term.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    try {
      setSearchingCustomers(true);
      setCustomerSearchError(null);
      const results = await customerService.searchCustomers({ searchTerm: term });
      setCustomerSearchResults(results);
    } catch (err) {
      console.error('Failed to search customers:', err);
      setCustomerSearchError('Customer search failed.');
      setCustomerSearchResults([]);
    } finally {
      setSearchingCustomers(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (step === 2) {
        searchCustomers(customerSearchTerm);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearchTerm, step]);

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerEditData(customerToEditData(customer));
    setCustomerEdited(false);
    setCustomerSaveError(null);
    setIsEditingCustomer(false);
    goToStep(3);
  };

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      ...INITIAL_FORM_DATA,
      loanAmount: product.defaultLoanAmount?.toString() || '',
      loanTerm: product.defaultTermMonths?.toString() || '',
      interestRate: product.defaultInterestRate?.toString() || '',
    });
    setFieldErrors({});
    setSubmitError(null);
    goToStep(selectedCustomer ? 3 : 2);
  };

  /* ── Validation ──────────────────────────────────────────────────────
     Every threshold below comes from the selected product record. */
  const validateForm = (): ProductFormErrors => {
    const errs: ProductFormErrors = {};
    if (!selectedProduct) return errs;
    const category = getProductCategory(selectedProduct.productType);
    const needsTerm = getFieldLabels(category).termLabel !== '';
    const isMortgage = category === 'MORTGAGE';

    const amount = parseFloat(formData.loanAmount);
    if (!formData.loanAmount.trim()) {
      errs.loanAmount = 'Enter the amount being requested.';
    } else if (Number.isNaN(amount) || amount <= 0) {
      errs.loanAmount = 'Enter an amount greater than zero.';
    } else {
      if (selectedProduct.minLoanAmount && amount < selectedProduct.minLoanAmount)
        errs.loanAmount = `The minimum for this product is ${formatCurrency(selectedProduct.minLoanAmount)}.`;
      else if (selectedProduct.maxLoanAmount && amount > selectedProduct.maxLoanAmount)
        errs.loanAmount = `The maximum for this product is ${formatCurrency(selectedProduct.maxLoanAmount)}.`;
    }

    if (needsTerm) {
      const term = parseInt(formData.loanTerm, 10);
      const minTerm = isMortgage
        ? Math.round((selectedProduct.minTermMonths || 0) / 12)
        : selectedProduct.minTermMonths || 0;
      const maxTerm = isMortgage
        ? Math.round((selectedProduct.maxTermMonths || 0) / 12)
        : selectedProduct.maxTermMonths || 0;
      const unit = isMortgage ? 'years' : 'months';
      if (!formData.loanTerm.trim()) {
        errs.loanTerm = `Enter the term in ${unit}.`;
      } else if (Number.isNaN(term) || term <= 0) {
        errs.loanTerm = `Enter a whole number of ${unit}.`;
      } else if ((minTerm && term < minTerm) || (maxTerm && term > maxTerm)) {
        errs.loanTerm = `The allowed term is ${minTerm} to ${maxTerm} ${unit}.`;
      }
    }

    const rate = parseFloat(formData.interestRate);
    if (!formData.interestRate.trim()) {
      errs.interestRate = 'Enter the interest rate.';
    } else if (Number.isNaN(rate) || rate < 0) {
      errs.interestRate = 'Enter a rate of zero or more.';
    } else if (
      (selectedProduct.minInterestRate != null && rate < selectedProduct.minInterestRate) ||
      (selectedProduct.maxInterestRate != null && rate > selectedProduct.maxInterestRate)
    ) {
      errs.interestRate = `The allowed rate is ${selectedProduct.minInterestRate?.toFixed(2)}% to ${selectedProduct.maxInterestRate?.toFixed(2)}%.`;
    }

    if (!formData.loanPurpose) errs.loanPurpose = 'Choose the purpose of the loan.';

    if (category === 'MORTGAGE') {
      if (!formData.propertyAddress.trim()) errs.propertyAddress = 'Enter the property address.';
      if (!formData.propertyCity.trim()) errs.propertyCity = 'Enter the city.';
      if (!formData.propertyState.trim()) errs.propertyState = 'Enter the county or region.';
      if (!formData.propertyType) errs.propertyType = 'Choose the property type.';
      const value = parseFloat(formData.propertyValue);
      if (!formData.propertyValue.trim()) errs.propertyValue = 'Enter the estimated property value.';
      else if (Number.isNaN(value) || value <= 0) errs.propertyValue = 'Enter a value greater than zero.';
    }

    if (category === 'VEHICLE_FINANCE') {
      if (!formData.vehicleMake.trim()) errs.vehicleMake = 'Enter the vehicle make.';
      if (!formData.vehicleModel.trim()) errs.vehicleModel = 'Enter the vehicle model.';
      if (!formData.vehicleYear.trim()) errs.vehicleYear = 'Enter the vehicle year.';
      if (!formData.vehicleCondition) errs.vehicleCondition = 'Choose the vehicle condition.';
      const value = parseFloat(formData.vehicleValue);
      if (!formData.vehicleValue.trim()) errs.vehicleValue = 'Enter the estimated vehicle value.';
      else if (Number.isNaN(value) || value <= 0) errs.vehicleValue = 'Enter a value greater than zero.';
    }

    if (category === 'INVOICE_ASSET_FINANCE' && !formData.assetDescription.trim()) {
      errs.assetDescription = 'Describe the invoices or assets being financed.';
    }

    return errs;
  };

  const focusFirstError = (errs: ProductFormErrors) => {
    const key = (Object.keys(errs) as (keyof ProductFormData)[]).find(k => errs[k]);
    if (!key) return;
    const id = PRODUCT_FIELD_IDS[key];
    if (!id) return;
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (el as HTMLElement | null)?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedProduct || !selectedCustomer) {
      setSubmitError('Choose a product and a customer before creating the application.');
      return;
    }

    const errs = validateForm();
    setFieldErrors(errs);
    const invalidKeys = (Object.keys(errs) as (keyof ProductFormData)[]).filter(k => errs[k]);
    if (invalidKeys.length > 0) {
      const count = invalidKeys.length;
      setSubmitError(
        `${count} field${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention before this application can be created.`
      );
      focusFirstError(errs);
      return;
    }

    const category = getProductCategory(selectedProduct.productType);
    const needsTerm = getFieldLabels(category).termLabel !== '';

    try {
      setSubmitting(true);

      // Convert mortgage term from years to months.
      // Revolving products (credit card, overdraft) have no term field: 12 months = annual review.
      const termMonths =
        category === 'MORTGAGE'
          ? parseInt(formData.loanTerm, 10) * 12
          : needsTerm
            ? parseInt(formData.loanTerm, 10)
            : 12;

      const request: CreateApplicationRequest = {
        bankId,
        productId: selectedProduct.productId,
        customerId: selectedCustomer.customerId,
        requestedAmount: parseFloat(formData.loanAmount),
        requestedTermMonths: termMonths,
        requestedInterestRate: parseFloat(formData.interestRate),
        loanPurpose: formData.loanPurpose,
        loanPurposeDescription: formData.notes || undefined,
        channel: 'RELATIONSHIP_MANAGER',
        ...(customerEditData?.employmentStatus && {
          employmentStatus: customerEditData.employmentStatus,
        }),
        ...(customerEditData?.employerName && { employerName: customerEditData.employerName }),
        ...(customerEditData?.annualIncome && {
          statedAnnualIncome: parseFloat(customerEditData.annualIncome),
        }),
        ...(formData.propertyAddress && { propertyAddress: formData.propertyAddress }),
        ...(formData.propertyCity && { propertyCity: formData.propertyCity }),
        ...(formData.propertyState && { propertyState: formData.propertyState }),
        ...(formData.propertyPostalCode && { propertyPostalCode: formData.propertyPostalCode }),
        ...(formData.propertyType && { propertyType: formData.propertyType }),
        ...(formData.propertyValue && { propertyValue: parseFloat(formData.propertyValue) }),
        ...(formData.downPaymentAmount && {
          downPaymentAmount: parseFloat(formData.downPaymentAmount),
        }),
        ...(formData.vehicleMake && { vehicleMake: formData.vehicleMake }),
        ...(formData.vehicleModel && { vehicleModel: formData.vehicleModel }),
        ...(formData.vehicleYear && { vehicleYear: parseInt(formData.vehicleYear, 10) }),
        ...(formData.vehicleCondition && { vehicleCondition: formData.vehicleCondition }),
        ...(formData.vehicleValue && { vehicleValue: parseFloat(formData.vehicleValue) }),
        ...(formData.assetDescription && {
          additionalData: { assetDescription: formData.assetDescription },
        }),
      };

      const application = await applicationService.createApplication(request);
      router.push(`/dashboard/applications/${application.applicationId}`);
    } catch (err: unknown) {
      console.error('Failed to create application:', err);
      // Scoped: everything typed so far stays on screen.
      setSubmitError(
        err instanceof Error ? err.message : 'The application could not be created. Nothing was saved.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateCustomerField = (field: keyof CustomerEditData, value: string) => {
    setCustomerEditData(prev => (prev ? { ...prev, [field]: value } : prev));
    setCustomerEdited(true);
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer || !customerEditData) return;
    try {
      setSavingCustomer(true);
      setCustomerSaveError(null);
      const updatePayload: Partial<Customer> = {
        ...(customerEditData.firstName && { firstName: customerEditData.firstName }),
        ...(customerEditData.middleName && { middleName: customerEditData.middleName }),
        ...(customerEditData.lastName && { lastName: customerEditData.lastName }),
        ...(customerEditData.businessName && { businessName: customerEditData.businessName }),
        ...(customerEditData.businessLegalName && {
          businessLegalName: customerEditData.businessLegalName,
        }),
        ...(customerEditData.dateOfBirth && { dateOfBirth: customerEditData.dateOfBirth }),
        ...(customerEditData.gender && { gender: customerEditData.gender }),
        primaryEmail: customerEditData.primaryEmail,
        ...(customerEditData.secondaryEmail && { secondaryEmail: customerEditData.secondaryEmail }),
        primaryPhone: customerEditData.primaryPhone,
        ...(customerEditData.secondaryPhone && { secondaryPhone: customerEditData.secondaryPhone }),
        ...(customerEditData.mobilePhone && { mobilePhone: customerEditData.mobilePhone }),
        ...(customerEditData.addressLine1 && { addressLine1: customerEditData.addressLine1 }),
        ...(customerEditData.addressLine2 && { addressLine2: customerEditData.addressLine2 }),
        ...(customerEditData.city && { city: customerEditData.city }),
        ...(customerEditData.stateProvince && { stateProvince: customerEditData.stateProvince }),
        ...(customerEditData.postalCode && { postalCode: customerEditData.postalCode }),
        ...(customerEditData.country && { country: customerEditData.country }),
        ...(customerEditData.nationality && { nationality: customerEditData.nationality }),
        ...(customerEditData.primaryIdentityType && {
          primaryIdentityType: customerEditData.primaryIdentityType,
        }),
        ...(customerEditData.primaryIdentityNumber && {
          primaryIdentityNumber: customerEditData.primaryIdentityNumber,
        }),
        ...(customerEditData.taxIdNumber && { taxIdNumber: customerEditData.taxIdNumber }),
        ...(customerEditData.employmentStatus && {
          employmentStatus: customerEditData.employmentStatus,
        }),
        ...(customerEditData.employerName && { employerName: customerEditData.employerName }),
        ...(customerEditData.occupation && { occupation: customerEditData.occupation }),
        ...(customerEditData.annualIncome && {
          annualIncome: parseFloat(customerEditData.annualIncome),
        }),
      };
      const updated = await customerService.updateCustomer(
        selectedCustomer.customerId,
        updatePayload
      );
      setSelectedCustomer(updated);
      setCustomerEdited(false);
      setIsEditingCustomer(false);
    } catch (err: unknown) {
      console.error('Failed to update customer:', err);
      // Scoped to the customer step — typed edits are kept.
      setCustomerSaveError(
        err instanceof Error ? err.message : 'Customer details could not be saved. Your edits are still here.'
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  /* ── Step 1: product ──────────────────────────────────────────────── */
  const renderProductSelection = () => (
    <div className="space-y-6">
      <div>
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          Select loan product
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Choose the product this application will be raised against.
        </p>
      </div>

      {productsError && <InlineAlert message={productsError} onRetry={loadProducts} />}

      {productsLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
              <div className="h-6 w-2/3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              <div className="mt-4 h-4 w-full rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              <div className="mt-6 space-y-3">
                <div className="h-4 w-1/2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                <div className="h-4 w-2/3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                <div className="h-4 w-1/3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!productsLoading && !productsError && products.length === 0 && (
        <div className="rounded-3xl py-20 text-center" style={cardStyle}>
          <p className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            No products available
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Loan products must be published before an application can be raised.
          </p>
        </div>
      )}

      {!productsLoading && products.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map(product => {
            const selected = selectedProduct?.productId === product.productId;
            return (
              <button
                key={product.productId}
                type="button"
                aria-pressed={selected}
                onClick={() => selectProduct(product)}
                className="rounded-3xl p-6 text-left transition-transform hover:-translate-y-0.5 sm:p-7"
                style={{
                  ...cardStyle,
                  outline: selected ? '2px solid var(--rm-accent)' : undefined,
                  outlineOffset: selected ? '-2px' : undefined,
                }}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
                    {product.productName}
                  </span>
                  {selected && (
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium"
                      style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                    >
                      Selected
                    </span>
                  )}
                </span>

                {product.shortDescription && (
                  <span className="mt-2 block text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {product.shortDescription}
                  </span>
                )}

                <span className="mt-5 block space-y-2">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Interest rate
                    </span>
                    <span className="text-base font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {productService.formatInterestRate(product.minInterestRate, product.maxInterestRate)}
                    </span>
                  </span>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Loan amount
                    </span>
                    <span className="text-base font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {productService.formatLoanAmount(product.minLoanAmount, product.maxLoanAmount)}
                    </span>
                  </span>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Tenure
                    </span>
                    <span className="text-base font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {productService.formatTenure(product.minTermMonths, product.maxTermMonths)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ── Step 2: customer ─────────────────────────────────────────────── */
  const renderCustomerSelection = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            ref={stepHeadingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            Select customer
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Search for an existing customer to raise this application against.
          </p>
        </div>
        <button
          type="button"
          onClick={() => goToStep(1)}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--rm-accent)' }}
        >
          Back to products
        </button>
      </div>

      {selectedProduct && (
        <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-accent-muted)' }}>
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Selected product
          </p>
          <p className="mt-1 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
            {selectedProduct.productName}
          </p>
          {selectedProduct.shortDescription && (
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              {selectedProduct.shortDescription}
            </p>
          )}
        </div>
      )}

      {customerLoadError && <InlineAlert message={customerLoadError} />}

      <div className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
        <label htmlFor="customer-search" className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
          Search customers
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: 'var(--rm-text-muted)' }}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="customer-search"
            type="search"
            aria-describedby="customer-search-hint"
            placeholder="Name, email, phone or customer number"
            value={customerSearchTerm}
            onChange={e => setCustomerSearchTerm(e.target.value)}
            className={`${fieldCls} pl-11`}
            style={baseStyle}
          />
        </div>
        <p id="customer-search-hint" className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Results appear as you type.
        </p>

        <div className="mt-6">
          {customerSearchError && (
            <InlineAlert
              message={customerSearchError}
              onRetry={() => searchCustomers(customerSearchTerm)}
            />
          )}

          {searchingCustomers && (
            <div className="space-y-3" aria-hidden="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-4 rounded-2xl px-5 py-4" style={{ backgroundColor: 'var(--rm-input)' }}>
                  <div className="h-11 w-11 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-card)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-card)' }} />
                    <div className="h-3 w-1/4 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-card)' }} />
                  </div>
                </div>
              ))}
              <p className="sr-only" role="status">
                Searching customers
              </p>
            </div>
          )}

          {!searchingCustomers && !customerSearchTerm.trim() && (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Enter a name, email or phone number to begin.
            </p>
          )}

          {!searchingCustomers && customerSearchTerm.trim() && !customerSearchError && customerSearchResults.length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              No customers match “{customerSearchTerm}”. Try a different search term.
            </p>
          )}

          {!searchingCustomers && customerSearchResults.length > 0 && (
            <>
              <p role="status" className="mb-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {customerSearchResults.length} customer{customerSearchResults.length === 1 ? '' : 's'} found
              </p>
              <ul className="space-y-2">
                {customerSearchResults.map(customer => {
                  const name = customerService.getCustomerName(customer);
                  const tone = RISK_TONE_BY_NAME[customerService.getRiskRatingColor(customer.riskRating)] ||
                    RISK_TONE_BY_NAME.gray;
                  return (
                    <li key={customer.customerId}>
                      <button
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition-colors hover:bg-slate-50"
                        style={{ backgroundColor: 'var(--rm-input)' }}
                      >
                        <span className="flex min-w-0 items-center gap-4">
                          <span
                            aria-hidden="true"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold"
                            style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                          >
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                              {name}
                            </span>
                            <span className="block truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              {customer.customerNumber} · {customerService.formatCustomerType(customer.customerType)}
                            </span>
                            {(customer.primaryEmail || customer.primaryPhone) && (
                              <span className="mt-0.5 block truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                                {[customer.primaryEmail, customer.primaryPhone].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          {customer.riskRating && (
                            <span
                              className="rounded-full px-3 py-1 text-sm font-medium"
                              style={{ backgroundColor: tone.bg, color: tone.fg }}
                            >
                              {customer.riskRating.replace(/_/g, ' ')} risk
                            </span>
                          )}
                          <svg className="h-4 w-4" style={{ color: 'var(--rm-text-muted)' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );

  /* ── Step 3: verify customer ──────────────────────────────────────── */
  const renderCustomerVerification = () => {
    if (!selectedCustomer || !customerEditData) return null;
    const isIndividual = selectedCustomer.customerType === 'INDIVIDUAL';
    const editing = isEditingCustomer;

    const moneyFormat = (value: string) =>
      value ? `${currencySymbol}${Number(value).toLocaleString()}` : '';

    const groups: { title: string; badge?: string; cols: string; fields: CustomerFieldDef[] }[] = [
      {
        title: isIndividual ? 'Personal information' : 'Business information',
        cols: 'md:grid-cols-3',
        fields: isIndividual
          ? [
              { key: 'firstName', label: 'First name', required: true },
              { key: 'middleName', label: 'Middle name' },
              { key: 'lastName', label: 'Last name', required: true },
              { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
              { key: 'gender', label: 'Gender', type: 'select', options: GENDER_OPTIONS },
              { key: 'nationality', label: 'Nationality' },
            ]
          : [
              { key: 'businessName', label: 'Business name', required: true },
              { key: 'businessLegalName', label: 'Legal name' },
            ],
      },
      {
        title: 'Contact information',
        cols: 'md:grid-cols-3',
        fields: [
          { key: 'primaryEmail', label: 'Primary email', required: true, type: 'email' },
          { key: 'secondaryEmail', label: 'Secondary email', type: 'email' },
          { key: 'primaryPhone', label: 'Primary phone', required: true, type: 'tel' },
          { key: 'secondaryPhone', label: 'Secondary phone', type: 'tel' },
          { key: 'mobilePhone', label: 'Mobile phone', type: 'tel' },
        ],
      },
      {
        title: 'Address',
        cols: 'md:grid-cols-2',
        fields: [
          { key: 'addressLine1', label: 'Address line 1', wide: true },
          { key: 'addressLine2', label: 'Address line 2', wide: true },
          { key: 'city', label: 'City' },
          { key: 'stateProvince', label: 'State or province' },
          { key: 'postalCode', label: 'Postal code' },
          { key: 'country', label: 'Country' },
        ],
      },
      {
        title: 'Identity documents',
        cols: 'md:grid-cols-3',
        fields: [
          { key: 'primaryIdentityType', label: 'ID type', type: 'select', options: ID_TYPE_OPTIONS },
          { key: 'primaryIdentityNumber', label: 'ID number' },
          { key: 'taxIdNumber', label: 'Tax ID number' },
        ],
      },
      {
        title: 'Employment and income',
        cols: 'md:grid-cols-3',
        fields: [
          { key: 'employmentStatus', label: 'Employment status', type: 'select', options: EMPLOYMENT_OPTIONS },
          { key: 'employerName', label: 'Employer name' },
          { key: 'occupation', label: 'Occupation' },
          { key: 'annualIncome', label: `Annual income (${currencySymbol})`, type: 'number', format: moneyFormat },
        ],
      },
    ];

    const displayName = isIndividual
      ? `${customerEditData.firstName} ${customerEditData.lastName}`.trim()
      : customerEditData.businessName;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Verify customer details
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {editing
                ? 'Make your changes, then save before continuing.'
                : 'Confirm the customer details are correct before continuing.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-pressed={editing}
              onClick={() => {
                if (editing) {
                  setCustomerEditData(customerToEditData(selectedCustomer));
                  setCustomerEdited(false);
                  setIsEditingCustomer(false);
                  setCustomerSaveError(null);
                } else {
                  setIsEditingCustomer(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={
                    editing
                      ? 'M6 18L18 6M6 6l12 12'
                      : 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                  }
                />
              </svg>
              {editing ? 'Cancel editing' : 'Edit details'}
            </button>
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--rm-accent)' }}
            >
              Change customer
            </button>
          </div>
        </div>

        {customerSaveError && (
          <InlineAlert message={`${customerSaveError} Your edits were kept.`} />
        )}

        {/* Summary */}
        <div className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold"
              style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
            >
              {(isIndividual ? customerEditData.firstName : customerEditData.businessName)?.charAt(0) || '?'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
                {displayName || 'Unnamed customer'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {selectedCustomer.customerNumber}
                </span>
                <span
                  className="rounded-full px-3 py-0.5 text-sm font-medium"
                  style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                >
                  {customerService.formatCustomerType(selectedCustomer.customerType)}
                </span>
                {selectedCustomer.customerStatus && (
                  <span
                    className="rounded-full px-3 py-0.5 text-sm font-medium"
                    style={
                      selectedCustomer.customerStatus === 'ACTIVE'
                        ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                        : { backgroundColor: 'rgba(127,127,127,0.14)', color: 'var(--rm-text-secondary)' }
                    }
                  >
                    {selectedCustomer.customerStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detail sections */}
        <div className="space-y-6">
          {groups.map(group => (
            <section key={group.title} className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
              <h3 className="mb-5 text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                {group.title}
              </h3>

              {editing ? (
                <div className={`grid grid-cols-1 gap-5 ${group.cols}`}>
                  {group.fields.map(f => {
                    const id = `cust-${f.key}`;
                    const value = customerEditData[f.key];
                    return (
                      <div key={f.key} className={f.wide ? 'md:col-span-2' : undefined}>
                        <label htmlFor={id} className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {f.label}
                          {f.required && <RequiredMark />}
                        </label>
                        {f.type === 'select' ? (
                          <select
                            id={id}
                            required={f.required}
                            aria-required={f.required || undefined}
                            value={value}
                            onChange={e => updateCustomerField(f.key, e.target.value)}
                            className={fieldCls}
                            style={baseStyle}
                          >
                            <option value="">Select…</option>
                            {f.options?.map(o => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={id}
                            type={f.type || 'text'}
                            required={f.required}
                            aria-required={f.required || undefined}
                            inputMode={f.type === 'number' ? 'decimal' : undefined}
                            value={value}
                            onChange={e => updateCustomerField(f.key, e.target.value)}
                            className={fieldCls}
                            style={baseStyle}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <dl className={`grid grid-cols-1 gap-5 ${group.cols}`}>
                  {group.fields.map(f => {
                    const raw = customerEditData[f.key];
                    const shown = f.options
                      ? optionLabel(f.options, raw)
                      : f.format
                        ? f.format(raw) || '—'
                        : raw || '—';
                    return (
                      <div key={f.key} className={f.wide ? 'md:col-span-2' : undefined}>
                        <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {f.label}
                        </dt>
                        <dd className="mt-1 text-base font-medium break-words" style={{ color: 'var(--rm-text)' }}>
                          {shown}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </section>
          ))}
        </div>

        {/* Compliance & credit — always read-only */}
        {(selectedCustomer.kycStatus ||
          selectedCustomer.amlCheckStatus ||
          selectedCustomer.creditScore != null ||
          selectedCustomer.riskRating) && (
          <section className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
            <h3 className="mb-5 text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Compliance and credit
            </h3>
            <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {selectedCustomer.kycStatus && (
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    KYC status
                  </dt>
                  <dd className="mt-1">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                      style={
                        selectedCustomer.kycStatus === 'COMPLETED' || selectedCustomer.kycStatus === 'VERIFIED'
                          ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                          : { backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309' }
                      }
                    >
                      {selectedCustomer.kycStatus.replace(/_/g, ' ')}
                    </span>
                  </dd>
                </div>
              )}
              {selectedCustomer.amlCheckStatus && (
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    AML check
                  </dt>
                  <dd className="mt-1">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                      style={
                        selectedCustomer.amlCheckStatus === 'CLEAR' || selectedCustomer.amlCheckStatus === 'COMPLETED'
                          ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                          : { backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309' }
                      }
                    >
                      {selectedCustomer.amlCheckStatus.replace(/_/g, ' ')}
                    </span>
                  </dd>
                </div>
              )}
              {selectedCustomer.creditScore != null && (
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Credit score
                  </dt>
                  <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {selectedCustomer.creditScore}
                  </dd>
                </div>
              )}
              {selectedCustomer.riskRating && (
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Risk rating
                  </dt>
                  <dd className="mt-1 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                    {selectedCustomer.riskRating.replace(/_/g, ' ')}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              setSelectedCustomer(null);
              setCustomerEditData(null);
              setCustomerEdited(false);
              setIsEditingCustomer(false);
              setCustomerSaveError(null);
              goToStep(2);
            }}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            Select a different customer
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {editing && customerEdited && (
              <button
                type="button"
                onClick={handleSaveCustomer}
                disabled={savingCustomer}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)' }}
              >
                {savingCustomer && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                )}
                {savingCustomer ? 'Saving…' : 'Save changes'}
              </button>
            )}
            <div>
              <button
                type="button"
                onClick={() => goToStep(4)}
                disabled={customerEdited}
                aria-disabled={customerEdited}
                className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                Continue to application details
              </button>
              {customerEdited && (
                <p role="alert" className="mt-2 text-right text-sm" style={{ color: '#b45309' }}>
                  Save your changes before continuing.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Step 4: application details ──────────────────────────────────── */
  const renderApplicationForm = () => {
    if (!selectedProduct) return null;
    const category = getProductCategory(selectedProduct.productType);
    const label = CATEGORY_LABELS[category] || 'Application';
    const errorKeys = Object.keys(fieldErrors).filter(k => fieldErrors[k as keyof ProductFormData]);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              {label} application details
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Complete the {label.toLowerCase()} application for {selectedProduct.productName}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => goToStep(3)}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--rm-accent)' }}
          >
            Back to customer verification
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl p-6" style={cardStyle}>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Selected product
            </p>
            <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
              {selectedProduct.productName}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {selectedProduct.productCode}
            </p>
          </div>

          <div className="rounded-3xl p-6" style={cardStyle}>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Selected customer
            </p>
            <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
              {selectedCustomer ? customerService.getCustomerName(selectedCustomer) : '—'}
            </p>
            <p className="mt-1 truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {[selectedCustomer?.customerNumber, selectedCustomer?.primaryEmail]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
          {submitError && (
            <div className="mb-6">
              <InlineAlert message={submitError} />
              {errorKeys.length > 0 && (
                <ul className="mt-3 space-y-1 pl-1">
                  {errorKeys.map(key => {
                    const id = PRODUCT_FIELD_IDS[key as keyof ProductFormData];
                    return (
                      <li key={key} className="text-sm">
                        <a
                          href={id ? `#${id}` : undefined}
                          onClick={e => {
                            if (!id) return;
                            e.preventDefault();
                            const el = document.getElementById(id);
                            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                            el?.focus();
                          }}
                          className="font-medium hover:underline"
                          style={{ color: '#b91c1c' }}
                        >
                          {fieldErrors[key as keyof ProductFormData]}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <ProductFormFields
            product={selectedProduct}
            formData={formData}
            onChange={updateField}
            errors={fieldErrors}
            customerProfile={
              customerEditData
                ? {
                    employmentStatus: customerEditData.employmentStatus,
                    employerName: customerEditData.employerName,
                    occupation: customerEditData.occupation,
                    annualIncome: customerEditData.annualIncome,
                  }
                : undefined
            }
          />

          <div
            className="mt-8 flex flex-wrap items-center justify-end gap-4 pt-6"
            style={{ borderTop: '1px solid var(--rm-border)' }}
          >
            <button
              type="button"
              onClick={() => router.push('/dashboard/applications')}
              disabled={submitting}
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Discard and exit
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              {submitting && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              )}
              {submitting ? 'Creating…' : `Create ${label.toLowerCase()} application`}
            </button>
          </div>
          {submitting && (
            <p className="sr-only" role="status">
              Creating the application
            </p>
          )}
        </form>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderProductSelection();
      case 2:
        return renderCustomerSelection();
      case 3:
        return renderCustomerVerification();
      case 4:
        return renderApplicationForm();
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ── Header ── */}
      <header className="rounded-3xl p-6 sm:p-7" style={cardStyle}>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </button>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          New application
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {selectedProduct
            ? `${selectedProduct.productName}${selectedCustomer ? ` · ${customerService.getCustomerName(selectedCustomer)}` : ''}`
            : 'Raise a new loan application for an existing customer.'}
        </p>

        {/* Step position — stated as text so it is announced, not implied by colour */}
        <p role="status" className="mt-5 text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
          Step {step} of {STEPS.length}: {STEPS[step - 1].label}
        </p>

        <nav aria-label="Progress" className="mt-3">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {STEPS.map((s, i) => {
              const index = i + 1;
              const done = index < step;
              const current = index === step;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span
                    aria-current={current ? 'step' : undefined}
                    className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor: current
                        ? 'var(--rm-accent-muted)'
                        : done
                          ? 'var(--rm-input)'
                          : 'transparent',
                      color: current
                        ? 'var(--rm-accent)'
                        : done
                          ? 'var(--rm-text-secondary)'
                          : 'var(--rm-text-muted)',
                    }}
                  >
                    <span className="tabular-nums" aria-hidden="true">
                      {index}
                    </span>
                    {s.label}
                    <span className="sr-only">
                      {current ? ' (current step)' : done ? ' (completed)' : ' (not started)'}
                    </span>
                  </span>
                  {index < STEPS.length && (
                    <span aria-hidden="true" className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      ·
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <div>{renderStep()}</div>
    </div>
  );
}
