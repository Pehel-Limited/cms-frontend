// types/loms.ts
// LOMS (Loan Origination Management System) Types

/**
 * LOMS Application Status - follows LOMS.md state machine
 * Includes both UI display names and backend status names
 */
export type LomsApplicationStatus =
  // Initial States
  | 'DRAFT'
  | 'SUBMITTED'
  // KYC/AML Check States
  | 'PENDING_KYC'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  // Document Collection
  | 'PENDING_DOCUMENTS'
  | 'DOCUMENTS_RECEIVED'
  // Credit Assessment States
  | 'PENDING_CREDIT_CHECK'
  | 'CREDIT_APPROVED'
  | 'CREDIT_DECLINED'
  // Underwriting States
  | 'PENDING_UNDERWRITING'
  | 'IN_UNDERWRITING'
  | 'UNDERWRITING_APPROVED'
  | 'UNDERWRITING_DECLINED'
  | 'REFERRED_TO_SENIOR'
  | 'REFERRED_TO_UNDERWRITER'
  // Decision/Offer States
  | 'PENDING_DECISION'
  | 'APPROVED'
  | 'DECLINED'
  | 'OFFER_GENERATED'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_EXPIRED'
  | 'OFFER_COUNTERED'
  // Conditions Precedent
  | 'PENDING_CONDITIONS'
  | 'CONDITIONS_MET'
  // E-Signature States
  | 'PENDING_ESIGN'
  | 'ESIGN_IN_PROGRESS'
  | 'ESIGN_COMPLETED'
  // Booking/Disbursement States
  | 'PENDING_BOOKING'
  | 'BOOKING_IN_PROGRESS'
  | 'BOOKED'
  | 'PENDING_DISBURSEMENT'
  | 'DISBURSEMENT_IN_PROGRESS'
  | 'DISBURSED'
  // Terminal States
  | 'CANCELLED'
  | 'WITHDRAWN'
  | 'EXPIRED';

/**
 * Workflow phases for progress display
 */
export type WorkflowPhase =
  | 'INITIATION'
  | 'VERIFICATION'
  | 'DECISIONING'
  | 'OFFER_MANAGEMENT'
  | 'SIGNATURE'
  | 'BOOKING'
  | 'COMPLETED';

/**
 * Status metadata for display
 */
export interface StatusInfo {
  status: LomsApplicationStatus;
  displayName: string;
  description: string;
  phase: WorkflowPhase;
  phaseName: string;
  progress: number;
  validTransitions: LomsApplicationStatus[];
  canCancel: boolean;
  canWithdraw: boolean;
  isTerminal: boolean;
  requiresAction: boolean;
}

/**
 * Task types in workflow
 */
export type TaskType =
  | 'REQUEST_MISSING_INFO'
  | 'REVIEW_FICO_REFER'
  | 'APPROVE_OVERRIDE'
  | 'REVIEW_DECLINE'
  | 'VERIFY_GREEN_ELIGIBILITY'
  | 'VERIFY_COLLATERAL'
  | 'BOOKING_EXCEPTION'
  | 'UNDERWRITING_REVIEW';

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskQueue = 'UNDERWRITING' | 'COMPLIANCE' | 'RM' | 'OPS';

export interface WorkflowTask {
  id: string;
  applicationId: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  queue: TaskQueue;
  assignedTo?: string;
  assigneeName?: string;
  slaDueAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  outcome?: string;
  completedAt?: string;
}

/**
 * Approval types (maker-checker)
 */
export type ApprovalType = 'DECISION_OVERRIDE' | 'PRICING_OVERRIDE' | 'POLICY_EXCEPTION';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Approval {
  id: string;
  applicationId: string;
  approvalType: ApprovalType;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  reasonCode: string;
  comment?: string;
  originalValue?: string;
  requestedValue?: string;
  justification?: string;
  createdAt: string;
  decidedAt?: string;
}

/**
 * Offer entity
 */
