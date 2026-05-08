import { apiClient } from './client';

// ─── Status ────────────────────────────────────────────────────

// Single comprehensive status (matches backend LomsApplicationStatus)
export type ApplicationStatus =
  // Initiation
  | 'DRAFT'
  | 'SUBMITTED'
  // KYC
  | 'PENDING_KYC'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  // Documents
  | 'PENDING_DOCUMENTS'
  | 'DOCUMENTS_RECEIVED'
  // Credit
  | 'PENDING_CREDIT_CHECK'
  | 'CREDIT_APPROVED'
  | 'CREDIT_DECLINED'
  // Underwriting
  | 'PENDING_UNDERWRITING'
  | 'IN_UNDERWRITING'
  | 'UNDERWRITING_APPROVED'
  | 'UNDERWRITING_DECLINED'
  | 'REFERRED_TO_SENIOR'
  | 'REFERRED_TO_UNDERWRITER'
  // Decision
  | 'PENDING_DECISION'
  | 'APPROVED'
  | 'DECLINED'
  // Offer
  | 'OFFER_GENERATED'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_EXPIRED'
  | 'OFFER_COUNTERED'
  // Conditions
  | 'PENDING_CONDITIONS'
  | 'CONDITIONS_MET'
  // E-Sign
  | 'PENDING_ESIGN'
  | 'ESIGN_IN_PROGRESS'
  | 'ESIGN_COMPLETED'
  // Booking & Disbursement
  | 'PENDING_BOOKING'
  | 'BOOKING_IN_PROGRESS'
  | 'BOOKED'
  | 'PENDING_DISBURSEMENT'
  | 'DISBURSEMENT_IN_PROGRESS'
  | 'DISBURSED'
  // Misc
  | 'RETURNED'
  | 'CANCELLED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'ACTIVE'
  | 'CLOSED';

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_KYC: 'Pending KYC',
  KYC_APPROVED: 'KYC Approved',
  KYC_REJECTED: 'KYC Rejected',
  PENDING_DOCUMENTS: 'Documents Pending',
  DOCUMENTS_RECEIVED: 'Documents Received',
  PENDING_CREDIT_CHECK: 'Credit Check Pending',
  CREDIT_APPROVED: 'Credit Approved',
  CREDIT_DECLINED: 'Credit Declined',
  PENDING_UNDERWRITING: 'Pending Underwriting',
  IN_UNDERWRITING: 'In Underwriting',
  UNDERWRITING_APPROVED: 'Underwriting Approved',
  UNDERWRITING_DECLINED: 'Underwriting Declined',
  REFERRED_TO_SENIOR: 'Referred to Senior',
  REFERRED_TO_UNDERWRITER: 'Referred to Underwriter',
  PENDING_DECISION: 'Pending Decision',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  OFFER_GENERATED: 'Offer Generated',
  OFFER_SENT: 'Offer Sent',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Rejected',
  OFFER_EXPIRED: 'Offer Expired',
  OFFER_COUNTERED: 'Offer Countered',
  PENDING_CONDITIONS: 'Pending Conditions',
  CONDITIONS_MET: 'Conditions Met',
  PENDING_ESIGN: 'Pending E-Sign',
  ESIGN_IN_PROGRESS: 'E-Sign In Progress',
  ESIGN_COMPLETED: 'E-Sign Completed',
  PENDING_BOOKING: 'Pending Booking',
  BOOKING_IN_PROGRESS: 'Booking In Progress',
  BOOKED: 'Booked',
  PENDING_DISBURSEMENT: 'Pending Disbursement',
  DISBURSEMENT_IN_PROGRESS: 'Disbursement In Progress',
  DISBURSED: 'Disbursed',
  RETURNED: 'Returned for Corrections',
  CANCELLED: 'Cancelled',
  WITHDRAWN: 'Withdrawn',
  EXPIRED: 'Expired',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  PENDING_KYC: 'bg-yellow-100 text-yellow-700',
  KYC_APPROVED: 'bg-teal-100 text-teal-700',
  KYC_REJECTED: 'bg-red-100 text-red-700',
  PENDING_DOCUMENTS: 'bg-yellow-100 text-yellow-700',
  DOCUMENTS_RECEIVED: 'bg-teal-100 text-teal-700',
  PENDING_CREDIT_CHECK: 'bg-purple-100 text-purple-700',
  CREDIT_APPROVED: 'bg-emerald-100 text-emerald-700',
  CREDIT_DECLINED: 'bg-red-100 text-red-700',
  PENDING_UNDERWRITING: 'bg-orange-100 text-orange-700',
  IN_UNDERWRITING: 'bg-orange-100 text-orange-700',
  UNDERWRITING_APPROVED: 'bg-emerald-100 text-emerald-700',
  UNDERWRITING_DECLINED: 'bg-red-100 text-red-700',
  REFERRED_TO_SENIOR: 'bg-indigo-100 text-indigo-700',
  REFERRED_TO_UNDERWRITER: 'bg-indigo-100 text-indigo-700',
  PENDING_DECISION: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  OFFER_GENERATED: 'bg-cyan-100 text-cyan-700',
  OFFER_SENT: 'bg-cyan-100 text-cyan-700',
  OFFER_ACCEPTED: 'bg-green-100 text-green-700',
  OFFER_REJECTED: 'bg-red-100 text-red-700',
  OFFER_EXPIRED: 'bg-gray-100 text-gray-500',
  OFFER_COUNTERED: 'bg-amber-100 text-amber-700',
  PENDING_CONDITIONS: 'bg-yellow-100 text-yellow-700',
  CONDITIONS_MET: 'bg-teal-100 text-teal-700',
  PENDING_ESIGN: 'bg-violet-100 text-violet-700',
  ESIGN_IN_PROGRESS: 'bg-violet-100 text-violet-700',
  ESIGN_COMPLETED: 'bg-emerald-100 text-emerald-700',
  PENDING_BOOKING: 'bg-sky-100 text-sky-700',
  BOOKING_IN_PROGRESS: 'bg-sky-100 text-sky-700',
  BOOKED: 'bg-green-100 text-green-700',
  PENDING_DISBURSEMENT: 'bg-lime-100 text-lime-700',
  DISBURSEMENT_IN_PROGRESS: 'bg-lime-100 text-lime-700',
  DISBURSED: 'bg-green-100 text-green-700',
  RETURNED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-gray-100 text-gray-500',
  ACTIVE: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

