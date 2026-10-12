import type { WorklistItem } from '@/services/api/dashboard-service';

/* One home for the rules that decide what a live application means: which column
   it sits in, how urgent it is, and what its next move is called.

   The status lists below mirror `credit.v_rm_worklist` as rewritten by
   `database/migrations/026_fix_dashboard_views_canonical_statuses.sql`. That view
   already computes `sla_breach_days` from a fixed set of per-status windows, so
   the board uses the same windows rather than inventing its own thresholds — a
   card may only call an application late because the bank said it was. */

export type BoardColumn = 'review' | 'credit' | 'offer' | 'signing' | 'done';

export interface ColumnDef {
  key: BoardColumn;
  label: string;
  /** What holds the ball here — one line, so the RM knows whose move it is. */
  hint: string;
  statuses: string[];
  /** Plum ramp step used to tint the column head. */
  tint: number;
}

export const COLUMNS: ColumnDef[] = [
  {
    key: 'review',
    label: 'New & verification',
    hint: 'Draft, submitted, KYC, documents',
    statuses: [
      'DRAFT',
      'SUBMITTED',
      'PENDING_KYC',
      'KYC_APPROVED',
      'PENDING_DOCUMENTS',
      'DOCUMENTS_RECEIVED',
    ],
    tint: 0.07,
  },
  {
    key: 'credit',
    label: 'Credit & underwriting',
    hint: 'With the bank',
    statuses: [
      'PENDING_CREDIT_CHECK',
      'CREDIT_APPROVED',
      'PENDING_UNDERWRITING',
      'IN_UNDERWRITING',
      'REFERRED_TO_SENIOR',
      'REFERRED_TO_UNDERWRITER',
      'UNDERWRITING_APPROVED',
      'PENDING_DECISION',
    ],
    tint: 0.11,
  },
  {
    key: 'offer',
    label: 'Decision & offer',
    hint: 'Approved or offered',
    statuses: ['APPROVED', 'OFFER_GENERATED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_COUNTERED'],
    tint: 0.16,
  },
  {
    /* Conditions, signature and booking share a column: a board that needs a
       horizontal scroll to read is no longer a scan, and to an RM these are the same
       state — decided, not yet funded. */
    key: 'signing',
    label: 'Conditions, signing & booking',
    hint: 'Decided, not yet funded',
    statuses: [
      'PENDING_CONDITIONS',
      'CONDITIONS_MET',
      'PENDING_ESIGN',
      'ESIGN_IN_PROGRESS',
      'ESIGN_COMPLETED',
      'PENDING_BOOKING',
      'BOOKING_IN_PROGRESS',
      'PENDING_DISBURSEMENT',
      'DISBURSEMENT_IN_PROGRESS',
    ],
    tint: 0.22,
  },
  {
    key: 'done',
    label: 'Completed',
    hint: 'Booked or active',
    statuses: ['BOOKED', 'DISBURSED', 'ACTIVE', 'CLOSED'],
    tint: 0,
  },
];

/** Applications that stopped moving; they are counted, not binned. */
const DECLINED = new Set([
  'DECLINED',
  'KYC_REJECTED',
  'CREDIT_DECLINED',
  'UNDERWRITING_DECLINED',
  'OFFER_REJECTED',
  'OFFER_EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
  'EXPIRED',
]);

const STATUS_TO_COLUMN = new Map<string, BoardColumn>();
COLUMNS.forEach(col => col.statuses.forEach(s => STATUS_TO_COLUMN.set(s, col.key)));

/**
 * A status the view can return that no column claims. The base
 * `dashboard_views.sql` and migration 026 disagree on a few codes, so anything
 * unexpected collects in its own column instead of vanishing from a board whose
 * totals are meant to reconcile against the KPI row.
 */
export const UNCLASSIFIED = 'unclassified';

/** A board column, or the catch-all a status lands in when no column claims it. */
export type ColumnKey = BoardColumn | typeof UNCLASSIFIED;

export function columnOf(status: string): ColumnKey | null {
  if (DECLINED.has(status)) return null;
  return STATUS_TO_COLUMN.get(status) ?? UNCLASSIFIED;
}

