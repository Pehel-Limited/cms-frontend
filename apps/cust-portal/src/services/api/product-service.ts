import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────────

export interface LoanProduct {
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  productCategory: string;
  productStatus: string;

  // Descriptions
  shortDescription?: string;
  detailedDescription?: string;
  marketingDescription?: string;
  termsAndConditions?: string;

  // Eligibility
  eligibleCustomerTypes?: string[];
  minCustomerAge?: number;
  maxCustomerAge?: number;
  minCreditScore?: number;
  minAnnualIncome?: number;
  minYearsInBusiness?: number;
  minBusinessRevenue?: number;

  // Loan amounts
  minLoanAmount: number;
  maxLoanAmount: number;
  defaultLoanAmount?: number;

  // Interest
  interestType?: string;
  minInterestRate: number;
  maxInterestRate: number;
  defaultInterestRate?: number;

  // Terms
  minTermMonths: number;
  maxTermMonths: number;
  defaultTermMonths?: number;
  repaymentFrequency?: string;

  // Fees
  processingFee?: number;
  processingFeePercentage?: number;
  latePaymentFee?: number;

  // Features
  prepaymentAllowed?: boolean;
  prepaymentPenaltyPercentage?: number;
  collateralRequired?: boolean;
  collateralTypes?: string[];
  loanToValueRatio?: number;
  downPaymentRequired?: boolean;
  minDownPaymentPercentage?: number;
  requiresGuarantor?: boolean;
  minGuarantors?: number;

  // Flags
  isFeatured?: boolean;
  isOnlineApplicationEnabled?: boolean;

  // SLA
  slaDays?: number;
}

export interface EligibilityCheck {
  status: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_REVIEW';
  summary: string;
  checks: EligibilityCheckItem[];
  canApply: boolean;
}

export interface EligibilityCheckItem {
  criterion: string;
  result: 'PASS' | 'FAIL' | 'SKIPPED';
  detail: string;
}

/**
 * Admin-managed interest rate plan (LTV band / fixed-term tier / green
 * discount) linked to a specific product. Replaces the old static frontend
 * rate table — rates are now fetched live from the product's own pricing
 * sheet so the wizard always reflects what the bank has configured.
 */
export interface RatePlan {
  ratePlanId: string;
  productId: string;
  planCode: string;
  label: string;
  rateType: string;
  ltvMinPercentage?: number;
  ltvMaxPercentage?: number;
  fixedTermYears?: number;
  interestRate: number;
  aprc?: number;
  costPerThousand?: number;
  isGreen?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

// ─── Product Type Labels ───────────────────────────────────────────

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  PERSONAL_LOAN: 'Personal Loan',
  AUTO_LOAN: 'Auto Loan',
  HOME_LOAN: 'Home Loan',
  MORTGAGE: 'Mortgage',
  BUSINESS_LOAN: 'Business Loan',
  BUSINESS_LINE_OF_CREDIT: 'Business Line of Credit',
  WORKING_CAPITAL_LOAN: 'Working Capital',
  EQUIPMENT_FINANCING: 'Equipment Financing',
  COMMERCIAL_REAL_ESTATE: 'Commercial Real Estate',
  CONSTRUCTION_LOAN: 'Construction Loan',
  AGRICULTURE_LOAN: 'Agriculture Loan',
  STUDENT_LOAN: 'Student Loan',
  CREDIT_CARD: 'Credit Card',
  OVERDRAFT: 'Overdraft',
  BRIDGE_LOAN: 'Bridge Loan',
  TERM_LOAN: 'Term Loan',
  REVOLVING_CREDIT: 'Revolving Credit',
  // Irish / SME specialized types (migration 011)
  PCP: 'Personal Contract Purchase',
  HIRE_PURCHASE: 'Hire Purchase',
  BNPL: 'Buy Now Pay Later',
  SME_TERM_LOAN: 'SME Term Loan',
  BUSINESS_OVERDRAFT: 'Business Overdraft',
  INVOICE_FINANCE: 'Invoice Finance',
  BUSINESS_CREDIT_CARD: 'Business Credit Card',
  COMMERCIAL_MORTGAGE: 'Commercial Mortgage',
  ASSET_LEASING: 'Asset Leasing',
  AGRI_LOAN: 'Agri-Loan',
  CREDIT_UNION_LOAN: 'Credit Union Loan',
  GREEN_LOAN: 'Green Loan',
  MICROFINANCE: 'Microfinance Loan',
};