// ─── Loan Purpose ──────────────────────────────────────────────

export type LoanPurpose =
  | 'HOME_PURCHASE'
  | 'HOME_CONSTRUCTION'
  | 'HOME_RENOVATION'
  | 'HOME_REFINANCE'
  | 'VEHICLE_PURCHASE'
  | 'BUSINESS_EXPANSION'
  | 'WORKING_CAPITAL'
  | 'EQUIPMENT_PURCHASE'
  | 'DEBT_CONSOLIDATION'
  | 'EDUCATION'
  | 'MEDICAL'
  | 'WEDDING'
  | 'TRAVEL'
  | 'PERSONAL_USE'
  | 'INVESTMENT'
  | 'OTHER';

export const LOAN_PURPOSE_LABELS: Record<LoanPurpose, string> = {
  HOME_PURCHASE: 'Home Purchase',
  HOME_CONSTRUCTION: 'Home Construction',
  HOME_RENOVATION: 'Home Renovation',
  HOME_REFINANCE: 'Home Refinance',
  VEHICLE_PURCHASE: 'Vehicle Purchase',
  BUSINESS_EXPANSION: 'Business Expansion',
  WORKING_CAPITAL: 'Working Capital',
  EQUIPMENT_PURCHASE: 'Equipment Purchase',
  DEBT_CONSOLIDATION: 'Debt Consolidation',
  EDUCATION: 'Education',
  MEDICAL: 'Medical Expenses',
  WEDDING: 'Wedding',
  TRAVEL: 'Travel',
  PERSONAL_USE: 'Personal Use',
  INVESTMENT: 'Investment',
  OTHER: 'Other',
};

