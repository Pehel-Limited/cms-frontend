import apiClient from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export interface KycCase {
  caseId: string;
  caseReference: string;
  partyId: string;
  partyDisplayName: string;
  customerSegment: string;
  caseType: 'ONBOARDING' | 'PERIODIC_REVIEW' | 'EVENT_DRIVEN' | 'REMEDIATION';
  triggerReason?: string;
  accountId?: string;
  status: KycCaseStatus;
  statusDisplay: string;
  statusChangedAt?: string;
  requiredDiligence: DiligenceLevel;
  appliedDiligence?: DiligenceLevel;
  riskScore?: number;
  riskTier?: RiskTier;
  riskAssessedAt?: string;
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
  isOverdue: boolean;
  assignedTo?: string;
  assignedAt?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  decision?: string;
  decisionReason?: string;
  decidedBy?: string;
  decidedAt?: string;
  requiresSeniorApproval: boolean;
  seniorApprovalBy?: string;
  seniorApprovalAt?: string;
  seniorApprovalNotes?: string;
  nextReviewDate?: string;
  reviewFrequencyMonths?: number;
  documentCount: number;
  documents?: KycDocument[];
  verifications?: VerificationCheck[];
  screeningResults?: ScreeningResult[];
  riskAssessment?: RiskAssessment;
  events?: KycCaseEvent[];
}

export type KycCaseStatus =
  | 'DRAFT'
  | 'PENDING_DOCUMENTS'
  | 'UNDER_REVIEW'
  | 'PENDING_VERIFICATION'
  | 'PENDING_SCREENING'
  | 'PENDING_RISK'
  | 'PENDING_APPROVAL'
  | 'ESCALATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'INCOMPLETE'
  | 'ON_HOLD';

export type DiligenceLevel = 'SDD' | 'CDD' | 'EDD';

export type RiskTier = 'LOW' | 'MEDIUM_LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH' | 'PROHIBITED';

