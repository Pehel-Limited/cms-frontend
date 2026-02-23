import axios from 'axios';
import config from '@/config';

const API_URL = config.api.baseUrl;

// ============================================================================
// Types
// ============================================================================

export type AccountCategory = 'DEPOSIT' | 'CREDIT' | 'OPERATIONAL';

export type AccountType =
  // Deposit Account Types
  | 'CURRENT_ACCOUNT'
  | 'SAVINGS_ACCOUNT'
  | 'TERM_DEPOSIT'
  | 'NOTICE_ACCOUNT'
  | 'DEMAND_DEPOSIT'
  | 'MULTI_CURRENCY'
  | 'JOINT_ACCOUNT'
  | 'TRUST_ACCOUNT'
  | 'ESCROW_ACCOUNT'
  // Credit Account Types
  | 'LOAN_ACCOUNT'
  | 'MORTGAGE_ACCOUNT'
  | 'REVOLVING_CREDIT'
  | 'OVERDRAFT_ACCOUNT'
  | 'CREDIT_CARD'
  | 'LINE_OF_CREDIT'
  // Operational Account Types
  | 'REPAYMENT_ACCOUNT'
  | 'DISBURSEMENT_ACCOUNT'
  | 'FEES_ACCOUNT'
  | 'SUSPENSE_ACCOUNT'
  | 'COLLECTIONS_ACCOUNT'
  | 'INTERNAL_ACCOUNT';

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'DORMANT' | 'FROZEN' | 'CLOSED' | 'BLOCKED';

export type AccountPartyRoleType =
  | 'PRIMARY_HOLDER'
  | 'JOINT_HOLDER'
  | 'AUTHORIZED_SIGNATORY'
  | 'NOMINEE'
  | 'BENEFICIARY'
  | 'TRUSTEE'
  | 'GUARANTOR'
  | 'POWER_OF_ATTORNEY';

export type AccountIdentifierType =
  | 'IBAN'
  | 'BIC'
  | 'SORT_CODE'
  | 'ACCOUNT_NUMBER'
  | 'BBAN'
  | 'VIRTUAL_IBAN';

export type LimitType =
  | 'DAILY_DEBIT'
  | 'DAILY_CREDIT'
  | 'MONTHLY_DEBIT'
  | 'MONTHLY_CREDIT'
  | 'SINGLE_TRANSACTION'
  | 'CASH_WITHDRAWAL'
  | 'ONLINE_TRANSFER'
  | 'OVERDRAFT'
  | 'CREDIT';

// ============================================================================
// Request DTOs
// ============================================================================

export interface CreateAccountRequest {
  bankId: string;
  branchId?: string;
  accountCategory: AccountCategory;
  accountType: AccountType;
  accountName: string;
  currencyCode: string;
  productId?: string;
  interestRate?: number;
  openingBalance?: number;
  maturityDate?: string;
  termMonths?: number;
  autoRenew?: boolean;
  notes?: string;
  // Primary holder info
  primaryPartyId?: string;
  primaryPartyType?: string;
}

export interface UpdateAccountRequest {
  accountName?: string;
  branchId?: string;
  interestRate?: number;
  maturityDate?: string;
  termMonths?: number;
  autoRenew?: boolean;
  notes?: string;
}

export interface AccountPartyRoleRequest {
  partyId: string;
  partyType: string;
  role: AccountPartyRoleType;
  ownershipPercentage?: number;
  isPrimary: boolean;
  startDate: string;
  endDate?: string;
  canView: boolean;
  canTransact: boolean;
  canManage: boolean;
  transactionLimit?: number;
}

export interface AccountIdentifierRequest {
  identifierType: AccountIdentifierType;
  identifierValue: string;
  isPrimary: boolean;
}