export function isDeclined(status: string): boolean {
  return DECLINED.has(status);
}

export function isDone(status: string): boolean {
  return status === 'BOOKED' || status === 'DISBURSED' || status === 'ACTIVE' || status === 'CLOSED';
}

/** Still moving: neither finished nor closed out. */
export function isLive(status: string): boolean {
  return !isDeclined(status) && !isDone(status);
}

/* The idle windows behind `sla_breach_days`, restated here so the board can show
   how much of a window is left — the API only reports the overrun. `submitted`
   means the clock runs from `submittedAt`; otherwise from the last write. */
interface Window {
  days: number;
  clock: 'submitted' | 'idle';
}

const WINDOWS: Record<string, Window> = {
  SUBMITTED: { days: 7, clock: 'submitted' },
  PENDING_KYC: { days: 3, clock: 'idle' },
  PENDING_DOCUMENTS: { days: 3, clock: 'idle' },
  PENDING_CREDIT_CHECK: { days: 3, clock: 'idle' },
  PENDING_UNDERWRITING: { days: 5, clock: 'idle' },
  IN_UNDERWRITING: { days: 5, clock: 'idle' },
  REFERRED_TO_SENIOR: { days: 5, clock: 'idle' },
  REFERRED_TO_UNDERWRITER: { days: 5, clock: 'idle' },
  OFFER_GENERATED: { days: 3, clock: 'idle' },
  OFFER_SENT: { days: 3, clock: 'idle' },
  PENDING_ESIGN: { days: 3, clock: 'idle' },
  PENDING_BOOKING: { days: 2, clock: 'idle' },
  BOOKING_IN_PROGRESS: { days: 2, clock: 'idle' },
};

export type RiskTier = 'high' | 'medium' | 'low';

export interface Risk {
  tier: RiskTier;
  /** Days the item has been running against its own window. */
  elapsed: number;
  limit: number | null;
  /** Days past the window, straight from the API when it is set. */
  over: number;
}

/**
 * How far an application is through the window the bank gave it.
 *
 * High is the API's own verdict — `slaBreachDays` is non-null exactly when the
 * view's CASE fired. Medium is the documented window with two days or less left
 * on it, so it warns without inventing a second definition of late. A status with
 * no window in the view can only ever be low: an unbuilt promise beats a guess.
 */
export function riskOf(item: WorklistItem): Risk | null {
  if (isDeclined(item.status) || isDone(item.status)) return null;

  const win = WINDOWS[item.status];
  const over = item.slaBreachDays ?? 0;
  const elapsed = win?.clock === 'submitted' ? item.daysSinceSubmitted : item.daysInCurrentStage;

  if (over > 0) {
    return { tier: 'high', elapsed, limit: win?.days ?? null, over };
  }
  if (win && win.days - elapsed <= 2) {
    return { tier: 'medium', elapsed, limit: win.days, over: 0 };
  }
  return { tier: 'low', elapsed, limit: win?.days ?? null, over: 0 };
}

/**
 * Days idle against the window the view allows this status. `elapsed > limit` with
 * `over === 0` really happens — the view's breach CASE for an issued offer needs
 * `decision_made_at`, and that column is NULL on most rows — so the phrase only
 * claims a share of the window while there is one left.
 */
export function idlePhrase(risk: Risk): { text: string; full: boolean } {
  const days = `${risk.elapsed} day${risk.elapsed === 1 ? '' : 's'} idle`;
  if (risk.limit === null || risk.elapsed > risk.limit) return { text: days, full: false };
  return { text: `${days} of ${risk.limit}`, full: true };
}

const ACRONYMS = ['KYC', 'AML', 'SLA', 'UW', 'PIN', 'AI', 'ESIGN', 'ID'];

/** Sentence case, per the dashboard's type standard: "Send offer", not "SEND OFFER". */
export function humanise(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map((word, i) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.includes(upper)) return upper === 'ESIGN' ? 'e-sign' : upper;
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(' ');
}

/* `next_action` is computed by the worklist view, so the board reads the bank's
   own instruction instead of a second mapping kept in TypeScript — the page used
   to carry one that had quietly drifted from the view's. Keys cover migration
   026 plus the codes the un-migrated base view still emits. */
