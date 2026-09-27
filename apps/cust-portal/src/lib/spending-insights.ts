import type { SpendCategory, Transaction } from './banking-data';

/**
 * Deterministic spending calculations for the insights screen.
 *
 * Every figure here is arithmetic over the transaction list that is passed in —
 * there is no model call and no estimate that cannot be re-derived from the
 * cited rows. Each result carries the transactions it was built from so the
 * screen can show its working, and each can be dismissed or corrected by the
 * customer without the calculation ever guessing on their behalf.
 */

const DAY_MS = 86_400_000;

/** Below this, a "per month" figure is extrapolation rather than observation. */
const MIN_RELIABLE_WINDOW_DAYS = 60;

/** Merchant → category corrections the customer has made. */
export type CategoryOverrides = Record<string, SpendCategory>;

export interface EvidenceLine {
  transactionId: string;
  label: string;
}

export interface InsightEvidence {
  /** Plain-words statement of what was counted, so the number can be checked. */
  basis: string;
  lines: EvidenceLine[];
}

export function merchantKey(merchant: string): string {
  return merchant.trim().toLowerCase();
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Only settled outgoing money counts as spending. Pending has not happened yet. */
function settledOutgoing(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.direction === 'OUT' && t.status === 'COMPLETED');
}

export function categoryOf(t: Transaction, overrides: CategoryOverrides): SpendCategory {
  return overrides[merchantKey(t.merchant)] ?? t.category;
}

function evidenceFor(
  basis: string,
  rows: Transaction[],
  overrides: CategoryOverrides
): InsightEvidence {
  return {
    basis,
    lines: rows.map(t => ({
      transactionId: t.id,
      label: `${dayLabel(t.date)} · ${t.direction === 'IN' ? '+' : '−'}${money(t.amount, t.currency)} · ${categoryOf(t, overrides)}`,
    })),
  };
}

/* ──────────────────────────────────────────────────────────────────
 * Recurring commitments
 * ────────────────────────────────────────────────────────────────── */

/**
 * CONFIRMED  — three or more settled payments whose gaps are all close to the
 *              median, so the regularity is visible in the history itself.
 * PROBABLE   — three or more payments, but the gaps wander.
 * INSUFFICIENT_HISTORY — seen only twice. Two points always look regular; that
 *              is not evidence of a pattern, so we say so instead of claiming one.
 */
export type RecurringConfidence = 'CONFIRMED' | 'PROBABLE' | 'INSUFFICIENT_HISTORY';

export interface RecurringCommitment {
  id: string;
  merchant: string;
  glyph: string;
  category: SpendCategory;
  currency: string;
  occurrences: number;
  typicalAmount: number;
  totalInWindow: number;
  medianGapDays: number | null;
  confidence: RecurringConfidence;
  firstSeen: string;
  lastSeen: string;
  evidence: InsightEvidence;
}

const GAP_TOLERANCE_DAYS = 4;

export function detectRecurring(
  transactions: Transaction[],
  overrides: CategoryOverrides = {}
): RecurringCommitment[] {
  const rows = settledOutgoing(transactions).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const byMerchant = new Map<string, Transaction[]>();
  rows.forEach(t => {
    const key = merchantKey(t.merchant);
    const bucket = byMerchant.get(key);
    if (bucket) bucket.push(t);
    else byMerchant.set(key, [t]);
  });

  const results: RecurringCommitment[] = [];

  byMerchant.forEach(group => {
    if (group.length < 2) return;

    const times = group.map(t => new Date(t.date).getTime());
    const gaps = times.slice(1).map((t, i) => Math.round((t - times[i]) / DAY_MS));
    const medianGap = median(gaps);
    const amounts = group.map(t => t.amount);
    const typical = median(amounts) ?? amounts[0];

    let confidence: RecurringConfidence;
    if (group.length < 3 || medianGap === null) {
      confidence = 'INSUFFICIENT_HISTORY';
    } else {
      const tight = gaps.every(g => Math.abs(g - medianGap) <= GAP_TOLERANCE_DAYS);
      confidence = tight ? 'CONFIRMED' : 'PROBABLE';
    }

    const first = group[0];
    results.push({
      id: `recurring:${merchantKey(first.merchant)}`,
      merchant: first.merchant,
      glyph: first.glyph,
      category: categoryOf(first, overrides),
      currency: first.currency,
      occurrences: group.length,
      typicalAmount: typical,
      totalInWindow: amounts.reduce((sum, a) => sum + a, 0),
      medianGapDays: medianGap,
      confidence,
      firstSeen: first.date,
      lastSeen: group[group.length - 1].date,
      evidence: evidenceFor(
        `${group.length} settled payments to ${first.merchant} between ${dayLabel(first.date)} and ${dayLabel(group[group.length - 1].date)}.`,
        group,
        overrides
      ),
    });
  });

  return results.sort((a, b) => b.totalInWindow - a.totalInWindow);
}