export interface AccountLimitRequest {
  limitType: LimitType;
  limitAmount: number;
  currencyCode: string;
  usedAmount?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isEnabled: boolean;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface AccountBalanceResponse {
  balanceId: string;
  accountId: string;
  currency: string;
  asOf: string;
  ledgerBalance: number;
  availableBalance: number;
  currentBalance: number;
  pendingDebits: number;
  pendingCredits: number;
  holdsAmount: number;
  overdraftUsed: number;
  overdraftAvailable: number;
  creditUsed: number;
  creditAvailable: number;
  accruedInterest: number;
  interestPaidYtd: number;
  interestEarnedYtd: number;
  arrearsBalance: number;
  principalArrears: number;
  interestArrears: number;
  feesArrears: number;
  principalOutstanding: number;
  totalOutstanding: number;
}

export interface AccountPartyRoleResponse {
  id: string;
  partyId: string;
  partyName?: string;
  partyType: string;
  role: AccountPartyRoleType;
  ownershipPercentage?: number;
  isPrimary: boolean;
  startDate: string;
  endDate?: string;
  canView: boolean;
  canTransact: boolean;
  canManage: boolean;
  transactionLimit?: number;
}

export interface AccountIdentifierResponse {
  id: string;
  identifierType: AccountIdentifierType;
  identifierValue: string;
  isPrimary: boolean;
}

export interface AccountLimitResponse {
  id: string;
  limitType: LimitType;
  limitAmount: number;
  currencyCode: string;
  usedAmount: number;
  availableAmount: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isEnabled: boolean;
}

export interface AccountResponse {
  accountId: string;
  accountNumber: string;
  bankId: string;
  branchId?: string;
  accountCategory: AccountCategory;
  accountType: AccountType;
  accountName: string;
  currency: string;
  status: AccountStatus;
  productId?: string;
  openedAt?: string;
  closedAt?: string;
  maturityDate?: string;
  termMonths?: number;
  interestRate?: number;
  autoRenew: boolean;
  notes?: string;
  balance?: AccountBalanceResponse;
  partyRoles: AccountPartyRoleResponse[];
  identifiers: AccountIdentifierResponse[];
  limits: AccountLimitResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface AccountSummaryResponse {
  accountId: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: AccountCategory;
  accountType: AccountType;
  accountTypeDisplay: string;
  currency: string;
  status: AccountStatus;
  statusDisplay: string;
  availableBalance: number;
  currentBalance: number;
  primaryOwnerId?: string;
  primaryOwnerName?: string;
  primaryIban?: string;
  isJoint: boolean;
  isFrozen: boolean;
}

export interface AccountStatsResponse {
  totalAccounts: number;
  activeAccounts: number;
  dormantAccounts: number;
  frozenAccounts: number;
  closedAccounts: number;
  depositAccounts: number;
  creditAccounts: number;
  operationalAccounts: number;
  accountsByType: Record<string, number>;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// ============================================================================
// Account Service Class
// ============================================================================

class AccountService {
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(config.auth.tokenKey);
    }
    return null;
  }

  private getUserId(): string | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(config.auth.userKey);
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          return user.userId;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private getHeaders() {
    const token = this.getAuthToken();
    const userId = this.getUserId();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(userId && { 'X-User-Id': userId }),
    };
  }

  // Create a new account
  async createAccount(request: CreateAccountRequest): Promise<AccountResponse> {
    try {
      const response = await axios.post(`${API_URL}/api/accounts`, request, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  // Update an existing account
  async updateAccount(accountId: string, request: UpdateAccountRequest): Promise<AccountResponse> {
    try {
      const response = await axios.put(`${API_URL}/api/accounts/${accountId}`, request, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  // Get account by ID
  async getAccountById(accountId: string): Promise<AccountResponse> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/${accountId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching account:', error);
      throw error;
    }
  }

  // Get account by account number
  async getAccountByNumber(accountNumber: string): Promise<AccountResponse> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/number/${accountNumber}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching account by number:', error);
      throw error;
    }
  }

  // Get paginated accounts for a bank
  async getAccounts(
    bankId: string,
    page = 0,
    size = 20
  ): Promise<PageResponse<AccountSummaryResponse>> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts`, {
        params: { bankId, page, size },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  // Get accounts by status
  async getAccountsByStatus(
    status: AccountStatus,
    bankId: string,
    page = 0,
    size = 20
  ): Promise<PageResponse<AccountSummaryResponse>> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/status/${status}`, {
        params: { bankId, page, size },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching accounts by status:', error);
      throw error;
    }
  }

  // Get accounts by category
  async getAccountsByCategory(
    category: AccountCategory,
    bankId: string,
    page = 0,
    size = 20
  ): Promise<PageResponse<AccountSummaryResponse>> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/category/${category}`, {
        params: { bankId, page, size },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching accounts by category:', error);
      throw error;
    }
  }

  // Get accounts by type
  async getAccountsByType(
    type: AccountType,
    bankId: string,
    page = 0,
    size = 20
  ): Promise<PageResponse<AccountSummaryResponse>> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/type/${type}`, {
        params: { bankId, page, size },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching accounts by type:', error);
      throw error;
    }
  }

  // Get accounts by party (customer)
  async getAccountsByParty(partyId: string): Promise<AccountSummaryResponse[]> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/party/${partyId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching accounts by party:', error);
      throw error;
    }
  }

