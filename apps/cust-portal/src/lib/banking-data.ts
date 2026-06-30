/**
 * Dummy banking data for the Customer Portal "neo-bank" experience.
 *
 * NOTE: This is mock/placeholder data used to render the new banking UI
 * (accounts, cards, payments, transactions, insights) until the real
 * backend services are available. None of this hits the network — it is
 * deterministic, in-memory data designed to look realistic.
 */

/* ──────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────── */

export type AccountType = 'CURRENT' | 'SAVINGS' | 'JOINT' | 'VAULT';

export interface BankAccount {
  id: string;
  name: string;
  type: AccountType;
  accountNumber: string; // last 4 shown, rest masked
  sortCode: string;
  iban: string;
  currency: string;
  balance: number;
  available: number;
  /** Gradient class pair used to render the account "card" art */
  gradient: string;
  /** Short emoji/glyph used as the account avatar */
  glyph: string;
  /** Monthly inflow / outflow used for the mini sparkline */
  spark: number[];
  primary?: boolean;
}

export type CardType = 'DEBIT' | 'CREDIT';
export type CardScheme = 'VISA' | 'MASTERCARD';

export interface PaymentCard {
  id: string;
  type: CardType;
  scheme: CardScheme;
  label: string;
  /** Masked PAN, only last 4 are real */
  last4: string;
  expiry: string;
  holder: string;
  linkedAccountId: string;
  frozen: boolean;
  contactless: boolean;
  online: boolean;
  /** Gradient class pair for the plastic art */
  gradient: string;
  /** Credit-card only */
  creditLimit?: number;
  creditUsed?: number;
  apr?: number;
  /** Debit-card only spend this month */
  spentThisMonth?: number;
}

export type TxnDirection = 'IN' | 'OUT';
export type TxnStatus = 'COMPLETED' | 'PENDING' | 'DECLINED';

export interface Transaction {
  id: string;
  accountId: string;
  cardId?: string;
  merchant: string;
  category: SpendCategory;
  amount: number; // always positive; use direction for sign
  direction: TxnDirection;
  currency: string;
  status: TxnStatus;
  date: string; // ISO
  note?: string;
  /** Emoji glyph for the merchant avatar */
  glyph: string;
}

export type SpendCategory =
  | 'Groceries'
  | 'Eating out'
  | 'Transport'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Health'
  | 'Travel'
  | 'Income'
  | 'Transfers'
  | 'Cash'
  | 'Other';

export interface Beneficiary {
  id: string;
  name: string;
  handle: string; // @handle or sort/acct
  glyph: string;
  gradient: string;
  lastSent?: number;
}

export interface ScheduledPayment {
  id: string;
  payee: string;
  amount: number;
  currency: string;
  nextDate: string;
  frequency: 'Monthly' | 'Weekly' | 'Yearly';
  glyph: string;
}

/* ──────────────────────────────────────────────────────────────────
 * Category metadata (colors + glyphs)
 * ────────────────────────────────────────────────────────────────── */

export const CATEGORY_META: Record<SpendCategory, { color: string; glyph: string }> = {
  Groceries: { color: '#10b981', glyph: '🛒' },
  'Eating out': { color: '#f59e0b', glyph: '🍔' },
  Transport: { color: '#3b82f6', glyph: '🚇' },
  Shopping: { color: '#ec4899', glyph: '🛍️' },
  Bills: { color: '#8b5cf6', glyph: '💡' },
  Entertainment: { color: '#ef4444', glyph: '🎬' },
  Health: { color: '#14b8a6', glyph: '💊' },
  Travel: { color: '#0ea5e9', glyph: '✈️' },
  Income: { color: '#22c55e', glyph: '💰' },
  Transfers: { color: '#64748b', glyph: '🔁' },
  Cash: { color: '#a855f7', glyph: '🏧' },
  Other: { color: '#94a3b8', glyph: '✨' },
};

/* ──────────────────────────────────────────────────────────────────
 * Accounts
 * ────────────────────────────────────────────────────────────────── */

