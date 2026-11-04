import { apiClient } from './client';

/**
 * The authenticated customer's cards — bff-customer `GET/PUT/PATCH/POST
 * /api/customer/cards/*`, which resolves the caller from the bearer token and refuses any card
 * that is not on an account they can currently view.
 *
 * There is no sample fallback here, deliberately. A card that does not exist cannot be shown as
 * a fixture: a fake "•••• 4827" with a fake expiry invites the customer to believe the bank has
 * issued them a plastic. If this service is unreachable the screen says so and offers a retry.
 */

export type CardStatus = 'ACTIVE' | 'FROZEN' | 'LOST' | 'STOLEN' | 'CLOSED' | 'EXPIRED';
export type CardScheme = 'VISA' | 'MASTERCARD';
export type CardType = 'DEBIT' | 'CREDIT';
export type CardCredentialType = 'PAN' | 'EXPIRY' | 'CVV' | 'PIN';
export type CardRequestType = 'REPLACE_LOST' | 'REPLACE_STOLEN' | 'REISSUE' | 'CANCEL';
export type CardRequestStatus = 'PENDING' | 'IN_PRODUCTION' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface CustomerCard {
  cardId: string;
  accountId: string;
  cardHolderName: string;
  /** The customer's own label. Null means the account name is shown instead. */
  nickname: string | null;
  scheme: CardScheme;
  cardType: CardType;
  status: CardStatus;
  statusReason?: string;
  /** "•••• •••• •••• 1234" — the full number only ever arrives from the reveal call. */
  panMasked: string;
  panLast4: string;
  expiryMonth: number;
  expiryYear: number;
  /** Past the printed expiry date; the status alone does not say this. */
  expired: boolean;
  onlineEnabled: boolean;
  contactlessEnabled: boolean;
  atmEnabled: boolean;
  internationalEnabled: boolean;
  contactlessLimit: number;
  atmDailyLimit: number;
  dailySpendLimit: number;
  currency: string;
  issuedAt?: string;
  activatedAt?: string;
  frozenAt?: string;
  closedAt?: string;
  deliveryStatus: string;
  replacesCardId?: string;
}

export interface CardControlsPatch {
  onlineEnabled?: boolean;
  contactlessEnabled?: boolean;
  atmEnabled?: boolean;
  internationalEnabled?: boolean;
  contactlessLimit?: number;
  atmDailyLimit?: number;
  dailySpendLimit?: number;
}

export interface CardCredential {
  cardId: string;
  credential: CardCredentialType;
  value: string;
  viewedAt: string;
  /** The audit row this reveal wrote. */
  viewId: string;
}

export interface CardRequestRecord {
  requestId: string;
  cardId: string;
  requestType: CardRequestType;
  status: CardRequestStatus;
  reason?: string;
  newCardId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Product ceilings, mirrored from account-service so a client cannot offer a number the bank
    will reject. The server remains the authority. */
export const CARD_LIMIT_MAX = {
  contactless: 100,
  atmDaily: 1000,
  dailySpend: 10000,
} as const;

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  ACTIVE: 'Active',
  FROZEN: 'Frozen',
  LOST: 'Reported lost',
  STOLEN: 'Reported stolen',
  CLOSED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const CARD_REQUEST_LABEL: Record<CardRequestType, string> = {
  REPLACE_LOST: 'Replacement for a lost card',
  REPLACE_STOLEN: 'Replacement for a stolen card',
  REISSUE: 'Reissue this card',
  CANCEL: 'Cancel this card',
};

/** A blocked card cannot be spent with, and only a replacement puts it back in use. */
export const isBlocked = (status: CardStatus) => status === 'LOST' || status === 'STOLEN';

export const expiryLabel = (card: CustomerCard) =>
  `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear % 100).padStart(2, '0')}`;

export const cardService = {
  async getCards(): Promise<CustomerCard[]> {
    const cards = await apiClient.get<CustomerCard[] | null>('/api/customer/cards');
    return cards ?? [];
  },

  setStatus(cardId: string, status: 'ACTIVE' | 'FROZEN', reason?: string): Promise<CustomerCard> {
    return apiClient.put<CustomerCard>(`/api/customer/cards/${cardId}/status`, { status, reason });
  },

  updateControls(cardId: string, patch: CardControlsPatch): Promise<CustomerCard> {
    return apiClient.patch<CustomerCard>(`/api/customer/cards/${cardId}/controls`, patch);
  },

  rename(cardId: string, nickname: string): Promise<CustomerCard> {
    return apiClient.put<CustomerCard>(`/api/customer/cards/${cardId}/nickname`, { nickname });
  },

  /** Returns the secret and writes the audit row. Hold the value in memory only. */
  reveal(cardId: string, credential: CardCredentialType): Promise<CardCredential> {
    return apiClient.post<CardCredential>(`/api/customer/cards/${cardId}/credentials`, { credential });
  },

  createRequest(cardId: string, requestType: CardRequestType, reason?: string): Promise<CardRequestRecord> {
    return apiClient.post<CardRequestRecord>(`/api/customer/cards/${cardId}/requests`, {
      requestType,
      reason,
    });
  },

  async listRequests(cardId: string): Promise<CardRequestRecord[]> {
    const requests = await apiClient.get<CardRequestRecord[] | null>(
      `/api/customer/cards/${cardId}/requests`
    );
    return requests ?? [];
  },
};
