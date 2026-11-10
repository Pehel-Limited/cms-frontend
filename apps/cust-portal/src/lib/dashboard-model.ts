import type { BankAccount, Transaction } from './banking-data';
import { detectRecurring } from './spending-insights';
import type { LoanApplication } from '@/services/api/application-service';
import type { CustomerTask, TaskPriority } from '@/services/api/task-service';
import type { CustomerCard } from '@/services/api/card-service';
import type { ConversationInboxRow } from '@/services/api/messaging-service';

/**
 * Derivations behind the SuperBank dashboard.
 *
 * Everything here is deterministic arithmetic over what the existing customer APIs already
 * return — accounts, statement lines, applications, tasks, cards and the message inbox. Nothing
 * is fetched, estimated by a model, or invented: where the data cannot support a figure, the
 * function returns null and the screen leaves the figure out.
 */

const DAY_MS = 86_400_000;

/* ──────────────────────────────────────────────────────────────────
 * Application lifecycle
 * ────────────────────────────────────────────────────────────────── */

export const TERMINAL_STATUSES = new Set([
  'COMPLETED', 'WITHDRAWN', 'CANCELLED', 'DECLINED', 'EXPIRED', 'UNDERWRITING_DECLINED',
  'CREDIT_DECLINED', 'KYC_REJECTED', 'OFFER_REJECTED', 'OFFER_EXPIRED', 'CLOSED',
]);

export const JOURNEY_STEPS = ['Applied', 'Identity & KYC', 'Documents', 'Credit review', 'Offer', 'Signing & funding'];

const JOURNEY_MATCH: string[][] = [
  ['DRAFT', 'SUBMITTED', 'RETURNED'],
  ['PENDING_KYC', 'KYC_APPROVED', 'KYC_REJECTED'],
  ['PENDING_DOCUMENTS', 'DOCUMENTS_RECEIVED'],
  [
    'PENDING_CREDIT_CHECK', 'CREDIT_APPROVED', 'PENDING_UNDERWRITING', 'IN_UNDERWRITING',
    'REFERRED_TO_SENIOR', 'REFERRED_TO_UNDERWRITER', 'PENDING_DECISION', 'UNDERWRITING_APPROVED',
  ],
  [
    'APPROVED', 'OFFER_GENERATED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_COUNTERED',
    'PENDING_CONDITIONS', 'CONDITIONS_MET',
  ],
  [
    'PENDING_ESIGN', 'ESIGN_IN_PROGRESS', 'ESIGN_COMPLETED', 'PENDING_BOOKING', 'BOOKING_IN_PROGRESS',
    'BOOKED', 'PENDING_DISBURSEMENT', 'DISBURSEMENT_IN_PROGRESS', 'DISBURSED',
  ],
];

export function journeyStep(status: string): number {
  return JOURNEY_MATCH.findIndex(m => m.includes(status));
}

const isLiveOffer = (app: LoanApplication, now: number) =>
  app.offerValidUntil != null && !app.offerAccepted && new Date(app.offerValidUntil).getTime() > now;

/** How urgently this application needs the customer, not the bank. 0 = it does not. */
export function appUrgency(app: LoanApplication, now = Date.now()): number {
  if (app.status === 'RETURNED' || app.lomsStatus === 'RETURNED') return 5;
  if (app.status === 'PENDING_ESIGN' || app.status === 'ESIGN_IN_PROGRESS') return 4;
  if (isLiveOffer(app, now)) return 3;
  if ((app.documentsPendingCount ?? 0) > 0) return 2;
  if (app.status === 'DRAFT') return 1;
  return 0;
}

export function appTitle(app: LoanApplication, purposeLabels: Record<string, string>): string {
  return app.product?.productName || purposeLabels[app.loanPurpose] || app.loanPurpose || 'Application';
}

