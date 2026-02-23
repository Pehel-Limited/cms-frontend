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
};

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
};
