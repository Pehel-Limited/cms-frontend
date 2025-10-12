// services/api/applicationService.ts
import { ApiClient } from './client';

export interface CreateApplicationRequest {
  bankId: string;
  customerId: string;
  productId: string;
  channel: 'RELATIONSHIP_MANAGER' | 'ONLINE_PORTAL' | 'MOBILE_APP' | 'BRANCH' | 'PHONE';
  requestedAmount: number;
  requestedTermMonths: number;
  requestedInterestRate?: number;
  loanPurpose: string;
  loanPurposeDescription?: string;

  // Financial info
  statedAnnualIncome?: number;
  statedMonthlyIncome?: number;
  statedMonthlyExpenses?: number;

  // Employment info
  employmentStatus?: string;
  employerName?: string;
  yearsWithEmployer?: number;
  jobTitle?: string;

  // Property info (for home loans)
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyPostalCode?: string;
  propertyType?: string;
  propertyValue?: number;
  downPaymentAmount?: number;

  // Vehicle info (for auto loans)
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleCondition?: string;
  vehicleValue?: number;
}

export interface ApplicationResponse {
  applicationId: string;
  bankId: string;
  customerId: string;
  productId: string;
  applicationNumber: string;
  status: string;
  channel: string;
  currentStage: string;

  requestedAmount: number;
  requestedTermMonths: number;
  requestedInterestRate?: number;
  loanPurpose: string;
  loanPurposeDescription?: string;

  approvedAmount?: number;
  approvedTermMonths?: number;
  approvedInterestRate?: number;
  approvedMonthlyPayment?: number;

  statedAnnualIncome?: number;
  statedMonthlyIncome?: number;
  statedMonthlyExpenses?: number;
  debtToIncomeRatio?: number;

  employmentStatus?: string;
  employerName?: string;
  yearsWithEmployer?: number;
  jobTitle?: string;

  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyValue?: number;
  downPaymentAmount?: number;

  assignedToUserId?: string;
  assignedAt?: string;
  submittedAt?: string;
  reviewStartedAt?: string;
  decisionMadeAt?: string;
  decisionDueDate?: string;
  slaBreached?: boolean;
  daysInCurrentStatus?: number;

  decisionNotes?: string;
  rejectionReason?: string;
  rejectionCategory?: string;

  creditScoreAtApplication?: number;
  internalRiskRating?: string;
  riskScore?: number;

  allDocumentsReceived?: boolean;
  documentsReceivedCount?: number;
  documentsPendingCount?: number;

  kycCompleted?: boolean;
  amlCheckCompleted?: boolean;

  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
  updatedByUserId: string;

  // Enriched data
  customer?: {
    customerId: string;
    customerNumber: string;
    firstName?: string;
    lastName?: string;
    businessName?: string;
    email?: string;
    phoneNumber?: string;
  };

  assignedToUser?: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  createdByUser?: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  product?: {
    productId: string;
    productName: string;
    productType: string;
    interestRate: number;
  };
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

export interface ApproveApplicationRequest {
  approvedAmount: number;
  approvedTermMonths: number;
  approvedInterestRate: number;
  approvedMonthlyPayment?: number;
  notes?: string;
}

export interface RejectApplicationRequest {
  rejectionReason: string;
  rejectionCategory?: string;
  notes?: string;
}

export interface AssignApplicationRequest {
  assignToUserId: string;
}

export interface UpdateStatusRequest {
  status: string;
  notes?: string;
}

export class ApplicationService {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient();
  }

  /**
   * Create a new application
   */
  async createApplication(data: CreateApplicationRequest): Promise<ApplicationResponse> {
    return this.client.post<ApplicationResponse>('/api/admin/applications', data);
  }

  /**
   * Get application by ID
   */
  async getApplication(id: string): Promise<ApplicationResponse> {
    return this.client.get<ApplicationResponse>(`/api/admin/applications/${id}`);
  }

  /**
   * Get application by application number
   */
  async getApplicationByNumber(applicationNumber: string): Promise<ApplicationResponse> {
    return this.client.get<ApplicationResponse>(
      `/api/admin/applications/by-number/${applicationNumber}`
    );
  }

  /**
   * Get all applications with filters
   */
  async getApplications(params: {
    bankId: string;
    status?: string;
    search?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<PageResponse<ApplicationResponse>> {
    const queryParams = new URLSearchParams();
    queryParams.append('bankId', params.bankId);
    if (params.status) queryParams.append('status', params.status);
    if (params.search) queryParams.append('search', params.search);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());
    if (params.sort) queryParams.append('sort', params.sort);

    return this.client.get<PageResponse<ApplicationResponse>>(
      `/api/admin/applications?${queryParams.toString()}`
    );
  }

  /**
   * Get applications for a customer
   */
  async getApplicationsByCustomer(
    customerId: string,
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<ApplicationResponse>> {
    return this.client.get<PageResponse<ApplicationResponse>>(
      `/api/admin/applications/customer/${customerId}?page=${page}&size=${size}`
    );
  }

  /**
   * Get my assigned applications
   */
  async getMyAssignedApplications(
    params: {
      status?: string;
      page?: number;
      size?: number;
    } = {}
  ): Promise<PageResponse<ApplicationResponse>> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());

    return this.client.get<PageResponse<ApplicationResponse>>(
      `/api/admin/applications/assigned/me?${queryParams.toString()}`
    );
  }

  /**
   * Get my created applications
   */
  async getMyCreatedApplications(
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<ApplicationResponse>> {
    return this.client.get<PageResponse<ApplicationResponse>>(
      `/api/admin/applications/created/me?page=${page}&size=${size}`
    );
  }

  /**
   * Submit application
   */
  async submitApplication(id: string): Promise<ApplicationResponse> {
    return this.client.post<ApplicationResponse>(`/api/admin/applications/${id}/submit`, {});
  }

  /**
   * Assign application to a user
   */
  async assignApplication(
    id: string,
    data: AssignApplicationRequest
  ): Promise<ApplicationResponse> {
    return this.client.post<ApplicationResponse>(`/api/admin/applications/${id}/assign`, data);
  }

  /**
   * Update application status
   */
  async updateStatus(id: string, data: UpdateStatusRequest): Promise<ApplicationResponse> {
    return this.client.put<ApplicationResponse>(`/api/admin/applications/${id}/status`, data);
  }

  /**
   * Approve application
   */
  async approveApplication(
    id: string,
    data: ApproveApplicationRequest
  ): Promise<ApplicationResponse> {
    return this.client.post<ApplicationResponse>(`/api/admin/applications/${id}/approve`, data);
  }

  /**
   * Reject application
   */
  async rejectApplication(
    id: string,
    data: RejectApplicationRequest
  ): Promise<ApplicationResponse> {
    return this.client.post<ApplicationResponse>(`/api/admin/applications/${id}/reject`, data);
  }

  /**
   * Return for corrections
   */
  async returnForCorrections(id: string, reason: string): Promise<ApplicationResponse> {
    return this.client.post<ApplicationResponse>(
      `/api/admin/applications/${id}/return?reason=${encodeURIComponent(reason)}`,
      {}
    );
  }

  /**
   * Get application count by status
   */
  async getApplicationCount(bankId: string, status: string): Promise<number> {
    return this.client.get<number>(
      `/api/admin/applications/count?bankId=${bankId}&status=${status}`
    );
  }
}

export const applicationService = new ApplicationService();
