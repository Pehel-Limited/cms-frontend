import axios from 'axios';
import config from '@/config';

const API_URL = config.api.baseUrl;

export interface KnowledgeSource {
  id: string;
  bankId: string;
  sourceType: string;
  title: string;
  description?: string;
  jurisdiction?: string;
  classification?: string;
  version?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  status: string;
  storageReference?: string;
  checksum?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionJob {
  id: string;
  bankId: string;
  sourceId: string;
  status: string;
  currentStage?: string;
  pagesProcessed: number;
  chunksCreated: number;
  embeddingsCreated: number;
  errorCount: number;
  errorSummary?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

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

export interface KnowledgeSearchResponse {
  answerStatus: string;
  results: Citation[];
}

export interface RegisterSourceRequest {
  bankId: string;
  sourceType: string;
  title: string;
  description?: string;
  jurisdiction?: string;
  classification?: string;
  version?: string;
}

class AiKnowledgeService {
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

  private getHeaders(contentType: string = 'application/json') {
    const token = this.getAuthToken();
    const userId = this.getUserId();
    return {
      'Content-Type': contentType,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(userId && { 'X-User-Id': userId }),
    };
  }

  async listSources(bankId: string): Promise<KnowledgeSource[]> {
    const response = await axios.get(`${API_URL}/api/admin/ai/knowledge/sources`, {
      params: { bankId },
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getSource(sourceId: string, bankId: string): Promise<KnowledgeSource> {
    const response = await axios.get(`${API_URL}/api/admin/ai/knowledge/sources/${sourceId}`, {
      params: { bankId },
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async registerSource(request: RegisterSourceRequest): Promise<KnowledgeSource> {
    const response = await axios.post(`${API_URL}/api/admin/ai/knowledge/sources`, request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async ingest(sourceId: string, bankId: string, file: File): Promise<IngestionJob> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(
      `${API_URL}/api/admin/ai/knowledge/sources/${sourceId}/ingest`,
      formData,
      {
        params: { bankId },
        headers: this.getHeaders('multipart/form-data'),
      }
    );
    return response.data;
  }

  async activate(sourceId: string, bankId: string): Promise<KnowledgeSource> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/knowledge/sources/${sourceId}/activate`,
      null,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  async archive(sourceId: string, bankId: string): Promise<KnowledgeSource> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/knowledge/sources/${sourceId}/archive`,
      null,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  async getJob(jobId: string, bankId: string): Promise<IngestionJob> {
    const response = await axios.get(`${API_URL}/api/admin/ai/knowledge/jobs/${jobId}`, {
      params: { bankId },
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async search(
    bankId: string,
    queryText: string,
    sourceIds?: string[],
    limit?: number
  ): Promise<KnowledgeSearchResponse> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/knowledge/search`,
      { bankId, queryText, sourceIds, limit },
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const aiKnowledgeService = new AiKnowledgeService();