export const PRODUCT_TYPE_ICONS: Record<string, string> = {
  PERSONAL_LOAN: '💰',
  AUTO_LOAN: '🚗',
  HOME_LOAN: '🏠',
  MORTGAGE: '🏦',
  BUSINESS_LOAN: '💼',
  BUSINESS_LINE_OF_CREDIT: '📊',
  WORKING_CAPITAL_LOAN: '🔄',
  EQUIPMENT_FINANCING: '⚙️',
  COMMERCIAL_REAL_ESTATE: '🏢',
  CONSTRUCTION_LOAN: '🏗️',
  AGRICULTURE_LOAN: '🌾',
  STUDENT_LOAN: '🎓',
  CREDIT_CARD: '💳',
  OVERDRAFT: '📈',
  BRIDGE_LOAN: '🌉',
  TERM_LOAN: '📅',
  REVOLVING_CREDIT: '🔁',
  PCP: '🚘',
  HIRE_PURCHASE: '🚙',
  BNPL: '🛍️',
  SME_TERM_LOAN: '🏭',
  BUSINESS_OVERDRAFT: '📈',
  INVOICE_FINANCE: '🧾',
  BUSINESS_CREDIT_CARD: '💳',
  COMMERCIAL_MORTGAGE: '🏢',
  ASSET_LEASING: '📦',
  AGRI_LOAN: '🌾',
  CREDIT_UNION_LOAN: '🤝',
  GREEN_LOAN: '🌱',
  MICROFINANCE: '🪙',
};

// ─── Credit Need → Product Matching ────────────────────────────────

/**
 * Maps AI Credit Assistant intent codes (IntentCatalog) to the loan_product
 * types that are relevant for that need. Used to refine "matching products"
 * shown after a credit need review is confirmed, instead of a generic
 * browse-all-products link.
 */
export const INTENT_TO_PRODUCT_TYPES: Record<string, string[]> = {
  HOME_PURCHASE: ['MORTGAGE', 'HOME_LOAN', 'GREEN_LOAN'],
  VEHICLE_PURCHASE: ['AUTO_LOAN', 'PCP', 'HIRE_PURCHASE'],
  BUSINESS_EQUIPMENT_PURCHASE: ['ASSET_LEASING', 'EQUIPMENT_FINANCING', 'SME_TERM_LOAN'],
  CASH_FLOW_MANAGEMENT: ['BUSINESS_OVERDRAFT', 'INVOICE_FINANCE', 'OVERDRAFT', 'WORKING_CAPITAL_LOAN'],
  COMMERCIAL_PROPERTY_PURCHASE: ['COMMERCIAL_MORTGAGE', 'COMMERCIAL_REAL_ESTATE'],
  BUSINESS_EXPANSION: ['BUSINESS_LOAN', 'SME_TERM_LOAN', 'TERM_LOAN'],
  REFINANCE_EXISTING_BORROWING: ['MORTGAGE', 'BUSINESS_LOAN', 'PERSONAL_LOAN'],
  PERSONAL_BORROWING: ['PERSONAL_LOAN', 'CREDIT_UNION_LOAN', 'MICROFINANCE'],
  OVERDRAFT: ['OVERDRAFT', 'BUSINESS_OVERDRAFT'],
  CREDIT_CARD: ['CREDIT_CARD', 'BUSINESS_CREDIT_CARD'],
  OTHER: [],
};

/**
 * Refines a product list down to the ones relevant for a confirmed credit
 * need: filters by the purpose's mapped product types, then ranks products
 * whose amount range fits the customer's estimated cost first (products
 * outside the amount range are kept — e.g. a Green Loan top-up alongside a
 * Home Mortgage — just ranked lower).
 *
 * `borrowerSegment` / `assetCategory` (from `CreditNeedFacts`) refine the
 * candidate list further — mirroring how AIB/BOI route the same "purpose"
 * to entirely different product lines depending on who the borrower is and
 * what specific asset is being financed (e.g. a farm buying machinery gets
 * routed to `AGRI_LOAN`, not the generic SME asset-finance products).
 */
