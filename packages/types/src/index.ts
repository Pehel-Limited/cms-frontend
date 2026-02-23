// @cms/types - Shared type definitions across bank-ops and cust-portal

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface User {
  userId: string;
  bankId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  userType: 'BANK_USER' | 'CUSTOMER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_ACTIVATION' | 'LOCKED';
  roles: (Role | string)[];
  lastLoginAt?: string;
  twoFactorEnabled: boolean;
}

export interface Role {
  roleId: string;
  roleName: string;
  roleType: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  bankId?: string;
  bankCode?: string;
  username: string;
  password: string;
}

export interface RegisterCustomerRequest {
  bankId: string;
  customerId?: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

// ─── Domain Models ────────────────────────────────────────────────────────────

export interface Bank {
  bankId: string;
  bankCode: string;
  bankName: string;
  bankType: string;
  country?: string;
  website?: string;
  logo?: string;
  primaryColor?: string;
  isActive: boolean;
}

export interface Customer {
  customerId: string;
  bankId: string;
  customerNumber: string;
  customerName: string;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  email?: string;
  phoneNumber?: string;
  status: string;
  createdAt: string;
}

// ─── LOMS Status Types ────────────────────────────────────────────────────────

export type LomsApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_KYC'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'PENDING_DOCUMENTS'
  | 'DOCUMENTS_RECEIVED'
  | 'PENDING_CREDIT_CHECK'
  | 'CREDIT_APPROVED'
  | 'CREDIT_DECLINED'
  | 'PENDING_UNDERWRITING'
  | 'IN_UNDERWRITING'
  | 'UNDERWRITING_APPROVED'
  | 'UNDERWRITING_DECLINED'
  | 'REFERRED_TO_SENIOR'
  | 'REFERRED_TO_UNDERWRITER'
  | 'PENDING_DECISION'
  | 'APPROVED'
  | 'DECLINED'
  | 'OFFER_GENERATED'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_EXPIRED'
  | 'OFFER_COUNTERED'
  | 'PENDING_CONDITIONS'
  | 'CONDITIONS_MET'
  | 'PENDING_ESIGN'
  | 'ESIGN_IN_PROGRESS'
  | 'ESIGN_COMPLETED'
  | 'PENDING_BOOKING'
  | 'BOOKING_IN_PROGRESS'
  | 'BOOKED'
  | 'PENDING_DISBURSEMENT'
  | 'DISBURSEMENT_IN_PROGRESS'
  | 'DISBURSED'
  | 'CANCELLED'
  | 'WITHDRAWN'
  | 'EXPIRED';

export type WorkflowPhase =
  | 'INITIATION'
  | 'VERIFICATION'
  | 'DECISIONING'
  | 'OFFER_MANAGEMENT'
  | 'SIGNATURE'
  | 'BOOKING'
  | 'COMPLETED';

/**
 * Customer-facing simplified statuses
 * These map from the internal LOMS statuses to customer-friendly stages
 */
export type CustomerFacingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VERIFICATION'
  | 'UNDER_REVIEW'
  | 'OFFER'
  | 'SIGNING'
  | 'BOOKING'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'WITHDRAWN'
  | 'EXPIRED';

// ─── Offer Types ──────────────────────────────────────────────────────────────

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

// ─── Task Types ───────────────────────────────────────────────────────────────

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

// ─── Audit Types ──────────────────────────────────────────────────────────────

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

// ─── E-Sign Types ─────────────────────────────────────────────────────────────

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

// ─── Booking Types ────────────────────────────────────────────────────────────

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

// ─── Origination Channel ─────────────────────────────────────────────────────

export type ApplicationChannel =
  | 'ONLINE_WEB'
  | 'ONLINE_MOBILE'
  | 'BRANCH'
  | 'PHONE'
  | 'AGENT'
  | 'PARTNER'
  | 'DIRECT_MAIL';
