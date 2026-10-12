import axios from 'axios';
import config from '@/config';

const API_URL = config.api.baseUrl;

export interface CreditMemoSection {
  title: string;
  content: string;
}

export interface CreditMemo {
  runId: string | null;
  status: string;
  humanReviewRequired: boolean;
  reviewReady: boolean;
  generatedAt: string | null;
  dataFreshness: string | null;
  model: string | null;
  sections: CreditMemoSection[];
  citations: string[];
  unsupportedClaims: string[];
  warnings: string[];
}

class AiCreditMemoService {
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

  async generateCreditMemo(applicationId: string, bankId: string): Promise<CreditMemo> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/applications/${applicationId}/credit-memo`,
      null,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  /** Fetches the last persisted memo without triggering regeneration. */
  async getLatestCreditMemo(applicationId: string, bankId: string): Promise<CreditMemo> {
    const response = await axios.get(
      `${API_URL}/api/admin/ai/applications/${applicationId}/credit-memo`,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const aiCreditMemoService = new AiCreditMemoService();
