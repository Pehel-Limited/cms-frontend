// services/api/lomsService.ts
// LOMS (Loan Origination Management System) API Service

import { ApiClient } from './client';
import {
  LomsApplicationStatus,
  StatusInfo,
  WorkflowTask,
  Approval,
  Offer,
  OfferCondition,
  DocusignEnvelope,
  LoanBooking,
  AuditEvent,
  ApplicationSnapshot,
  TransitionStatusRequest,
  ClaimTaskRequest,
  CompleteTaskRequest,
  CreateApprovalRequest,
  ApprovalDecisionRequest,
  SatisfyConditionRequest,
  WaiveConditionRequest,
} from '@/types/loms';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * LOMS Workflow Service
 * Handles all loan origination workflow operations
 */
export class LomsService {
  private client: ApiClient;
  private baseUrl = '/api/v1/bff/workflow';

  constructor() {
    this.client = new ApiClient();
  }

  // ==================== Status Management ====================

  /**
   * Get application status with valid transitions and phase info
   */
  async getApplicationStatus(applicationId: string, currentStatus: string): Promise<StatusInfo> {
    const response = await this.client.get<StatusInfo>(
      `${this.baseUrl}/applications/${applicationId}/status?currentStatus=${currentStatus}`
    );
    return response;
  }

  /**
   * Transition application to a new status
   */
  async transitionStatus(applicationId: string, request: TransitionStatusRequest): Promise<void> {
    await this.client.post(`${this.baseUrl}/applications/${applicationId}/transition`, request);
  }

  // ==================== Task Management ====================