export const ACCOUNTS: BankAccount[] = [
  {
    id: 'acc-current',
    name: 'Everyday',
    type: 'CURRENT',
    accountNumber: '•••• 4827',
    sortCode: '04-29-11',
    iban: 'GB29 RAYV 0429 1100 0048 27',
    currency: 'GBP',
    balance: 12480.55,
    available: 12230.55,
    gradient: 'linear-gradient(135deg, #2d0e2b 0%, #4a1747 50%, #7f2b7b 100%)',
    glyph: '💜',
    spark: [8200, 9100, 8700, 10200, 9800, 11400, 12480],
    primary: true,
  },
  {
    id: 'acc-savings',
    name: 'Savings Pot',
    type: 'SAVINGS',
    accountNumber: '•••• 9043',
    sortCode: '04-29-11',
    iban: 'GB29 RAYV 0429 1100 0090 43',
    currency: 'GBP',
    balance: 28750.0,
    available: 28750.0,
    gradient: 'linear-gradient(135deg, #0f3d3e 0%, #0c5e54 50%, #10b981 100%)',
    glyph: '🌱',
    spark: [21000, 22500, 23800, 25000, 26400, 27600, 28750],
  },
  {
    id: 'acc-vault',
    name: 'Travel Vault',
    type: 'VAULT',
    accountNumber: '•••• 1170',
    sortCode: '04-29-11',
    iban: 'GB29 RAYV 0429 1100 0011 70',
    currency: 'EUR',
    balance: 3420.9,
    available: 3420.9,
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #0ea5e9 100%)',
    glyph: '✈️',
    spark: [1200, 1800, 2100, 2600, 2900, 3200, 3420],
  },
  {
    id: 'acc-joint',
    name: 'Joint Household',
    type: 'JOINT',
    accountNumber: '•••• 6692',
    sortCode: '04-29-11',
    iban: 'GB29 RAYV 0429 1100 0066 92',
    currency: 'GBP',
    balance: 5210.34,
    available: 4960.34,
    gradient: 'linear-gradient(135deg, #5b1d4f 0%, #9d174d 50%, #db2777 100%)',
    glyph: '🏠',
    spark: [4100, 4400, 4900, 5300, 5000, 5400, 5210],
  },
];

/* ──────────────────────────────────────────────────────────────────
 * Cards
 * ────────────────────────────────────────────────────────────────── */

export const CARDS: PaymentCard[] = [
  {
    id: 'card-debit-1',
    type: 'DEBIT',
    scheme: 'VISA',
    label: 'Everyday Debit',
    last4: '4827',
    expiry: '08/28',
    holder: 'Card Holder',
    linkedAccountId: 'acc-current',
    frozen: false,
    contactless: true,
    online: true,
    gradient: 'linear-gradient(135deg, #2d0e2b 0%, #4a1747 50%, #7f2b7b 100%)',
    spentThisMonth: 1842.2,
  },
  {
    id: 'card-credit-1',
    type: 'CREDIT',
    scheme: 'MASTERCARD',
    label: 'Rayva Signature',
    last4: '7731',
    expiry: '11/27',
    holder: 'Card Holder',
    linkedAccountId: 'acc-current',
    frozen: false,
    contactless: true,
    online: true,
    gradient: 'linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #71717a 100%)',
    creditLimit: 10000,
    creditUsed: 2340.18,
    apr: 22.9,
  },
  {
    id: 'card-debit-2',
    type: 'DEBIT',
    scheme: 'VISA',
    label: 'Travel Vault',
    last4: '1170',
    expiry: '03/29',
    holder: 'Card Holder',
    linkedAccountId: 'acc-vault',
    frozen: true,
    contactless: true,
    online: false,
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #0ea5e9 100%)',
    spentThisMonth: 420.5,
  },
  {
    id: 'card-credit-2',
    type: 'CREDIT',
    scheme: 'VISA',
    label: 'Rayva Rewards',
    last4: '5508',
    expiry: '06/26',
    holder: 'Card Holder',
    linkedAccountId: 'acc-current',
    frozen: false,
    contactless: true,
    online: true,
    gradient: 'linear-gradient(135deg, #3b0764 0%, #6d28d9 50%, #a855f7 100%)',
    creditLimit: 5000,
    creditUsed: 612.4,
    apr: 19.9,
  },
];

/* ──────────────────────────────────────────────────────────────────
 * Beneficiaries & scheduled payments
 * ────────────────────────────────────────────────────────────────── */

