import config from '@/config';

/**
 * Client for the Document Extraction Agent — AI_roadmap.md §15.1/§316.
 * Uploads a bank statement/payslip and gets back a DRAFT of extracted
 * financial facts for the customer to review before it prefills the
 * Financial Info / Employment wizard steps. Uses a raw multipart fetch
 * (not the JSON-only `apiClient`) since this is a file upload.
 */

export type DocumentType = 'BANK_STATEMENT' | 'PAYSLIP';

export interface DocumentExtractionResult {
  runId: string | null;
  status: 'DRAFT' | 'FAILED' | 'NOT_GENERATED' | 'AI_PROVIDER_UNAVAILABLE';
  humanReviewRequired: boolean;
  documentType: DocumentType;
  extractionMethod: 'TEXT' | 'VISION' | null;
  generatedAt: string | null;
  model: string | null;
  extractedFields: Record<string, unknown>;
  citations: string[];
  warnings: string[];
  errorMessage: string | null;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(config.auth.tokenKey) : null;
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['X-User-Id'] = userId;
  return headers;
}

export const documentExtractionService = {
  async extract(documentType: DocumentType, file: File): Promise<DocumentExtractionResult> {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);

    const res = await fetch(`${config.api.baseUrl}/api/customer/ai/documents/extract`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Document extraction failed');
    }
    return res.json();
  },

  async getLatest(documentType: DocumentType): Promise<DocumentExtractionResult> {
    const res = await fetch(
      `${config.api.baseUrl}/api/customer/ai/documents/extract/latest?documentType=${documentType}`,
      { headers: authHeaders() }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to load extraction draft');
    }
    return res.json();
  },
};