  /**
   * Get workflow tasks with filtering
   */
  async getTasks(params?: {
    queue?: string;
    status?: string;
    assigneeId?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<WorkflowTask>> {
    const queryParams = new URLSearchParams();
    if (params?.queue) queryParams.append('queue', params.queue);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.assigneeId) queryParams.append('assigneeId', params.assigneeId);
    queryParams.append('page', String(params?.page || 0));
    queryParams.append('size', String(params?.size || 20));

    return this.client.get<PageResponse<WorkflowTask>>(
      `${this.baseUrl}/tasks?${queryParams.toString()}`
    );
  }

  /**
   * Get tasks for a specific application
   */
  async getApplicationTasks(applicationId: string): Promise<WorkflowTask[]> {
    const response = await this.client.get<PageResponse<WorkflowTask>>(
      `${this.baseUrl}/tasks?applicationId=${applicationId}`
    );
    return response.content || [];
  }

  /**
   * Get task details
   */
  async getTask(taskId: string): Promise<WorkflowTask> {
    return this.client.get<WorkflowTask>(`${this.baseUrl}/tasks/${taskId}`);
  }

  /**
   * Claim a task
   */
  async claimTask(
    taskId: string,
    request: ClaimTaskRequest
  ): Promise<{ success: boolean; message: string }> {
    return this.client.post(`${this.baseUrl}/tasks/${taskId}/claim`, request);
  }

  /**
   * Release a claimed task
   */
  async releaseTask(
    taskId: string,
    assigneeId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.client.post(`${this.baseUrl}/tasks/${taskId}/release`, { assigneeId });
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, request: CompleteTaskRequest): Promise<void> {
    await this.client.post(`${this.baseUrl}/tasks/${taskId}/complete`, request);
  }

  // ==================== Approval Management ====================

  /**
   * Get pending approvals
   */
  async getApprovals(page = 0, size = 20): Promise<PageResponse<Approval>> {
    return this.client.get<PageResponse<Approval>>(
      `${this.baseUrl}/approvals?page=${page}&size=${size}`
    );
  }

  /**
   * Get approval by ID
   */
  async getApproval(approvalId: string): Promise<Approval> {
    return this.client.get<Approval>(`${this.baseUrl}/approvals/${approvalId}`);
  }

  /**
   * Create an approval request (maker)
   */
  async createApprovalRequest(request: CreateApprovalRequest): Promise<Approval> {
    return this.client.post<Approval>(`${this.baseUrl}/approvals`, request);
  }

  /**
   * Process approval decision (checker)
   */
  async decideApproval(approvalId: string, request: ApprovalDecisionRequest): Promise<void> {
    await this.client.post(`${this.baseUrl}/approvals/${approvalId}/decide`, request);
  }

  // ==================== Offer Management ====================

  /**
   * Get all offers for an application
   */
  async getOffers(applicationId: string): Promise<Offer[]> {
    return this.client.get<Offer[]>(`${this.baseUrl}/applications/${applicationId}/offers`);
  }

  /**
   * Get the latest offer for an application
   */
  async getLatestOffer(applicationId: string): Promise<Offer | null> {
    try {
      return await this.client.get<Offer>(
        `${this.baseUrl}/applications/${applicationId}/offers/latest`
      );
    } catch {
      return null;
    }
  }

  /**
   * Accept an offer
   */
  async acceptOffer(applicationId: string, offerId: string): Promise<void> {
    await this.client.post(
      `${this.baseUrl}/applications/${applicationId}/offers/${offerId}/accept`,
      {}
    );
  }

  /**
   * Get offer conditions
   */
  async getOfferConditions(offerId: string): Promise<OfferCondition[]> {
    return this.client.get<OfferCondition[]>(`${this.baseUrl}/offers/${offerId}/conditions`);
  }

  /**
   * Mark a condition as satisfied
   */
  async satisfyCondition(
    conditionId: string,
    request: SatisfyConditionRequest
  ): Promise<OfferCondition> {
    return this.client.post<OfferCondition>(
      `${this.baseUrl}/conditions/${conditionId}/satisfy`,
      request
    );
  }

  /**
   * Waive a condition
   */
  async waiveCondition(
    conditionId: string,
    request: WaiveConditionRequest
  ): Promise<OfferCondition> {
    return this.client.post<OfferCondition>(
      `${this.baseUrl}/conditions/${conditionId}/waive`,
      request
    );
  }

  // ==================== E-Signature ====================

  /**
   * Get envelopes for an offer
   */
  async getEnvelopes(offerId: string): Promise<DocusignEnvelope[]> {
    return this.client.get<DocusignEnvelope[]>(`${this.baseUrl}/offers/${offerId}/envelopes`);
  }

  /**
   * Initiate e-signature process
   */
  async initiateEsign(applicationId: string): Promise<void> {
    await this.client.post(`${this.baseUrl}/applications/${applicationId}/esign/initiate`, {});
  }

  /**
   * Get signing URL for embedded signing
   */
  async getSigningUrl(offerId: string): Promise<{ signingUrl: string }> {
    return this.client.get(`${this.baseUrl}/offers/${offerId}/esign/signing-url`);
  }

  // ==================== Booking ====================

  /**
   * Get booking status for an application
   */
  async getBooking(applicationId: string): Promise<LoanBooking | null> {
    try {
      return await this.client.get<LoanBooking>(
        `${this.baseUrl}/applications/${applicationId}/booking`
      );
    } catch {
      return null;
    }
  }

  /**
   * Initiate loan booking
   */
  async initiateBooking(applicationId: string): Promise<void> {
    await this.client.post(`${this.baseUrl}/applications/${applicationId}/booking/initiate`, {});
  }

  /**
   * Initiate disbursement
   */
  async initiateDisbursement(applicationId: string): Promise<void> {
    await this.client.post(
      `${this.baseUrl}/applications/${applicationId}/disbursement/initiate`,
      {}
    );
  }

  // ==================== Audit & History ====================

  /**
   * Get audit trail for an application
   */
  async getAuditTrail(applicationId: string): Promise<AuditEvent[]> {
    return this.client.get<AuditEvent[]>(`${this.baseUrl}/applications/${applicationId}/audit`);
  }

  /**
   * Get snapshots for an application
   */
  async getSnapshots(applicationId: string): Promise<ApplicationSnapshot[]> {
    return this.client.get<ApplicationSnapshot[]>(
      `${this.baseUrl}/applications/${applicationId}/snapshots`
    );
  }

  // ==================== Workflow Actions ====================

  /**
   * Submit application for processing
   * This triggers KYC check → Decisioning flow
   */
  async submitForDecisioning(applicationId: string, userId: string): Promise<void> {
    await this.transitionStatus(applicationId, {
      currentStatus: 'SUBMITTED',
      targetStatus: 'DECISIONING_PENDING',
      actorId: userId,
      reason: 'Submitting for credit decisioning',
    });
  }

  /**
   * Complete underwriting review
   */
  async completeUnderwritingReview(
    applicationId: string,
    taskId: string,
    userId: string,
    decision: 'APPROVE' | 'DECLINE',
    notes: string,
    approvedAmount?: number,
    approvedRate?: number
  ): Promise<void> {
    await this.completeTask(taskId, {
      completedBy: userId,
      decision,
      notes,
      approvedAmount,
      approvedRate,
    });
  }

  /**
   * Generate offer for approved application
   * Note: Backend uses 'APPROVED' status, not 'APPROVED_PENDING_OFFER'
   */
  async generateOffer(applicationId: string, userId: string): Promise<void> {
    await this.transitionStatus(applicationId, {
      currentStatus: 'APPROVED',
      targetStatus: 'OFFER_GENERATED',
      actorId: userId,
      reason: 'Generating offer',
    });
  }

  /**
   * Send offer for e-signature
   * Note: Backend uses 'PENDING_ESIGN' instead of 'AWAITING_SIGNATURE'
   */
  async sendForSignature(applicationId: string, userId: string): Promise<void> {
    await this.initiateEsign(applicationId);
    await this.transitionStatus(applicationId, {
      currentStatus: 'OFFER_GENERATED',
      targetStatus: 'PENDING_ESIGN',
      actorId: userId,
      reason: 'Sent for e-signature',
    });
  }

  /**
   * Book the loan after signature (simple version without disbursement details)
   * Note: Backend uses 'ESIGN_COMPLETED' instead of 'SIGNED'
   */
  async bookLoan(applicationId: string, userId: string): Promise<void> {
    await this.initiateBooking(applicationId);
    await this.transitionStatus(applicationId, {
      currentStatus: 'ESIGN_COMPLETED',
      targetStatus: 'PENDING_BOOKING',
      actorId: userId,
      reason: 'Initiating loan booking',
    });
  }

  /**
   * Book the loan with disbursement configuration
   * This is the full booking flow that includes disbursement account selection
   */
  async bookLoanWithDisbursements(
    applicationId: string,
    userId: string,
    disbursements: Array<{
      id: string;
      accountNumber: string;
      accountName: string;
      bankName: string;
      iban?: string;
      bic?: string;
      isExternal: boolean;
      amount: number;
      percentage: number;
    }>
  ): Promise<void> {
    // Initiate the booking with disbursement details - backend handles status transition
    await this.client.post(
      `${this.baseUrl}/applications/${applicationId}/booking/initiate-with-disbursements`,
      {
        userId: userId,
        disbursements: disbursements.map(d => ({
          id: d.id,
          accountNumber: d.accountNumber,
          accountName: d.accountName,
          bankName: d.bankName,
          iban: d.iban,
          bic: d.bic,
          isExternal: d.isExternal,
          amount: d.amount,
          percentage: d.percentage,
        })),
      }
    );
  }

  /**
   * Cancel an application
   */
  async cancelApplication(
    applicationId: string,
    currentStatus: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.transitionStatus(applicationId, {
      currentStatus,
      targetStatus: 'CANCELLED',
      actorId: userId,
      reason,
    });
  }
}

// Export singleton instance
export const lomsService = new LomsService();