/* ──────────────────────────────────────────────────────────────────
 * Savings projection
 * ────────────────────────────────────────────────────────────────── */

export interface SavingsProjection {
  target: number;
  saved: number;
  remaining: number;
  currency: string;
  windowDays: number;
  monthlyNet: number;
  monthsToTarget: number | null;
  targetDate: string | null;
  assumptions: string[];
  evidence: InsightEvidence;
}

/**
 * Projects a savings date from observed net cash flow. Deliberately naive and
 * deliberately explicit about it: the assumptions are returned alongside the
 * number so the screen shows them rather than burying them.
 */
export function projectSavings(
  transactions: Transaction[],
  goal: { saved: number; target: number; currency: string },
  overrides: CategoryOverrides = {}
): SavingsProjection {
  const remaining = Math.max(0, goal.target - goal.saved);

  if (transactions.length === 0) {
    return {
      ...zeroProjection(goal, remaining),
      assumptions: ['No transactions on record, so nothing can be projected.'],
      evidence: { basis: 'No transactions available.', lines: [] },
    };
  }

  const times = transactions.map(t => new Date(t.date).getTime());
  const start = Math.min(...times);
  const end = Math.max(...times);
  const windowDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1);

  const net = transactions
    .filter(t => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + (t.direction === 'IN' ? t.amount : -t.amount), 0);
  const monthlyNet = (net / windowDays) * 30.44;

  const monthsToTarget = monthlyNet > 0 ? remaining / monthlyNet : null;
  const targetDate =
    monthsToTarget === null
      ? null
      : new Date(Date.now() + monthsToTarget * 30.44 * DAY_MS).toISOString();

  return {
    target: goal.target,
    saved: goal.saved,
    remaining,
    currency: goal.currency,
    windowDays,
    monthlyNet,
    monthsToTarget,
    targetDate,
    assumptions: [
      `Based on ${windowDays} days of history, ${dayLabel(new Date(start).toISOString())} to ${dayLabel(new Date(end).toISOString())}.`,
      'Assumes the same money in and money out continues each month.',
      'Ignores scheduled payments that have not yet been taken.',
      // Extrapolating a month from a few weeks of history is unreliable, and a
      // single late salary can swing the whole figure — say so rather than let
      // the number look more settled than it is.
      ...(windowDays < MIN_RELIABLE_WINDOW_DAYS
        ? [
            `Fewer than ${MIN_RELIABLE_WINDOW_DAYS} days of history, so the monthly figure is an extrapolation and one unusual payment can swing it.`,
          ]
        : []),
      'An illustration only — not a bank commitment or an offer.',
    ],
    evidence: evidenceFor(
      `Net of every settled transaction in the window: ${money(net, goal.currency)} over ${windowDays} days.`,
      transactions.filter(t => t.status === 'COMPLETED'),
      overrides
    ),
  };
}

function zeroProjection(
  goal: { saved: number; target: number; currency: string },
  remaining: number
): SavingsProjection {
  return {
    target: goal.target,
    saved: goal.saved,
    remaining,
    currency: goal.currency,
    windowDays: 0,
    monthlyNet: 0,
    monthsToTarget: null,
    targetDate: null,
    assumptions: [],
    evidence: { basis: '', lines: [] },
  };
}
