'use client';

import { type Product } from '@/services/api/productService';

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
    { value: 'PERSONAL_USE', label: 'Personal Use' },
    { value: 'DEBT_CONSOLIDATION', label: 'Debt Consolidation' },
    { value: 'EDUCATION', label: 'Education' },
    { value: 'MEDICAL', label: 'Medical Expenses' },
    { value: 'WEDDING', label: 'Wedding' },
    { value: 'TRAVEL', label: 'Travel' },
    { value: 'HOME_RENOVATION', label: 'Home Renovation' },
    { value: 'BUSINESS_EXPANSION', label: 'Business Expansion' },
    { value: 'WORKING_CAPITAL', label: 'Working Capital' },
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment Purchase' },
    { value: 'OTHER', label: 'Other' },
  ],
  MORTGAGE: [
    { value: 'HOME_PURCHASE', label: 'Home Purchase' },
    { value: 'HOME_CONSTRUCTION', label: 'Home Construction' },
    { value: 'HOME_RENOVATION', label: 'Home Renovation' },
    { value: 'HOME_REFINANCE', label: 'Refinance Existing Mortgage' },
    { value: 'INVESTMENT', label: 'Investment Property' },
    { value: 'OTHER', label: 'Other' },
  ],
  VEHICLE_FINANCE: [
    { value: 'VEHICLE_PURCHASE', label: 'New Vehicle Purchase' },
    { value: 'PERSONAL_USE', label: 'Used Vehicle Purchase' },
    { value: 'BUSINESS_EXPANSION', label: 'Commercial Vehicle' },
    { value: 'OTHER', label: 'Other' },
  ],
  CREDIT_CARD: [
    { value: 'PERSONAL_USE', label: 'Personal Spending' },
    { value: 'BUSINESS_EXPANSION', label: 'Business Spending' },
    { value: 'TRAVEL', label: 'Travel & Rewards' },
    { value: 'OTHER', label: 'Other' },
  ],
  OVERDRAFT: [
    { value: 'WORKING_CAPITAL', label: 'Cash Flow Management' },
    { value: 'PERSONAL_USE', label: 'Personal Buffer' },
    { value: 'BUSINESS_EXPANSION', label: 'Business Operations' },
    { value: 'OTHER', label: 'Other' },
  ],
  BNPL: [
    { value: 'PERSONAL_USE', label: 'Consumer Purchase' },
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment / Electronics' },
    { value: 'OTHER', label: 'Other' },
  ],
  INVOICE_ASSET_FINANCE: [
    { value: 'WORKING_CAPITAL', label: 'Working Capital' },
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment / Asset Acquisition' },
    { value: 'BUSINESS_EXPANSION', label: 'Business Expansion' },
    { value: 'OTHER', label: 'Other' },
  ],
};

export function getPurposeOptions(category: string) {
  return PURPOSE_OPTIONS[category] || PURPOSE_OPTIONS.TERM_LOAN;
}

// ─── Shared field labels per product category (for amount/term) ─────────
const FIELD_LABELS: Record<string, { amountLabel: string; termLabel: string }> = {
  TERM_LOAN: { amountLabel: 'Loan Amount (€)', termLabel: 'Loan Term (months)' },
  MORTGAGE: { amountLabel: 'Mortgage Amount (€)', termLabel: 'Mortgage Term (years)' },
  VEHICLE_FINANCE: { amountLabel: 'Finance Amount (€)', termLabel: 'Finance Term (months)' },
  CREDIT_CARD: { amountLabel: 'Credit Limit (€)', termLabel: '' },
  OVERDRAFT: { amountLabel: 'Overdraft Limit (€)', termLabel: '' },
  BNPL: { amountLabel: 'Purchase Amount (€)', termLabel: 'Repayment Term (months)' },
  INVOICE_ASSET_FINANCE: {
    amountLabel: 'Facility Amount (€)',
    termLabel: 'Facility Term (months)',
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

// ─── Props ───────────────────────────────────────────────────────────────
interface ProductFormFieldsProps {
  product: Product;
  formData: ProductFormData;
  onChange: (field: keyof ProductFormData, value: string) => void;
}

// ─── Shared input styling ───────────────────────────────────────────────
const inputCls =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-2';
const hintCls = 'mt-1 text-xs text-gray-500';

// ─── Section wrapper ────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
    </div>
  );
}

