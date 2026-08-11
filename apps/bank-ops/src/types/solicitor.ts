// types/solicitor.ts
// TypeScript types for the RM→Solicitor integration bridge

export interface SolicitorFirm {
  id: string;
  bankId: string;
  firmName: string;
  firmRegistrationNumber?: string;
  panelStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export interface SolicitorSummary {
  applicationId: string;
  requiresSolicitor: boolean;
  requirementReason?: string;
  solicitorCaseId?: string;
  solicitorCaseStatus?: string;
  solicitorCaseStatusLabel?: string;
  caseReference?: string;
  assignedFirmId?: string;
  assignedFirmName?: string;
  assignedHandlerId?: string;
  legalReadinessStatus: 'NOT_ASSESSED' | 'NOT_READY' | 'READY' | 'READY_WITH_CONDITIONS';
  drawdownReadinessStatus: 'BLOCKED' | 'PENDING' | 'CLEAR';
  issuedAt?: string;
  acceptedAt?: string;
  completionTargetDate?: string;
  slaBreached?: boolean;
  checklist: {
    undertakingAccepted?: boolean;
    certificateAccepted?: boolean;
    mandatoryChecklistComplete?: boolean;
    drawdownEligible?: boolean;
    total?: number;
    accepted?: number;
    rejected?: number;
    pendingSolicitor?: number;
    waived?: number;
  };
  blockers: Array<{ code: string; message: string }>;
  legalReadyForDrawdown?: boolean;
  availableActions: string[];
}

export interface LegalCaseChecklistItem {
  id: string;
  caseId: string;
  category: string;
  title: string;
  description?: string;
  status: 'PENDING_SOLICITOR' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'WAIVED' | 'NA';
  mandatory: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  waiveReason?: string;
}

export interface LegalCaseUndertaking {
  id?: string;
  caseId: string;
  status: 'NOT_ISSUED' | 'ISSUED' | 'VIEWED' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  issuedAt?: string;
  signedAt?: string;
  acceptedAt?: string;
  rejectionReason?: string;
  contentSnapshot?: string;
  firmId?: string;
}

export interface CertificateOfTitle {
  id?: string;
  caseId: string;
  status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  submittedAt?: string;
  acceptedAt?: string;
  rejectionReason?: string;
  propertyAddress?: string;
  titleOpinion?: string;
  solicitorName?: string;
}

export interface DrawdownEligibility {
  caseId: string;
  eligible: boolean;
  undertakingAccepted?: boolean;
  certificateAccepted?: boolean;
  mandatoryChecklistComplete?: boolean;
  blockers?: Array<{ code: string; message: string }>;
}

export interface DrawdownRequest {
  id: string;
  caseId: string;
  requestedAmount: number;
  requestedDate?: string;
  purpose?: string;
  status: 'PENDING_BANK_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FUNDS_RELEASED';
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  fundsReleasedAt?: string;
  createdAt?: string;
}

export interface DrawdownReadiness {
  applicationId: string;
  legalReady: boolean;
  solicitorCaseId?: string;
  undertakingAccepted?: boolean;
  certificateAccepted?: boolean;
  mandatoryChecklistComplete?: boolean;
  blockers: Array<{ code: string; message: string }>;
}

export interface CreateSolicitorCaseRequest {
  bankApplicationId?: string;
  loanType?: string;
  securityType?: string;
  propertyAddress?: string;
  propertyValue?: number;
  completionTargetDate?: string;
  notes?: string;
}

export interface AssignFirmRequest {
  firmId: string;
  handlerUserId?: string;
  notes?: string;
}

export interface LegalQueryThread {
  id: string;
  caseId: string;
  subject: string;
  queryType?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'AWAITING_SOLICITOR' | 'AWAITING_BANK' | 'CLOSED';
  createdBy?: string;
  createdAt?: string;
  messages?: Array<{
    id: string;
    messageBody: string;
    senderId?: string;
    senderType?: string;
    internalOnly: boolean;
    createdAt?: string;
  }>;
}
