import { apiClient } from './client';

/**
 * Retail Connects, Send Money and Request Money (BFF-Customer /api/customer/*).
 *
 * Amounts are whole euro cents. Money never moves from the voice or intent endpoints: they only
 * propose a draft, which the customer reviews, confirms and authorises with their password.
 * In this build payments execute against a sandbox rail — see `executionMode`.
 */

export type ConnectKind = 'BANK_CUSTOMER' | 'EXTERNAL_PAYEE';
export type ConnectSource = 'REGISTERED_PAYEE' | 'PAST_TRANSFER';

export interface LastTransfer {
  amountMinor: number;
  currency: string;
  at: string;
  purpose: string | null;
}

export interface Connect {
  connectId: string;
  displayName: string;
  nickname: string | null;
  verifiedName: string | null;
  sources: ConnectSource[];
  kind: ConnectKind;
  maskedIban: string | null;
  maskedPhone: string | null;
  beneficiaryBank: string | null;
  canSend: boolean;
  sendBlockedReason: string | null;
  canRequest: boolean;
  requestBlockedReason: string | null;
  lastTransfer: LastTransfer | null;
}

export interface ConnectList {
  connects: Connect[];
  unresolvedHistoryEntries: number;
}

export interface SourceAccount {
  accountId: string;
  accountName: string;
  maskedIban: string;
  currency: string;
  availableBalance: number;
}

export type DraftStatus =
  | 'REVIEW_REQUIRED'
  | 'CONFIRMED'
  | 'SUBMITTED'
  | 'COMPLETED_SANDBOX'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface SendDraft {
  draftId: string;
  status: DraftStatus;
  recipientName: string;
  recipientMaskedIban: string | null;
  recipientMaskedPhone: string | null;
  amountMinor: number;
  currency: string;
  purpose: string;
  sourceAccountId: string;
  sourceAccountName: string;
  sourceMaskedIban: string;
  version: number;
  nonce: string | null;
  intentSource: 'TEXT' | 'VOICE' | 'REQUEST';
  moneyRequestId: string | null;
  executionMode: 'SANDBOX' | 'LIVE' | null;
  receiptReference: string | null;
  failureReason: string | null;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  lastTransfer: LastTransfer | null;
  replayed: boolean;
  message: string | null;
}

export type RequestStatus =
  | 'SENT'
  | 'VIEWED'
  | 'PAYMENT_PENDING'
  | 'PAID_SANDBOX'
  | 'PAID'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface MoneyRequest {
  requestId: string;
  direction: 'SENT' | 'RECEIVED';
  counterpartyName: string;
  amountMinor: number;
  currency: string;
  purpose: string;
  status: RequestStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  paidDraftId: string | null;
  canPay: boolean;
  canDecline: boolean;
  canCancel: boolean;
  statusNote: string | null;
}

export interface RequestSummary {
  pendingReceived: number;
  pendingSent: number;
}

export type IntentStatus =
  | 'REVIEW_REQUIRED'
  | 'REQUEST_REVIEW'
  | 'NEEDS_CLARIFICATION'
  | 'AMBIGUOUS_RECIPIENT'
  | 'RECIPIENT_NOT_FOUND'
  | 'BLOCKED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'UPDATED'
  | 'UNSUPPORTED'
  | 'AI_UNAVAILABLE';

export interface ParsedIntent {
  action: 'SEND_MONEY' | 'REQUEST_MONEY' | 'UPDATE_AMOUNT' | 'UNKNOWN';
  recipient: string | null;
  amountMinor: number | null;
  purpose: string | null;
  missing: string[];
}

export interface RequestProposal {
  connectId: string;
  amountMinor: number;
  purpose: string;
  source: 'TEXT' | 'VOICE';
}

export interface IntentResponse {
  status: IntentStatus;
  message: string;
  transcript: string;
  parser?: 'LLM' | 'RULES';
  intent?: ParsedIntent;
  matches?: Connect[];
  connect?: Connect;
  draft?: SendDraft;
  proposal?: RequestProposal;
}

export type InputSource = 'TEXT' | 'VOICE';