/** The application the customer most needs to see: most urgent, then most recently moved. */
export function featuredApplication(apps: LoanApplication[]): LoanApplication | null {
  const active = apps.filter(a => !TERMINAL_STATUSES.has(a.status));
  const pool = active.length > 0 ? active : apps;
  return (
    [...pool].sort(
      (a, b) =>
        (active.length > 0 ? appUrgency(b) - appUrgency(a) : 0) ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0] ?? null
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Zone 1 — Financial position
 * ────────────────────────────────────────────────────────────────── */

export interface FinancialPosition {
  /** The currency every headline figure is stated in. */
  currency: string;
  /** Spendable money across deposit accounts in `currency`. */
  available: number;
  /** Ledger balance across the same accounts. */
  balance: number;
  depositCount: number;
  /** Capital still owed on CREDIT accounts in `currency`; null when the customer holds none. */
  owed: number | null;
  creditCount: number;
  /** Accounts left out of the headline because they are held in another currency. */
  otherCurrencyCount: number;
  /** Newest balance timestamp, when the service supplied one. */
  asOf: string | null;
}

export function primaryCurrency(accounts: BankAccount[]): string {
  return (
    accounts.find(a => a.primary)?.currency ??
    accounts.find(a => a.type === 'CURRENT' && a.accountCategory !== 'CREDIT')?.currency ??
    accounts[0]?.currency ??
    'EUR'
  );
}

/**
 * A loan account's balance is money owed, not money held, so it is reported separately rather
 * than netted into "what you have". Balances in other currencies are not converted — there is no
 * rate service to convert them with — so they are counted and named instead of summed.
 */
export function financialPosition(accounts: BankAccount[]): FinancialPosition {
  const currency = primaryCurrency(accounts);
  const deposits = accounts.filter(a => a.accountCategory !== 'CREDIT');
  const credit = accounts.filter(a => a.accountCategory === 'CREDIT');
  const inCcy = deposits.filter(a => a.currency === currency);
  const creditInCcy = credit.filter(a => a.currency === currency);
  const stamps = accounts.map(a => a.balanceAsOf).filter((s): s is string => Boolean(s)).sort();

  return {
    currency,
    available: inCcy.reduce((s, a) => s + a.available, 0),
    balance: inCcy.reduce((s, a) => s + a.balance, 0),
    depositCount: deposits.length,
    owed: credit.length > 0 ? creditInCcy.reduce((s, a) => s + Math.abs(a.balance), 0) : null,
    creditCount: credit.length,
    otherCurrencyCount: accounts.length - inCcy.length - creditInCcy.length,
    asOf: stamps.length ? stamps[stamps.length - 1] : null,
  };
}

/* ──────────────────────────────────────────────────────────────────
 * Zone 4 — Month to date cash flow
 * ────────────────────────────────────────────────────────────────── */

export interface MonthFlow {
  currency: string;
  moneyIn: number;
  moneyOut: number;
  /** The same number of days last month, so a part-month is never compared to a whole one. */
  lastIn: number | null;
  lastOut: number | null;
  dayOfMonth: number;
  /** Rows that made up this month's figures. */
  count: number;
}

const counts = (t: Transaction) => t.status === 'COMPLETED' || t.status === 'PENDING';

/**
 * Money in and out this month to date, beside the matching span of last month. The comparison
 * is withheld (null) when the fetched history does not reach back to the start of last month,
 * because a figure built from half the period would read as a fall in spending.
 */
export function monthFlow(
  transactions: Transaction[],
  currency: string,
  now = new Date(),
  historyStart?: Date
): MonthFlow {
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const day = now.getDate();
  const lastMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const endLast = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(day, lastMonthDays) + 1);

  const rows = transactions.filter(t => t.currency === currency && counts(t));
  const sum = (from: Date, to: Date, dir: 'IN' | 'OUT') =>
    rows
      .filter(t => {
        const d = new Date(t.date);
        return t.direction === dir && d >= from && d < to;
      })
      .reduce((s, t) => s + t.amount, 0);

  const oldest = historyStart ?? (rows.length
    ? new Date(Math.min(...rows.map(t => new Date(t.date).getTime())))
    : now);
  const covered = oldest <= startLast;
  const thisRows = rows.filter(t => new Date(t.date) >= startThis && new Date(t.date) <= now);

  return {
    currency,
    moneyIn: sum(startThis, new Date(now.getTime() + 1), 'IN'),
    moneyOut: sum(startThis, new Date(now.getTime() + 1), 'OUT'),
    lastIn: covered ? sum(startLast, endLast, 'IN') : null,
    lastOut: covered ? sum(startLast, endLast, 'OUT') : null,
    dayOfMonth: day,
    count: thisRows.length,
  };
}

/* ──────────────────────────────────────────────────────────────────
 * Zone 3 — Needs your attention
 * ────────────────────────────────────────────────────────────────── */

export type AttentionTone = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  tone: AttentionTone;
  /** Higher sorts first. */
  rank: number;
  title: string;
  detail: string;
  cta: string;
  href: string;
  glyph: string;
  dueAt?: string | null;
}