export interface Party {
  partyId: string;
  partyReference: string;
  partyType: 'INDIVIDUAL' | 'LEGAL_ENTITY' | 'LEGAL_ARRANGEMENT';
  partyTypeDisplay: string;
  displayName: string;
  status: string;
  customerId?: string;
  entityId?: string;
  customerDetails?: CustomerDetails;
  entityDetails?: EntityDetails;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetails {
  customerNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string;
  email: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  country?: string;
  occupation?: string;
  employmentStatus?: string;
}

export interface EntityDetails {
  entityType: string;
  legalName: string;
  tradingName?: string;
  registrationNumber?: string;
  registrationCountry?: string;
  registrationDate?: string;
  taxIdNumber?: string;
  vatNumber?: string;
  industrySector?: string;
  numberOfEmployees?: number;
  annualTurnover?: number;
}

export interface PartyRelationship {
  relationshipId: string;
  fromPartyId: string;
  fromPartyReference: string;
  fromPartyDisplayName: string;
  fromPartyType: string;
  toPartyId: string;
  toPartyReference: string;
  toPartyDisplayName: string;
  toPartyType: string;
  relationshipType: RelationshipType;
  relationshipTypeDisplay: string;
  ownershipPercentage?: number;
  isDirect: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  controlType?: string;
  isVerified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type RelationshipType =
  | 'BENEFICIAL_OWNER'
  | 'DIRECTOR'
  | 'SHAREHOLDER'
  | 'SIGNATORY'
  | 'TRUSTEE'
  | 'SETTLOR'
  | 'BENEFICIARY_OF_TRUST'
  | 'PARTNER'
  | 'MEMBER'
  | 'COMMITTEE_MEMBER'
  | 'AUTHORIZED_PERSON'
  | 'POWER_OF_ATTORNEY'
  | 'SECRETARY';

export interface KycDocument {
  documentId: string;
  partyId: string;
  caseId?: string;
  documentType: string;
  documentTypeDisplay: string;
  documentCategory: string;
  documentName: string;
  issuingAuthority?: string;
  issuingCountry?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  fileReference?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  statusDisplay: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningResult {
  screeningId: string;
  partyId: string;
  caseId?: string;
  screeningType: 'SANCTIONS' | 'PEP' | 'ADVERSE_MEDIA' | 'WATCHLIST';
  screeningTypeDisplay: string;
  provider: string;
  providerReference?: string;
  isOngoingMonitoring: boolean;
  hasHits: boolean;
  matchCount: number;
  matches?: ScreeningMatch[];
  matchStatus?: 'PENDING_REVIEW' | 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'POSSIBLE' | 'CLEARED';
  matchStatusDisplay?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewDecision?: string;
  reviewNotes?: string;
  screenedAt: string;
  createdAt: string;
}

export interface ScreeningMatch {
  matchId: string;
  name: string;
  matchScore: number;
  listName: string;
  listCategory: string;
  sanctions?: string[];
  pepDetails?: {
    position?: string;
    country?: string;
    level?: string;
  };
}

export interface VerificationCheck {
  checkId: string;
  partyId: string;
  caseId?: string;
  documentId?: string;
  verificationType:
    | 'EIDV'
    | 'VIDEO_KYC'
    | 'BIOMETRIC'
    | 'CRO_REGISTRY'
    | 'ADDRESS_VERIFY'
    | 'BANK_REFERENCE';
  verificationTypeDisplay: string;
  provider: string;
  providerReference?: string;
  result: 'PASS' | 'FAIL' | 'REFER' | 'PENDING' | 'ERROR' | 'EXPIRED';
  resultDisplay: string;
  confidenceScore?: number;
  dataSubmitted?: Record<string, unknown>;
  dataReturned?: Record<string, unknown>;
  signals?: Record<string, unknown>;
  requestedAt: string;
  completedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface RiskAssessment {
  assessmentId: string;
  partyId: string;
  caseId?: string;
  assessmentType: 'INITIAL' | 'PERIODIC' | 'EVENT_DRIVEN' | 'OVERRIDE';
  customerRiskScore: number;
  geographyRiskScore: number;
  productRiskScore: number;
  channelRiskScore: number;
  transactionRiskScore: number;
  overallRiskScore: number;
  riskTier: RiskTier;
  riskTierDisplay: string;
  appliedDiligence: DiligenceLevel;
  appliedDiligenceDisplay: string;
  customerRiskFactors?: Record<string, unknown>;
  geographyRiskFactors?: Record<string, unknown>;
  productRiskFactors?: Record<string, unknown>;
  channelRiskFactors?: Record<string, unknown>;
  transactionRiskFactors?: Record<string, unknown>;
  isOverridden: boolean;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  originalRiskTier?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  assessedAt: string;
  validUntil?: string;
  isExpired: boolean;
  createdAt: string;
}

export interface KycCaseEvent {
  eventId: string;
  caseId: string;
  eventType: string;
  eventTypeDisplay: string;
  eventDescription: string;
  previousValue?: string;
  newValue?: string;
  relatedDocumentId?: string;
  relatedCheckId?: string;
  relatedScreeningId?: string;
  performedBy?: string;
  performedAt: string;
  notes?: string;
}

export interface KycDashboardStats {
  totalCases: number;
  pendingCases: number;
  inReviewCases: number;
  pendingApprovalCases: number;
  approvedCases: number;
  rejectedCases: number;
  escalatedCases: number;
  overdueCases: number;
  lowRiskCustomers: number;
  mediumRiskCustomers: number;
  highRiskCustomers: number;
  prohibitedCustomers: number;
  pendingScreeningReviews: number;
  pendingDocumentVerifications: number;
  expiringDocuments: number;
  expiredDocuments: number;
  casesForPeriodicReview: number;
}

export interface CreateKycCaseRequest {
  partyId?: string;
  customerId?: string;
  entityId?: string;
  customerSegment: string;
  caseType?: string;
  triggerReason?: string;
  requiredDiligence?: DiligenceLevel;
  accountId?: string;
}

export interface UploadKycDocumentRequest {
  partyId: string;
  caseId?: string;
  documentType: string;
  documentCategory: string;
  documentName: string;
  issuingAuthority?: string;
  issuingCountry?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileReference: string;
  fileHash?: string;
  fileSizeBytes?: number;
  mimeType?: string;
}

export interface CreatePartyRelationshipRequest {
  fromPartyId: string;
  toPartyId: string;
  relationshipType: RelationshipType;
  ownershipPercentage?: number;
  isDirect?: boolean;
  effectiveFrom?: string;
  controlType?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

// ============================================================================
// KYC Service
// ============================================================================

class KycService {
  private baseUrl = '/api/v1/kyc';

  // ------------------------------------------------------------------------
  // Dashboard
  // ------------------------------------------------------------------------

  async getDashboardStats(): Promise<KycDashboardStats> {
    const response = await apiClient.get<KycDashboardStats>(
      `${this.baseUrl}/cases/dashboard/stats`
    );
    return response.data;
  }

  // ------------------------------------------------------------------------
  // Cases
  // ------------------------------------------------------------------------

