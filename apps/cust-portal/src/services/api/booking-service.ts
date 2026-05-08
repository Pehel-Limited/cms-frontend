import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────

export type BookingPhase =
  | 'PRE_BOOKING'
  | 'BOOKING'
  | 'BOOKED'
  | 'DISBURSEMENT'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'CLOSED';

export type MilestoneStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';

export interface BookingMilestone {
  key: string;
  label: string;
  description: string;
  status: MilestoneStatus;
  completedAt: string | null;
}

export interface BookingStatus {
  applicationId: string;
  applicationStatus: string;
  phase: BookingPhase;
  bookingStatus: string | null;
  disbursementStatus: string;
  arrangementId: string | null;
  accountNumber: string | null;
  disbursementReference: string | null;
  disbursementAmount: number | null;
  disbursementAccount: string | null;
  convertedToLoan: boolean;
  milestones: BookingMilestone[];
}

// ─── Phase display helpers ─────────────────────────────────────

export const PHASE_LABELS: Record<BookingPhase, string> = {
  PRE_BOOKING: 'Awaiting Booking',
  BOOKING: 'Booking in Progress',
  BOOKED: 'Loan Booked',
  DISBURSEMENT: 'Disbursing Funds',
  DISBURSED: 'Funds Disbursed',
  ACTIVE: 'Loan Active',
  CLOSED: 'Loan Closed',
};

export const PHASE_COLORS: Record<BookingPhase, string> = {
  PRE_BOOKING: 'bg-gray-100 text-gray-600',
  BOOKING: 'bg-blue-100 text-blue-700',
  BOOKED: 'bg-indigo-100 text-indigo-700',
  DISBURSEMENT: 'bg-amber-100 text-amber-700',
  DISBURSED: 'bg-green-100 text-green-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  COMPLETED: 'text-green-600',
  IN_PROGRESS: 'text-blue-600',
  PENDING: 'text-gray-300',
};

// ─── Booking-relevant application statuses ─────────────────────

export const BOOKING_STATUSES = [
  'PENDING_BOOKING',
  'BOOKING_IN_PROGRESS',
  'BOOKED',
  'PENDING_DISBURSEMENT',
  'DISBURSEMENT_IN_PROGRESS',
  'DISBURSED',
  'ACTIVE',
  'CLOSED',
] as const;

export function isBookingPhaseStatus(status: string): boolean {
  return (BOOKING_STATUSES as readonly string[]).includes(status);
}

// ─── Service ───────────────────────────────────────────────────

export const bookingService = {
  /** Get booking + disbursement milestones (read-only) */
  async getStatus(applicationId: string): Promise<BookingStatus> {
    return apiClient.get<BookingStatus>(
      `/api/customer/applications/${applicationId}/booking-status`
    );
  },
};