// ─── Types ─────────────────────────────────────────────────────

export interface ProductSummary {
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  minAmount: number;
  maxAmount: number;
}

export interface LoanApplication {
  // Identifiers
  applicationId: string;
  bankId: string;
  customerId: string;
  productId: string;
  applicationNumber: string;

  // Status
  status: string;
  lomsStatus?: string;
  channel: string;
  currentStage?: string;

  // Loan request
  requestedAmount: number;
  requestedTermMonths: number;
  requestedInterestRate?: number;
  loanPurpose: string;
  loanPurposeDescription?: string;

  // Approved terms
  approvedAmount?: number;
  approvedTermMonths?: number;
  approvedInterestRate?: number;
  approvedMonthlyPayment?: number;

  // Co-borrower
  hasCoBorrower?: boolean;
  coBorrowerCustomerId?: string;
  coBorrowerRelationship?: string;

  // Financial
  statedAnnualIncome?: number;
  statedMonthlyIncome?: number;
  statedMonthlyExpenses?: number;
  statedAssetsValue?: number;
  statedLiabilitiesValue?: number;
  debtToIncomeRatio?: number;

  // Employment
  employmentStatus?: string;
  employerName?: string;
  yearsWithEmployer?: number;
  jobTitle?: string;

  // Business (for business/corporate loans)
  businessVintageYears?: number;
  businessAnnualRevenue?: number;

  // Property (home/mortgage)
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyPostalCode?: string;
  propertyType?: string;
  propertyValue?: number;
  downPaymentAmount?: number;

  // Vehicle (auto loan)
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleCondition?: string;
  vehicleValue?: number;

  // Timeline
  submittedAt?: string;
  reviewStartedAt?: string;
  decisionDueDate?: string;
  decisionMadeAt?: string;
  slaBreached?: boolean;
  daysInCurrentStatus?: number;

  // Decision
  rejectionReason?: string;
  conditionalApprovalConditions?: string;

  // Documents
  allDocumentsReceived?: boolean;
  documentsReceivedCount?: number;
  documentsPendingCount?: number;

  // Compliance
  kycCompleted?: boolean;
  amlCheckCompleted?: boolean;

  // Offer
  offerValidUntil?: string;
  offerAccepted?: boolean;
  offerAcceptedAt?: string;

  // Audit
  createdAt: string;
  updatedAt: string;

  // Enriched
  product?: ProductSummary;
}

export interface CreateApplicationPayload {
  productId: string;
  requestedAmount: number;
  requestedTermMonths: number;
  requestedInterestRate?: number;
  loanPurpose: string;
  loanPurposeDescription?: string;

  // Co-borrower
  hasCoBorrower?: boolean;
  coBorrowerCustomerId?: string;
  coBorrowerRelationship?: string;

  // Financial
  statedAnnualIncome?: number;
  statedMonthlyIncome?: number;
  statedMonthlyExpenses?: number;

  // Employment
  employmentStatus?: string;
  employerName?: string;
  yearsWithEmployer?: number;
  jobTitle?: string;

  // Business
  businessVintageYears?: number;
  businessAnnualRevenue?: number;
  facilityType?: string;
  facilityPurposeDescription?: string;

  // Property
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyPostalCode?: string;
  propertyType?: string;
  propertyValue?: number;
  downPaymentAmount?: number;

  // Vehicle
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleCondition?: string;
  vehicleValue?: number;
}

export type UpdateApplicationPayload = Partial<CreateApplicationPayload>;

// ─── Business Facility Types ──────────────────────────────────

