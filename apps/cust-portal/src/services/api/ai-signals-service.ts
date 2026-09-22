import { apiClient } from './client';

/**
 * Real, evidence-backed customer signals — AI_roadmap.md §5.2/§6 (Phase 2).
 * Talks to bff-customer's /api/customer/ai/signals, which resolves the
 * caller's own customer/bank context from their authenticated session.
 */

export interface CustomerSignal {
  signalType: string;
  status: string;
  severity: string | null;
  detectedAt: string;
  evidence: Record<string, unknown>;
  detectorVersion: string;
}

export interface CustomerSignalsSnapshot {
  bankId: string | null;
  customerId: string | null;
  stateVersion: number;
  asOf: string | null;
  activeSignals: CustomerSignal[];
  warnings: string[];
}

export const aiSignalsService = {
  async getSignals(): Promise<CustomerSignalsSnapshot> {
    return apiClient.get<CustomerSignalsSnapshot>('/api/customer/ai/signals');
  },
};