const PRIORITY_RANK: Record<TaskPriority, number> = { CRITICAL: 90, HIGH: 70, MEDIUM: 50, LOW: 30 };

/** The application-level situation a task stands for, so a task and its derived row never both show. */
const TASK_KIND: Record<string, string> = {
  SIGN_AGREEMENT: 'sign',
  ACCEPT_OFFER: 'offer',
  UPLOAD_DOCUMENT: 'documents',
  PROVIDE_KYC_DOCUMENTS: 'documents',
  FIX_APPLICATION_FIELDS: 'returned',
  REQUEST_MISSING_INFO: 'returned',
};

const TASK_GLYPH: Record<string, string> = {
  sign: 'sign',
  offer: 'check',
  documents: 'doc',
  returned: 'alert',
};

/** Only work the customer can do. Reviews sit with the bank and are not the customer's to clear. */
const CUSTOMER_TASK_TYPES = new Set(Object.keys(TASK_KIND));

function dueText(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - now) / DAY_MS);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export interface AttentionInputs {
  tasks: CustomerTask[];
  apps: LoanApplication[];
  inbox: ConversationInboxRow[];
  cards: CustomerCard[];
  purposeLabels: Record<string, string>;
  now?: number;
}

export function buildAttention({
  tasks,
  apps,
  inbox,
  cards,
  purposeLabels,
  now = Date.now(),
}: AttentionInputs): AttentionItem[] {
  const items: AttentionItem[] = [];
  const covered = new Set<string>();
  const appById = new Map(apps.map(a => [a.applicationId, a]));

  tasks
    .filter(t => ['OPEN', 'IN_PROGRESS', 'WAITING'].includes(t.status) && CUSTOMER_TASK_TYPES.has(t.taskType))
    .forEach(t => {
      const kind = TASK_KIND[t.taskType];
      covered.add(`${t.applicationId}:${kind}`);
      const overdue = t.slaDueAt != null && new Date(t.slaDueAt).getTime() < now;
      const app = appById.get(t.applicationId);
      const due = dueText(t.slaDueAt, now);
      items.push({
        id: `task:${t.id}`,
        tone: overdue || t.priority === 'CRITICAL' ? 'critical' : 'warning',
        rank: PRIORITY_RANK[t.priority] + (overdue ? 25 : 0),
        title: t.title,
        detail: [app ? appTitle(app, purposeLabels) : null, due].filter(Boolean).join(' · ') || 'From your bank',
        cta: kind === 'sign' ? 'Sign' : kind === 'documents' ? 'Upload' : kind === 'offer' ? 'Review' : 'Open',
        href:
          kind === 'sign'
            ? `/portal/applications/${t.applicationId}/signing`
            : kind === 'documents'
              ? '/portal/documents'
              : `/portal/applications/${t.applicationId}`,
        glyph: TASK_GLYPH[kind],
        dueAt: t.slaDueAt,
      });
    });

  apps
    .filter(a => !TERMINAL_STATUSES.has(a.status))
    .forEach(a => {
      const name = appTitle(a, purposeLabels);
      const base = `/portal/applications/${a.applicationId}`;
      const push = (kind: string, item: Omit<AttentionItem, 'id'>) => {
        if (covered.has(`${a.applicationId}:${kind}`)) return;
        covered.add(`${a.applicationId}:${kind}`);
        items.push({ id: `app:${a.applicationId}:${kind}`, ...item });
      };

      if (a.status === 'RETURNED' || a.lomsStatus === 'RETURNED') {
        push('returned', {
          tone: 'critical', rank: 85, title: 'Your application needs changes',
          detail: `${name} · returned by the bank`, cta: 'Fix', href: base, glyph: 'alert',
        });
      }
      if (a.status === 'PENDING_ESIGN' || a.status === 'ESIGN_IN_PROGRESS') {
        push('sign', {
          tone: 'critical', rank: 80, title: 'Sign your loan agreement',
          detail: `${name} · ready to sign`, cta: 'Sign', href: `${base}/signing`, glyph: 'sign',
        });
      }
      if (isLiveOffer(a, now)) {
        const due = dueText(a.offerValidUntil, now);
        push('offer', {
          tone: 'warning', rank: 75, title: 'Your offer is waiting',
          detail: [name, due ? due.replace('Due', 'Expires') : null].filter(Boolean).join(' · '),
          cta: 'Review', href: base, glyph: 'check', dueAt: a.offerValidUntil,
        });
      }
      const pendingDocs = a.documentsPendingCount ?? 0;
      if (pendingDocs > 0) {
        push('documents', {
          tone: 'warning', rank: 60,
          title: `Upload ${pendingDocs} document${pendingDocs === 1 ? '' : 's'}`,
          detail: `${name} · needed to continue`, cta: 'Upload', href: '/portal/documents', glyph: 'doc',
        });
      }
      if (a.status === 'DRAFT') {
        push('draft', {
          tone: 'info', rank: 20, title: 'Finish your application',
          detail: `${name} · saved as a draft`, cta: 'Resume', href: base, glyph: 'clock',
        });
      }
    });

  inbox
    .filter(r => (r.unreadCount || 0) > 0)
    .forEach(r => {
      items.push({
        id: `msg:${r.conversation.id}`,
        tone: 'warning',
        rank: 65,
        title: `${r.unreadCount} new message${r.unreadCount === 1 ? '' : 's'} from the bank`,
        detail: r.lastMessage?.senderName || r.conversation.subject || 'Your relationship manager',
        cta: 'Reply',
        href: `/portal/messages?application=${r.conversation.applicationId}`,
        glyph: 'send',
      });
    });

  const replaced = new Set(cards.map(c => c.replacesCardId).filter(Boolean));
  cards.forEach(c => {
    const label = `${c.nickname || `${c.cardType === 'CREDIT' ? 'Credit' : 'Debit'} card`} ·••• ${c.panLast4}`;
    if ((c.status === 'LOST' || c.status === 'STOLEN') && !replaced.has(c.cardId)) {
      items.push({
        id: `card:${c.cardId}:blocked`, tone: 'critical', rank: 70,
        title: 'Your card is blocked', detail: `${label} · order a replacement`,
        cta: 'Replace', href: '/portal/cards', glyph: 'alert',
      });
    } else if (c.status === 'FROZEN') {
      items.push({
        id: `card:${c.cardId}:frozen`, tone: 'info', rank: 25,
        title: 'Card frozen', detail: `${label} · unfreeze it any time`,
        cta: 'Manage', href: '/portal/cards', glyph: 'snowflake',
      });
    } else if (c.status === 'ACTIVE' && !c.expired) {
      const expiry = new Date(c.expiryYear, c.expiryMonth, 0).getTime();
      const days = Math.ceil((expiry - now) / DAY_MS);
      if (days >= 0 && days <= 45 && !replaced.has(c.cardId)) {
        items.push({
          id: `card:${c.cardId}:expiring`, tone: 'info', rank: 22,
          title: 'Card expiring soon', detail: `${label} · expires in ${days} day${days === 1 ? '' : 's'}`,
          cta: 'View', href: '/portal/cards', glyph: 'clock',
        });
      }
    }
  });

  return items.sort(
    (a, b) =>
      b.rank - a.rank ||
      (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity)
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Zone 4 — Coming up
 * ────────────────────────────────────────────────────────────────── */

export interface UpcomingItem {
  id: string;
  date: string;
  title: string;
  detail: string;
  amount?: number;
  currency?: string;
  href: string;
  glyph: string;
  /** Plain words for how the date was arrived at, so a predicted date is never presented as a booked one. */
  basis: 'predicted' | 'deadline';
}

/**
 * The next month of commitments that the data can actually support:
 *
 *  - Payments the history shows recurring with a steady interval (CONFIRMED only). The date is
 *    the last payment plus the observed interval, and is labelled as predicted. There is no
 *    standing-order API, so nothing here claims to be scheduled.
 *  - Task deadlines and offer expiries, which are dates the bank recorded.
 */
export function buildUpcoming(
  transactions: Transaction[],
  tasks: CustomerTask[],
  apps: LoanApplication[],
  purposeLabels: Record<string, string>,
  horizonDays = 30,
  now = Date.now()
): UpcomingItem[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const horizon = today.getTime() + horizonDays * DAY_MS;
  const items: UpcomingItem[] = [];

  detectRecurring(transactions)
    .filter(r => r.confidence === 'CONFIRMED' && r.medianGapDays != null && r.medianGapDays >= 6 && r.medianGapDays <= 35)
    .forEach(r => {
      const gap = r.medianGapDays as number;
      let next = new Date(r.lastSeen).getTime() + gap * DAY_MS;
      // A payment that should already have gone out and has not is more likely stopped than late.
      if (next < today.getTime() - 4 * DAY_MS) return;
      if (next < today.getTime()) next = today.getTime();
      if (next > horizon) return;
      items.push({
        id: r.id,
        date: new Date(next).toISOString(),
        title: r.merchant,
        detail: `${gap >= 26 ? 'Monthly' : gap <= 8 ? 'Weekly' : `Every ${gap} days`} · seen ${r.occurrences}×`,
        amount: r.typicalAmount,
        currency: r.currency,
        href: '/portal/payments',
        glyph: r.category,
        basis: 'predicted',
      });
    });

  tasks
    .filter(t => ['OPEN', 'IN_PROGRESS', 'WAITING'].includes(t.status) && t.slaDueAt)
    .forEach(t => {
      const due = new Date(t.slaDueAt as string).getTime();
      if (due < today.getTime() || due > horizon) return;
      items.push({
        id: `task:${t.id}`,
        date: t.slaDueAt as string,
        title: t.title,
        detail: 'Task deadline',
        href: '/portal/tasks',
        glyph: 'calendar',
        basis: 'deadline',
      });
    });

  apps
    .filter(a => isLiveOffer(a, now))
    .forEach(a => {
      const until = new Date(a.offerValidUntil as string).getTime();
      if (until > horizon) return;
      items.push({
        id: `offer:${a.applicationId}`,
        date: a.offerValidUntil as string,
        title: `${appTitle(a, purposeLabels)} offer expires`,
        detail: 'Offer deadline',
        amount: a.approvedAmount,
        href: `/portal/applications/${a.applicationId}`,
        glyph: 'clock',
        basis: 'deadline',
      });
    });

  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function formatMoney(amount: number, currency: string, signed = false): string {
  const text = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  if (!signed) return amount < 0 ? `−${text}` : text;
  return `${amount >= 0 ? '+' : '−'}${text}`;
}

export function relativeDay(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
