import type { WorklistItem } from '@/services/api/dashboard-service';
import { BoardColumn, UNCLASSIFIED, columnOf, riskOf } from '@/lib/application-buckets';

/* Pipeline funnel stages (grouped by the dashboard view) -> underlying LOMS statuses,
   so clicking a funnel stage can filter a worklist client-side. */
export const STAGE_STATUSES: Record<string, Set<string>> = {
  DRAFT: new Set(['DRAFT']),
  SUBMITTED: new Set(['SUBMITTED', 'PENDING_KYC', 'KYC_APPROVED', 'PENDING_DOCUMENTS', 'DOCUMENTS_RECEIVED']),
  UNDERWRITING: new Set([
    'PENDING_CREDIT_CHECK',
    'CREDIT_APPROVED',
    'PENDING_UNDERWRITING',
    'IN_UNDERWRITING',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'UNDERWRITING_APPROVED',
    'PENDING_DECISION',
  ]),
  APPROVED: new Set(['APPROVED']),
  OFFER: new Set([
    'OFFER_GENERATED',
    'OFFER_SENT',
    'OFFER_ACCEPTED',
    'OFFER_COUNTERED',
    'PENDING_CONDITIONS',
    'CONDITIONS_MET',
    'PENDING_ESIGN',
    'ESIGN_IN_PROGRESS',
    'ESIGN_COMPLETED',
  ]),
  BOOKING: new Set([
    'PENDING_BOOKING',
    'BOOKING_IN_PROGRESS',
    'BOOKED',
    'PENDING_DISBURSEMENT',
    'DISBURSEMENT_IN_PROGRESS',
    'DISBURSED',
  ]),
};

/* Aging heatmap buckets -> inclusive day ranges on daysInCurrentStage. */
export const AGE_BUCKET_RANGE: Record<string, [number, number]> = {
  '0-2': [0, 2],
  '3-7': [3, 7],
  '8-14': [8, 14],
  '15-30': [15, 30],
  '30+': [31, Number.MAX_SAFE_INTEGER],
};

export interface FocusFilter {
  stageFilter?: string | null;
  /** A board column: the same click on the pipeline filters the queue by that stage set. */
  columnFilter?: BoardColumn | typeof UNCLASSIFIED | null;
  ageFilter?: { stage: string; bucket: string } | null;
  riskOnly?: boolean;
}

/**
 * Past its status's SLA window, or within two days of it.
 *
 * This replaced `priorityScore >= 70`, which was never a risk signal: the view
 * builds that score as `(requested_amount / 100000) * 10 + days * 2`, so 70 is
 * roughly "a €700k facility", and it flagged large healthy applications while
 * letting a small one rot past its window.
 */
export function isAtRisk(item: WorklistItem): boolean {
  const tier = riskOf(item)?.tier;
  return tier === 'high' || tier === 'medium';
}

/** Client-side drill-through filter shared by the RM and Admin dashboards. */
export function matchesFocus(item: WorklistItem, f: FocusFilter): boolean {
  if (f.stageFilter) {
    const set = STAGE_STATUSES[f.stageFilter];
    if (set && !set.has(item.status)) return false;
  }
  if (f.columnFilter && columnOf(item.status) !== f.columnFilter) return false;
  if (f.ageFilter) {
    const range = AGE_BUCKET_RANGE[f.ageFilter.bucket];
    const days = item.daysInCurrentStage ?? 0;
    if (!range || item.status !== f.ageFilter.stage || days < range[0] || days > range[1]) return false;
  }
  if (f.riskOnly && !isAtRisk(item)) return false;
  return true;
}