export const FACILITY_TYPE_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan',
  WORKING_CAPITAL: 'Working Capital',
  OVERDRAFT: 'Overdraft Facility',
  LETTER_OF_CREDIT: 'Letter of Credit',
  BANK_GUARANTEE: 'Bank Guarantee',
  BILL_DISCOUNTING: 'Bill Discounting',
  CASH_CREDIT: 'Cash Credit',
  EQUIPMENT_FINANCE: 'Equipment Finance',
  PROJECT_FINANCE: 'Project Finance',
  TRADE_FINANCE: 'Trade Finance',
};

// ─── Application Context ──────────────────────────────────────

export interface ApplicationContext {
  customerId: string;
  customerType: string;
  isBusiness: boolean;
}

// ─── Customer-Friendly Status ─────────────────────────────────

/** 6 simplified customer stages */
export type CustomerStage =
  | 'DRAFT'
  | 'VERIFICATION'
  | 'UNDER_REVIEW'
  | 'OFFER'
  | 'SIGNING'
  | 'BOOKING'
  | 'COMPLETED'
  | 'TERMINATED';

export const CUSTOMER_STAGES: { key: CustomerStage; label: string }[] = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'VERIFICATION', label: 'Verification' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'OFFER', label: 'Offer' },
  { key: 'SIGNING', label: 'Signing' },
  { key: 'BOOKING', label: 'Booking' },
];

export interface TimelineEvent {
  title: string;
  description?: string;
  timestamp: string;
  icon: 'info' | 'success' | 'warning' | 'action' | 'milestone';
}

export interface CustomerStatusInfo {
  internalStatus: string;
  stage: CustomerStage;
  stageLabel: string;
  headline: string;
  detail?: string;
  progress: number;
  terminal: boolean;
  declined: boolean;
  lastUpdated?: string;
  timeline: TimelineEvent[];
}

// ─── Status Flow Steps (for progress tracker) ─────────────────

export const STATUS_FLOW: string[] = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_KYC',
  'PENDING_DOCUMENTS',
  'PENDING_CREDIT_CHECK',
  'PENDING_UNDERWRITING',
  'PENDING_DECISION',
  'APPROVED',
  'OFFER_GENERATED',
  'PENDING_ESIGN',
  'PENDING_BOOKING',
  'DISBURSED',
];

// ─── API Functions ─────────────────────────────────────────────

export const applicationService = {
  /** Get application context (customer type, etc.) */
  async getContext(): Promise<ApplicationContext> {
    return apiClient.get<ApplicationContext>('/api/customer/applications/context');
  },

  /** Create a draft application */
  async create(data: CreateApplicationPayload, applicationType?: string): Promise<LoanApplication> {
    const qs = applicationType ? `?applicationType=${applicationType}` : '';
    return apiClient.post<LoanApplication>(`/api/customer/applications${qs}`, data);
  },

  /** List all my applications */
  async list(page = 0, size = 20): Promise<LoanApplication[]> {
    return apiClient.get<LoanApplication[]>(`/api/customer/applications?page=${page}&size=${size}`);
  },

  /** Get application by ID */
  async getById(id: string): Promise<LoanApplication> {
    return apiClient.get<LoanApplication>(`/api/customer/applications/${id}`);
  },

  /** Get customer-friendly status + timeline */
  async getStatus(id: string): Promise<CustomerStatusInfo> {
    return apiClient.get<CustomerStatusInfo>(`/api/customer/applications/${id}/status`);
  },

  /** Update a draft application */
  async update(id: string, data: UpdateApplicationPayload): Promise<LoanApplication> {
    return apiClient.put<LoanApplication>(`/api/customer/applications/${id}`, data);
  },

  /** Submit a draft application for review */
  async submit(id: string): Promise<LoanApplication> {
    return apiClient.post<LoanApplication>(`/api/customer/applications/${id}/submit`);
  },

  /** Withdraw a non-draft application */
  async withdraw(id: string, reason?: string): Promise<{ withdrawn: boolean }> {
    return apiClient.post<{ withdrawn: boolean }>(`/api/customer/applications/${id}/withdraw`, {
      reason: reason || 'Customer requested withdrawal',
    });
  },
};
