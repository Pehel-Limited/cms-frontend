// services/api/solicitorIntegrationService.ts
// Bank-ops service for RM→Solicitor integration bridge
import { ApiClient } from './client';
import type {
  SolicitorSummary,
  SolicitorFirm,
  LegalCaseChecklistItem,
  LegalCaseUndertaking,
  CertificateOfTitle,
  DrawdownEligibility,
  DrawdownRequest,
  DrawdownReadiness,
  CreateSolicitorCaseRequest,
  AssignFirmRequest,
  LegalQueryThread,
} from '@/types/solicitor';

const apiClient = new ApiClient();

export const solicitorIntegrationService = {
  // ── SUMMARY ────────────────────────────────────────────────────────────

  async getSolicitorSummary(applicationId: string): Promise<SolicitorSummary> {
    return apiClient.get<SolicitorSummary>(
      `/api/admin/applications/${applicationId}/solicitor-summary`
    );
  },

  // ── CASE MANAGEMENT ────────────────────────────────────────────────────

  async createSolicitorCase(
    applicationId: string,
    payload: CreateSolicitorCaseRequest
  ): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(
      `/api/admin/applications/${applicationId}/solicitor-case`,
      payload
    );
  },

  async getCaseDetail(applicationId: string, caseId: string): Promise<Record<string, unknown>> {
    return apiClient.get<Record<string, unknown>>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}`
    );
  },

  // ── FIRM ASSIGNMENT ─────────────────────────────────────────────────────

  async assignFirm(
    applicationId: string,
    caseId: string,
    payload: AssignFirmRequest
  ): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/assign-firm`,
      payload
    );
  },

  async sendInstruction(
    applicationId: string,
    caseId: string,
    payload?: { message?: string }
  ): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/send-instruction`,
      payload ?? {}
    );
  },

  // ── CHECKLIST ───────────────────────────────────────────────────────────

  async getChecklist(applicationId: string, caseId: string): Promise<LegalCaseChecklistItem[]> {
    return apiClient.get<LegalCaseChecklistItem[]>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/checklist`
    );
  },

  async seedChecklist(applicationId: string, caseId: string): Promise<LegalCaseChecklistItem[]> {
    return apiClient.post<LegalCaseChecklistItem[]>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/checklist/seed`,
      {}
    );
  },

  async acceptChecklistItem(
    itemId: string,
    caseId: string,
    reason?: string
  ): Promise<LegalCaseChecklistItem> {
    return apiClient.post<LegalCaseChecklistItem>(
      `/api/admin/solicitor-checklist/items/${itemId}/accept`,
      { caseId, reason: reason ?? 'Accepted by Bank Legal' }
    );
  },

  async rejectChecklistItem(
    itemId: string,
    caseId: string,
    note: string
  ): Promise<LegalCaseChecklistItem> {
    return apiClient.post<LegalCaseChecklistItem>(
      `/api/admin/solicitor-checklist/items/${itemId}/reject`,
      { caseId, note }
    );
  },

  async waiveChecklistItem(
    itemId: string,
    caseId: string,
    note: string
  ): Promise<LegalCaseChecklistItem> {
    return apiClient.post<LegalCaseChecklistItem>(
      `/api/admin/solicitor-checklist/items/${itemId}/waive`,
      { caseId, note }
    );
  },

  // ── UNDERTAKING ─────────────────────────────────────────────────────────

  async getUndertaking(applicationId: string, caseId: string): Promise<LegalCaseUndertaking> {
    return apiClient.get<LegalCaseUndertaking>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/undertaking`
    );
  },

  async issueUndertaking(applicationId: string, caseId: string): Promise<LegalCaseUndertaking> {
    return apiClient.post<LegalCaseUndertaking>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/undertaking/issue`,
      {}
    );
  },

  async acceptUndertaking(caseId: string): Promise<LegalCaseUndertaking> {
    return apiClient.post<LegalCaseUndertaking>(
      `/api/admin/solicitor-undertakings/${caseId}/accept`,
      {}
    );
  },

  async rejectUndertaking(caseId: string, reason: string): Promise<LegalCaseUndertaking> {
    return apiClient.post<LegalCaseUndertaking>(
      `/api/admin/solicitor-undertakings/${caseId}/reject`,
      { reason }
    );
  },

  // ── CERTIFICATE OF TITLE ────────────────────────────────────────────────

  async getCertificate(caseId: string): Promise<CertificateOfTitle> {
    return apiClient.get<CertificateOfTitle>(
      `/api/admin/applications/solicitor-case/${caseId}/certificate`
    );
  },

  async acceptCertificate(caseId: string): Promise<CertificateOfTitle> {
    return apiClient.post<CertificateOfTitle>(
      `/api/admin/certificates-of-title/${caseId}/accept`,
      {}
    );
  },

  async rejectCertificate(caseId: string, reason: string): Promise<CertificateOfTitle> {
    return apiClient.post<CertificateOfTitle>(`/api/admin/certificates-of-title/${caseId}/reject`, {
      reason,
    });
  },

  // ── DRAWDOWN ────────────────────────────────────────────────────────────

  async getDrawdownReadiness(applicationId: string): Promise<DrawdownReadiness> {
    return apiClient.get<DrawdownReadiness>(
      `/api/admin/applications/${applicationId}/drawdown-readiness`
    );
  },

  async getDrawdownHistory(applicationId: string, caseId: string): Promise<DrawdownRequest[]> {
    return apiClient.get<DrawdownRequest[]>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/drawdown`
    );
  },

  async acceptDrawdownRequest(caseId: string, drawdownId: string): Promise<DrawdownRequest> {
    return apiClient.post<DrawdownRequest>(
      `/api/admin/solicitor-drawdown-requests/${caseId}/${drawdownId}/accept`,
      {}
    );
  },

  async rejectDrawdownRequest(
    caseId: string,
    drawdownId: string,
    reason: string
  ): Promise<DrawdownRequest> {
    return apiClient.post<DrawdownRequest>(
      `/api/admin/solicitor-drawdown-requests/${caseId}/${drawdownId}/reject`,
      { reason }
    );
  },

  // ── QUERIES ─────────────────────────────────────────────────────────────

  async getQueries(applicationId: string, caseId: string): Promise<LegalQueryThread[]> {
    return apiClient.get<LegalQueryThread[]>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/queries`
    );
  },

  async createQuery(
    applicationId: string,
    caseId: string,
    subject: string,
    message: string
  ): Promise<LegalQueryThread> {
    return apiClient.post<LegalQueryThread>(
      `/api/admin/applications/${applicationId}/solicitor-case/${caseId}/queries`,
      { subject, message }
    );
  },

  // ── FIRMS ────────────────────────────────────────────────────────────────

  async listFirms(): Promise<SolicitorFirm[]> {
    return apiClient.get<SolicitorFirm[]>('/api/admin/solicitor-firms');
  },
};
