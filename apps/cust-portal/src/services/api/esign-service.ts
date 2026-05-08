import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────

export type EsignOverallStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PARTIALLY_SIGNED'
  | 'COMPLETED'
  | 'DECLINED';

export type EnvelopeStatus =
  | 'CREATED'
  | 'SENT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'VOIDED'
  | 'EXPIRED';

export interface SignerProgress {
  id: string;
  envelopeId: string;
  email: string;
  name: string;
  status: EnvelopeStatus;
  signerOrder: number;
  sentAt: string | null;
  deliveredAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
}

export interface EsignStatus {
  overallStatus: EsignOverallStatus;
  signers: SignerProgress[];
  completedCount: number;
  totalCount: number;
}

export interface EsignStartResult {
  signingUrl: string;
  envelopeId: string;
  envelopeDbId: string;
}

// ─── Status helpers ────────────────────────────────────────────

export const ESIGN_STATUS_LABELS: Record<EsignOverallStatus, string> = {
  NOT_STARTED: 'Ready to Sign',
  IN_PROGRESS: 'Signing in Progress',
  PARTIALLY_SIGNED: 'Partially Signed',
  COMPLETED: 'All Signed',
  DECLINED: 'Declined',
};

export const ESIGN_STATUS_COLORS: Record<EsignOverallStatus, string> = {
  NOT_STARTED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  PARTIALLY_SIGNED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
};

export const SIGNER_STATUS_COLORS: Record<string, string> = {
  CREATED: 'text-gray-400',
  SENT: 'text-blue-500',
  DELIVERED: 'text-blue-600',
  COMPLETED: 'text-green-600',
  DECLINED: 'text-red-500',
  VOIDED: 'text-gray-400',
  EXPIRED: 'text-amber-500',
};

// ─── Service ───────────────────────────────────────────────────

export const esignService = {
  /** Start embedded signing — returns signing URL */
  async startSigning(
    applicationId: string,
    signerEmail?: string,
    signerName?: string,
    returnUrl?: string
  ): Promise<EsignStartResult> {
    return apiClient.post<EsignStartResult>(
      `/api/customer/applications/${applicationId}/esign/start`,
      { signerEmail, signerName, returnUrl }
    );
  },

  /** Get e-sign status with signer progress */
  async getStatus(applicationId: string): Promise<EsignStatus> {
    return apiClient.get<EsignStatus>(`/api/customer/applications/${applicationId}/esign/status`);
  },

  /** Simulate signing completion (dev/test) */
  async simulateComplete(applicationId: string, envelopeId: string): Promise<void> {
    return apiClient.post<void>(`/api/customer/applications/${applicationId}/esign/complete`, {
      envelopeId,
    });
  },
};