  // Get active accounts by party
  async getActiveAccountsByParty(partyId: string): Promise<AccountSummaryResponse[]> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/party/${partyId}/active`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching active accounts by party:', error);
      throw error;
    }
  }

  // Search accounts
  async searchAccounts(
    bankId: string,
    searchTerm: string,
    page = 0,
    size = 20
  ): Promise<PageResponse<AccountSummaryResponse>> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/search`, {
        params: { bankId, q: searchTerm, page, size },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error searching accounts:', error);
      throw error;
    }
  }

  // Get account statistics
  async getAccountStats(bankId: string): Promise<AccountStatsResponse> {
    try {
      const response = await axios.get(`${API_URL}/api/accounts/stats`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching account stats:', error);
      throw error;
    }
  }

  // Activate account
  async activateAccount(accountId: string): Promise<AccountResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/api/accounts/${accountId}/activate`,
        {},
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error activating account:', error);
      throw error;
    }
  }

  // Freeze account
  async freezeAccount(accountId: string, reason: string): Promise<AccountResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/api/accounts/${accountId}/freeze`,
        {},
        { params: { reason }, headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error freezing account:', error);
      throw error;
    }
  }

  // Unfreeze account
  async unfreezeAccount(accountId: string): Promise<AccountResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/api/accounts/${accountId}/unfreeze`,
        {},
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error unfreezing account:', error);
      throw error;
    }
  }

  // Close account
  async closeAccount(accountId: string): Promise<AccountResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/api/accounts/${accountId}/close`,
        {},
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error closing account:', error);
      throw error;
    }
  }

  // Add party role to account
  async addPartyRole(
    accountId: string,
    request: AccountPartyRoleRequest
  ): Promise<AccountResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/api/accounts/${accountId}/party-roles`,
        request,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding party role:', error);
      throw error;
    }
  }

  // Add identifier to account
  async addIdentifier(
    accountId: string,
    request: AccountIdentifierRequest
  ): Promise<AccountResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/api/accounts/${accountId}/identifiers`,
        request,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding identifier:', error);
      throw error;
    }
  }

  // Add limit to account
  async addLimit(accountId: string, request: AccountLimitRequest): Promise<AccountResponse> {
    try {
      const response = await axios.post(`${API_URL}/api/accounts/${accountId}/limits`, request, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error adding limit:', error);
      throw error;
    }
  }

  // Delete account (soft delete)
  async deleteAccount(accountId: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/api/accounts/${accountId}`, {
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export const accountCategoryLabels: Record<AccountCategory, string> = {
  DEPOSIT: 'Deposit',
  CREDIT: 'Credit',
  OPERATIONAL: 'Operational',
};

export const accountTypeLabels: Record<AccountType, string> = {
  CURRENT_ACCOUNT: 'Current Account',
  SAVINGS_ACCOUNT: 'Savings Account',
  TERM_DEPOSIT: 'Term Deposit',
  NOTICE_ACCOUNT: 'Notice Account',
  DEMAND_DEPOSIT: 'Demand Deposit',
  MULTI_CURRENCY: 'Multi-Currency Account',
  JOINT_ACCOUNT: 'Joint Account',
  TRUST_ACCOUNT: 'Trust Account',
  ESCROW_ACCOUNT: 'Escrow Account',
  LOAN_ACCOUNT: 'Loan Account',
  MORTGAGE_ACCOUNT: 'Mortgage Account',
  REVOLVING_CREDIT: 'Revolving Credit',
  OVERDRAFT_ACCOUNT: 'Overdraft Account',
  CREDIT_CARD: 'Credit Card',
  LINE_OF_CREDIT: 'Line of Credit',
  REPAYMENT_ACCOUNT: 'Repayment Account',
  DISBURSEMENT_ACCOUNT: 'Disbursement Account',
  FEES_ACCOUNT: 'Fees Account',
  SUSPENSE_ACCOUNT: 'Suspense Account',
  COLLECTIONS_ACCOUNT: 'Collections Account',
  INTERNAL_ACCOUNT: 'Internal Account',
};

export const accountStatusLabels: Record<AccountStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  DORMANT: 'Dormant',
  FROZEN: 'Frozen',
  CLOSED: 'Closed',
  BLOCKED: 'Blocked',
};

export const accountStatusColors: Record<AccountStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  DORMANT: 'bg-gray-100 text-gray-800',
  FROZEN: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-red-100 text-red-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

export const accountCategoryColors: Record<AccountCategory, string> = {
  DEPOSIT: 'bg-emerald-100 text-emerald-800',
  CREDIT: 'bg-purple-100 text-purple-800',
  OPERATIONAL: 'bg-slate-100 text-slate-800',
};

export const partyRoleTypeLabels: Record<AccountPartyRoleType, string> = {
  PRIMARY_HOLDER: 'Primary Holder',
  JOINT_HOLDER: 'Joint Holder',
  AUTHORIZED_SIGNATORY: 'Authorized Signatory',
  NOMINEE: 'Nominee',
  BENEFICIARY: 'Beneficiary',
  TRUSTEE: 'Trustee',
  GUARANTOR: 'Guarantor',
  POWER_OF_ATTORNEY: 'Power of Attorney',
};

export const identifierTypeLabels: Record<AccountIdentifierType, string> = {
  IBAN: 'IBAN',
  BIC: 'BIC',
  SORT_CODE: 'Sort Code',
  ACCOUNT_NUMBER: 'Account Number',
  BBAN: 'BBAN',
  VIRTUAL_IBAN: 'Virtual IBAN',
};

export const limitTypeLabels: Record<LimitType, string> = {
  DAILY_DEBIT: 'Daily Debit',
  DAILY_CREDIT: 'Daily Credit',
  MONTHLY_DEBIT: 'Monthly Debit',
  MONTHLY_CREDIT: 'Monthly Credit',
  SINGLE_TRANSACTION: 'Single Transaction',
  CASH_WITHDRAWAL: 'Cash Withdrawal',
  ONLINE_TRANSFER: 'Online Transfer',
  OVERDRAFT: 'Overdraft',
  CREDIT: 'Credit',
};

// Get account types for a category
export const getAccountTypesForCategory = (category: AccountCategory): AccountType[] => {
  const typesByCategory: Record<AccountCategory, AccountType[]> = {
    DEPOSIT: [
      'CURRENT_ACCOUNT',
      'SAVINGS_ACCOUNT',
      'TERM_DEPOSIT',
      'NOTICE_ACCOUNT',
      'DEMAND_DEPOSIT',
      'MULTI_CURRENCY',
      'JOINT_ACCOUNT',
      'TRUST_ACCOUNT',
      'ESCROW_ACCOUNT',
    ],
    CREDIT: [
      'LOAN_ACCOUNT',
      'MORTGAGE_ACCOUNT',
      'REVOLVING_CREDIT',
      'OVERDRAFT_ACCOUNT',
      'CREDIT_CARD',
      'LINE_OF_CREDIT',
    ],
    OPERATIONAL: [
      'REPAYMENT_ACCOUNT',
      'DISBURSEMENT_ACCOUNT',
      'FEES_ACCOUNT',
      'SUSPENSE_ACCOUNT',
      'COLLECTIONS_ACCOUNT',
      'INTERNAL_ACCOUNT',
    ],
  };
  return typesByCategory[category] || [];
};

// Format currency amount
export const formatCurrency = (amount: number, currencyCode?: string): string => {
  const currency = currencyCode || 'EUR';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// Export singleton instance
export const accountService = new AccountService();
export default accountService;
