import axios from 'axios';
import config from '@/config';

const API_URL = config.api.baseUrl;

export interface CustomerSignal {
  signalType: string;
  status: string;
  severity: string | null;
  detectedAt: string;
  evidence: Record<string, unknown>;
  detectorVersion: string;
}

export interface ApplicationSnapshot {
  applicationId: string;
  applicationNumber: string;
  status: string;
  daysInCurrentStatus: number | null;
  slaBreached: boolean | null;
  allDocumentsReceived: boolean | null;
  documentsPendingCount: number | null;
  kycCompleted: boolean | null;
  amlCheckCompleted: boolean | null;
}

export interface CustomerIntelligenceState {
  bankId: string;
  customerId: string;
  stateVersion: number;
  asOf: string;
  relationship: {
    customerNumber: string | null;
    customerType: string | null;
    customerStatus: string | null;
    displayName: string | null;
    customerSegment: string | null;
  } | null;
  applications: {
    totalCount: number;
    activeCount: number;
    applications: ApplicationSnapshot[];
  } | null;
  activeSignals: CustomerSignal[];
  warnings: string[];
}

export interface AffectedCustomer {
  customerId: string;
  signalType: string;
  severity: string | null;
  detectedAt: string;
  applicationNumber: string | null;
}

export interface CustomerSignalSummary {
  bankId: string;
  totalActiveSignals: number;
  customersWithActiveSignals: number;
  countsBySignalType: Record<string, number>;
  countsBySeverity: Record<string, number>;
  topAffectedCustomers: AffectedCustomer[];
}

export interface Recommendation {
  id: string;
  customerId: string;
  recommendationType: string;
  lifecycleStatus: string;
  rationale: Record<string, unknown>;
  evidence: Record<string, unknown>;
  modelVersion: string | null;
  createdAt: string;
  presentedAt: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

/**
 * Real, evidence-backed Customer Intelligence Snapshot — AI_roadmap.md
 * §5.2/§6 (Phase 2, AIP-006/AIP-007). Deterministic/rule-based only; a
 * degraded ai-assistant-service returns an empty snapshot with a warning
 * rather than breaking the customer page (handled server-side in bff-admin).
 */
class AiCustomerIntelligenceService {
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

  async getCustomerState(customerId: string, bankId: string): Promise<CustomerIntelligenceState> {
    const response = await axios.get(
      `${API_URL}/api/admin/ai/customers/${customerId}/state`,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  /** Bank-wide rollup of active signals — feeds the RM dashboard (AI_roadmap.md §9.1). */
  async getSignalSummary(bankId: string): Promise<CustomerSignalSummary> {
    const response = await axios.get(
      `${API_URL}/api/admin/ai/customers/signals/summary`,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  /** Proactive Journey Engine recommendations for a customer (AI_roadmap.md §8.5/§20). */
  async getRecommendations(customerId: string, bankId: string): Promise<Recommendation[]> {
    const response = await axios.get(
      `${API_URL}/api/admin/ai/customers/${customerId}/recommendations`,
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  /** RM accepts a recommendation — terminal decision (AI_roadmap.md §20/§21). */
  async acceptRecommendation(recommendationId: string, bankId: string, reason?: string): Promise<Recommendation> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/recommendations/${recommendationId}/accept`,
      reason ? { reason } : {},
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }

  /** RM dismisses a recommendation — terminal decision (AI_roadmap.md §20/§21). */
  async dismissRecommendation(recommendationId: string, bankId: string, reason?: string): Promise<Recommendation> {
    const response = await axios.post(
      `${API_URL}/api/admin/ai/recommendations/${recommendationId}/dismiss`,
      reason ? { reason } : {},
      { params: { bankId }, headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const aiCustomerIntelligenceService = new AiCustomerIntelligenceService();