const ACTION_LABELS: Record<string, string> = {
  COMPLETE_KYC: 'Complete KYC',
  REQUEST_DOCUMENTS: 'Request documents',
  COLLECT_DOCUMENTS: 'Collect documents',
  REVIEW_DOCUMENTS: 'Review documents',
  BEGIN_REVIEW: 'Begin review',
  RUN_CREDIT_CHECK: 'Run credit check',
  ASSIGN_UNDERWRITER: 'Assign underwriter',
  ASSIGN_TO_UNDERWRITER: 'Assign underwriter',
  AWAITING_DECISION: 'Await decision',
  TRACK_UNDERWRITING: 'Track underwriting',
  GENERATE_OFFER: 'Generate offer',
  SEND_OFFER: 'Send offer',
  SEND_OFFER_LETTER: 'Send offer letter',
  AWAITING_CUSTOMER: 'Await customer',
  PREPARE_SIGNING: 'Prepare signing',
  CONFIRM_SIGNATURE: 'Confirm signature',
  BOOK_FACILITY: 'Book facility',
  PROCESS_BOOKING: 'Process booking',
  DISBURSE_FUNDS: 'Disburse funds',
  FOLLOW_UP: 'Follow up',
};

export function nextActionLabel(item: WorklistItem): string {
  const code = item.nextAction;
  if (code && ACTION_LABELS[code]) return ACTION_LABELS[code];
  if (code) return humanise(code);
  return 'Review';
}

/** Why it is stuck, in the same voice as the action. */
export function blockerLabel(item: WorklistItem): string | null {
  const code = item.blockerReason;
  if (!code || code === 'NONE' || code === 'IN_PROGRESS') return null;
  if (code === 'COMPLETED' || code === 'CLOSED') return null;
  return humanise(code);
}

/* Next actions the view reports that are not something to press — the move is
   with the underwriter, the customer, or a system already running. They belong on
   the board and in the "waiting on the customer" count, not on an action list. */
/* Two views exist for this endpoint: migration 026 emits verb codes like
   ASSIGN_UNDERWRITER, the base `dashboard_views.sql` still emits
   TRACK_UNDERWRITING and SEND_OFFER_LETTER. Both spellings are listed, because on
   an action list a missed alias silently reads as "nothing to do". */
const RM_VERBS = new Set([
  'COMPLETE_KYC',
  'REQUEST_DOCUMENTS',
  'COLLECT_DOCUMENTS',
  'REVIEW_DOCUMENTS',
  'BEGIN_REVIEW',
  'RUN_CREDIT_CHECK',
  'ASSIGN_UNDERWRITER',
  'ASSIGN_TO_UNDERWRITER',
  'MAKE_DECISION',
  'REVIEW_DECISION',
  'GENERATE_OFFER',
  'SEND_OFFER',
  'SEND_OFFER_LETTER',
  'PREPARE_SIGNING',
  'CONFIRM_SIGNATURE',
  'BOOK_FACILITY',
  'PROCESS_BOOKING',
  'DISBURSE_FUNDS',
]);

const PASSIVE_ACTION = new Set([
  'AWAITING_DECISION',
  'AWAITING_CUSTOMER',
  'PROCESSING',
  'COMPLETED',
  'CLOSED',
  'TRACK_UNDERWRITING',
]);

/* Statuses where the next move is somebody else's: an underwriter assessing, or a
   customer accepting, signing or supplying a condition. */
const HELD_BY_OTHERS = new Set([
  'PENDING_UNDERWRITING',
  'IN_UNDERWRITING',
  'REFERRED_TO_SENIOR',
  'REFERRED_TO_UNDERWRITER',
  'OFFER_SENT',
  'OFFER_COUNTERED',
  'PENDING_ESIGN',
  'ESIGN_IN_PROGRESS',
  'PENDING_CONDITIONS',
]);

