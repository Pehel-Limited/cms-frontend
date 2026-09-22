'use client';

import { type Product } from '@/services/api/productService';
import { getCurrencySymbol, formatCurrency } from '@/lib/format';

// ─── Product-type category mapping ──────────────────────────────────────
const PRODUCT_CATEGORY_MAP: Record<string, string> = {
  // Term Loans
  PERSONAL_LOAN: 'TERM_LOAN',
  SME_TERM_LOAN: 'TERM_LOAN',
  AGRI_LOAN: 'TERM_LOAN',
  CREDIT_UNION_LOAN: 'TERM_LOAN',
  GREEN_LOAN: 'TERM_LOAN',
  MICROFINANCE: 'TERM_LOAN',
  BUSINESS_LOAN: 'TERM_LOAN',
  AUTO_LOAN: 'VEHICLE_FINANCE',

  // Mortgage
  MORTGAGE: 'MORTGAGE',
  COMMERCIAL_MORTGAGE: 'MORTGAGE',

  // Vehicle Finance
  PCP: 'VEHICLE_FINANCE',
  HIRE_PURCHASE: 'VEHICLE_FINANCE',

  // Credit Card
  CREDIT_CARD: 'CREDIT_CARD',
  BUSINESS_CREDIT_CARD: 'CREDIT_CARD',

  // Overdraft
  OVERDRAFT: 'OVERDRAFT',
  BUSINESS_OVERDRAFT: 'OVERDRAFT',

  // BNPL
  BNPL: 'BNPL',

  // Invoice / Asset Finance
  INVOICE_FINANCE: 'INVOICE_ASSET_FINANCE',
  ASSET_LEASING: 'INVOICE_ASSET_FINANCE',
};

export function getProductCategory(productType: string): string {
  return PRODUCT_CATEGORY_MAP[productType] || 'TERM_LOAN';
}

// ─── Purpose options per product category ──────────────────────────────
const PURPOSE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  TERM_LOAN: [
    { value: 'PERSONAL_USE', label: 'Personal use' },
    { value: 'DEBT_CONSOLIDATION', label: 'Debt consolidation' },
    { value: 'EDUCATION', label: 'Education' },
    { value: 'MEDICAL', label: 'Medical expenses' },
    { value: 'WEDDING', label: 'Wedding' },
    { value: 'TRAVEL', label: 'Travel' },
    { value: 'HOME_RENOVATION', label: 'Home renovation' },
    { value: 'BUSINESS_EXPANSION', label: 'Business expansion' },
    { value: 'WORKING_CAPITAL', label: 'Working capital' },
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment purchase' },
    { value: 'OTHER', label: 'Other' },
  ],
  MORTGAGE: [
    { value: 'HOME_PURCHASE', label: 'Home purchase' },
    { value: 'HOME_CONSTRUCTION', label: 'Home construction' },
    { value: 'HOME_RENOVATION', label: 'Home renovation' },
    { value: 'HOME_REFINANCE', label: 'Refinance existing mortgage' },
    { value: 'INVESTMENT', label: 'Investment property' },
    { value: 'OTHER', label: 'Other' },
  ],
  VEHICLE_FINANCE: [
    { value: 'VEHICLE_PURCHASE', label: 'New vehicle purchase' },
    { value: 'PERSONAL_USE', label: 'Used vehicle purchase' },
    { value: 'BUSINESS_EXPANSION', label: 'Commercial vehicle' },
    { value: 'OTHER', label: 'Other' },
  ],
  CREDIT_CARD: [
    { value: 'PERSONAL_USE', label: 'Personal spending' },
    { value: 'BUSINESS_EXPANSION', label: 'Business spending' },
    { value: 'TRAVEL', label: 'Travel and rewards' },
    { value: 'OTHER', label: 'Other' },
  ],
  OVERDRAFT: [
    { value: 'WORKING_CAPITAL', label: 'Cash flow management' },
    { value: 'PERSONAL_USE', label: 'Personal buffer' },
    { value: 'BUSINESS_EXPANSION', label: 'Business operations' },
    { value: 'OTHER', label: 'Other' },
  ],
  BNPL: [
    { value: 'PERSONAL_USE', label: 'Consumer purchase' },
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment or electronics' },
    { value: 'OTHER', label: 'Other' },
  ],
  INVOICE_ASSET_FINANCE: [
    { value: 'WORKING_CAPITAL', label: 'Working capital' },
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment or asset acquisition' },
    { value: 'BUSINESS_EXPANSION', label: 'Business expansion' },
    { value: 'OTHER', label: 'Other' },
  ],
};

