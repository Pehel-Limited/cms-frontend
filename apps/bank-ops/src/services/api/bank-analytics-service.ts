// src/services/api/bank-analytics-service.ts
import { apiClient } from './client';

/*
 * Bank-wide aggregates for the executive overview. These are the only figures on that page that
 * describe the whole bank rather than the lending book — everything here comes from the account
 * and transaction tables, so a number here can be traced to a row in credit.account or
 * credit.account_transaction.
 */

export interface BookSlice {
  category: 'DEPOSIT' | 'CREDIT' | string;
  type: string;
  accountCount: number;
  /** What the bank owes on a deposit slice, or is owed on an advance slice. */
  ledgerBalance: number;
  availableBalance: number;
  accruedInterest?: number;
}

export interface Liquidity {
  payableBalance: number;
  ledgerBalance: number;
  holdsAmount: number;
  pendingDebits: number;
  pendingCredits: number;
  /** Deposits left in the bank after every advance is funded. */
  surplusFunding: number;
}

export interface StatusSlice {
  status: string;
  accountCount: number;
  balance: number;
  closedCount: number;
}

export interface Lifecycle {
  totalAccounts: number;
  depositAccounts: number;
  creditAccounts: number;
  operationalAccounts: number;
  byStatus: StatusSlice[];
  averageAgeDays: number;
  withRecordedActivity: number;
}

export interface Depositor {
  partyId: string;
  name: string;
  partyType?: string;
  accountCount: number;
  balance: number;
  sharePercent: number;
}

export interface ClosedPosition {
  closedAccounts: number;
  /**
   * Balance still carried on closed accounts. Kept out of the deposit total by the backend and
   * reported beside it, so a closure cannot silently shrink the balance sheet.
   */
  closedBalance: number;
}

export interface BankExecutiveOverview {
  balancesAsOf?: string;
  depositBookTotal: number;
  advanceBookTotal: number;
  loanToDepositPercent?: number;
  depositBook: BookSlice[];
  advanceBook: BookSlice[];
  liquidity?: Liquidity;
  lifecycle?: Lifecycle;
  topDepositors: Depositor[];
  topTenDepositSharePercent?: number;
  depositHolders: number;
  closedPosition?: ClosedPosition;
}

export interface MonthlyBankFlow {
  /** 'yyyy-MM'. */
  month: string;
  monthStart: string;
  transactionCount: number;
  settledCount: number;
  failedCount: number;
  reversalCount: number;
  totalValue?: number;
  creditValue?: number;
  debitValue?: number;
  activeAccounts: number;
  activeCustomers: number;
  feeIncome?: number;
  interestReceived?: number;
  interestPaid?: number;
  repayments?: number;
  disbursements?: number;
  cardValue?: number;
  cardCount: number;
  accountsOpened: number;
  accountsClosed: number;
  /** Nothing was booked in this month at all. */
  recorded: boolean;
  /** The month has not finished, so it cannot be compared with its neighbours. */
  partial: boolean;
}

export interface ChannelMix {
  channel: string;
  channelDisplay: string;
  transactionCount: number;
  totalValue?: number;
  countSharePercent?: number;
  valueSharePercent?: number;
}

export type AnalyticsPeriod = 6 | 12 | 24;

export const bankAnalyticsService = {
  getOverview(bankId: string): Promise<BankExecutiveOverview> {
    return apiClient.get<BankExecutiveOverview>(
      `/api/accounts/analytics/overview?bankId=${encodeURIComponent(bankId)}`
    );
  },

  getMonthlyFlows(bankId: string, months: AnalyticsPeriod = 12): Promise<MonthlyBankFlow[]> {
    return apiClient.get<MonthlyBankFlow[]>(
      `/api/accounts/analytics/monthly-flows?bankId=${encodeURIComponent(bankId)}&months=${months}`
    );
  },

  getChannelMix(bankId: string, months: AnalyticsPeriod = 12): Promise<ChannelMix[]> {
    return apiClient.get<ChannelMix[]>(
      `/api/accounts/analytics/channel-mix?bankId=${encodeURIComponent(bankId)}&months=${months}`
    );
  },
};
