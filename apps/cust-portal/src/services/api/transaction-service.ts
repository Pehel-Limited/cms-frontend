import { apiClient } from './client';
import {
  TRANSACTIONS,
  type SpendCategory,
  type Transaction,
  type TxnStatus,
} from '@/lib/banking-data';

/**
 * Statement lines for the authenticated customer — bff-customer
 * `GET /api/customer/accounts/transactions` (every viewable account at once) and
 * `GET /api/customer/accounts/{accountId}/transactions` (one account).
 */

export interface CustomerTransaction {
  transactionId: string;
  accountId: string;
  accountName?: string;
  accountTypeDisplay?: string;
  transactionType: string;
  transactionTypeDisplay?: string;
  status: string;
  statusDisplay?: string;
  /** IN or OUT from the holder's point of view, resolved server-side against the account type. */
  direction: 'IN' | 'OUT';
  amount: number;
  currency: string;
  /** Assigned when the line was booked. Absent on lines the feed did not classify. */
  category?: string;
  counterpartyName?: string;
  description?: string;
  remittanceInfo?: string;
  reference?: string;
  channel?: string;
  channelDisplay?: string;
  valueDate: string;
  initiatedAt: string;
  balanceAfter?: number;
  exchangeRate?: number;
  originalAmount?: number;
  originalCurrency?: string;
  feeAmount?: number;
  rejectionReason?: string;
  isReversal?: boolean;
}

export interface TransactionPage {
  content: CustomerTransaction[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export type TransactionSource = 'LIVE' | 'SAMPLE';

export type TransactionSampleReason =
  /** The BFF answered, but this customer has no activity in the requested window. */
  | 'NO_LIVE_TRANSACTIONS'
  /** The BFF or account-service could not be reached. */
  | 'SERVICE_UNAVAILABLE';

export interface TransactionsSnapshot {
  transactions: Transaction[];
  source: TransactionSource;
  /** Null when source is LIVE. */
  sampleReason: TransactionSampleReason | null;
  /** Rows the backend holds for the window — larger than `transactions` when it paginated. */
  totalElements: number;
  /** True when the backend had more rows than were fetched, so window totals are a floor. */
  truncated: boolean;
}

export interface TransactionQuery {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

const CATEGORY_NAMES: SpendCategory[] = [
  'Groceries', 'Eating out', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health',
  'Travel', 'Income', 'Transfers', 'Cash', 'Other', 'Suppliers', 'Payroll', 'Tax & Duties',
  'Premises', 'Materials', 'Fees & Charges', 'Takings', 'Marketing', 'Operations',
];

/**
 * A booked line that has not yet left the account is still money the holder has committed, so it
 * surfaces as PENDING. INITIATED and PROCESSING are the same situation earlier along the chain.
 * A REVERSAL is a distinct row paired with its REVERSED original, which is why the two need
 * separate labels — folding a reversal into DECLINED would claim a purchase never happened.
 */
function toStatus(status: string): TxnStatus {
  switch (status) {
    case 'COMPLETED':
    case 'BOOKED':
      return 'COMPLETED';
    case 'PENDING':
    case 'INITIATED':
    case 'PROCESSING':
      return 'PENDING';
    case 'FAILED':
    case 'CANCELLED':
      return 'DECLINED';
    case 'REVERSED':
      return 'REVERSED';
    default:
      return 'COMPLETED';
  }
}

/**
 * The stored classification wins; only when a line carries none do we fall back, and then only to
 * something defensible from the direction rather than to a guess from the merchant's name.
 */
function toCategory(row: CustomerTransaction): SpendCategory {
  const stored = row.category as SpendCategory | undefined;
  if (stored && CATEGORY_NAMES.includes(stored)) return stored;
  return row.direction === 'IN' ? 'Income' : 'Other';
}

/** Adapts one wire row to the shape the banking screens already render. */
export function toTransaction(row: CustomerTransaction): Transaction {
  return {
    id: row.transactionId,
    accountId: row.accountId,
    merchant: row.counterpartyName || row.description || 'Transaction',
    category: toCategory(row),
    // Amounts arrive unsigned; direction carries the sign, same as the sample set.
    amount: Math.abs(row.amount),
    direction: row.direction === 'IN' ? 'IN' : 'OUT',
    currency: row.currency || 'EUR',
    status: toStatus(row.status),
    // initiatedAt carries the time of day, which the weekday/weekend and evening panels need.
    date: row.initiatedAt || `${row.valueDate}T12:00:00`,
    // The descriptor line is the narrative; the statement text is what the payer wrote.
    note: row.remittanceInfo || undefined,
    // There are no card instruments in the backend yet, so a live line names no card — but a
    // card-funded one is still card-funded, and card-shaped panels key off that instead.
    viaCard: row.channel === 'CARD',
  };
}

function buildQuery(q: TransactionQuery): string {
  const params = new URLSearchParams();
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  params.set('page', String(q.page ?? 0));
  params.set('size', String(q.size ?? 500));
  return params.toString();
}

/** One page of the empty result, so a caller can tell "no rows" from "did not ask". */
const EMPTY_PAGE: TransactionPage = {
  content: [],
  page: 0,
  size: 0,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};

export const transactionService = {
  async getPage(query: TransactionQuery = {}): Promise<TransactionPage> {
    const res = await apiClient.get<TransactionPage | null>(
      `/api/customer/accounts/transactions?${buildQuery(query)}`
    );
    return res ?? EMPTY_PAGE;
  },

  async getAccountPage(accountId: string, query: TransactionQuery = {}): Promise<TransactionPage> {
    const res = await apiClient.get<TransactionPage | null>(
      `/api/customer/accounts/${accountId}/transactions?${buildQuery(query)}`
    );
    return res ?? EMPTY_PAGE;
  },

  /**
   * Live lines when the BFF has them, otherwise the sample set — always with `source` set so no
   * screen can present sample spending as the customer's own money.
   *
   * `from` defaults to 92 days back, which is what makes a real month-on-month comparison
   * computable; the sample history spanned about a week, which is why the dashboard had to
   * compare 12 days against 12 days.
   */
  async getTransactionsSnapshot(query: TransactionQuery = {}): Promise<TransactionsSnapshot> {
    let page: TransactionPage;
    try {
      page = await this.getPage({ size: 500, ...query });
    } catch {
      return {
        transactions: TRANSACTIONS,
        source: 'SAMPLE',
        sampleReason: 'SERVICE_UNAVAILABLE',
        totalElements: TRANSACTIONS.length,
        truncated: false,
      };
    }

    if (page.content.length === 0) {
      return {
        transactions: [],
        source: 'LIVE',
        sampleReason: 'NO_LIVE_TRANSACTIONS',
        totalElements: page.totalElements,
        truncated: false,
      };
    }

    return {
      transactions: page.content.map(toTransaction),
      source: 'LIVE',
      sampleReason: null,
      totalElements: page.totalElements,
      truncated: page.totalElements > page.content.length,
    };
  },
};
