import { apiClient } from './client';
import { ACCOUNTS, type AccountType, type BankAccount } from '@/lib/banking-data';

/**
 * Deposit accounts for the authenticated customer — bff-customer
 * `GET /api/customer/accounts`, which resolves the caller's own customer and
 * bank context server-side and returns only accounts they hold a current view
 * permission on.
 */

export interface CustomerAccount {
  accountId: string;
  accountName: string;
  accountNumber: string;
  iban?: string;
  currency: string;
  accountCategory?: string;
  accountType?: string;
  /** Human label published by account-service, e.g. "Notice Savings Account". */
  accountTypeDisplay?: string;
  status?: string;
  statusDisplay?: string;
  availableBalance?: number;
  currentBalance?: number;
  /** When the balance snapshot was taken. Lets the UI state how old it is. */
  balanceAsOf?: string;
  isJoint?: boolean;
  isFrozen?: boolean;
}

/** `SAMPLE` means the figures on screen are not the customer's real money. */
export type AccountSource = 'LIVE' | 'SAMPLE';

export type SampleReason =
  /** The BFF answered, but the customer has no accounts of their own yet. */
  | 'NO_LIVE_ACCOUNTS'
  /** The BFF or account-service could not be reached. */
  | 'SERVICE_UNAVAILABLE';

export interface AccountsSnapshot {
  accounts: BankAccount[];
  source: AccountSource;
  /** Null when source is LIVE. */
  sampleReason: SampleReason | null;
  /** Newest balance timestamp across live accounts; null for sample data. */
  balanceAsOf: string | null;
}

/** Presentation taxonomy the existing banking UI renders from. */
function toUiAccountType(account: CustomerAccount): AccountType {
  if (account.isJoint || account.accountType === 'JOINT_ACCOUNT') return 'JOINT';
  switch (account.accountType) {
    case 'SAVINGS_ACCOUNT':
    case 'NOTICE_SAVINGS':
    case 'TERM_DEPOSIT':
      return 'SAVINGS';
    default:
      return 'CURRENT';
  }
}

const TYPE_ART: Record<AccountType, { gradient: string; glyph: string }> = {
  CURRENT: {
    gradient: 'linear-gradient(135deg, #2d0e2b 0%, #4a1747 50%, #7f2b7b 100%)',
    glyph: '💜',
  },
  SAVINGS: {
    gradient: 'linear-gradient(135deg, #0f3d3e 0%, #0c5e54 50%, #10b981 100%)',
    glyph: '🌱',
  },
  JOINT: {
    gradient: 'linear-gradient(135deg, #5b1d4f 0%, #9d174d 50%, #db2777 100%)',
    glyph: '🏠',
  },
  VAULT: {
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #0ea5e9 100%)',
    glyph: '✈️',
  },
};

/** Last four of an account number, masked the way the sample set presents it. */
function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  return `•••• ${digits.slice(-4) || '0000'}`;
}

/**
 * Adapts a live account to the shape the banking screens already render.
 * Balance history is not served yet, so `spark` is empty and the sparkline
 * simply does not draw — inventing a trend line would be a fabrication. The
 * same applies to `primary`: the backend does not say which account is the
 * customer's main one, so no account is marked as it.
 */
export function toBankAccount(account: CustomerAccount): BankAccount {
  const type = toUiAccountType(account);
  return {
    id: account.accountId,
    name: account.accountName || account.accountTypeDisplay || 'Account',
    type,
    typeLabel: account.accountTypeDisplay,
    accountNumber: maskAccountNumber(account.accountNumber),
    sortCode: '',
    iban: account.iban || account.accountNumber,
    currency: account.currency || 'EUR',
    balance: account.currentBalance ?? account.availableBalance ?? 0,
    available: account.availableBalance ?? account.currentBalance ?? 0,
    gradient: TYPE_ART[type].gradient,
    glyph: TYPE_ART[type].glyph,
    spark: [],
    statusDisplay: account.statusDisplay,
    balanceAsOf: account.balanceAsOf,
  };
}

function sampleSnapshot(reason: SampleReason): AccountsSnapshot {
  return { accounts: ACCOUNTS, source: 'SAMPLE', sampleReason: reason, balanceAsOf: null };
}

export const accountService = {
  async getAccounts(): Promise<CustomerAccount[]> {
    const accounts = await apiClient.get<CustomerAccount[] | null>('/api/customer/accounts');
    return accounts ?? [];
  },

  /**
   * Live accounts when the BFF has them, otherwise the sample set — always
   * with `source` set so no screen can present sample figures as real ones.
   */
  async getAccountsSnapshot(): Promise<AccountsSnapshot> {
    let live: CustomerAccount[];
    try {
      live = await this.getAccounts();
    } catch {
      return sampleSnapshot('SERVICE_UNAVAILABLE');
    }
    if (live.length === 0) return sampleSnapshot('NO_LIVE_ACCOUNTS');

    const stamps = live
      .map(a => a.balanceAsOf)
      .filter((s): s is string => Boolean(s))
      .sort();

    return {
      accounts: live.map(toBankAccount),
      source: 'LIVE',
      sampleReason: null,
      balanceAsOf: stamps.length ? stamps[stamps.length - 1] : null,
    };
  },
};