const SME_ONLY_PRODUCT_TYPES = new Set([
  'SME_TERM_LOAN', 'BUSINESS_OVERDRAFT', 'INVOICE_FINANCE', 'BUSINESS_CREDIT_CARD',
  'COMMERCIAL_MORTGAGE', 'BUSINESS_LOAN', 'WORKING_CAPITAL_LOAN',
]);

export function resolveCandidateProductTypes(
  purposeCode: string | null | undefined,
  borrowerSegment?: string | null,
  assetCategory?: string | null
): string[] {
  const base = purposeCode ? INTENT_TO_PRODUCT_TYPES[purposeCode] ?? [] : [];
  let candidates = [...base];

  const isFarm = borrowerSegment === 'FARM_AGRICULTURE' || assetCategory === 'AGRICULTURAL_MACHINERY';
  const isGreen = assetCategory === 'RENEWABLE_ENERGY';
  const isPersonal = borrowerSegment === 'PERSONAL';
  const isBusinessLike = borrowerSegment === 'COMPANY' || borrowerSegment === 'SOLE_TRADER' || borrowerSegment === 'PARTNERSHIP';

  if (isFarm) {
    candidates = ['AGRI_LOAN', ...candidates];
  }
  if (isGreen) {
    candidates = ['GREEN_LOAN', ...candidates];
  }
  if (purposeCode === 'VEHICLE_PURCHASE' && isBusinessLike) {
    // A company/sole-trader vehicle is financed as a business asset, not a personal car loan.
    candidates = ['HIRE_PURCHASE', 'ASSET_LEASING', 'SME_TERM_LOAN', ...candidates];
  }
  if (isPersonal) {
    candidates = candidates.filter(t => !SME_ONLY_PRODUCT_TYPES.has(t));
    if (candidates.length === 0) {
      candidates = ['PERSONAL_LOAN', 'HIRE_PURCHASE', 'PCP', 'CREDIT_UNION_LOAN'];
    }
  }

  return Array.from(new Set(candidates));
}

export function matchProductsForIntent(
  products: LoanProduct[],
  purposeCode: string | null | undefined,
  estimatedCost?: number | null,
  borrowerSegment?: string | null,
  assetCategory?: string | null
): LoanProduct[] {
  const types = resolveCandidateProductTypes(purposeCode, borrowerSegment, assetCategory);
  let matched =
    types.length > 0
      ? products.filter(p => types.includes(p.productType))
      : products.filter(p => p.isFeatured);

  if (matched.length === 0) {
    matched = products.filter(p => p.isFeatured);
  }

  if (types.length > 0) {
    matched = [...matched].sort((a, b) => types.indexOf(a.productType) - types.indexOf(b.productType));
  }

  if (estimatedCost != null && estimatedCost > 0) {
    const fits = (p: LoanProduct) => estimatedCost >= p.minLoanAmount && estimatedCost <= p.maxLoanAmount;
    matched = [...matched].sort((a, b) => Number(fits(b)) - Number(fits(a)));
  }

  return matched;
}

// ─── API Functions ─────────────────────────────────────────────────

export const productService = {
  /** List active products for the customer's bank */
  async getProducts(params?: {
    type?: string;
    category?: string;
    featured?: boolean;
  }): Promise<LoanProduct[]> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.featured) searchParams.set('featured', 'true');
    const qs = searchParams.toString();
    return apiClient.get<LoanProduct[]>(`/api/customer/products${qs ? `?${qs}` : ''}`);
  },

  /** Get product detail by product code */
  async getProductByCode(code: string): Promise<LoanProduct> {
    return apiClient.get<LoanProduct>(`/api/customer/products/${code}`);
  },

  /** Run eligibility pre-check */
  async checkEligibility(code: string): Promise<EligibilityCheck> {
    return apiClient.post<EligibilityCheck>(`/api/customer/products/${code}/eligibility-check`);
  },

  /**
   * Active, admin-managed rate plans for a product (LTV bands / fixed-term
   * tiers / green discounts). Returns an empty array for products that have
   * no rate plans configured — callers should fall back to the product's
   * flat min/max/default interest rate in that case.
   */
  async getRatePlans(code: string): Promise<RatePlan[]> {
    return apiClient.get<RatePlan[]>(`/api/customer/products/${code}/rate-plans`);
  },
};
