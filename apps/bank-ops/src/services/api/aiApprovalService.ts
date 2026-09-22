import axios from 'axios';
import config from '@/config';

const API_URL = config.api.baseUrl;

export interface PendingAction {
  actionId: string;
  approvalRequestId: string;
  customerId: string | null;
  toolCode: string;
  riskClass: string;
  actionStatus: string;
  approvalStatus: string;
  payload: string | null;
  createdAt: string;
  decidedAt: string | null;
  executionResult: string | null;
}

/**
 * RM-facing Approval Engine client — AI_roadmap.md §11.3, AIP-005.
 * Every mutating AI action is gated here: request -> approve/reject ->
 * execute-on-approve. No tool executes outside this flow.
 */
class AiApprovalService {
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(config.auth.tokenKey);
    }
    return null;
  }

  private getUserId(): string | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(config.auth.userKey);
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.userId;
      }
    }
    return null;
  }

  private getHeaders() {
    const token = this.getAuthToken();
    const userId = this.getUserId();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(userId && { 'X-User-Id': userId }),
    };
  }

  async listPending(bankId: string): Promise<PendingAction[]> {
    const response = await axios.get(`${API_URL}/api/admin/ai/actions`, {
      params: { bankId },
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async approve(actionId: string, bankId: string, reason?: string): Promise<PendingAction> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/actions/${actionId}/approve`,
      { reason },
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  async reject(actionId: string, bankId: string, reason?: string): Promise<PendingAction> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/actions/${actionId}/reject`,
      { reason },
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const aiApprovalService = new AiApprovalService();
