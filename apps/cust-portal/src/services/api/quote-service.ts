import { apiClient } from './client';

/**
 * Quotes are issued by the bank, not calculated in the browser. Every figure a
 * customer sees here is a stored snapshot the bank can reproduce, which is why a
 * failed request surfaces as an error and never falls back to local arithmetic.
 */
export interface Quote {
  quoteId: string;
  productCode: string;
  productName?: string;
  currency: string;
  requestedAmount: number;
  termMonths: number;
  repaymentFrequency: string;
  /** EQUAL_INSTALMENT | INTEREST_ONLY | REVOLVING */
  repaymentStructure: string;
  firstRepaymentDate?: string;

  rateType?: string;
  calculatedRatePct: number;
  /** PRODUCT_RATE_PLAN | PRODUCT_DEFAULT_RATE */
  rateProvenance: string;
  aprcPct?: number;
  /** False when the bank publishes no APRC. Render "not published", never 0%. */
  aprcAvailable: boolean;

  monthlyRepayment: number;
  totalRepayable: number;
  costOfCredit: number;

  /** ILLUSTRATIVE until a decision is made; a quote is not an offer. */
  disclosure: string;
  calculationVersion: string;
  issuedAt: string;
  expiresAt: string;
  validityDays: number;
  expired: boolean;
  snapshotHash: string;
  previousQuoteId?: string;
}

export interface QuoteRequest {
  productCode: string;
  requestedAmount: number;
  termMonths: number;
  repaymentFrequency?: string;
  rateType?: string;
  ratePlanCode?: string;
  firstRepaymentDate?: string;
  previousQuoteId?: string;
  journeyId?: string;
  applicationId?: string;
}

export const quoteService = {
  async issue(request: QuoteRequest): Promise<Quote> {
    return apiClient.post<Quote>('/api/customer/quotes', request);
  },

  async get(quoteId: string): Promise<Quote> {
    return apiClient.get<Quote>(`/api/customer/quotes/${quoteId}`);
  },
};
