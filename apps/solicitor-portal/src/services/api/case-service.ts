import { apiClient } from './client';

export const caseService = {
  async getCases(params?: { page?: number; size?: number; sort?: string }) {
    return apiClient.get<{
      content: unknown[];
      totalElements: number;
      totalPages: number;
      number: number;
    }>('/api/solicitor/cases', params as Record<string, string | number | boolean | undefined>);
  },

  async getCase(id: string) {
    return apiClient.get<Record<string, unknown>>(`/api/solicitor/cases/${id}`);
  },

  async createCase(data: unknown) {
    return apiClient.post<Record<string, unknown>>('/api/solicitor/cases', data);
  },

  async issueCase(id: string, firmId: string, solicitorUserId?: string) {
    const params = new URLSearchParams({ firmId });
    if (solicitorUserId) params.set('solicitorUserId', solicitorUserId);
    return apiClient.post<Record<string, unknown>>(`/api/solicitor/cases/${id}/issue?${params}`);
  },

  async changeStatus(id: string, newStatus: string, reason?: string) {
    const params = new URLSearchParams({ newStatus });
    if (reason) params.set('reason', reason);
    return apiClient.post<Record<string, unknown>>(`/api/solicitor/cases/${id}/status?${params}`);
  },

  // Checklist
  async getChecklist(caseId: string) {
    return apiClient.get<unknown[]>(`/api/solicitor/cases/${caseId}/checklist`);
  },

  async reviewChecklistItem(caseId: string, itemId: string, action: string, reason?: string) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/checklist/${itemId}/review`,
      { action, reason }
    );
  },

  // Documents
  async getDocuments(caseId: string) {
    return apiClient.get<unknown[]>(`/api/solicitor/cases/${caseId}/documents`);
  },

  async reviewDocument(caseId: string, docId: string, action: string, reason?: string) {
    const params = new URLSearchParams({ action });
    if (reason) params.set('reason', reason);
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/documents/${docId}/review?${params}`
    );
  },

  // Undertaking
  async getUndertaking(caseId: string) {
    return apiClient.get<Record<string, unknown>>(`/api/solicitor/cases/${caseId}/undertaking`);
  },

  async issueUndertaking(caseId: string) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/undertaking/issue`
    );
  },

  async submitUndertaking(caseId: string) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/undertaking/submit`
    );
  },

  async reviewUndertaking(caseId: string, action: string, reason?: string) {
    const params = new URLSearchParams({ action });
    if (reason) params.set('reason', reason);
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/undertaking/review?${params}`
    );
  },

  // Certificate of Title
  async getCertificate(caseId: string) {
    return apiClient.get<Record<string, unknown>>(`/api/solicitor/cases/${caseId}/certificate`);
  },

  async submitCertificate(
    caseId: string,
    data: { isQualified: boolean; qualificationDetails?: string; templateVersion: string }
  ) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/certificate/submit`,
      data
    );
  },

  async reviewCertificate(caseId: string, action: string, reason?: string) {
    const params = new URLSearchParams({ action });
    if (reason) params.set('reason', reason);
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/certificate/review?${params}`
    );
  },

  // Queries
  async getQueries(caseId: string, solicitorView = false) {
    return apiClient.get<unknown[]>(
      `/api/solicitor/cases/${caseId}/queries?solicitorView=${solicitorView}`
    );
  },

  async createQuery(
    caseId: string,
    data: { subject: string; queryType: string; messageBody: string; priority?: string }
  ) {
    return apiClient.post<Record<string, unknown>>(`/api/solicitor/cases/${caseId}/queries`, data);
  },

  async replyToQuery(caseId: string, threadId: string, message: string, internalOnly = false) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/queries/${threadId}/reply?message=${encodeURIComponent(message)}&internalOnly=${internalOnly}`
    );
  },

  async closeQuery(caseId: string, threadId: string) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/queries/${threadId}/close`
    );
  },

  // Drawdown
  async checkEligibility(caseId: string) {
    return apiClient.get<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/drawdown/eligibility`
    );
  },

  async getDrawdownHistory(caseId: string) {
    return apiClient.get<unknown[]>(`/api/solicitor/cases/${caseId}/drawdown`);
  },

  async requestDrawdown(caseId: string, data: unknown) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/drawdown/request`,
      data
    );
  },

  async reviewDrawdown(caseId: string, drawdownId: string, action: string, reason?: string) {
    const params = new URLSearchParams({ action });
    if (reason) params.set('reason', reason);
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/cases/${caseId}/drawdown/${drawdownId}/review?${params}`
    );
  },

  // Audit
  async getAudit(caseId: string, page = 0, size = 50) {
    return apiClient.get<{
      content: unknown[];
      totalElements: number;
      totalPages: number;
      number: number;
    }>(`/api/solicitor/cases/${caseId}/audit?page=${page}&size=${size}`);
  },
};