function newKey(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

let eligibilityCache: { key: string; value: Promise<boolean> } | null = null;

class RetailService {
  /**
   * True for personal (retail) customers. Cached per logged-in user so a different login never inherits the
   * previous answer; failures are not cached, so a transient error doesn't hide the feature until reload.
   */
  eligibility(force = false): Promise<boolean> {
    const key = typeof window === 'undefined' ? '' : (localStorage.getItem('auth_token') ?? '');
    if (!key) return Promise.resolve(false);
    if (!eligibilityCache || eligibilityCache.key !== key || force) {
      const value = apiClient
        .get<{ retail: boolean }>('/api/customer/connects/eligibility')
        .then(r => r.retail === true)
        .catch(() => {
          eligibilityCache = null;
          return false;
        });
      eligibilityCache = { key, value };
    }
    return eligibilityCache.value;
  }

  connects() {
    return apiClient.get<ConnectList>('/api/customer/connects');
  }

  sourceAccounts() {
    return apiClient.get<SourceAccount[]>('/api/customer/money/source-accounts');
  }

  /** Speech to text. The audio is processed in memory server-side and not stored. */
  transcribe(audio: Blob): Promise<{ text: string }> {
    const form = new FormData();
    const ext = audio.type.includes('wav') ? 'wav' : audio.type.includes('mp4') ? 'm4a' : 'webm';
    form.append('audio', audio, `speech.${ext}`);
    return apiClient.postForm<{ text: string }>('/api/customer/voice/transcriptions', form);
  }

  interpret(
    text: string,
    source: InputSource,
    clientRequestId: string,
    draftId?: string
  ): Promise<IntentResponse> {
    return apiClient.post<IntentResponse>('/api/customer/voice/intents', {
      text,
      source,
      clientRequestId,
      context: draftId ? { draftId } : null,
    });
  }

  createDraft(input: {
    connectId: string;
    amountMinor: number;
    purpose: string;
    source: InputSource;
    sourceAccountId?: string;
  }) {
    return apiClient.post<SendDraft>('/api/customer/money/send-drafts', {
      ...input,
      idempotencyKey: newKey('draft'),
    });
  }

  getDraft(id: string) {
    return apiClient.get<SendDraft>(`/api/customer/money/send-drafts/${id}`);
  }

  updateDraft(
    draft: SendDraft,
    changes: { amountMinor?: number; purpose?: string; sourceAccountId?: string }
  ) {
    return apiClient.put<SendDraft>(`/api/customer/money/send-drafts/${draft.draftId}`, {
      expectedVersion: draft.version,
      ...changes,
    });
  }

  confirmDraft(draft: SendDraft) {
    return apiClient.post<SendDraft>(`/api/customer/money/send-drafts/${draft.draftId}/confirm`, {
      expectedVersion: draft.version,
      nonce: draft.nonce,
    });
  }

  /** A 401 here means the password was wrong, so it must never trigger a token refresh/retry. */
  authoriseDraft(draft: SendDraft, password: string, twoFactorCode?: string) {
    return apiClient.postNoRefresh<SendDraft>(
      `/api/customer/money/send-drafts/${draft.draftId}/authorise`,
      {
        expectedVersion: draft.version,
        nonce: draft.nonce,
        password,
        twoFactorCode: twoFactorCode || undefined,
      }
    );
  }

  cancelDraft(id: string) {
    return apiClient.post<SendDraft>(`/api/customer/money/send-drafts/${id}/cancel`);
  }

  createRequest(input: RequestProposal) {
    return apiClient.post<MoneyRequest>('/api/customer/money/requests', {
      ...input,
      idempotencyKey: newKey('request'),
    });
  }

  requests(direction: 'SENT' | 'RECEIVED') {
    return apiClient.get<MoneyRequest[]>(`/api/customer/money/requests?direction=${direction}`);
  }

  requestSummary() {
    return apiClient.get<RequestSummary>('/api/customer/money/requests/summary');
  }

  declineRequest(id: string) {
    return apiClient.post<MoneyRequest>(`/api/customer/money/requests/${id}/decline`);
  }

  cancelRequest(id: string) {
    return apiClient.post<MoneyRequest>(`/api/customer/money/requests/${id}/cancel`);
  }

  /** Returns a draft locked to the request's amount, purpose and recipient. */
  payRequest(id: string, sourceAccountId?: string) {
    return apiClient.post<SendDraft>(`/api/customer/money/requests/${id}/pay`, {
      idempotencyKey: newKey('pay'),
      sourceAccountId,
    });
  }

  newClientRequestId() {
    return newKey('intent');
  }
}

export const retailService = new RetailService();

export function formatEuro(minor: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(minor / 100);
}
