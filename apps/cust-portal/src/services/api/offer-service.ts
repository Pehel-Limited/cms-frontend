import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────

export type OfferStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'EXPIRED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTERED'
  | 'VOIDED';

export interface Offer {
  id: string;
  applicationId: string;
  offerNumber: string;
  version: number;
  status: OfferStatus;
  amount: number;
  currency: string;
  termMonths: number;
  interestRate: number;
  rateType: 'FIXED' | 'VARIABLE';
  apr: number | null;
  repaymentEstimate: number | null;
  repaymentFrequency: string;
  fees: Record<string, unknown> | null;
  issuedAt: string | null;
  expiryAt: string | null;
  acceptedAt: string | null;
  voidReason: string | null;
  createdAt: string | null;
}

export type ConditionStatus = 'PENDING' | 'SATISFIED' | 'WAIVED';

export interface OfferCondition {
  id: string;
  offerId: string;
  conditionType: string;
  description: string;
  status: ConditionStatus;
  isMandatory: boolean;
  satisfiedAt: string | null;
  satisfiedBy: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  notes: string | null;
}

export interface OfferWithConditions {
  offer: Offer | null;
  conditions: OfferCondition[];
}

export interface CounterOfferPayload {
  proposedAmount?: number;
  proposedTermMonths?: number;
  proposedRate?: number;
  notes?: string;
}

// ─── Status helpers ────────────────────────────────────────────

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Pending Review',
  EXPIRED: 'Expired',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  COUNTERED: 'Counter Sent',
  VOIDED: 'Voided',
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  COUNTERED: 'bg-purple-100 text-purple-700',
  VOIDED: 'bg-gray-100 text-gray-500',
};

// ─── Service ───────────────────────────────────────────────────

export const offerService = {
  /** Fetch latest offer with its conditions */
  async getLatestOffer(applicationId: string): Promise<OfferWithConditions> {
    return apiClient.get<OfferWithConditions>(`/api/customer/applications/${applicationId}/offer`);
  },

  /** Fetch all offer versions */
  async getAllOffers(applicationId: string): Promise<Offer[]> {
    return apiClient.get<Offer[]>(`/api/customer/applications/${applicationId}/offers`);
  },

  /** Accept an offer */
  async acceptOffer(applicationId: string, offerId: string): Promise<void> {
    return apiClient.post<void>(
      `/api/customer/applications/${applicationId}/offer/${offerId}/accept`,
      {}
    );
  },

  /** Reject an offer */
  async rejectOffer(applicationId: string, offerId: string, reason?: string): Promise<void> {
    return apiClient.post<void>(
      `/api/customer/applications/${applicationId}/offer/${offerId}/reject`,
      { reason: reason || null }
    );
  },

  /** Submit a counter-offer */
  async counterOffer(
    applicationId: string,
    offerId: string,
    payload: CounterOfferPayload
  ): Promise<Offer> {
    return apiClient.post<Offer>(
      `/api/customer/applications/${applicationId}/offer/${offerId}/counter`,
      payload
    );
  },
};