export type OfferStatus = 'DRAFT' | 'ISSUED' | 'EXPIRED' | 'ACCEPTED' | 'VOIDED';
export type RateType = 'FIXED' | 'VARIABLE';
export type RepaymentFrequency = 'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY';

export interface Offer {
  id: string;
  applicationId: string;
  version: number;
  status: OfferStatus;
  amount: number;
  currency: string;
  termMonths: number;
  rateType: RateType;
  interestRate: number;
  apr?: number;
  fees?: Record<string, number>;
  repaymentFrequency: RepaymentFrequency;
  repaymentEstimate?: number;
  expiryAt: string;
  createdAt: string;
  conditions?: OfferCondition[];
}

/**
 * Offer conditions (CP checklist)
 */
export type ConditionType =
  | 'KYC_COMPLETE'
  | 'COLLATERAL_VERIFIED'
  | 'GREEN_PROOF'
  | 'INSURANCE'
  | 'BOARD_RESOLUTION'
  | 'OTHER';

export type ConditionStatus = 'PENDING' | 'SATISFIED' | 'WAIVED';

export interface OfferCondition {
  id: string;
  offerId: string;
  conditionType: ConditionType;
  status: ConditionStatus;
  description?: string;
  documentReference?: string;
  satisfiedBy?: string;
  satisfiedAt?: string;
  waivedBy?: string;
  waivedAt?: string;
  notes?: string;
}

/**
 * E-Signature envelope
 */
export type EnvelopeStatus =
  | 'CREATED'
  | 'SENT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'VOIDED'
  | 'EXPIRED';

export interface DocusignEnvelope {
  id: string;
  offerId: string;
  envelopeId: string;
  status: EnvelopeStatus;
  recipientEmail: string;
  recipientName: string;
  signingUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastEventAt?: string;
  completedAt?: string;
}

/**
 * Loan booking
 */
export type BookingStatus = 'REQUESTED' | 'BOOKED' | 'FAILED';
export type DisbursementStatus = 'PENDING' | 'INITIATED' | 'COMPLETED' | 'FAILED';