export function getPurposeOptions(category: string) {
  return PURPOSE_OPTIONS[category] || PURPOSE_OPTIONS.TERM_LOAN;
}

// ─── Shared field labels per product category (for amount/term) ─────────
const FIELD_LABELS: Record<string, { amountLabel: string; termLabel: string }> = {
  TERM_LOAN: {
    amountLabel: `Loan amount (${getCurrencySymbol()})`,
    termLabel: 'Loan term (months)',
  },
  MORTGAGE: {
    amountLabel: `Mortgage amount (${getCurrencySymbol()})`,
    termLabel: 'Mortgage term (years)',
  },
  VEHICLE_FINANCE: {
    amountLabel: `Finance amount (${getCurrencySymbol()})`,
    termLabel: 'Finance term (months)',
  },
  CREDIT_CARD: { amountLabel: `Credit limit (${getCurrencySymbol()})`, termLabel: '' },
  OVERDRAFT: { amountLabel: `Overdraft limit (${getCurrencySymbol()})`, termLabel: '' },
  BNPL: {
    amountLabel: `Purchase amount (${getCurrencySymbol()})`,
    termLabel: 'Repayment term (months)',
  },
  INVOICE_ASSET_FINANCE: {
    amountLabel: `Facility amount (${getCurrencySymbol()})`,
    termLabel: 'Facility term (months)',
  },
};

export function getFieldLabels(category: string) {
  return FIELD_LABELS[category] || FIELD_LABELS.TERM_LOAN;
}