  async getCases(params?: {
    status?: string;
    assignedTo?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<PageResponse<KycCase>> {
    const response = await apiClient.get<PageResponse<KycCase>>(`${this.baseUrl}/cases`, {
      params,
    });
    return response.data;
  }

  async getMyCases(page = 0, size = 20): Promise<PageResponse<KycCase>> {
    const response = await apiClient.get<PageResponse<KycCase>>(`${this.baseUrl}/cases/my-cases`, {
      params: { page, size },
    });
    return response.data;
  }

  async getCase(caseId: string, includeDetails = false): Promise<KycCase> {
    const response = await apiClient.get<KycCase>(`${this.baseUrl}/cases/${caseId}`, {
      params: { includeDetails },
    });
    return response.data;
  }

  async createCase(request: CreateKycCaseRequest): Promise<KycCase> {
    const response = await apiClient.post<KycCase>(`${this.baseUrl}/cases`, request);
    return response.data;
  }

  async updateCaseStatus(caseId: string, status: string, reason?: string): Promise<KycCase> {
    const response = await apiClient.patch<KycCase>(
      `${this.baseUrl}/cases/${caseId}/status`,
      null,
      { params: { status, reason } }
    );
    return response.data;
  }

  async assignCase(caseId: string, assigneeId: string): Promise<KycCase> {
    const response = await apiClient.patch<KycCase>(
      `${this.baseUrl}/cases/${caseId}/assign`,
      null,
      { params: { assigneeId } }
    );
    return response.data;
  }

  async submitForReview(caseId: string): Promise<KycCase> {
    const response = await apiClient.post<KycCase>(`${this.baseUrl}/cases/${caseId}/submit`);
    return response.data;
  }

  async approveCase(caseId: string, notes?: string): Promise<KycCase> {
    const response = await apiClient.post<KycCase>(
      `${this.baseUrl}/cases/${caseId}/approve`,
      null,
      { params: { notes } }
    );
    return response.data;
  }

  async rejectCase(caseId: string, reason: string): Promise<KycCase> {
    const response = await apiClient.post<KycCase>(`${this.baseUrl}/cases/${caseId}/reject`, null, {
      params: { reason },
    });
    return response.data;
  }

  async escalateCase(caseId: string, reason: string): Promise<KycCase> {
    const response = await apiClient.post<KycCase>(
      `${this.baseUrl}/cases/${caseId}/escalate`,
      null,
      { params: { reason } }
    );
    return response.data;
  }

  async requestDocuments(caseId: string, documentTypes: string): Promise<KycCase> {
    const response = await apiClient.post<KycCase>(
      `${this.baseUrl}/cases/${caseId}/request-documents`,
      null,
      { params: { documentTypes } }
    );
    return response.data;
  }

  // ------------------------------------------------------------------------
  // Parties
  // ------------------------------------------------------------------------

  async getParty(partyId: string): Promise<Party> {
    const response = await apiClient.get<Party>(`${this.baseUrl}/parties/${partyId}`);
    return response.data;
  }

  async createPartyFromCustomer(customerId: string): Promise<Party> {
    const response = await apiClient.post<Party>(
      `${this.baseUrl}/parties/from-customer/${customerId}`
    );
    return response.data;
  }

  async createPartyFromEntity(entityId: string): Promise<Party> {
    const response = await apiClient.post<Party>(`${this.baseUrl}/parties/from-entity/${entityId}`);
    return response.data;
  }

  async getPartyGraph(partyId: string): Promise<PartyRelationship[]> {
    const response = await apiClient.get<PartyRelationship[]>(
      `${this.baseUrl}/parties/${partyId}/graph`
    );
    return response.data;
  }

  async getBeneficialOwners(partyId: string): Promise<PartyRelationship[]> {
    const response = await apiClient.get<PartyRelationship[]>(
      `${this.baseUrl}/parties/${partyId}/beneficial-owners`
    );
    return response.data;
  }

  async addRelationship(request: CreatePartyRelationshipRequest): Promise<PartyRelationship> {
    const response = await apiClient.post<PartyRelationship>(
      `${this.baseUrl}/parties/relationships`,
      request
    );
    return response.data;
  }

  // ------------------------------------------------------------------------
  // Documents
  // ------------------------------------------------------------------------

  async getDocumentsForParty(partyId: string): Promise<KycDocument[]> {
    const response = await apiClient.get<KycDocument[]>(
      `${this.baseUrl}/documents/party/${partyId}`
    );
    return response.data;
  }

  async uploadDocument(request: UploadKycDocumentRequest): Promise<KycDocument> {
    const response = await apiClient.post<KycDocument>(`${this.baseUrl}/documents`, request);
    return response.data;
  }

  async verifyDocument(documentId: string): Promise<KycDocument> {
    const response = await apiClient.post<KycDocument>(
      `${this.baseUrl}/documents/${documentId}/verify`
    );
    return response.data;
  }

  async rejectDocument(documentId: string, reason: string): Promise<KycDocument> {
    const response = await apiClient.post<KycDocument>(
      `${this.baseUrl}/documents/${documentId}/reject`,
      null,
      { params: { reason } }
    );
    return response.data;
  }

  // ------------------------------------------------------------------------
  // Screening
  // ------------------------------------------------------------------------

  async initiateScreening(
    partyId: string,
    screeningType: string,
    caseId?: string,
    provider = 'INTERNAL'
  ): Promise<ScreeningResult> {
    const response = await apiClient.post<ScreeningResult>(
      `${this.baseUrl}/screening/initiate`,
      null,
      { params: { partyId, screeningType, caseId, provider } }
    );
    return response.data;
  }

  async recordScreeningResults(
    screeningId: string,
    hasHits: boolean,
    matchCount: number,
    matchesJson?: string
  ): Promise<ScreeningResult> {
    const response = await apiClient.post<ScreeningResult>(
      `${this.baseUrl}/screening/${screeningId}/results`,
      matchesJson,
      { params: { hasHits, matchCount } }
    );
    return response.data;
  }

  async reviewScreeningHit(
    screeningId: string,
    matchStatus: string,
    decision: string,
    notes?: string
  ): Promise<ScreeningResult> {
    const response = await apiClient.post<ScreeningResult>(
      `${this.baseUrl}/screening/${screeningId}/review`,
      null,
      { params: { matchStatus, decision, notes } }
    );
    return response.data;
  }

  // ------------------------------------------------------------------------
  // Risk Assessment
  // ------------------------------------------------------------------------

  async performRiskAssessment(
    partyId: string,
    riskInputs: Record<string, unknown>,
    caseId?: string
  ): Promise<RiskAssessment> {
    const response = await apiClient.post<RiskAssessment>(
      `${this.baseUrl}/risk/assess`,
      riskInputs,
      { params: { partyId, caseId } }
    );
    return response.data;
  }

  async performQuickRiskAssessment(params: {
    partyId: string;
    caseId?: string;
    customerSegment: string;
    country?: string;
    productType?: string;
    onboardingChannel?: string;
    cashIntensive?: boolean;
    international?: boolean;
    monthlyVolume?: number;
  }): Promise<RiskAssessment> {
    const response = await apiClient.post<RiskAssessment>(
      `${this.baseUrl}/risk/assess/quick`,
      null,
      { params }
    );
    return response.data;
  }

  // ------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------

  getStatusColor(status: KycCaseStatus): string {
    const colors: Record<KycCaseStatus, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING_DOCUMENTS: 'bg-yellow-100 text-yellow-800',
      UNDER_REVIEW: 'bg-blue-100 text-blue-800',
      PENDING_VERIFICATION: 'bg-purple-100 text-purple-800',
      PENDING_SCREENING: 'bg-indigo-100 text-indigo-800',
      PENDING_RISK: 'bg-orange-100 text-orange-800',
      PENDING_APPROVAL: 'bg-cyan-100 text-cyan-800',
      ESCALATED: 'bg-red-100 text-red-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      INCOMPLETE: 'bg-gray-100 text-gray-800',
      ON_HOLD: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  getRiskTierColor(tier: RiskTier): string {
    const colors: Record<RiskTier, string> = {
      LOW: 'bg-green-100 text-green-800',
      MEDIUM_LOW: 'bg-lime-100 text-lime-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      MEDIUM_HIGH: 'bg-orange-100 text-orange-800',
      HIGH: 'bg-red-100 text-red-800',
      PROHIBITED: 'bg-gray-900 text-white',
    };
    return colors[tier] || 'bg-gray-100 text-gray-800';
  }

  getDiligenceColor(level: DiligenceLevel): string {
    const colors: Record<DiligenceLevel, string> = {
      SDD: 'bg-green-100 text-green-800',
      CDD: 'bg-blue-100 text-blue-800',
      EDD: 'bg-red-100 text-red-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  }

  getDiligenceLabel(level: DiligenceLevel): string {
    const labels: Record<DiligenceLevel, string> = {
      SDD: 'Simplified',
      CDD: 'Standard',
      EDD: 'Enhanced',
    };
    return labels[level] || level;
  }

  formatRelationshipType(type: RelationshipType): string {
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}

export const kycService = new KycService();
