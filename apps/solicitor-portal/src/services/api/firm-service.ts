import { apiClient } from './client';

export const firmService = {
  async getFirms(page = 0, size = 20) {
    return apiClient.get<{
      content: unknown[];
      totalElements: number;
      totalPages: number;
      number: number;
    }>(`/api/solicitor/firms?page=${page}&size=${size}`);
  },

  async getFirm(id: string) {
    return apiClient.get<Record<string, unknown>>(`/api/solicitor/firms/${id}`);
  },

  async createFirm(data: unknown) {
    return apiClient.post<Record<string, unknown>>('/api/solicitor/firms', data);
  },

  async approveFirm(id: string) {
    return apiClient.post<Record<string, unknown>>(`/api/solicitor/firms/${id}/approve`);
  },

  async suspendFirm(id: string, reason: string) {
    return apiClient.post<Record<string, unknown>>(
      `/api/solicitor/firms/${id}/suspend?reason=${encodeURIComponent(reason)}`
    );
  },

  async reactivateFirm(id: string) {
    return apiClient.post<Record<string, unknown>>(`/api/solicitor/firms/${id}/reactivate`);
  },
};