export interface LoanBooking {
  id: string;
  applicationId: string;
  temenosArrangementId?: string;
  bookingStatus: BookingStatus;
  disbursementStatus?: DisbursementStatus;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Audit event
 */
export interface AuditEvent {
  id: string;
  applicationId: string;
  eventType: string;
  eventSubType?: string;
  eventTimestamp: string;
  actorId?: string;
  actorName?: string;
  actorType?: string;
  previousState?: string;
  newState?: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Application snapshot (immutable evidence)
 */
export type SnapshotType =
  | 'KYC_RESULT'
  | 'FINANCIAL_PROFILE'
  | 'FICO_REQUEST'
  | 'FICO_RESPONSE'
  | 'OFFER_TERMS'
  | 'DOC_PACK_METADATA'
  | 'DOCUSIGN_ENVELOPE_REQUEST'
  | 'DOCUSIGN_ENVELOPE_STATUS'
  | 'TEMENOS_SIMULATION_REQUEST'
  | 'TEMENOS_SIMULATION_RESPONSE'
  | 'TEMENOS_BOOKING_REQUEST'
  | 'TEMENOS_BOOKING_RESPONSE';

export interface ApplicationSnapshot {
  id: string;
  applicationId: string;
  snapshotType: SnapshotType;
  version: number;
  payload: Record<string, unknown>;
  payloadHash: string;
  createdAt: string;
  createdBy?: string;
}

/**
 * FICO Decision
 */
export type FicoDecisionOutcome = 'APPROVE' | 'DECLINE' | 'REFER';

export interface FicoDecisionResponse {
  decisionId: string;
  outcome: FicoDecisionOutcome;
  approvedAmount?: number;
  approvedTermMin?: number;
  approvedTermMax?: number;
  suggestedRate?: number;
  reasonCodes: string[];
  conditions: string[];
}

/**
 * Workflow action request types
 */
export interface TransitionStatusRequest {
  currentStatus: string;
  targetStatus: string;
  actorId: string;
  reason?: string;
}

export interface ClaimTaskRequest {
  assigneeId: string;
}

export interface CompleteTaskRequest {
  completedBy: string;
  decision: string;
  notes?: string;
  approvedAmount?: number;
  approvedRate?: number;
}

export interface CreateApprovalRequest {
  applicationId: string;
  entityType: string;
  entityId?: string;
  approvalType: ApprovalType;
  makerId: string;
  originalValue?: string;
  requestedValue?: string;
  justification: string;
}

export interface ApprovalDecisionRequest {
  checkerId: string;
  decision: 'APPROVED' | 'REJECTED';
  comment?: string;
}

export interface SatisfyConditionRequest {
  documentId?: string;
  satisfiedBy: string;
  notes?: string;
}

export interface WaiveConditionRequest {
  approvedBy: string;
  reason: string;
}

/**
 * Status display configuration
 */
export const STATUS_CONFIG: Record<
  LomsApplicationStatus,
  {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: string;
  }
> = {
  DRAFT: {
    label: 'Draft',
    description: 'Application is being prepared',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '📝',
  },
  SUBMITTED: {
    label: 'Submitted',
    description: 'Application submitted for processing',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    icon: '📤',
  },
  PENDING_KYC: {
    label: 'Pending KYC',
    description: 'Awaiting KYC/AML verification',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    icon: '🔍',
  },
  REFERRED_TO_SENIOR: {
    label: 'Under Review',
    description: 'Referred for senior review',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    icon: '👤',
  },
  REFERRED_TO_UNDERWRITER: {
    label: 'Under Review',
    description: 'Assigned to underwriter for review',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: '🔎',
  },
  DECLINED: {
    label: 'Declined',
    description: 'Application declined',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: '❌',
  },
  OFFER_GENERATED: {
    label: 'Offer Ready',
    description: 'Offer generated, ready for review',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-300',
    icon: '📋',
  },
  BOOKED: {
    label: 'Booked',
    description: 'Successfully booked',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    icon: '🎉',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'Application cancelled',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '🚫',
  },
  APPROVED: {
    label: 'Approved',
    description: 'Application approved',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: '✅',
  },
  PENDING_CREDIT_CHECK: {
    label: 'Credit Check',
    description: 'Running credit checks',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    icon: '⚙️',
  },
  PENDING_UNDERWRITING: {
    label: 'Underwriting',
    description: 'Manual underwriting review',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    icon: '👤',
  },
  OFFER_SENT: {
    label: 'Offer Sent',
    description: 'Offer sent to customer',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-300',
    icon: '📧',
  },
  PENDING_ESIGN: {
    label: 'Pending E-Sign',
    description: 'Awaiting electronic signature',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    borderColor: 'border-cyan-300',
    icon: '✍️',
  },
  ESIGN_IN_PROGRESS: {
    label: 'Signing',
    description: 'E-signature in progress',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    borderColor: 'border-cyan-300',
    icon: '✍️',
  },
  ESIGN_COMPLETED: {
    label: 'Signed',
    description: 'Documents signed',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
    borderColor: 'border-teal-300',
    icon: '📝',
  },
  PENDING_BOOKING: {
    label: 'Pending Booking',
    description: 'Ready for booking',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: '📚',
  },
  BOOKING_IN_PROGRESS: {
    label: 'Booking',
    description: 'Booking in progress',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: '📚',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    description: 'Application withdrawn by customer',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '↩️',
  },
  EXPIRED: {
    label: 'Expired',
    description: 'Application expired',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '⏰',
  },
  KYC_APPROVED: {
    label: 'KYC Approved',
    description: 'KYC verification passed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: '✅',
  },
  KYC_REJECTED: {
    label: 'KYC Rejected',
    description: 'KYC verification failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: '❌',
  },
  PENDING_DOCUMENTS: {
    label: 'Pending Documents',
    description: 'Awaiting required documents',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    icon: '📄',
  },
  DOCUMENTS_RECEIVED: {
    label: 'Documents Received',
    description: 'All required documents collected',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    icon: '📋',
  },
  CREDIT_APPROVED: {
    label: 'Credit Approved',
    description: 'Credit check passed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: '✅',
  },
  CREDIT_DECLINED: {
    label: 'Credit Declined',
    description: 'Credit check failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: '❌',
  },
  IN_UNDERWRITING: {
    label: 'In Underwriting',
    description: 'Actively being underwritten',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    icon: '👤',
  },
  UNDERWRITING_APPROVED: {
    label: 'Underwriting Approved',
    description: 'Underwriting approved',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: '✅',
  },
  UNDERWRITING_DECLINED: {
    label: 'Underwriting Declined',
    description: 'Underwriting declined',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: '❌',
  },
  PENDING_DECISION: {
    label: 'Pending Decision',
    description: 'Awaiting final decision',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    icon: '⚙️',
  },
  OFFER_ACCEPTED: {
    label: 'Offer Accepted',
    description: 'Customer accepted offer',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: '✅',
  },
  OFFER_REJECTED: {
    label: 'Offer Rejected',
    description: 'Customer rejected offer',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: '❌',
  },
  OFFER_EXPIRED: {
    label: 'Offer Expired',
    description: 'Offer validity expired',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '⏰',
  },
  OFFER_COUNTERED: {
    label: 'Offer Countered',
    description: 'Customer requested modification',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: '↩️',
  },
  PENDING_CONDITIONS: {
    label: 'Pending Conditions',
    description: 'Conditions precedent not fulfilled',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    icon: '📋',
  },
  CONDITIONS_MET: {
    label: 'Conditions Met',
    description: 'All conditions satisfied',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: '✅',
  },
  PENDING_DISBURSEMENT: {
    label: 'Pending Disbursement',
    description: 'Awaiting disbursement',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: '💰',
  },
  DISBURSEMENT_IN_PROGRESS: {
    label: 'Disbursing',
    description: 'Disbursement processing',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: '💰',
  },
  DISBURSED: {
    label: 'Disbursed',
    description: 'Amount disbursed',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    icon: '🎉',
  },
};

/**
 * Workflow phases configuration
 */
export const WORKFLOW_PHASES: {
  phase: WorkflowPhase;
  label: string;
  statuses: LomsApplicationStatus[];
}[] = [
  {
    phase: 'INITIATION',
    label: 'Application',
    statuses: ['DRAFT', 'SUBMITTED'],
  },
  {
    phase: 'VERIFICATION',
    label: 'Verification',
    statuses: [
      'PENDING_KYC',
      'KYC_APPROVED',
      'KYC_REJECTED',
      'PENDING_DOCUMENTS',
      'DOCUMENTS_RECEIVED',
    ],
  },
  {
    phase: 'DECISIONING',
    label: 'Decision',
    statuses: [
      'PENDING_CREDIT_CHECK',
      'CREDIT_APPROVED',
      'CREDIT_DECLINED',
      'PENDING_UNDERWRITING',
      'IN_UNDERWRITING',
      'UNDERWRITING_APPROVED',
      'UNDERWRITING_DECLINED',
      'REFERRED_TO_SENIOR',
      'REFERRED_TO_UNDERWRITER',
      'PENDING_DECISION',
      'APPROVED',
      'DECLINED',
    ],
  },
  {
    phase: 'OFFER_MANAGEMENT',
    label: 'Offer',
    statuses: [
      'OFFER_GENERATED',
      'OFFER_SENT',
      'OFFER_ACCEPTED',
      'OFFER_REJECTED',
      'OFFER_EXPIRED',
      'OFFER_COUNTERED',
      'PENDING_CONDITIONS',
      'CONDITIONS_MET',
    ],
  },
  {
    phase: 'SIGNATURE',
    label: 'Signature',
    statuses: ['PENDING_ESIGN', 'ESIGN_IN_PROGRESS', 'ESIGN_COMPLETED'],
  },
  {
    phase: 'BOOKING',
    label: 'Booking',
    statuses: [
      'PENDING_BOOKING',
      'BOOKING_IN_PROGRESS',
      'BOOKED',
      'PENDING_DISBURSEMENT',
      'DISBURSEMENT_IN_PROGRESS',
      'DISBURSED',
    ],
  },
];

/**
 * Helper to get phase for a status
 */
export function getPhaseForStatus(status: LomsApplicationStatus): WorkflowPhase {
  const phaseConfig = WORKFLOW_PHASES.find(p => p.statuses.includes(status));
  return phaseConfig?.phase || 'INITIATION';
}

/**
 * Helper to calculate progress percentage
 */
export function calculateProgress(status: LomsApplicationStatus): number {
  const progressMap: Partial<Record<LomsApplicationStatus, number>> = {
    DRAFT: 5,
    SUBMITTED: 15,
    PENDING_KYC: 25,
    KYC_APPROVED: 28,
    KYC_REJECTED: 100,
    PENDING_DOCUMENTS: 30,
    DOCUMENTS_RECEIVED: 33,
    PENDING_CREDIT_CHECK: 40,
    CREDIT_APPROVED: 43,
    CREDIT_DECLINED: 100,
    PENDING_UNDERWRITING: 45,
    IN_UNDERWRITING: 47,
    UNDERWRITING_APPROVED: 50,
    UNDERWRITING_DECLINED: 100,
    REFERRED_TO_SENIOR: 48,
    REFERRED_TO_UNDERWRITER: 48,
    PENDING_DECISION: 52,
    APPROVED: 55,
    DECLINED: 100,
    OFFER_GENERATED: 65,
    OFFER_SENT: 70,
    OFFER_ACCEPTED: 72,
    OFFER_REJECTED: 100,
    OFFER_EXPIRED: 100,
    OFFER_COUNTERED: 68,
    PENDING_CONDITIONS: 73,
    CONDITIONS_MET: 75,
    PENDING_ESIGN: 78,
    ESIGN_IN_PROGRESS: 80,
    ESIGN_COMPLETED: 85,
    PENDING_BOOKING: 92,
    BOOKING_IN_PROGRESS: 95,
    BOOKED: 100,
    PENDING_DISBURSEMENT: 97,
    DISBURSEMENT_IN_PROGRESS: 98,
    DISBURSED: 100,
    CANCELLED: 100,
    WITHDRAWN: 100,
    EXPIRED: 100,
  };
  return progressMap[status] || 0;
}

/**
 * Check if status is terminal
 */
export function isTerminalStatus(status: LomsApplicationStatus): boolean {
  return [
    'DECLINED',
    'KYC_REJECTED',
    'CREDIT_DECLINED',
    'UNDERWRITING_DECLINED',
    'OFFER_REJECTED',
    'OFFER_EXPIRED',
    'BOOKED',
    'DISBURSED',
    'CANCELLED',
    'WITHDRAWN',
    'EXPIRED',
  ].includes(status);
}

/**
 * Get product-aware label (e.g. "Loan", "Overdraft", "Credit Card")
 * Falls back to "Facility" as a generic banking term
 */
export function getProductLabel(productName?: string): string {
  if (!productName) return 'Facility';
  const name = productName.toLowerCase();
  if (name.includes('overdraft')) return 'Overdraft';
  if (name.includes('credit card')) return 'Credit Card';
  if (name.includes('mortgage') || name.includes('home loan')) return 'Mortgage';
  if (name.includes('vehicle') || name.includes('auto') || name.includes('car'))
    return 'Vehicle Finance';
  if (name.includes('bnpl') || name.includes('buy now')) return 'BNPL Facility';
  if (name.includes('invoice') || name.includes('asset')) return 'Asset Finance';
  if (name.includes('term loan') || name.includes('personal')) return 'Loan';
  return productName;
}