// ─── Form state interface ───────────────────────────────────────────────
export interface ProductFormData {
  loanAmount: string;
  loanTerm: string;
  interestRate: string;
  loanPurpose: string;
  notes: string;
  // Employment & income
  employmentStatus: string;
  employerName: string;
  annualIncome: string;
  // Mortgage / property
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyPostalCode: string;
  propertyType: string;
  propertyValue: string;
  downPaymentAmount: string;
  // Vehicle
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleCondition: string;
  vehicleValue: string;
  // Invoice / Asset
  assetDescription: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormData, string>>;

export const INITIAL_FORM_DATA: ProductFormData = {
  loanAmount: '',
  loanTerm: '',
  interestRate: '',
  loanPurpose: '',
  notes: '',
  employmentStatus: '',
  employerName: '',
  annualIncome: '',
  propertyAddress: '',
  propertyCity: '',
  propertyState: '',
  propertyPostalCode: '',
  propertyType: '',
  propertyValue: '',
  downPaymentAmount: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleCondition: '',
  vehicleValue: '',
  assetDescription: '',
};

// ─── Customer profile snapshot type ─────────────────────────────────────
export interface CustomerProfileSnapshot {
  employmentStatus: string;
  employerName: string;
  occupation: string;
  annualIncome: string;
}

// ─── Props ───────────────────────────────────────────────────────────────
interface ProductFormFieldsProps {
  product: Product;
  formData: ProductFormData;
  onChange: (field: keyof ProductFormData, value: string) => void;
  customerProfile?: CustomerProfileSnapshot;
  /** Field-level validation messages, keyed by ProductFormData field. */
  errors?: ProductFormErrors;
}

// ─── Shared input styling ───────────────────────────────────────────────
const inputCls = 'w-full rounded-xl px-4 py-2.5 text-base transition-colors';
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

/* Label + hint + error scaffolding shared by every control below.
   The control itself receives aria-invalid / aria-describedby via a11yProps. */
function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* Wires aria-invalid / aria-describedby onto a control rendered by FieldShell. */
function a11yProps(id: string, error?: string, hasHint?: boolean) {
  const describedBy =
    [hasHint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return {
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': describedBy,
  };
}

// ─── Section wrapper ────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h3 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

// ─── Helper: convert months to years if mortgage ────────────────────────
function formatTermHint(product: Product, category: string) {
  if (category === 'MORTGAGE') {
    const minYears = Math.round((product.minTermMonths || 0) / 12);
    const maxYears = Math.round((product.maxTermMonths || 0) / 12);
    return `Allowed range: ${minYears} to ${maxYears} years`;
  }
  return `Allowed range: ${product.minTermMonths} to ${product.maxTermMonths} months`;
}

// ─── Shared: Amount + Rate fields ───────────────────────────────────────
function AmountRateFields({
  product,
  formData,
  onChange,
  errors,
  category,
}: ProductFormFieldsProps & { category: string }) {
  const labels = getFieldLabels(category);
  const showTerm = labels.termLabel !== '';
  const isMortgage = category === 'MORTGAGE';
  const rateHint =
    product.minInterestRate != null && product.maxInterestRate != null
      ? `Allowed range: ${product.minInterestRate.toFixed(2)}% to ${product.maxInterestRate.toFixed(2)}%`
      : undefined;

  return (
    <Section
      title={
        category === 'CREDIT_CARD'
          ? 'Credit limit'
          : category === 'OVERDRAFT'
            ? 'Overdraft details'
            : 'Financing details'
      }
    >
      <FieldShell
        id="pf-amount"
        label={labels.amountLabel}
        required
        error={errors?.loanAmount}
        hint={`Allowed range: ${formatCurrency(product.minLoanAmount || 0)} to ${formatCurrency(
          product.maxLoanAmount || 0
        )}`}
      >
        <input
          id="pf-amount"
          type="number"
          min={product.minLoanAmount || undefined}
          max={product.maxLoanAmount || undefined}
          step="0.01"
          inputMode="decimal"
          required
          aria-required="true"
          value={formData.loanAmount}
          onChange={e => onChange('loanAmount', e.target.value)}
          className={inputCls}
          style={errors?.loanAmount ? invalidStyle : baseStyle}
          {...a11yProps('pf-amount', errors?.loanAmount, true)}
        />
      </FieldShell>

      {showTerm && (
        <FieldShell
          id="pf-term"
          label={labels.termLabel}
          required
          error={errors?.loanTerm}
          hint={formatTermHint(product, category)}
        >
          <input
            id="pf-term"
            type="number"
            min={isMortgage ? Math.round((product.minTermMonths || 0) / 12) || undefined : product.minTermMonths || undefined}
            max={isMortgage ? Math.round((product.maxTermMonths || 0) / 12) || undefined : product.maxTermMonths || undefined}
            step="1"
            inputMode="numeric"
            required
            aria-required="true"
            placeholder={isMortgage ? 'e.g. 25' : 'e.g. 12'}
            value={formData.loanTerm}
            onChange={e => onChange('loanTerm', e.target.value)}
            className={inputCls}
            style={errors?.loanTerm ? invalidStyle : baseStyle}
            {...a11yProps('pf-term', errors?.loanTerm, true)}
          />
        </FieldShell>
      )}

      <FieldShell
        id="pf-rate"
        label="Interest rate (%)"
        required
        error={errors?.interestRate}
        hint={rateHint}
      >
        <input
          id="pf-rate"
          type="number"
          step="0.01"
          min={0}
          inputMode="decimal"
          required
          aria-required="true"
          value={formData.interestRate}
          onChange={e => onChange('interestRate', e.target.value)}
          className={inputCls}
          style={errors?.interestRate ? invalidStyle : baseStyle}
          {...a11yProps('pf-rate', errors?.interestRate, !!rateHint)}
        />
      </FieldShell>

      <FieldShell id="pf-purpose" label="Purpose" required error={errors?.loanPurpose}>
        <select
          id="pf-purpose"
          required
          aria-required="true"
          value={formData.loanPurpose}
          onChange={e => onChange('loanPurpose', e.target.value)}
          className={inputCls}
          style={errors?.loanPurpose ? invalidStyle : baseStyle}
          {...a11yProps('pf-purpose', errors?.loanPurpose)}
        >
          <option value="">Select purpose</option>
          {getPurposeOptions(category).map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldShell>
    </Section>
  );
}

// ─── Employment & Income – read-only from customer profile ─────────────
const EMPLOYMENT_LABELS: Record<string, string> = {
  EMPLOYED: 'Employed',
  SELF_EMPLOYED: 'Self-employed',
  BUSINESS_OWNER: 'Business owner',
  RETIRED: 'Retired',
  STUDENT: 'Student',
  HOMEMAKER: 'Homemaker',
  UNEMPLOYED: 'Unemployed',
};

function CustomerIncomeSnapshot({ profile }: { profile: CustomerProfileSnapshot }) {
  const viewField = (label: string, value: string | undefined | null) => (
    <div>
      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </p>
      <p className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
        {value || '—'}
      </p>
    </div>
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          Employment and income
        </h3>
        <span
          className="rounded-full px-3 py-1 text-sm"
          style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-muted)' }}
        >
          Taken from the customer profile
        </span>
      </div>
      <dl
        className="grid grid-cols-1 gap-5 rounded-2xl p-5 md:grid-cols-2"
        style={{ backgroundColor: 'var(--rm-input)' }}
      >
        {viewField(
          'Employment status',
          EMPLOYMENT_LABELS[profile.employmentStatus] || profile.employmentStatus
        )}
        {viewField('Employer name', profile.employerName)}
        {viewField('Occupation', profile.occupation)}
        {viewField(
          'Annual income',
          profile.annualIncome
            ? `${getCurrencySymbol()}${Number(profile.annualIncome).toLocaleString()}`
            : ''
        )}
      </dl>
    </section>
  );
}

// ─── Property section (Mortgage) ────────────────────────────────────────
function PropertyFields({
  formData,
  onChange,
  errors,
}: {
  formData: ProductFormData;
  onChange: ProductFormFieldsProps['onChange'];
  errors?: ProductFormErrors;
}) {
  return (
    <Section title="Property details">
      <div className="md:col-span-2">
        <FieldShell id="pf-property-address" label="Property address" required error={errors?.propertyAddress}>
          <input
            id="pf-property-address"
            type="text"
            required
            aria-required="true"
            value={formData.propertyAddress}
            onChange={e => onChange('propertyAddress', e.target.value)}
            className={inputCls}
            style={errors?.propertyAddress ? invalidStyle : baseStyle}
            {...a11yProps('pf-property-address', errors?.propertyAddress)}
          />
        </FieldShell>
      </div>

      <FieldShell id="pf-property-city" label="City" required error={errors?.propertyCity}>
        <input
          id="pf-property-city"
          type="text"
          required
          aria-required="true"
          placeholder="e.g. Dublin"
          value={formData.propertyCity}
          onChange={e => onChange('propertyCity', e.target.value)}
          className={inputCls}
          style={errors?.propertyCity ? invalidStyle : baseStyle}
          {...a11yProps('pf-property-city', errors?.propertyCity)}
        />
      </FieldShell>

      <FieldShell id="pf-property-state" label="County or region" required error={errors?.propertyState}>
        <input
          id="pf-property-state"
          type="text"
          required
          aria-required="true"
          placeholder="e.g. Co. Dublin"
          value={formData.propertyState}
          onChange={e => onChange('propertyState', e.target.value)}
          className={inputCls}
          style={errors?.propertyState ? invalidStyle : baseStyle}
          {...a11yProps('pf-property-state', errors?.propertyState)}
        />
      </FieldShell>

      <FieldShell id="pf-property-postal" label="Eircode or postcode">
        <input
          id="pf-property-postal"
          type="text"
          placeholder="e.g. D02 X285"
          value={formData.propertyPostalCode}
          onChange={e => onChange('propertyPostalCode', e.target.value)}
          className={inputCls}
          style={baseStyle}
        />
      </FieldShell>

      <FieldShell id="pf-property-type" label="Property type" required error={errors?.propertyType}>
        <select
          id="pf-property-type"
          required
          aria-required="true"
          value={formData.propertyType}
          onChange={e => onChange('propertyType', e.target.value)}
          className={inputCls}
          style={errors?.propertyType ? invalidStyle : baseStyle}
          {...a11yProps('pf-property-type', errors?.propertyType)}
        >
          <option value="">Select type</option>
          <option value="DETACHED_HOUSE">Detached house</option>
          <option value="SEMI_DETACHED">Semi-detached house</option>
          <option value="TERRACED">Terraced house</option>
          <option value="APARTMENT">Apartment or flat</option>
          <option value="BUNGALOW">Bungalow</option>
          <option value="COMMERCIAL">Commercial property</option>
          <option value="MIXED_USE">Mixed use</option>
          <option value="LAND">Land or site</option>
        </select>
      </FieldShell>

      <FieldShell
        id="pf-property-value"
        label={`Estimated property value (${getCurrencySymbol()})`}
        required
        error={errors?.propertyValue}
      >
        <input
          id="pf-property-value"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          required
          aria-required="true"
          value={formData.propertyValue}
          onChange={e => onChange('propertyValue', e.target.value)}
          className={inputCls}
          style={errors?.propertyValue ? invalidStyle : baseStyle}
          {...a11yProps('pf-property-value', errors?.propertyValue)}
        />
      </FieldShell>

      <FieldShell
        id="pf-property-deposit"
        label={`Down payment (${getCurrencySymbol()})`}
        error={errors?.downPaymentAmount}
      >
        <input
          id="pf-property-deposit"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={formData.downPaymentAmount}
          onChange={e => onChange('downPaymentAmount', e.target.value)}
          className={inputCls}
          style={errors?.downPaymentAmount ? invalidStyle : baseStyle}
          {...a11yProps('pf-property-deposit', errors?.downPaymentAmount)}
        />
      </FieldShell>
    </Section>
  );
}

// ─── Vehicle section ────────────────────────────────────────────────────
function VehicleFields({
  formData,
  onChange,
  errors,
}: {
  formData: ProductFormData;
  onChange: ProductFormFieldsProps['onChange'];
  errors?: ProductFormErrors;
}) {
  return (
    <Section title="Vehicle details">
      <FieldShell id="pf-vehicle-make" label="Make" required error={errors?.vehicleMake}>
        <input
          id="pf-vehicle-make"
          type="text"
          required
          aria-required="true"
          placeholder="e.g. Toyota"
          value={formData.vehicleMake}
          onChange={e => onChange('vehicleMake', e.target.value)}
          className={inputCls}
          style={errors?.vehicleMake ? invalidStyle : baseStyle}
          {...a11yProps('pf-vehicle-make', errors?.vehicleMake)}
        />
      </FieldShell>

      <FieldShell id="pf-vehicle-model" label="Model" required error={errors?.vehicleModel}>
        <input
          id="pf-vehicle-model"
          type="text"
          required
          aria-required="true"
          placeholder="e.g. Corolla"
          value={formData.vehicleModel}
          onChange={e => onChange('vehicleModel', e.target.value)}
          className={inputCls}
          style={errors?.vehicleModel ? invalidStyle : baseStyle}
          {...a11yProps('pf-vehicle-model', errors?.vehicleModel)}
        />
      </FieldShell>

      <FieldShell id="pf-vehicle-year" label="Year" required error={errors?.vehicleYear}>
        <input
          id="pf-vehicle-year"
          type="number"
          inputMode="numeric"
          required
          aria-required="true"
          placeholder="e.g. 2025"
          value={formData.vehicleYear}
          onChange={e => onChange('vehicleYear', e.target.value)}
          className={inputCls}
          style={errors?.vehicleYear ? invalidStyle : baseStyle}
          {...a11yProps('pf-vehicle-year', errors?.vehicleYear)}
        />
      </FieldShell>

      <FieldShell id="pf-vehicle-condition" label="Condition" required error={errors?.vehicleCondition}>
        <select
          id="pf-vehicle-condition"
          required
          aria-required="true"
          value={formData.vehicleCondition}
          onChange={e => onChange('vehicleCondition', e.target.value)}
          className={inputCls}
          style={errors?.vehicleCondition ? invalidStyle : baseStyle}
          {...a11yProps('pf-vehicle-condition', errors?.vehicleCondition)}
        >
          <option value="">Select condition</option>
          <option value="NEW">New</option>
          <option value="USED">Used or pre-owned</option>
          <option value="DEMO">Demonstrator</option>
        </select>
      </FieldShell>

      <FieldShell
        id="pf-vehicle-value"
        label={`Estimated vehicle value (${getCurrencySymbol()})`}
        required
        error={errors?.vehicleValue}
      >
        <input
          id="pf-vehicle-value"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          required
          aria-required="true"
          value={formData.vehicleValue}
          onChange={e => onChange('vehicleValue', e.target.value)}
          className={inputCls}
          style={errors?.vehicleValue ? invalidStyle : baseStyle}
          {...a11yProps('pf-vehicle-value', errors?.vehicleValue)}
        />
      </FieldShell>

      <FieldShell
        id="pf-vehicle-deposit"
        label={`Down payment (${getCurrencySymbol()})`}
        error={errors?.downPaymentAmount}
      >
        <input
          id="pf-vehicle-deposit"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={formData.downPaymentAmount}
          onChange={e => onChange('downPaymentAmount', e.target.value)}
          className={inputCls}
          style={errors?.downPaymentAmount ? invalidStyle : baseStyle}
          {...a11yProps('pf-vehicle-deposit', errors?.downPaymentAmount)}
        />
      </FieldShell>
    </Section>
  );
}

// ─── Invoice / Asset Finance section ────────────────────────────────────
function InvoiceAssetFields({
  product,
  formData,
  onChange,
  errors,
}: {
  product: Product;
  formData: ProductFormData;
  onChange: ProductFormFieldsProps['onChange'];
  errors?: ProductFormErrors;
}) {
  const isInvoice = product.productType === 'INVOICE_FINANCE';
  const id = 'pf-asset-description';
  return (
    <Section title={isInvoice ? 'Invoice details' : 'Asset details'}>
      <div className="md:col-span-2">
        <FieldShell
          id={id}
          label={isInvoice ? 'Invoice or debtor description' : 'Asset description'}
          required
          error={errors?.assetDescription}
        >
          <textarea
            id={id}
            rows={3}
            required
            aria-required="true"
            value={formData.assetDescription}
            onChange={e => onChange('assetDescription', e.target.value)}
            className={`${inputCls} resize-y`}
            style={errors?.assetDescription ? invalidStyle : baseStyle}
            {...a11yProps(id, errors?.assetDescription)}
            placeholder={
              isInvoice
                ? 'Describe the invoices or debtors to be financed'
                : 'Describe the assets to be leased'
            }
          />
        </FieldShell>
      </div>
    </Section>
  );
}

// ─── Main composing component ───────────────────────────────────────────
export default function ProductFormFields({
  product,
  formData,
  onChange,
  customerProfile,
  errors,
}: ProductFormFieldsProps) {
  const category = getProductCategory(product.productType);
  const notesId = 'pf-notes';

  return (
    <div className="space-y-8">
      {/* All products get Amount / Rate / Purpose */}
      <AmountRateFields
        product={product}
        formData={formData}
        onChange={onChange}
        errors={errors}
        category={category}
      />

      {/* Mortgage: property details */}
      {category === 'MORTGAGE' && (
        <PropertyFields formData={formData} onChange={onChange} errors={errors} />
      )}

      {/* Vehicle Finance: vehicle details */}
      {category === 'VEHICLE_FINANCE' && (
        <VehicleFields formData={formData} onChange={onChange} errors={errors} />
      )}

      {/* Invoice / Asset Finance: asset details */}
      {category === 'INVOICE_ASSET_FINANCE' && (
        <InvoiceAssetFields product={product} formData={formData} onChange={onChange} errors={errors} />
      )}

      {/* Employment & Income – read-only from customer profile (all products) */}
      {customerProfile && <CustomerIncomeSnapshot profile={customerProfile} />}

      {/* Notes — all products */}
      <FieldShell id={notesId} label="Additional notes">
        <textarea
          id={notesId}
          rows={3}
          value={formData.notes}
          onChange={e => onChange('notes', e.target.value)}
          className={`${inputCls} resize-y`}
          style={baseStyle}
          placeholder="Add any additional information about this application"
        />
      </FieldShell>
    </div>
  );
}