/**
 * True when there is a step the RM can perform right now.
 *
 * The view's own verb decides first: an application that is with an underwriter but
 * short of documents returns REQUEST_DOCUMENTS, and that is something to press. Only
 * a generic `next_action` (the CASE's ELSE, usually FOLLOW_UP) falls back to reading
 * the status for whose move it is.
 */
export function isRmAction(item: WorklistItem): boolean {
  if (!isLive(item.status)) return false;
  const code = item.nextAction;
  if (code && RM_VERBS.has(code)) return true;
  if (code && PASSIVE_ACTION.has(code)) return false;
  return !HELD_BY_OTHERS.has(item.status);
}

/* The view's own blocker reasons for "the next move is the customer's". Read off
   `blockerReason` rather than guessed from status, because a PENDING_DOCUMENTS row
   can be waiting on either side. */
const CUSTOMER_HELD = new Set([
  'KYC_PENDING',
  'AML_CHECK_PENDING',
  'MISSING_DOCUMENTS',
  'AWAITING_CUSTOMER_SIGNATURE',
  'AWAITING_ACCEPTANCE',
]);

const CUSTOMER_HELD_STATUS = new Set(['OFFER_SENT', 'OFFER_COUNTERED', 'PENDING_ESIGN', 'ESIGN_IN_PROGRESS']);

/**
 * What the view files as outstanding on the customer's side: their KYC, AML,
 * documents, acceptance or signature.
 *
 * This deliberately overlaps the action list rather than partitioning it. An
 * application referred to an underwriter that is still short of documents is both
 * "the customer owes us something" and "request the documents" — the view's
 * `blocker_reason` and `next_action` are two different questions about the same row,
 * so the two cards count the same application twice on purpose.
 */
export function awaitsCustomer(item: WorklistItem): boolean {
  if (!isLive(item.status)) return false;
  return CUSTOMER_HELD.has(item.blockerReason ?? '') || CUSTOMER_HELD_STATUS.has(item.status);
}

export interface BoardCell {
  column: ColumnKey;
  label: string;
  hint: string;
  /** Plum ramp step for the column head; 0 means "use the sentiment colour". */
  tint: number;
  items: WorklistItem[];
  value: number;
}

/**
 * Group the queue into board columns, most urgent first inside each. Every column
 * carries its own count and value so a header figure is a fact about the cards
 * under it, not a number fetched elsewhere and hoped to match.
 */
export function toBoard(items: WorklistItem[]): BoardCell[] {
  const buckets = new Map<ColumnKey, WorklistItem[]>();
  items.forEach(item => {
    const key = columnOf(item.status);
    if (!key) return;
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  });

  const order: ColumnKey[] = [...COLUMNS.map(c => c.key), UNCLASSIFIED];

  return order
    .map((key): BoardCell | null => {
      const column = COLUMNS.find(c => c.key === key);
      const list = (buckets.get(key) ?? []).sort((a, b) => riskRank(b) - riskRank(a));
      if (!list.length) return null;
      return {
        column: key,
        label: column?.label ?? 'Other statuses',
        hint: column?.hint ?? 'Not mapped by the worklist view',
        tint: column?.tint ?? 0.07,
        items: list,
        value: list.reduce((sum, i) => sum + (i.requestedAmount ?? 0), 0),
      };
    })
    .filter((c): c is BoardCell => c !== null);
}

/** Sort weight, highest first: an item already past its window outranks one with
 *  days to spare, and within that the larger facility goes on top.
 */
function riskRank(item: WorklistItem): number {
  const risk = riskOf(item);
  if (!risk) return -1;
  const money = Math.round((item.requestedAmount ?? 0) / 1000);
  if (risk.over > 0) return 1_000_000 + risk.over * 1_000 + money;
  /* Under its window: the fewer days left, the higher it sits. 400 separates
     "nearly out" from "no window on record" without overlapping either. */
  if (risk.limit === null) return 10_000 + money;
  const left = Math.max(0, risk.limit - risk.elapsed);
  return 400 - left * 20 + money;
}

/** The shared ordering for every list on the action band, so three panels of the
 *  same applications agree on what comes first. */
export function byUrgency(items: WorklistItem[]): WorklistItem[] {
  return [...items].sort((a, b) => riskRank(b) - riskRank(a));
}
