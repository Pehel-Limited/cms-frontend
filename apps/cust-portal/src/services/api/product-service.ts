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

// ─── Credit Need → Product Matching ────────────────────────────────
//
// Removed. This was a hand-maintained purpose -> product-type matrix that decided which products
// the AI assistant offered. It was the only copy of that logic that was not versioned, not
// region-aware and not recorded, so the short list a customer saw could disagree with the one the
// audit trail said they were shown. The suitability rules in loan-origination-service answer it now
// against solution_category on the product, and the journey returns the result.

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