export const BENEFICIARIES: Beneficiary[] = [
  { id: 'b1', name: 'Olivia Bennett', handle: '@olivia', glyph: 'OB', gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', lastSent: 45 },
  { id: 'b2', name: 'James Carter', handle: '@jcarter', glyph: 'JC', gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', lastSent: 120 },
  { id: 'b3', name: 'Sophia Lee', handle: '@sophialee', glyph: 'SL', gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', lastSent: 30 },
  { id: 'b4', name: 'Liam Walsh', handle: '@liamw', glyph: 'LW', gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', lastSent: 200 },
  { id: 'b5', name: 'Emma Stone', handle: '@emmas', glyph: 'ES', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', lastSent: 75 },
  { id: 'b6', name: 'Noah Davies', handle: '@noahd', glyph: 'ND', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)' },
];

export const SCHEDULED_PAYMENTS: ScheduledPayment[] = [
  { id: 's1', payee: 'Octopus Energy', amount: 96.4, currency: 'GBP', nextDate: '2026-06-14', frequency: 'Monthly', glyph: '⚡' },
  { id: 's2', payee: 'Vitality Health', amount: 48.0, currency: 'GBP', nextDate: '2026-06-18', frequency: 'Monthly', glyph: '💪' },
  { id: 's3', payee: 'Netflix', amount: 17.99, currency: 'GBP', nextDate: '2026-06-22', frequency: 'Monthly', glyph: '🎬' },
  { id: 's4', payee: 'Spotify Premium', amount: 11.99, currency: 'GBP', nextDate: '2026-06-25', frequency: 'Monthly', glyph: '🎧' },
  { id: 's5', payee: 'Apartment Rent', amount: 1450.0, currency: 'GBP', nextDate: '2026-07-01', frequency: 'Monthly', glyph: '🏠' },
];

/* ──────────────────────────────────────────────────────────────────
 * Transactions
 * ────────────────────────────────────────────────────────────────── */

function tx(
  id: string,
  daysAgo: number,
  merchant: string,
  glyph: string,
  category: SpendCategory,
  amount: number,
  direction: TxnDirection,
  accountId = 'acc-current',
  opts: Partial<Transaction> = {}
): Transaction {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9 + ((daysAgo * 7) % 12), (daysAgo * 13) % 60, 0, 0);
  return {
    id,
    accountId,
    merchant,
    glyph,
    category,
    amount,
    direction,
    currency: 'GBP',
    status: 'COMPLETED',
    date: d.toISOString(),
    cardId: direction === 'OUT' ? 'card-debit-1' : undefined,
    ...opts,
  };
}

export const TRANSACTIONS: Transaction[] = [
  tx('t1', 0, 'Pret A Manger', '🥪', 'Eating out', 8.45, 'OUT'),
  tx('t2', 0, 'Transport for London', '🚇', 'Transport', 5.6, 'OUT'),
  tx('t3', 0, 'Amazon', '📦', 'Shopping', 49.99, 'OUT', 'acc-current', { status: 'PENDING' }),
  tx('t4', 1, 'Tesco Express', '🛒', 'Groceries', 32.18, 'OUT'),
  tx('t5', 1, 'Spotify', '🎧', 'Entertainment', 11.99, 'OUT'),
  tx('t6', 1, 'Olivia Bennett', '💸', 'Transfers', 45.0, 'OUT', 'acc-current', { note: 'Dinner split' }),
  tx('t7', 2, 'Acme Corp Payroll', '💰', 'Income', 3250.0, 'IN', 'acc-current', { note: 'Salary — June', cardId: undefined }),
  tx('t8', 2, 'Shell', '⛽', 'Transport', 61.4, 'OUT'),
  tx('t9', 3, 'Deliveroo', '🍱', 'Eating out', 24.3, 'OUT'),
  tx('t10', 3, 'Apple', '', 'Shopping', 0.99, 'OUT', 'acc-current', { merchant: 'Apple iCloud', glyph: '☁️' }),
  tx('t11', 4, 'Sainsbury\u2019s', '🛒', 'Groceries', 58.72, 'OUT'),
  tx('t12', 4, 'Uber', '🚗', 'Transport', 14.2, 'OUT'),
  tx('t13', 5, 'Vue Cinema', '🎬', 'Entertainment', 27.0, 'OUT'),
  tx('t14', 5, 'Boots Pharmacy', '💊', 'Health', 18.45, 'OUT'),
  tx('t15', 6, 'Octopus Energy', '⚡', 'Bills', 96.4, 'OUT', 'acc-current', { cardId: undefined }),
  tx('t16', 6, 'Starbucks', '☕', 'Eating out', 4.85, 'OUT'),
  tx('t17', 7, 'ASOS', '🛍️', 'Shopping', 112.5, 'OUT'),
  tx('t18', 8, 'British Airways', '✈️', 'Travel', 340.0, 'OUT', 'acc-vault'),
  tx('t19', 9, 'Cash Withdrawal', '🏧', 'Cash', 60.0, 'OUT'),
  tx('t20', 9, 'Sophia Lee', '💸', 'Transfers', 30.0, 'IN', 'acc-current', { note: 'Concert tickets', cardId: undefined }),
  tx('t21', 10, 'Tesco Express', '🛒', 'Groceries', 21.05, 'OUT'),
  tx('t22', 11, 'Netflix', '🎬', 'Entertainment', 17.99, 'OUT'),
  tx('t23', 12, 'Gym — PureGym', '🏋️', 'Health', 28.99, 'OUT'),
  tx('t24', 13, 'Transport for London', '🚇', 'Transport', 5.6, 'OUT'),
  tx('t25', 14, 'Five Guys', '🍔', 'Eating out', 19.7, 'OUT'),
  tx('t26', 16, 'John Lewis', '🛍️', 'Shopping', 88.0, 'OUT'),
  tx('t27', 18, 'Thames Water', '💧', 'Bills', 42.1, 'OUT', 'acc-current', { cardId: undefined }),
  tx('t28', 20, 'Acme Corp Payroll', '💰', 'Income', 3250.0, 'IN', 'acc-current', { note: 'Salary — May', cardId: undefined }),
  tx('t29', 22, 'Airbnb', '🏡', 'Travel', 410.0, 'OUT', 'acc-vault'),
  tx('t30', 25, 'Waitrose', '🛒', 'Groceries', 64.3, 'OUT'),
];

/* ──────────────────────────────────────────────────────────────────
 * Derived helpers
 * ────────────────────────────────────────────────────────────────── */

/** Convert a foreign balance to GBP for the "total wealth" figure (mock rates). */
const FX_TO_GBP: Record<string, number> = { GBP: 1, EUR: 0.85, USD: 0.79 };

export function totalBalanceGBP(): number {
  return ACCOUNTS.reduce((sum, a) => sum + a.balance * (FX_TO_GBP[a.currency] ?? 1), 0);
}

export function getAccount(id: string): BankAccount | undefined {
  return ACCOUNTS.find(a => a.id === id);
}

export function transactionsForAccount(accountId: string): Transaction[] {
  return TRANSACTIONS.filter(t => t.accountId === accountId).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function recentTransactions(limit = 8): Transaction[] {
  return [...TRANSACTIONS]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export interface CategorySpend {
  category: SpendCategory;
  total: number;
  color: string;
  glyph: string;
  pct: number;
}

/** Spend breakdown by category for OUT transactions in the current window. */
export function spendByCategory(): CategorySpend[] {
  const totals = new Map<SpendCategory, number>();
  TRANSACTIONS.filter(t => t.direction === 'OUT' && t.category !== 'Transfers').forEach(t => {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  });
  const grand = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(totals.entries())
    .map(([category, total]) => ({
      category,
      total,
      color: CATEGORY_META[category].color,
      glyph: CATEGORY_META[category].glyph,
      pct: (total / grand) * 100,
    }))
    .sort((a, b) => b.total - a.total);
}

export function monthlyInOut(): { income: number; spending: number } {
  const income = TRANSACTIONS.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amount, 0);
  const spending = TRANSACTIONS.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0);
  return { income, spending };
}

export interface DailySpend {
  label: string; // e.g. "Mon"
  date: string;
  total: number;
}

/** Daily OUT-spend for the last `days` days, oldest → newest (for bar charts). */
export function dailySpendSeries(days = 14): DailySpend[] {
  const buckets: DailySpend[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1),
      date: d.toISOString(),
      total: 0,
    });
  }
  TRANSACTIONS.filter(t => t.direction === 'OUT').forEach(t => {
    const d = new Date(t.date);
    d.setHours(0, 0, 0, 0);
    const bucket = buckets.find(b => {
      const bd = new Date(b.date);
      bd.setHours(0, 0, 0, 0);
      return bd.getTime() === d.getTime();
    });
    if (bucket) bucket.total += t.amount;
  });
  return buckets;
}

/** A simple savings-goal model for the radial progress ring. */
export interface SavingsGoal {
  label: string;
  saved: number;
  target: number;
  currency: string;
}

export function savingsGoal(): SavingsGoal {
  const pot = ACCOUNTS.find(a => a.id === 'acc-savings');
  return {
    label: 'Savings Pot',
    saved: pot?.balance ?? 0,
    target: 40000,
    currency: pot?.currency ?? 'GBP',
  };
}

/** A 12-point series approximating account balance over time, for the hero chart. */
export function balanceTrend(): number[] {
  const base = totalBalanceGBP();
  const wobble = [0.78, 0.81, 0.79, 0.85, 0.88, 0.84, 0.9, 0.93, 0.91, 0.96, 0.98, 1];
  return wobble.map(w => Math.round(base * w));
}

export function groupTransactionsByDay(list: Transaction[]): { label: string; items: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  list.forEach(t => {
    const d = new Date(t.date);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = 'Today';
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
    else
      label = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(t);
  });
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
