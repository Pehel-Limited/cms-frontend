import axios from 'axios';
import config from '@/config';

const API_URL = config.api.baseUrl;

export interface Citation {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceVersion?: string;
  chunkIndex: number;
  headingPath?: string;
  pageFrom?: number;
  pageTo?: number;
  sectionReference?: string;
  snippet: string;
  vectorScore: number;
  textScore: number;
  combinedScore: number;
}

export interface ApplicationSummary {
  runId: string;
  status: string;
  generatedAt: string;
  dataFreshness: string;
  model: string;
  content: string | null;
  citations: Citation[];
  warnings: string[];
  humanReviewRequired: boolean;
}

class AiApplicationService {
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

  async generateSummary(applicationId: string, bankId: string): Promise<ApplicationSummary> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/applications/${applicationId}/summary`,
      null,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  /**
   * Fetches the last persisted summary without triggering regeneration.
   * Status is NOT_GENERATED (content: null) if none has been generated yet.
   */
  async getLatestSummary(applicationId: string, bankId: string): Promise<ApplicationSummary> {
    const response = await axios.get(
      `${API_URL}/api/admin/ai/applications/${applicationId}/summary`,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const aiApplicationService = new AiApplicationService();
