import config from '@/config';

/**
 * Client for the Document Extraction Agent — AI_roadmap.md §15.1/§316.
 * Uploads a bank statement/payslip and gets back a DRAFT of extracted
 * financial facts for the customer to review before it prefills the
 * Financial Info / Employment wizard steps. Uses a raw multipart fetch
 * (not the JSON-only `apiClient`) since this is a file upload.
 *
 * A customer can hold several documents of the same type at once — statements
 * from different banks are separate evidence — so the API lists and removes
 * documents rather than returning "the" latest one.
 */

export type DocumentType = 'BANK_STATEMENT' | 'PAYSLIP';

export interface DocumentExtractionResult {
  runId: string | null;
  status: 'DRAFT' | 'FAILED' | 'AI_PROVIDER_UNAVAILABLE';
  humanReviewRequired: boolean;
  documentType: DocumentType;
  /** Which source document this came from; pass back to remove it. */
  documentKey: string | null;
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

async function failure(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  throw new Error(err.message || fallback);
}

const BASE = () => `${config.api.baseUrl}/api/customer/ai/documents`;

export const documentExtractionService = {
  async extract(
    documentType: DocumentType,
    file: File,
    signal?: AbortSignal
  ): Promise<DocumentExtractionResult> {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);

    const res = await fetch(`${BASE()}/extract`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
      signal,
    });
    if (!res.ok) return failure(res, 'Document extraction failed');
    return res.json();
  },

  /** Every document of this type on file, newest first. Empty means nothing uploaded yet. */
  async list(documentType: DocumentType): Promise<DocumentExtractionResult[]> {
    const res = await fetch(`${BASE()}/extract/documents?documentType=${documentType}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return failure(res, 'Failed to load extracted documents');
    return res.json();
  },

  async remove(documentType: DocumentType, documentKey: string): Promise<void> {
    const res = await fetch(
      `${BASE()}/extract/documents?documentType=${documentType}&documentKey=${encodeURIComponent(documentKey)}`,
      { method: 'DELETE', headers: authHeaders() }
    );
    if (!res.ok) return failure(res, 'Failed to remove the document');
  },
};
