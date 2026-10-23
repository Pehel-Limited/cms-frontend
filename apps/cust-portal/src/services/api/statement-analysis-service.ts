import config from '@/config';

/**
 * Client for the cross-statement cash-flow analysis. One call covers every statement the
 * application has: the accounts the customer holds with the bank (only once they consent) and
 * every bank statement they uploaded.
 *
 * The figures are summed from individual transaction lines in service code, never by the model —
 * the model's job ends at reading a line off a page. What comes back is still a draft the customer
 * has to apply.
 */

export type SourceKind = 'BANK_RECORDS' | 'UPLOADED';

export interface SourceBreakdown {
  label: string;
  kind: SourceKind;
  currency: string;
  lineCount: number;
  firstDate: string;
  lastDate: string;
  credits: number;
  debits: number;
}

export interface MonthTotals {
  month: string;
  credits: number;
  debits: number;
  net: number;
  lineCount: number;
}

export interface CurrencyTotals {
  currency: string;
  credits: number;
  debits: number;
  net: number;
  monthsCovered: number;
  months: MonthTotals[];
  suggestedFields: Record<string, string>;
}

export interface CashFlowAnalysis {
  generatedAt: string;
  humanReviewRequired: boolean;
  basis: string;
  from: string;
  to: string;
  windowMonths: number;
  includesBankRecords: boolean;
  sources: SourceBreakdown[];
  byCurrency: CurrencyTotals[];
  suggestedFields: Record<string, string>;
  warnings: string[];
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(config.auth.tokenKey) : null;
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['X-User-Id'] = userId;
  return headers;
}

export const statementAnalysisService = {
  async cashFlow(options: {
    windowMonths: number;
    useBankRecords: boolean;
    consentGranted: boolean;
    signal?: AbortSignal;
  }): Promise<CashFlowAnalysis> {
    const params = new URLSearchParams({
      windowMonths: String(options.windowMonths),
      useBankRecords: String(options.useBankRecords),
      consentGranted: String(options.consentGranted),
    });
    const res = await fetch(
      `${config.api.baseUrl}/api/customer/ai/analysis/cash-flow?${params.toString()}`,
      { method: 'POST', headers: authHeaders(), signal: options.signal }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Could not analyse the statements on file');
    }
    return res.json();
  },
};
