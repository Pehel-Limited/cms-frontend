// src/services/api/dashboard-service.ts
import { apiClient } from './client';

export interface DashboardKpis {
  inProgressCount: number;
  inProgressValue: number;
  stuckAtRiskCount: number;
  needsActionCount: number;
  approvedThisMonthCount: number;
  approvedThisMonthValue: number;
  bookedThisMonthCount: number;
  bookedThisMonthValue: number;
  declinedThisMonthCount: number;
  conversionRate30d: number;
  bankId: string;
  rmUserId: string;
}

export interface WorklistItem {
  applicationId: string;
  applicationNumber: string;
  status: string;
  productId: string;
  productName: string;
  productCode: string;
  customerId: string;
  customerNumber: string;
  customerName: string;
  customerType: string;
  requestedAmount: number;
  approvedAmount: number;
  daysSinceSubmitted: number;
  daysInCurrentStage: number;
  blockerReason: string;
  nextAction: string;
  slaBreachDays: number | null;
  priorityScore: number;
  documentsSubmittedCount: number;
  documentsRequiredCount: number;
  kycVerified: boolean;
  amlCheckPassed: boolean;
  submittedAt: string;
  approvedAt: string | null;
  updatedAt: string;
  bankId: string;
  rmUserId: string;
  createdByMe: boolean;
}

export interface PipelineStage {
  stage: string;
  applicationCount: number;
  totalValue: number;
  avgDaysInStage: number;
  p90DaysInStage: number;
  kycPendingCount: number;
  amlPendingCount: number;
  docsPendingCount: number;
  creditCheckPendingCount: number;
  bankId: string;
  rmUserId: string;
}

export interface AgingHeatmapCell {
  stage: string;
  ageBucket: string;
  applicationCount: number;
  totalValue: number;
  breachReason: string;
  bankId: string;
  rmUserId: string;
}

export interface MissingItem {
  itemCategory: string;
  applicationCount: number;
  oldestCaseDate: string;
  sampleApplicationNumbers: string[];
  bankId: string;
  rmUserId: string;
}

export interface PerformanceMetrics {
  avgDaysToApproval: number;
  medianDaysToApproval: number;
  avgDaysApprovalToBooked: number;
  postApprovalDropoutRate: number;
  reworkRate: number;
  referralToUnderwritingRate: number;
  declinedCreditRisk: number;
  declinedFraud: number;
  declinedPolicy: number;
  declinedIncomplete: number;
  bankId: string;
  rmUserId: string;
}

// ---- Admin cross-RM oversight ----

export interface RmPortfolio {
  rmUserId: string;
  username: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  customersCount: number;
  inProgressCount: number;
  inProgressValue: number;
  needsActionCount: number;
  stuckAtRiskCount: number;
  approvedThisMonthCount: number;
  approvedThisMonthValue: number;
  bookedThisMonthCount: number;
  bookedThisMonthValue: number;
  declinedThisMonthCount: number;
  conversionRate30d: number;
  bankId: string;
}

export interface AdminOversightSummary {
  bankKpis: DashboardKpis;
  rmPortfolios: RmPortfolio[];
  bankId: string;
}

export interface AdminInsights {
  performance: PerformanceMetrics;
  missingItems: MissingItem[];
  bankId: string;
}

/* One week of the volume/outcome series. Every count is derived from a real
   timestamp on the application (submitted_at / decision_made_at). */
export interface TrendPoint {
  /** ISO date of the Monday that starts the week */
  weekStart: string;
  submittedCount: number;
  submittedValue: number;
  decidedCount: number;
  approvedCount: number;
  declinedCount: number;
}

export const dashboardService = {
  async getKpis(bankId: string): Promise<DashboardKpis> {
    return apiClient.get<DashboardKpis>(`/api/admin/dashboard/kpis?bankId=${bankId}`);
  },

  async getWorklist(bankId: string, status?: string, limit: number = 50): Promise<WorklistItem[]> {
    const params = new URLSearchParams({ bankId, limit: limit.toString() });
    if (status) {
      params.append('status', status);
    }
    return apiClient.get<WorklistItem[]>(`/api/admin/dashboard/worklist?${params.toString()}`);
  },

  async getPipeline(bankId: string): Promise<PipelineStage[]> {
    return apiClient.get<PipelineStage[]>(`/api/admin/dashboard/pipeline?bankId=${bankId}`);
  },

  async getAgingHeatmap(bankId: string): Promise<AgingHeatmapCell[]> {
    return apiClient.get<AgingHeatmapCell[]>(`/api/admin/dashboard/aging-heatmap?bankId=${bankId}`);
  },

  async getMissingItems(bankId: string): Promise<MissingItem[]> {
    return apiClient.get<MissingItem[]>(`/api/admin/dashboard/missing-items?bankId=${bankId}`);
  },

  async getPerformanceMetrics(bankId: string): Promise<PerformanceMetrics> {
    return apiClient.get<PerformanceMetrics>(
      `/api/admin/dashboard/performance-metrics?bankId=${bankId}`
    );
  },

  async getTrends(bankId: string, weeks: number = 12): Promise<TrendPoint[]> {
    return apiClient.get<TrendPoint[]>(
      `/api/admin/dashboard/trends?bankId=${bankId}&weeks=${weeks}`
    );
  },

  // ---- Admin cross-RM oversight (bank-wide) ----

  async getOversightSummary(bankId: string): Promise<AdminOversightSummary> {
    return apiClient.get<AdminOversightSummary>(
      `/api/admin/dashboard/oversight/summary?bankId=${bankId}`
    );
  },

  async getOversightPipeline(bankId: string): Promise<PipelineStage[]> {
    return apiClient.get<PipelineStage[]>(
      `/api/admin/dashboard/oversight/pipeline?bankId=${bankId}`
    );
  },

  async getOversightAgingHeatmap(bankId: string): Promise<AgingHeatmapCell[]> {
    return apiClient.get<AgingHeatmapCell[]>(
      `/api/admin/dashboard/oversight/aging-heatmap?bankId=${bankId}`
    );
  },

  async getOversightInsights(bankId: string): Promise<AdminInsights> {
    return apiClient.get<AdminInsights>(
      `/api/admin/dashboard/oversight/insights?bankId=${bankId}`
    );
  },

  async getOversightWorklist(
    bankId: string,
    rmUserId?: string,
    status?: string,
    limit: number = 50
  ): Promise<WorklistItem[]> {
    const params = new URLSearchParams({ bankId, limit: limit.toString() });
    if (rmUserId) params.append('rmUserId', rmUserId);
    if (status) params.append('status', status);
    return apiClient.get<WorklistItem[]>(
      `/api/admin/dashboard/oversight/worklist?${params.toString()}`
    );
  },

  async getOversightTrends(bankId: string, rmUserId?: string, weeks: number = 12): Promise<TrendPoint[]> {
    const params = new URLSearchParams({ bankId, weeks: weeks.toString() });
    if (rmUserId) params.append('rmUserId', rmUserId);
    return apiClient.get<TrendPoint[]>(
      `/api/admin/dashboard/oversight/trends?${params.toString()}`
    );
  },
};
