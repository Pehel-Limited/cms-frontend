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
};
