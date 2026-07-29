import { apiClient } from './client';

/**
 * Parallel AI-first Credit Case Manager journey (Rayva AI Assistant) —
 * Need Discovery -> Intent Review slice (AI_FIRST_CUSTOMER_LOAN_JOURNEY.md §21).
 * Talks to bff-customer's /api/customer/ai/credit-journeys/** endpoints, which
 * are gated by customer.ai-credit-agent.enabled (returns 404 when disabled).
 */

export interface IntentOption {
  code: string;
  label: string;
  description: string;
}

/**
 * Client-side mirror of ai-assistant-service's `IntentCatalog` (fixed,
 * bank-approved purpose codes — AI_FIRST_CUSTOMER_LOAN_JOURNEY.md §2.1).
 * Used to render intent option chips immediately, before a journey has been
 * started (the server only returns `intentOptions` as part of a
 * `CreditJourney`, which doesn't exist yet on the first screen).
 */
export const DEFAULT_INTENT_OPTIONS: IntentOption[] = [
  { code: 'BUSINESS_EQUIPMENT_PURCHASE', label: 'Buy business equipment', description: 'Finance for machinery, tools or other business equipment' },
  { code: 'CASH_FLOW_MANAGEMENT', label: 'Manage short-term cash flow', description: 'Cover short-term working capital needs' },
  { code: 'COMMERCIAL_PROPERTY_PURCHASE', label: 'Purchase business premises', description: 'Finance to buy commercial property' },
  { code: 'VEHICLE_PURCHASE', label: 'Buy a vehicle', description: 'Finance for a car, van or other vehicle' },
  { code: 'BUSINESS_EXPANSION', label: 'Grow or expand my business', description: 'Finance to grow or expand an existing business' },
  { code: 'REFINANCE_EXISTING_BORROWING', label: 'Refinance existing borrowing', description: 'Replace or restructure existing borrowing' },
  { code: 'HOME_PURCHASE', label: 'Buy a home', description: 'Finance to purchase a residential property' },
  { code: 'PERSONAL_BORROWING', label: 'Personal borrowing', description: 'General personal finance needs' },
  { code: 'OVERDRAFT', label: 'Arrange an overdraft', description: 'An overdraft facility on an existing account' },
  { code: 'CREDIT_CARD', label: 'Apply for a credit card', description: 'A new credit card' },
  { code: 'OTHER', label: 'Something else', description: "A credit need that doesn't fit the options above" },
];

/** Structured interpretation of the customer's credit need (CreditNeedDraft). */
export interface CreditNeedFacts {
  purpose: string;
  rawDescription?: string | null;
  assetCondition?: string | null;
  estimatedCost?: number | null;
  currency?: string | null;
  targetDate?: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  needsClarification: boolean;
  clarifyingQuestion?: string | null;
  customerExplanation?: string | null;
}

export interface StageReview {
  reviewId: string;
  stageCode: string;
  reviewVersion: number;
  status: 'DRAFT' | 'PRESENTED' | 'CONFIRMED' | 'SUPERSEDED' | string;
  facts: CreditNeedFacts;
  presentedAt?: string | null;
  confirmedAt?: string | null;
}

export interface ConversationMessage {
  messageId: string;
  role: 'CUSTOMER' | 'AGENT' | 'SYSTEM_NOTICE' | string;
  content: string;
  stageCode?: string | null;
  createdAt: string;
}

export interface ConfirmedFact {
  factKey: string;
  value: unknown;
  provenanceType: string;
  version: number;
  confirmedAt?: string | null;
}

export interface CreditJourney {
  journeyId: string;
  bankId: string;
  customerId: string;
  status: string;
  currentStage: string;
  pausedReason?: string | null;
  lastActiveAt?: string | null;
  currentReview: StageReview | null;
  recentMessages: ConversationMessage[];
  confirmedFacts: ConfirmedFact[];
  intentOptions: IntentOption[];
}

export const aiCreditJourneyService = {
  /** Start a new journey with a free-text message and/or a selected intent code. */
  async start(initialMessage?: string, selectedIntentCode?: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>('/api/customer/ai/credit-journeys', {
      initialMessage,
      selectedIntentCode,
    });
  },

  async getJourney(journeyId: string): Promise<CreditJourney> {
    return apiClient.get<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}`);
  },

  async sendMessage(journeyId: string, message: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}/messages`, {
      message,
    });
  },

  async selectIntent(journeyId: string, intentCode: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(
      `/api/customer/ai/credit-journeys/${journeyId}/intent-selection`,
      { intentCode }
    );
  },

  async confirmReview(journeyId: string, reviewId: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(
      `/api/customer/ai/credit-journeys/${journeyId}/reviews/${reviewId}/confirm`
    );
  },

  async requestRevision(
    journeyId: string,
    reviewId: string,
    updatedFacts: Record<string, unknown>
  ): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(
      `/api/customer/ai/credit-journeys/${journeyId}/reviews/${reviewId}/request-revision`,
      { updatedFacts }
    );
  },

  async pause(journeyId: string, reason?: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}/pause`, {
      reason,
    });
  },

  async resume(journeyId: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}/resume`);
  },
};
