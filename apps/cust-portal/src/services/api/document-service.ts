import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────

export type DocumentCategory =
  | 'IDENTITY'
  | 'ADDRESS_PROOF'
  | 'INCOME_PROOF'
  | 'BANK_STATEMENT'
  | 'TAX_RETURN'
  | 'EMPLOYMENT_LETTER'
  | 'BUSINESS_REGISTRATION'
  | 'FINANCIAL_STATEMENT'
  | 'COLLATERAL'
  | 'INSURANCE'
  | 'LEGAL'
  | 'SIGNED_AGREEMENT'
  | 'OTHER';

export type UploadStatus =
  | 'INITIATED'
  | 'UPLOADED'
  | 'VIRUS_CHECK_PENDING'
  | 'VIRUS_CHECK_PASSED'
  | 'VIRUS_CHECK_FAILED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export type DocRequestStatus =
  | 'PENDING'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'WAIVED'
  | 'EXPIRED';

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  bankId: string | null;
  ownerType: string;
  ownerId: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  storageKey: string | null;
  checksum: string | null;
  version: number;
  uploadStatus: UploadStatus;
  virusScanResult: string | null;
  virusScannedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  notes: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface DocumentRequest {
  id: string;
  applicationId: string;
  category: DocumentCategory;
  title: string;
  description: string | null;
  required: boolean;
  status: DocRequestStatus;
  requestedBy: string | null;
  taskId: string | null;
  fulfilledDocId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApplicationDocumentsResponse {
  documents: ApplicationDocument[];
  requests: DocumentRequest[];
  applicationId: string;
  totalDocuments: number;
  totalRequiredRequests: number;
  pendingRequiredRequests: number;
  allRequiredFulfilled: boolean;
}

export interface DocumentSummary {
  applicationId: string;
  totalDocuments: number;
  totalRequiredRequests: number;
  pendingRequiredRequests: number;
  allRequiredFulfilled: boolean;
}

export interface UploadDocumentPayload {
  category: DocumentCategory;
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  requestId?: string;
  notes?: string;
}

// ─── Labels & Colours ──────────────────────────────────────────

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  IDENTITY: 'Identity Document',
  ADDRESS_PROOF: 'Address Proof',
  INCOME_PROOF: 'Income Proof',
  BANK_STATEMENT: 'Bank Statement',
  TAX_RETURN: 'Tax Return',
  EMPLOYMENT_LETTER: 'Employment Letter',
  BUSINESS_REGISTRATION: 'Business Registration',
  FINANCIAL_STATEMENT: 'Financial Statement',
  COLLATERAL: 'Collateral Document',
  INSURANCE: 'Insurance',
  LEGAL: 'Legal Document',
  SIGNED_AGREEMENT: 'Signed Agreement',
  OTHER: 'Other',
};

export const UPLOAD_STATUS_LABELS: Record<UploadStatus, string> = {
  INITIATED: 'Uploading…',
  UPLOADED: 'Uploaded',
  VIRUS_CHECK_PENDING: 'Scanning…',
  VIRUS_CHECK_PASSED: 'Uploaded',
  VIRUS_CHECK_FAILED: 'Virus Detected',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

export const UPLOAD_STATUS_COLORS: Record<UploadStatus, string> = {
  INITIATED: 'bg-blue-100 text-blue-700',
  UPLOADED: 'bg-green-100 text-green-700',
  VIRUS_CHECK_PENDING: 'bg-yellow-100 text-yellow-700',
  VIRUS_CHECK_PASSED: 'bg-green-100 text-green-700',
  VIRUS_CHECK_FAILED: 'bg-red-100 text-red-700',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-600',
};

export const REQUEST_STATUS_LABELS: Record<DocRequestStatus, string> = {
  PENDING: 'Pending',
  PARTIALLY_FULFILLED: 'Partial',
  FULFILLED: 'Fulfilled',
  WAIVED: 'Waived',
  EXPIRED: 'Expired',
};

export const REQUEST_STATUS_COLORS: Record<DocRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PARTIALLY_FULFILLED: 'bg-blue-100 text-blue-800',
  FULFILLED: 'bg-green-100 text-green-800',
  WAIVED: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

// ─── Helpers ───────────────────────────────────────────────────

export function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getCategoryIcon(category: DocumentCategory): string {
  const icons: Partial<Record<DocumentCategory, string>> = {
    IDENTITY: '🪪',
    ADDRESS_PROOF: '🏠',
    INCOME_PROOF: '💰',
    BANK_STATEMENT: '🏦',
    TAX_RETURN: '📋',
    EMPLOYMENT_LETTER: '💼',
    BUSINESS_REGISTRATION: '🏢',
    FINANCIAL_STATEMENT: '📊',
    COLLATERAL: '🔒',
    INSURANCE: '🛡️',
    LEGAL: '⚖️',
    SIGNED_AGREEMENT: '✍️',
  };
  return icons[category] || '📄';
}

// ─── Service ───────────────────────────────────────────────────

export const documentService = {
  /** List all documents for the authenticated customer (across applications). */
  async listMyDocuments(): Promise<ApplicationDocument[]> {
    return apiClient.get<ApplicationDocument[]>('/api/customer/documents');
  },

  /** Get documents + requests + summary for a specific application. */
  async getApplicationDocuments(applicationId: string): Promise<ApplicationDocumentsResponse> {
    return apiClient.get<ApplicationDocumentsResponse>(
      `/api/customer/applications/${applicationId}/documents`
    );
  },

  /** Get document summary (counts only). */
  async getDocumentSummary(applicationId: string): Promise<DocumentSummary> {
    return apiClient.get<DocumentSummary>(
      `/api/customer/applications/${applicationId}/documents/summary`
    );
  },

  /** Upload a document for an application. */
  async uploadDocument(
    applicationId: string,
    payload: UploadDocumentPayload
  ): Promise<ApplicationDocument> {
    return apiClient.post<ApplicationDocument>(
      `/api/customer/applications/${applicationId}/documents`,
      payload
    );
  },
};