// ─── Helper: convert months to years if mortgage ────────────────────────
function formatTermHint(product: Product, category: string) {
  if (category === 'MORTGAGE') {
    const minYears = Math.round((product.minTermMonths || 0) / 12);
    const maxYears = Math.round((product.maxTermMonths || 0) / 12);
    return `Range: ${minYears} - ${maxYears} years`;
  }
  return `Range: ${product.minTermMonths} - ${product.maxTermMonths} months`;
}

// ─── Shared: Amount + Rate fields ───────────────────────────────────────
function AmountRateFields({
  product,
  formData,
  onChange,
  category,
}: ProductFormFieldsProps & { category: string }) {
  const labels = getFieldLabels(category);
  const showTerm = labels.termLabel !== '';
  const isMortgage = category === 'MORTGAGE';

  return (
    <Section
      title={
        category === 'CREDIT_CARD'
          ? 'Credit Limit'
          : category === 'OVERDRAFT'
            ? 'Overdraft Details'
            : 'Financing Details'
      }
    >
      <div>
        <label className={labelCls}>{labels.amountLabel} *</label>
        <input
          type="number"
          value={formData.loanAmount}
          onChange={e => onChange('loanAmount', e.target.value)}
          className={inputCls}
          placeholder={`Enter ${labels.amountLabel.toLowerCase().replace(' *', '').replace(' (€)', '')}`}
        />
        <p className={hintCls}>
          Range: €{product.minLoanAmount?.toLocaleString()} – €
          {product.maxLoanAmount?.toLocaleString()}
        </p>
      </div>

      {showTerm && (
        <div>
          <label className={labelCls}>{labels.termLabel} *</label>
          <input
            type="number"
            value={formData.loanTerm}
            onChange={e => onChange('loanTerm', e.target.value)}
            className={inputCls}
            placeholder={isMortgage ? 'e.g. 25' : 'e.g. 12'}
          />
          <p className={hintCls}>{formatTermHint(product, category)}</p>
        </div>
      )}

      {/* Credit cards & overdrafts don't show term, but we need to fill a grid gap */}
      {!showTerm && <div />}

      <div>
        <label className={labelCls}>Interest Rate (%) *</label>
        <input
          type="number"
          step="0.01"
          value={formData.interestRate}
          onChange={e => onChange('interestRate', e.target.value)}
          className={inputCls}
          placeholder="Enter interest rate"
        />
        <p className={hintCls}>
          Range: {product.minInterestRate?.toFixed(2)}% – {product.maxInterestRate?.toFixed(2)}%
        </p>
      </div>

      <div>
        <label className={labelCls}>Purpose *</label>
        <select
          value={formData.loanPurpose}
          onChange={e => onChange('loanPurpose', e.target.value)}
          className={inputCls}
        >
          <option value="">Select purpose</option>
          {getPurposeOptions(category).map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </Section>
  );
}

// ─── Employment & Income section ────────────────────────────────────────
function EmploymentIncomeFields({
  formData,
  onChange,
}: {
  formData: ProductFormData;
  onChange: ProductFormFieldsProps['onChange'];
}) {
  return (
    <Section title="Employment & Income">
      <div>
        <label className={labelCls}>Employment Status</label>
        <select
          value={formData.employmentStatus}
          onChange={e => onChange('employmentStatus', e.target.value)}
          className={inputCls}
        >
          <option value="">Select status</option>
          <option value="EMPLOYED">Employed</option>
          <option value="SELF_EMPLOYED">Self-Employed</option>
          <option value="BUSINESS_OWNER">Business Owner</option>
          <option value="RETIRED">Retired</option>
          <option value="STUDENT">Student</option>
          <option value="HOMEMAKER">Homemaker</option>
          <option value="UNEMPLOYED">Unemployed</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Employer Name</label>
        <input
          type="text"
          value={formData.employerName}
          onChange={e => onChange('employerName', e.target.value)}
          className={inputCls}
          placeholder="Enter employer name"
        />
      </div>

      <div>
        <label className={labelCls}>Annual Income (€)</label>
        <input
          type="number"
          value={formData.annualIncome}
          onChange={e => onChange('annualIncome', e.target.value)}
          className={inputCls}
          placeholder="Enter gross annual income"
        />
      </div>
    </Section>
  );
}

// ─── Property section (Mortgage) ────────────────────────────────────────
function PropertyFields({
  formData,
  onChange,
}: {
  formData: ProductFormData;
  onChange: ProductFormFieldsProps['onChange'];
}) {
  return (
    <Section title="Property Details">
      <div className="md:col-span-2">
        <label className={labelCls}>Property Address *</label>
        <input
          type="text"
          value={formData.propertyAddress}
          onChange={e => onChange('propertyAddress', e.target.value)}
          className={inputCls}
          placeholder="Enter property address"
        />
      </div>

      <div>
        <label className={labelCls}>City *</label>
        <input
          type="text"
          value={formData.propertyCity}
          onChange={e => onChange('propertyCity', e.target.value)}
          className={inputCls}
          placeholder="e.g. Dublin"
        />
      </div>

      <div>
        <label className={labelCls}>County / Region *</label>
        <input
          type="text"
          value={formData.propertyState}
          onChange={e => onChange('propertyState', e.target.value)}
          className={inputCls}
          placeholder="e.g. Co. Dublin"
        />
      </div>

      <div>
        <label className={labelCls}>Eircode / Postcode</label>
        <input
          type="text"
          value={formData.propertyPostalCode}
          onChange={e => onChange('propertyPostalCode', e.target.value)}
          className={inputCls}
          placeholder="e.g. D02 X285"
        />
      </div>

      <div>
        <label className={labelCls}>Property Type *</label>
        <select
          value={formData.propertyType}
          onChange={e => onChange('propertyType', e.target.value)}
          className={inputCls}
        >
          <option value="">Select type</option>
          <option value="DETACHED_HOUSE">Detached House</option>
          <option value="SEMI_DETACHED">Semi-Detached House</option>
          <option value="TERRACED">Terraced House</option>
          <option value="APARTMENT">Apartment / Flat</option>
          <option value="BUNGALOW">Bungalow</option>
          <option value="COMMERCIAL">Commercial Property</option>
          <option value="MIXED_USE">Mixed Use</option>
          <option value="LAND">Land / Site</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Estimated Property Value (€) *</label>
        <input
          type="number"
          value={formData.propertyValue}
          onChange={e => onChange('propertyValue', e.target.value)}
          className={inputCls}
          placeholder="Enter estimated value"
        />
      </div>

      <div>
        <label className={labelCls}>Down Payment Amount (€)</label>
        <input
          type="number"
          value={formData.downPaymentAmount}
          onChange={e => onChange('downPaymentAmount', e.target.value)}
          className={inputCls}
          placeholder="Enter down payment"
        />
        <p className={hintCls}>Minimum typically 10% for first-time buyers, 20% for others</p>
      </div>
    </Section>
  );
}

// ─── Vehicle section ────────────────────────────────────────────────────
function VehicleFields({
  formData,
  onChange,
}: {
  formData: ProductFormData;
  onChange: ProductFormFieldsProps['onChange'];
}) {
  return (
    <Section title="Vehicle Details">
      <div>
        <label className={labelCls}>Make *</label>
        <input
          type="text"
          value={formData.vehicleMake}
          onChange={e => onChange('vehicleMake', e.target.value)}
          className={inputCls}
          placeholder="e.g. Toyota"
        />
      </div>

      <div>
        <label className={labelCls}>Model *</label>
        <input
          type="text"
          value={formData.vehicleModel}
          onChange={e => onChange('vehicleModel', e.target.value)}
          className={inputCls}
          placeholder="e.g. Corolla"
        />
      </div>

      <div>
        <label className={labelCls}>Year *</label>
        <input
          type="number"
          value={formData.vehicleYear}
          onChange={e => onChange('vehicleYear', e.target.value)}
          className={inputCls}
          placeholder="e.g. 2025"
        />
      </div>

      <div>
        <label className={labelCls}>Condition *</label>
        <select
          value={formData.vehicleCondition}
          onChange={e => onChange('vehicleCondition', e.target.value)}
          className={inputCls}
        >
          <option value="">Select condition</option>
          <option value="NEW">New</option>
          <option value="USED">Used / Pre-Owned</option>
          <option value="DEMO">Demonstrator</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Estimated Vehicle Value (€) *</label>
        <input
          type="number"
          value={formData.vehicleValue}
          onChange={e => onChange('vehicleValue', e.target.value)}
          className={inputCls}
          placeholder="Enter vehicle value"
        />
      </div>

      <div>
        <label className={labelCls}>Down Payment (€)</label>
        <input
          type="number"
          value={formData.downPaymentAmount}
          onChange={e => onChange('downPaymentAmount', e.target.value)}
          className={inputCls}
          placeholder="Enter down payment"
        />
      </div>
    </Section>
  );
}

// ─── Invoice / Asset Finance section ────────────────────────────────────
function InvoiceAssetFields({
  product,
  formData,
  onChange,
}: {
  product: Product;
  formData: ProductFormData;
  onChange: ProductFormFieldsProps['onChange'];
}) {
  const isInvoice = product.productType === 'INVOICE_FINANCE';
  return (
    <Section title={isInvoice ? 'Invoice Details' : 'Asset Details'}>
      <div className="md:col-span-2">
        <label className={labelCls}>
          {isInvoice ? 'Invoice / Debtor Description' : 'Asset Description'} *
        </label>
        <textarea
          value={formData.assetDescription}
          onChange={e => onChange('assetDescription', e.target.value)}
          rows={3}
          className={inputCls}
          placeholder={
            isInvoice
              ? 'Describe the invoices / debtors to be financed...'
              : 'Describe the asset(s) to be leased...'
          }
        />
      </div>
    </Section>
  );
}

// ─── Main composing component ───────────────────────────────────────────
export default function ProductFormFields({ product, formData, onChange }: ProductFormFieldsProps) {
  const category = getProductCategory(product.productType);

  return (
    <div className="space-y-8">
      {/* All products get Amount / Rate / Purpose */}
      <AmountRateFields
        product={product}
        formData={formData}
        onChange={onChange}
        category={category}
      />

      {/* Mortgage: property + income */}
      {category === 'MORTGAGE' && (
        <>
          <PropertyFields formData={formData} onChange={onChange} />
          <EmploymentIncomeFields formData={formData} onChange={onChange} />
        </>
      )}

      {/* Vehicle Finance: vehicle details */}
      {category === 'VEHICLE_FINANCE' && <VehicleFields formData={formData} onChange={onChange} />}

      {/* Term Loans: employment & income */}
      {category === 'TERM_LOAN' && (
        <EmploymentIncomeFields formData={formData} onChange={onChange} />
      )}

      {/* Credit Card / Overdraft: income only */}
      {(category === 'CREDIT_CARD' || category === 'OVERDRAFT') && (
        <Section title="Income Information">
          <div>
            <label className={labelCls}>Annual Income (€)</label>
            <input
              type="number"
              value={formData.annualIncome}
              onChange={e => onChange('annualIncome', e.target.value)}
              className={inputCls}
              placeholder="Enter gross annual income"
            />
          </div>
          <div>
            <label className={labelCls}>Employment Status</label>
            <select
              value={formData.employmentStatus}
              onChange={e => onChange('employmentStatus', e.target.value)}
              className={inputCls}
            >
              <option value="">Select status</option>
              <option value="EMPLOYED">Employed</option>
              <option value="SELF_EMPLOYED">Self-Employed</option>
              <option value="BUSINESS_OWNER">Business Owner</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
        </Section>
      )}

      {/* Invoice / Asset Finance: asset details */}
      {category === 'INVOICE_ASSET_FINANCE' && (
        <>
          <InvoiceAssetFields product={product} formData={formData} onChange={onChange} />
          <EmploymentIncomeFields formData={formData} onChange={onChange} />
        </>
      )}

      {/* BNPL: minimal — just notes */}

      {/* Notes — all products */}
      <div>
        <label className={labelCls}>Additional Notes</label>
        <textarea
          value={formData.notes}
          onChange={e => onChange('notes', e.target.value)}
          rows={3}
          className={inputCls}
          placeholder="Enter any additional information about this application..."
        />
      </div>
    </div>
  );
}
